# faust2rnaa

Compiles FAUST `.dsp` files into a complete [react-native-audio-api](https://github.com/software-mansion/react-native-audio-api) custom node package with Expo CNG support.

## Prerequisites

- [FAUST](https://faust.grame.fr/) compiler on your PATH
- Node.js

## Usage

```sh
npx faust2rnaa [-n name] [-o output-dir] <file.dsp | dir/ | file1.dsp file2.dsp ...>
```

**Options:**

- `-n name` — Override the name used for package/class naming (default: filename without `.dsp`). **Required** when processing multiple DSP files.
- `-o output-dir` — Output directory (default: `packages/<name>-processor`)

**Examples:**

```sh
# Single DSP — generate packages/reverb-processor/
npx faust2rnaa reverb.dsp

# Single DSP with name override
npx faust2rnaa -n delay dsp/my_delay_effect.dsp

# Directory of DSP files — one package with multiple nodes
npx faust2rnaa -n effects dsp/

# Multiple DSP files explicitly
npx faust2rnaa -n effects dsp/gain.dsp dsp/reverb.dsp
```

## Using a generated package

1. Add it to your app's `package.json`:
   ```json
   "dependencies": {
     "effects-processor": "file:packages/effects-processor"
   }
   ```

2. Register it as an Expo plugin in `app.json`:
   ```json
   "plugins": [
     "react-native-audio-api",
     "effects-processor"
   ]
   ```

3. Import and use:
   ```typescript
   import { GainNode, ReverbNode } from "effects-processor";

   // Create nodes — JSI globals are installed automatically on import
   const gain = new GainNode(context);
   gain.gain = 0.8;

   const reverb = new ReverbNode(context);
   reverb.wetDryMix = 0.5;

   // Connect: source → gain → reverb → destination
   source.connect(gain);
   gain.connect(reverb);
   reverb.connect(context.destination);
   ```

## What it generates

### Single DSP

Given `reverb.dsp` (or `-n reverb`):

| Derived name | Value |
|---|---|
| Package | `reverb-processor` |
| Node class | `ReverbNode` |
| Codegen name | `reverbprocessor` |
| JSI factory | `createReverbNode` |

### Multiple DSPs

Given `-n effects dsp/` containing `gain.dsp` and `reverb.dsp`:

| Derived name | Value |
|---|---|
| Package | `effects-processor` |
| Node classes | `GainNode`, `ReverbNode` |
| Codegen name | `effectsprocessor` |
| JSI factories | `createGainNode`, `createReverbNode` |

Node names are derived from each DSP file's basename. The package name comes from `-n`.

### Output structure

```
effects-processor/
  shared/           # C++ core (per-DSP headers + AudioNode + JSI HostObject per node)
  ios/              # ObjC++ TurboModule bridge
  android/          # Gradle + CMake + Java package
  specs/            # TurboModule TypeScript spec
  src/              # TypeScript exports + typed node wrappers
  package.json
  effects-processor.podspec
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
6. Generates typed TypeScript wrappers from the JSON metadata, with named getter/setter properties for each FAUST parameter

The `-inpl` flag enables in-place computation, allowing `compute()` to use the same buffers for input and output. This matches RNAA's model where `processNode()` modifies the AudioBus in-place.
