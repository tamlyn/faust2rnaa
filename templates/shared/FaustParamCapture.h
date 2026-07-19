#pragma once

// Captures every settable FAUST control (full address, range and live zone
// pointer) as the DSP builds its UI, so each can be driven by an
// audioapi::AudioParam.
//
// This header relies on the FAUST UI/PathBuilder definitions and the
// FAUSTFLOAT typedef, which are inlined into the generated DSP header rather
// than shipped separately, so that header must be included first.
#ifndef FAUSTFLOAT
#error "Include the generated FAUST DSP header before FaustParamCapture.h"
#endif

#include <string>
#include <vector>

namespace __NAMESPACE__ {

struct FaustParam {
  std::string address;
  FAUSTFLOAT *zone;
  FAUSTFLOAT init;
  FAUSTFLOAT min;
  FAUSTFLOAT max;
};

// PathBuilder supplies the same hierarchical address FAUST reports in its JSON
// metadata, so addresses recorded here match the ones the generator bakes into
// the TypeScript wrapper.
class FaustParamCapture : public UI, public PathBuilder {
 public:
  std::vector<FaustParam> params;

  void openTabBox(const char *label) override { pushLabel(label); }
  void openHorizontalBox(const char *label) override { pushLabel(label); }
  void openVerticalBox(const char *label) override { pushLabel(label); }
  void closeBox() override { popLabel(); }

  // FAUST declares no range for buttons or check buttons; both are gates the
  // DSP reads as 0 or 1.
  void addButton(const char *label, FAUSTFLOAT *zone) override {
    record(label, zone, 0, 0, 1);
  }

  void addCheckButton(const char *label, FAUSTFLOAT *zone) override {
    record(label, zone, 0, 0, 1);
  }

  void addVerticalSlider(const char *label, FAUSTFLOAT *zone, FAUSTFLOAT init,
                         FAUSTFLOAT min, FAUSTFLOAT max,
                         FAUSTFLOAT step) override {
    record(label, zone, init, min, max);
  }

  void addHorizontalSlider(const char *label, FAUSTFLOAT *zone, FAUSTFLOAT init,
                           FAUSTFLOAT min, FAUSTFLOAT max,
                           FAUSTFLOAT step) override {
    record(label, zone, init, min, max);
  }

  void addNumEntry(const char *label, FAUSTFLOAT *zone, FAUSTFLOAT init,
                   FAUSTFLOAT min, FAUSTFLOAT max, FAUSTFLOAT step) override {
    record(label, zone, init, min, max);
  }

  // Bargraphs are written by the DSP rather than read by it, so they cannot be
  // driven by an AudioParam. The generator omits them from the JS API to match.
  void addHorizontalBargraph(const char *label, FAUSTFLOAT *zone,
                             FAUSTFLOAT min, FAUSTFLOAT max) override {}
  void addVerticalBargraph(const char *label, FAUSTFLOAT *zone, FAUSTFLOAT min,
                           FAUSTFLOAT max) override {}

  void addSoundfile(const char *label, const char *filename,
                    Soundfile **sf_zone) override {}

 private:
  void record(const char *label, FAUSTFLOAT *zone, FAUSTFLOAT init,
              FAUSTFLOAT min, FAUSTFLOAT max) {
    params.push_back({buildPath(label), zone, init, min, max});
  }
};

} // namespace __NAMESPACE__
