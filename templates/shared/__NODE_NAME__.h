#pragma once

#include "__DSP_CLASS__.h"
#include <audioapi/core/AudioNode.h>
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

  void setParam(const std::string &name, double value);
  double getParam(const std::string &name);
  int getParamCount();
  std::string getParamAddress(int index);

  static audioapi::AudioNodeOptions defaultOptions();

 protected:
  std::shared_ptr<audioapi::DSPAudioBuffer> processNode(
      const std::shared_ptr<audioapi::DSPAudioBuffer> &buffer,
      int framesToProcess) override;

 private:
  std::unique_ptr<__DSP_CLASS__> fDsp;
  MapUI fUI;
  std::vector<float> fSilenceBuffer;
};

} // namespace __NAMESPACE__
