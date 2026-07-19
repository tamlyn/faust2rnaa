# faust2rnaa

Compiles FAUST `.dsp` files into a complete [react-native-audio-api](https://github.com/software-mansion/react-native-audio-api) custom node package with Expo CNG support.

## Compatibility

[![RNAA Compatibility](https://github.com/tamlyn/faust2rnaa/actions/workflows/rnaa-compat.yml/badge.svg)](https://github.com/tamlyn/faust2rnaa/actions/workflows/rnaa-compat.yml)

| react-native-audio-api | faust2rnaa                                                 | Status |
|------------------------|------------------------------------------------------------|--------|
| 0.12.x                 | [main](https://github.com/tamlyn/faust2rnaa/tree/main)     | Tested in CI |
| 0.11.x                 | [v0.1.0](https://github.com/tamlyn/faust2rnaa/tree/v0.1.0) | No longer maintained |
| 0.10.x and earlier     | —                                                          | Not compatible |

## Prerequisites

- [FAUST](https://faust.grame.fr/) compiler on your PATH
- Node.js

## Usage

```sh
npx github:tamlyn/faust2rnaa [-n name] [-o output-dir] <file.dsp | dir/ | file1.dsp file2.dsp ...>
```

**Options:**

- `-n name` — Override the name used for package/class naming (default: filename without `.dsp`). **Required** when processing multiple DSP files.
- `-o output-dir` — Output directory (default: `packages/<name>-nodes`)

**Examples:**

```sh
# Single DSP — generate packages/reverb-nodes/
npx github:tamlyn/faust2rnaa reverb.dsp

# Single DSP with name override
npx github:tamlyn/faust2rnaa -n delay dsp/my_delay_effect.dsp

# Directory of DSP files — one package with multiple nodes
npx github:tamlyn/faust2rnaa -n effects dsp/

# Multiple DSP files explicitly
npx github:tamlyn/faust2rnaa -n effects dsp/gain.dsp dsp/reverb.dsp
```

## Using a generated package

1. Add it to your app's `package.json`:
   ```json
   "dependencies": {
     "effects-nodes": "file:packages/effects-nodes"
   }
   ```

2. Register it as an Expo plugin in `app.json`:
   ```json
   "plugins": [
     "react-native-audio-api",
     "effects-nodes"
   ]
   ```

3. Import and use:
   ```typescript
   import { GainNode, ReverbNode } from "effects-nodes";

   // Create nodes — JSI globals are installed automatically on import
   const gain = new GainNode(context);

   const reverb = new ReverbNode(context);

   // Connect: source → gain → reverb → destination
   source.connect(gain);
   gain.connect(reverb);
   reverb.connect(context.destination);
   ```

   Each FAUST control is exposed as a Web Audio [`AudioParam`](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam),
   so values can be set immediately, scheduled over time, or driven by another node:

   ```typescript
   // Set immediately
   gain.gain.value = 0.8;

   // Or schedule changes on the audio timeline
   const now = context.currentTime;
   reverb.wetDryMix.setValueAtTime(0, now);
   reverb.wetDryMix.linearRampToValueAtTime(0.5, now + 2);

   // Or modulate with another node
   lfo.connect(reverb.wetDryMix);
   ```

   Parameters are read once per render quantum (k-rate), which matches how FAUST
   reads its controls, and are clamped to the range the DSP declared.

   FAUST bargraphs are DSP outputs rather than controls, so they are not exposed;
   the generator lists any it skipped.

## What it generates

### Single DSP

Given `reverb.dsp` (or `-n reverb`):

| Derived name | Value |
|---|---|
| Package | `reverb-nodes` |
| Node class | `ReverbNode` |
| Codegen name | `reverbnodes` |
| JSI factory | `createReverbNode` |

### Multiple DSPs

Given `-n effects dsp/` containing `gain.dsp` and `reverb.dsp`:

| Derived name | Value |
|---|---|
| Package | `effects-nodes` |
| Node classes | `GainNode`, `ReverbNode` |
| Codegen name | `effectsnodes` |
| JSI factories | `createGainNode`, `createReverbNode` |

Node names are derived from each DSP file's basename. The package name comes from `-n`.

### Output structure

```
effects-nodes/
  shared/           # C++ core (per-DSP headers + AudioNode + JSI HostObject per node)
  ios/              # ObjC++ TurboModule bridge
  android/          # Gradle + CMake + Java package
  specs/            # TurboModule TypeScript spec
  src/              # TypeScript exports + typed node wrappers
  package.json
  effects-nodes.podspec
  react-native.config.js
  app.plugin.js     # Expo CNG plugin for Android build ordering
```

Each DSP generates its own self-contained C++ header (e.g. `GainDsp.h`, `ReverbDsp.h`) with all FAUST headers inlined, so the package has no FAUST compile-time dependencies.


## How it works

1. Runs `faust -json` on each DSP to extract parameter metadata (names, ranges, defaults)
2. Runs `faust -i -inpl -a rnaa.arch -cn <DspClass>` to compile each DSP into a self-contained C++ header
3. Copies per-package template files from `templates/`, replacing `__PLACEHOLDER__` tokens with derived names
4. Copies per-node template files once per DSP, generating the AudioNode and JSI HostObject C++ classes
5. Generates aggregate files: `ProcessorInstaller.cpp` (registers all JSI factory functions) and `src/index.ts` (exports all node classes)
6. Generates typed TypeScript wrappers from the JSON metadata, exposing each FAUST control as a named `AudioParam`

The `-inpl` flag enables in-place computation, allowing `compute()` to use the same buffers for input and output. This matches RNAA's model where `processNode()` modifies the `DSPAudioBuffer` in-place.

## Development

```sh
npm test
```

The tests generate packages from the DSP files in `test/fixtures/` and assert on
the output. The `FaustParamCapture` tests go further and compile the generated
C++ against the system compiler, since that class needs no react-native-audio-api
headers. Tests that need `faust` or a C++ compiler skip when they are absent.
