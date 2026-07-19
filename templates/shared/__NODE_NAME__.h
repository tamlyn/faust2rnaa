#pragma once

#include "__DSP_CLASS__.h"
#include "FaustParamCapture.h"
#include <audioapi/core/AudioNode.h>
#include <audioapi/core/AudioParam.h>
#include <audioapi/types/NodeOptions.h>
#include <audioapi/utils/AudioBuffer.hpp>
#include <memory>
#include <string>
#include <vector>

namespace audioapi {
class BaseAudioContext;
}

namespace __NAMESPACE__ {

class __NODE_NAME__ : public audioapi::AudioNode {
 public:
  explicit __NODE_NAME__(
      const std::shared_ptr<audioapi::BaseAudioContext> &context);

  // The AudioParam backing a FAUST control, looked up by its full address.
  // Returns nullptr for an unknown address.
  std::shared_ptr<audioapi::AudioParam> getAudioParam(const std::string &name);

  static audioapi::AudioNodeOptions defaultOptions();

 protected:
  std::shared_ptr<audioapi::DSPAudioBuffer> processNode(
      const std::shared_ptr<audioapi::DSPAudioBuffer> &buffer,
      int framesToProcess) override;

 private:
  std::unique_ptr<__DSP_CLASS__> fDsp;
  FaustParamCapture fUI;
  // One AudioParam per captured FAUST control, parallel to fUI.params.
  std::vector<std::shared_ptr<audioapi::AudioParam>> fAudioParams;
  std::vector<float> fSilenceBuffer;
};

} // namespace __NAMESPACE__
