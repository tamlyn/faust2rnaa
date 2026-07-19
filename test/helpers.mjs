import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

export const FIXTURES_DIR = join(TEST_DIR, "fixtures");
export const CLI = join(TEST_DIR, "..", "faust2rnaa.mjs");

export function fixture(name) {
  return join(FIXTURES_DIR, `${name}.dsp`);
}

function isOnPath(command) {
  try {
    execFileSync("which", [command], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// The generator shells out to FAUST, and the C++ tests need a compiler. Both
// are developer-machine prerequisites rather than npm dependencies, so tests
// that need them skip rather than fail when they are absent.
export const HAS_FAUST = isOnPath("faust");
export const HAS_CXX = isOnPath("c++");

const tempDirs = [];

/** Run the CLI over `dspFiles`, returning the output directory and its stdout. */
export function generate(dspFiles, extraArgs = []) {
  const outputDir = mkdtempSync(join(tmpdir(), "faust2rnaa-test-"));
  tempDirs.push(outputDir);
  const stdout = execFileSync(
    process.execPath,
    [CLI, "-o", outputDir, ...extraArgs, ...dspFiles],
    { encoding: "utf-8" }
  );
  return {
    outputDir,
    stdout,
    read: (relPath) => readFileSync(join(outputDir, relPath), "utf-8"),
  };
}

export function cleanUp() {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
}
