#!/usr/bin/env node

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const TOOLS_DIR = dirname(new URL(import.meta.url).pathname);
const TEMPLATES_DIR = join(TOOLS_DIR, "templates");
const ARCH_FILE = join(TOOLS_DIR, "rnaa.arch");

// --- Argument parsing ---

function usage() {
  console.error(
    "Usage: faust2rnaa [-n name] [-o output-dir] <file.dsp | dir/ | file1.dsp file2.dsp ...>"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const dspInputs = [];
let nameOverride = null;
let outputDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "-n" && i + 1 < args.length) {
    nameOverride = args[++i];
  } else if (args[i] === "-o" && i + 1 < args.length) {
    outputDir = args[++i];
  } else if (args[i].startsWith("-")) {
    console.error(`Unknown option: ${args[i]}`);
    usage();
  } else {
    dspInputs.push(args[i]);
  }
}

if (dspInputs.length === 0) usage();

// Resolve inputs: expand directories to their .dsp files
const dspFiles = [];
for (const input of dspInputs) {
  const inputPath = resolve(input);
  if (!existsSync(inputPath)) {
    console.error(`Not found: ${inputPath}`);
    process.exit(1);
  }
  if (statSync(inputPath).isDirectory()) {
    const found = readdirSync(inputPath)
      .filter((f) => f.endsWith(".dsp"))
      .sort()
      .map((f) => ({
        dspPath: join(inputPath, f),
        dspBaseName: basename(f, ".dsp"),
      }));
    if (found.length === 0) {
      console.error(`No .dsp files found in ${inputPath}`);
      process.exit(1);
    }
    dspFiles.push(...found);
  } else {
    dspFiles.push({
      dspPath: inputPath,
      dspBaseName: basename(input, ".dsp"),
    });
  }
}

const isSingleDsp = dspFiles.length === 1;

if (!isSingleDsp && !nameOverride) {
  console.error("Error: -n is required when processing multiple DSP files");
  usage();
}

// --- Name helpers ---

