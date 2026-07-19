import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { cleanUp, fixture, generate, HAS_CXX, HAS_FAUST } from "./helpers.mjs";

// FaustParamCapture is what decides which FAUST controls become AudioParams,
// and it depends on FAUST internals the generator does not control. It needs
// no react-native-audio-api headers, so it can be compiled and run directly.
describe(
  "FaustParamCapture",
  {
    skip: !HAS_FAUST
      ? "faust not on PATH"
      : !HAS_CXX
        ? "no C++ compiler on PATH"
        : false,
  },
  () => {
    let pkg;
    let captured;

    function compile(source, name) {
      const path = join(pkg.outputDir, `${name}.cpp`);
      writeFileSync(path, source);
      const binary = join(pkg.outputDir, name);
      execFileSync("c++", ["-std=c++17", "-o", binary, path], { stdio: "pipe" });
      return binary;
    }

    before(() => {
      pkg = generate([fixture("test_widgets")]);

      const probe = compile(
        `#include "shared/TestWidgetsDsp.h"
#include "shared/FaustParamCapture.h"
#include <cstdio>

int main() {
  TestWidgetsDsp dsp;
  dsp.init(48000);
  testwidgetsnodes::FaustParamCapture ui;
  dsp.buildUserInterface(&ui);
  for (const auto &p : ui.params) {
    printf("%s\\t%g\\t%g\\t%g\\t%d\\n", p.address.c_str(), (double)p.init,
           (double)p.min, (double)p.max, p.zone != nullptr);
  }
  return 0;
}
`,
        "probe"
      );

      captured = execFileSync(probe, { encoding: "utf-8" })
        .trim()
        .split("\n")
        .map((line) => {
          const [address, init, min, max, hasZone] = line.split("\t");
          return {
            address,
            init: Number(init),
            min: Number(min),
            max: Number(max),
            hasZone: hasZone === "1",
          };
        });
    });

    after(cleanUp);

    it("records every input control", () => {
      assert.deepEqual(
        captured.map((p) => p.address).sort(),
        [
          "/test_widgets/bypass",
          "/test_widgets/depth",
          "/test_widgets/gain",
          "/test_widgets/go!",
          "/test_widgets/mode",
        ]
      );
    });

    // A bargraph the capture skipped but the generator emitted an accessor for
    // would leave that accessor pointing at a parameter that does not exist.
    it("skips bargraphs", () => {
      assert.ok(!captured.some((p) => p.address.endsWith("/level")));
    });

    it("records the range FAUST declared", () => {
      const gain = captured.find((p) => p.address.endsWith("/gain"));
      assert.deepEqual(
        { init: gain.init, min: gain.min, max: gain.max },
        { init: 0.5, min: 0, max: 1 }
      );

      const mode = captured.find((p) => p.address.endsWith("/mode"));
      assert.deepEqual(
        { init: mode.init, min: mode.min, max: mode.max },
        { init: 1, min: 0, max: 4 }
      );
    });

    // FAUST declares no range for gates, so the capture supplies 0..1. The
    // generator documents the same range, and the two must not drift apart.
    it("gives buttons and check buttons a 0..1 range", () => {
      for (const address of ["/test_widgets/go!", "/test_widgets/bypass"]) {
        const gate = captured.find((p) => p.address === address);
        assert.deepEqual(
          { init: gate.init, min: gate.min, max: gate.max },
          { init: 0, min: 0, max: 1 }
        );
      }
    });

    it("points every parameter at a live zone", () => {
      assert.ok(captured.every((p) => p.hasZone));
    });

    // The header uses FAUST's UI and PathBuilder definitions, which are inlined
    // into the generated DSP header rather than shipped separately.
    it("fails with a clear error if included before the DSP header", () => {
      assert.throws(
        () => compile(`#include "shared/FaustParamCapture.h"\n`, "standalone"),
        (error) =>
          /Include the generated FAUST DSP header before FaustParamCapture\.h/.test(
            error.stderr.toString()
          )
      );
    });
  }
);
