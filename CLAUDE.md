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

There is no build step, test suite, or linter configured. The tool is a single ESM file (`faust2rnaa.mjs`) with zero npm dependencies.

## Architecture

### Code generation pipeline

1. **FAUST JSON extraction** — `faust -json` extracts parameter metadata (names, ranges, defaults) from each DSP
2. **FAUST C++ compilation** — `faust -i -inpl -a rnaa.arch` compiles each DSP into a self-contained C++ header (all FAUST headers inlined, no compile-time FAUST dependency in output)
3. **Per-package template expansion** — copies `templates/` to output, replacing `__PLACEHOLDER__` tokens with derived names
4. **Per-node template expansion** — for each DSP, copies the node-specific C++ templates (`__NODE_NAME__.h/cpp`, `__NODE_NAME__HostObject.h/cpp`)
5. **Aggregate file generation** — generates `ProcessorInstaller.cpp` (JSI factory registry) and `src/index.ts` (barrel export)
6. **TypeScript wrapper generation** — creates typed node classes with getter/setter properties from FAUST parameter metadata

### Name derivation system

All names derive from the input DSP filename (or `-n` override) through a chain of conversions. For `my_delay.dsp`:

- kebab: `my-delay` → packageName: `my-delay-processor`
- pascal: `MyDelay` → nodeName: `MyDelayNode`, dspClass: `MyDelayDsp`
- codegen: `mydelayprocessor` (Java package, CMake target, C++ namespace)
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

- **In-place computation** (`-inpl` flag): FAUST `compute()` modifies buffers in-place, matching RNAA's AudioBus model
- **Self-contained headers** (`-i` flag): each DSP compiles to one header with all FAUST deps inlined — generated packages have no FAUST compile-time dependency
- **String replacement over template engine**: simple `replaceAll` with zero dependencies
- **Synchronous fs operations**: deliberate choice for CLI tool simplicity

### Key file

`faust2rnaa.mjs` — the entire tool in a single ~435-line file. Contains argument parsing, name derivation, FAUST invocation, template processing, and TypeScript/C++ code generation.

`rnaa.arch` — custom FAUST architecture file that shapes the C++ output to work with RNAA's AudioNode model.