function toKebab(name) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function kebabToCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function kebabToPascal(s) {
  const camel = kebabToCamel(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

// --- Package-level name derivation ---

const dspName = nameOverride || dspFiles[0].dspBaseName;
const kebab = toKebab(dspName);
const packageName = kebab.endsWith("-processor") ? kebab : `${kebab}-processor`;
const pascalName = kebabToPascal(kebab);
const codegenName = packageName.replace(/-/g, "");
const namespace = codegenName;

if (!outputDir) {
  outputDir = `packages/${packageName}`;
}
outputDir = resolve(outputDir);

// --- Per-node name derivation ---

const nodes = dspFiles.map(({ dspPath, dspBaseName }) => {
  // Single DSP: node name from -n (if provided) or DSP basename (backward compat)
  // Multi DSP: node name always from DSP basename
  const nameSource = isSingleDsp ? dspName : dspBaseName;
  const nodeKebab = toKebab(nameSource);
  const nodePascal = kebabToPascal(nodeKebab);
  const nodeName = `${nodePascal}Node`;
  const dspClass = `${nodePascal}Dsp`;
  const jsiFactory = `create${nodeName}`;
  return { dspPath, dspBaseName, nodePascal, nodeName, dspClass, jsiFactory, params: null };
});

// Check for duplicate node names
const nodeNames = nodes.map((n) => n.nodeName);
const dupes = [...new Set(nodeNames.filter((name, i) => nodeNames.indexOf(name) !== i))];
if (dupes.length > 0) {
  console.error(`Error: duplicate node names: ${dupes.join(", ")}`);
  process.exit(1);
}

console.log(`Package:      ${packageName}`);
console.log(`Codegen name: ${codegenName}`);
console.log(`Namespace:    ${namespace}`);
console.log(`Output:       ${outputDir}`);
console.log(`Nodes:        ${nodes.map((n) => n.nodeName).join(", ")}`);

// --- Placeholder substitution ---

function applyReplacements(content, replacements) {
  let result = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

const packageReplacements = {
  __PACKAGE_NAME__: packageName,
  __CODEGEN_NAME__: codegenName,
  __NAMESPACE__: namespace,
  __PASCAL_NAME__: pascalName,
};

// --- Extract parameters from FAUST JSON ---

function extractParams(ui) {
  const params = [];
  for (const item of ui) {
    if (item.items) {
      params.push(...extractParams(item.items));
    } else if (item.address) {
      params.push({
        label: item.label,
        shortname: item.shortname || item.label,
        address: item.address,
        type: item.type,
        init: item.init,
        min: item.min,
        max: item.max,
        step: item.step,
      });
    }
  }
  return params;
}

// --- Run FAUST for each node ---

const sharedDir = join(outputDir, "shared");
mkdirSync(sharedDir, { recursive: true });

for (const node of nodes) {
  const jsonFile = `${node.dspPath}.json`;
  execSync(`faust -json "${node.dspPath}"`, { stdio: "pipe" });
  if (!existsSync(jsonFile)) {
    console.error(`Expected JSON output at ${jsonFile}`);
    process.exit(1);
  }
  const faustJson = JSON.parse(readFileSync(jsonFile, "utf-8"));
  rmSync(jsonFile);

  node.params = extractParams(faustJson.ui);

  console.log(`\n${node.nodeName}:`);
  console.log(`  DSP class:   ${node.dspClass}`);
  console.log(`  JSI factory: ${node.jsiFactory}`);
  console.log(
    `  Parameters:  ${node.params.map((p) => p.shortname).join(", ") || "(none)"}`
  );

  const dspHeaderPath = join(sharedDir, `${node.dspClass}.h`);
  execSync(
    `faust -i -inpl -a "${ARCH_FILE}" -cn ${node.dspClass} "${node.dspPath}" -o "${dspHeaderPath}"`,
    { stdio: "pipe" }
  );
  console.log(
    `  Generated ${node.dspClass}.h (${readFileSync(dspHeaderPath, "utf-8").split("\n").length} lines)`
  );
}

// --- Copy per-package templates ---

// Per-node template files are handled separately in a loop over nodes
const PER_NODE_TEMPLATES = new Set([
  "shared/__NODE_NAME__.h",
  "shared/__NODE_NAME__.cpp",
  "shared/__NODE_NAME__HostObject.h",
  "shared/__NODE_NAME__HostObject.cpp",
]);

function processTemplateDir(srcDir, destDir, relPath = "") {
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const destName = applyReplacements(entry.name, packageReplacements);
      const destSubDir = join(destDir, destName);
      mkdirSync(destSubDir, { recursive: true });
      processTemplateDir(srcPath, destSubDir, entryRelPath);
    } else {
      if (PER_NODE_TEMPLATES.has(entryRelPath)) continue;

      const content = readFileSync(srcPath, "utf-8");
      const destName = applyReplacements(entry.name, packageReplacements);
      const destPath = join(destDir, destName);
      writeFileSync(destPath, applyReplacements(content, packageReplacements));
    }
  }
}

mkdirSync(outputDir, { recursive: true });
processTemplateDir(TEMPLATES_DIR, outputDir);

// --- Copy per-node templates for each node ---

for (const node of nodes) {
  const nodeReplacements = {
    ...packageReplacements,
    __NODE_NAME__: node.nodeName,
    __JSI_FACTORY__: node.jsiFactory,
    __DSP_CLASS__: node.dspClass,
    __DSP_NAME__: node.dspBaseName,
  };

  for (const templateRel of PER_NODE_TEMPLATES) {
    const srcPath = join(TEMPLATES_DIR, templateRel);
    const content = readFileSync(srcPath, "utf-8");
    const destRel = applyReplacements(templateRel, nodeReplacements);
    const destPath = join(outputDir, destRel);
    writeFileSync(destPath, applyReplacements(content, nodeReplacements));
  }
}

// --- Generate ProcessorInstaller.cpp ---

function generateProcessorInstallerCpp() {
  const includes = nodes
    .map(
      (n) => `#include "${n.nodeName}.h"\n#include "${n.nodeName}HostObject.h"`
    )
    .join("\n");

  const factories = nodes
    .map(
      (n) => `
  {
    auto installer = facebook::jsi::Function::createFromHostFunction(
        runtime,
        facebook::jsi::PropNameID::forAscii(runtime, "${n.jsiFactory}"),
        0,
        [](facebook::jsi::Runtime &runtime, const facebook::jsi::Value &thisVal,
           const facebook::jsi::Value *args, size_t count) {
          auto object = args[0].getObject(runtime);
          auto context =
              object.getHostObject<audioapi::BaseAudioContextHostObject>(
                  runtime);
          if (context != nullptr) {
            auto node =
                std::make_shared<${namespace}::${n.nodeName}>(context->context_);
            auto nodeHostObject =
                std::make_shared<${namespace}::${n.nodeName}HostObject>(node);
            return facebook::jsi::Object::createFromHostObject(
                runtime, nodeHostObject);
          }
          return facebook::jsi::Object::createFromHostObject(runtime, nullptr);
        });

    runtime.global().setProperty(runtime, "${n.jsiFactory}", installer);
  }`
    )
    .join("\n");

  return `#include "ProcessorInstaller.h"
${includes}

#include <audioapi/HostObjects/BaseAudioContextHostObject.h>

namespace ${namespace} {

void InstallCustomProcessor(facebook::jsi::Runtime &runtime) {${factories}
}

} // namespace ${namespace}
`;
}

writeFileSync(
  join(sharedDir, "ProcessorInstaller.cpp"),
  generateProcessorInstallerCpp()
);

// --- Generate src/index.ts ---

function generateIndexTs() {
  const lines = [
    'import NativeAudioProcessingModule from "./NativeAudioProcessingModule";',
    "",
    "NativeAudioProcessingModule.injectCustomProcessorInstaller();",
    "",
  ];
  for (const node of nodes) {
    lines.push(`export { ${node.nodeName} } from "./${node.nodeName}";`);
    lines.push(`export type { I${node.nodeName} } from "./${node.nodeName}";`);
  }
  return lines.join("\n") + "\n";
}

const srcDir = join(outputDir, "src");
writeFileSync(join(srcDir, "index.ts"), generateIndexTs());

// --- Generate TypeScript node wrappers ---

function paramToPropertyName(param) {
  return param.shortname
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}

function generateNodeTs(node) {
  const { nodeName, jsiFactory, params } = node;

  const interfaceProps = params
    .map((p) => {
      const prop = paramToPropertyName(p);
      const jsdoc = `  /** ${p.type} — min: ${p.min}, max: ${p.max}, default: ${p.init}, step: ${p.step} */`;
      return `${jsdoc}\n  ${prop}: number;`;
    })
    .join("\n");

  const gettersSetters = params
    .map((p) => {
      const prop = paramToPropertyName(p);
      return `
  public get ${prop}(): number {
    return (this.node as I${nodeName}).getParam("${p.address}");
  }

  public set ${prop}(value: number) {
    (this.node as I${nodeName}).setParam("${p.address}", value);
  }`;
    })
    .join("\n");

  return `import { AudioNode, BaseAudioContext } from "react-native-audio-api";
import {
  IAudioNode,
  IBaseAudioContext,
} from "react-native-audio-api/lib/typescript/interfaces";

export interface I${nodeName} extends IAudioNode {
  setParam(name: string, value: number): void;
  getParam(name: string): number;
  getParamCount(): number;
  getParamAddress(index: number): string;
${interfaceProps}
}

export class ${nodeName} extends AudioNode {
  constructor(context: BaseAudioContext) {
    super(context, ${jsiFactory}(context.context));
  }
${gettersSetters}
}

declare global {
  var ${jsiFactory}: (context: IBaseAudioContext) => I${nodeName};
}
`;
}

for (const node of nodes) {
  writeFileSync(join(srcDir, `${node.nodeName}.ts`), generateNodeTs(node));
}

// --- Summary ---

console.log("");
console.log(`Generated ${packageName} at ${outputDir}`);
console.log("Files:");

function listFiles(dir, prefix = "") {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const entry of entries) {
    if (entry.isDirectory()) {
      console.log(`  ${prefix}${entry.name}/`);
      listFiles(join(dir, entry.name), prefix + "  ");
    } else {
      console.log(`  ${prefix}${entry.name}`);
    }
  }
}

listFiles(outputDir);
