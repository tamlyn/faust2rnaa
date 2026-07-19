# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

faust2rnaa is a Node.js CLI code generator that compiles FAUST `.dsp` files into complete [react-native-audio-api](https://github.com/software-mansion/react-native-audio-api) custom processor npm packages with Expo CNG support. It bridges FAUST DSP authoring with cross-platform React Native audio apps.

## Prerequisites

- FAUST compiler on PATH
- Node.js (ESM)

## Running

```sh
npx faust2rnaa [-n name] [-o output-dir] <file.dsp | dir/ | file1.dsp file2.dsp ...>
```

There is no build step or linter configured. The tool is a single ESM file (`faust2rnaa.mjs`) with zero npm dependencies.

## Testing

```sh
npm test
```

`node --test` over `test/*.test.mjs`, no test framework. `test/generator.test.mjs` runs the CLI on `test/fixtures/` and asserts on the generated files. `test/param-capture.test.mjs` additionally compiles and runs the generated C++ — `FaustParamCapture` depends only on FAUST's inlined headers, so it can be exercised for real without react-native-audio-api. Both suites skip when `faust` or a C++ compiler is missing.

## Architecture

### Code generation pipeline

1. **FAUST JSON extraction** — `faust -json` extracts parameter metadata (names, ranges, defaults) from each DSP
2. **FAUST C++ compilation** — `faust -i -inpl -a rnaa.arch` compiles each DSP into a self-contained C++ header (all FAUST headers inlined, no compile-time FAUST dependency in output)

   Both invocations run against a copy of the DSP in a temp directory, with `-I` pointing back at the original, because `faust -json` writes `<input>.json` beside its input whatever `-o` says. Running it in place would litter the user's source tree and make two concurrent runs on one DSP clobber each other.

3. **Per-package template expansion** — copies `templates/` to output, replacing `__PLACEHOLDER__` tokens with derived names
4. **Per-node template expansion** — for each DSP, copies the node-specific C++ templates (`__NODE_NAME__.h/cpp`, `__NODE_NAME__HostObject.h/cpp`)
5. **Aggregate file generation** — generates `ProcessorInstaller.cpp` (JSI factory registry) and `src/index.ts` (barrel export)
6. **TypeScript wrapper generation** — creates typed node classes exposing each FAUST control as a Web Audio `AudioParam`, so callers can set `.value`, schedule with `setValueAtTime`/ramps, or `connect()` another node to it

### Name derivation system

All names derive from the input DSP filename (or `-n` override) through a chain of conversions. For `my_delay.dsp`:

- kebab: `my-delay` → packageName: `my-delay-nodes`
- pascal: `MyDelay` → nodeName: `MyDelayNode`, dspClass: `MyDelayDsp`
- codegen: `mydelaynodes` (Java package, CMake target, C++ namespace)
- jsiFactory: `createMyDelayNode`

The helpers `toKebab()`, `kebabToCamel()`, `kebabToPascal()` handle all case conversions.

### Template system

Templates live in `templates/` and mirror the output package structure. Placeholder tokens:

- Package-level: `__PACKAGE_NAME__`, `__CODEGEN_NAME__`, `__NAMESPACE__`, `__PASCAL_NAME__`
- Node-level: `__NODE_NAME__`, `__JSI_FACTORY__`, `__DSP_CLASS__`, `__DSP_NAME__`

Per-node templates (listed in `PER_NODE_TEMPLATES` set) are processed once per DSP file. Everything else is processed once per package.

### Generated package structure

Each generated package is a self-contained React Native TurboModule:

- `shared/` — C++ core: FAUST DSP headers, AudioNode subclasses, JSI HostObjects, ProcessorInstaller, TurboModule impl
- `ios/` — ObjC++ TurboModule bridge
- `android/` — Java package + CMake + Gradle
- `specs/` — TurboModule TypeScript spec
- `src/` — TypeScript exports and typed node wrappers

### Key design decisions

- **In-place computation** (`-inpl` flag): FAUST `compute()` modifies buffers in-place, matching RNAA's `DSPAudioBuffer` model
- **Self-contained headers** (`-i` flag): each DSP compiles to one header with all FAUST deps inlined — generated packages have no FAUST compile-time dependency
- **String replacement over template engine**: simple `replaceAll` with zero dependencies
- **Synchronous fs operations**: deliberate choice for CLI tool simplicity
- **Parameters as `AudioParam`s** (k-rate): each FAUST control is backed by an `audioapi::AudioParam`. `shared/FaustParamCapture.h` (a `UI` + `PathBuilder` subclass) records each control's address, range, and live zone pointer during `buildUserInterface`; `processNode` samples every param once per render quantum via `processKRateParam` and writes it into the zone before `compute()`. This gives Web Audio timeline scheduling (`setValueAtTime`, ramps) and node modulation (`lfo.connect(node.cutoff)`) for free. K-rate (one value per block) matches FAUST's control-read model; sample-accurate a-rate would need sub-block chunking or signal-input params.

  Three details are load-bearing:

  - The zone write is **clamped** to the control's declared range. Neither automation nor modulation from a connected node is bounded, but FAUST compiles the DSP assuming its controls stay in range, so an out-of-range value can produce Inf/NaN that sticks in the DSP's recursive state.
  - The TypeScript wrapper hands out RNAA's **`AudioParam` class**, not the raw `IAudioParam` host object. `AudioNode.connect` compares `destination.context` and tests `instanceof AudioParam`, so an unwrapped param can never be a connect() target.
  - **Bargraphs are excluded** on both sides — the capture ignores them and the generator omits their accessors — because they are DSP outputs, not controls. The two must stay in step, or an accessor points at a parameter that does not exist.

- **No scalar parameter API**: `setParam`/`getParam`/`getParamCount`/`getParamAddress` were removed in 0.3.0. They duplicated the `AudioParam` API with divergent semantics (silent no-op on an unknown address, a different parameter ordering, and a value that ignored connected modulation).

### Key file

`faust2rnaa.mjs` — the entire tool in a single ~450-line file. Contains argument parsing, name derivation, FAUST invocation, template processing, and TypeScript/C++ code generation.

`rnaa.arch` — custom FAUST architecture file that shapes the C++ output to work with RNAA's AudioNode model.
