#pragma once

#include "__DSP_CLASS__.h"
#include <audioapi/core/AudioNode.h>
#include <memory>
#include <string>
#include <vector>

namespace audioapi {
class BaseAudioContext;
class AudioBus;
}

namespace __NAMESPACE__ {

class __NODE_NAME__ : public audioapi::AudioNode {
 public:
  explicit __NODE_NAME__(std::shared_ptr<audioapi::BaseAudioContext> context);

  void setParam(const std::string &name, double value);
  double getParam(const std::string &name);
  int getParamCount();
  std::string getParamAddress(int index);

 protected:
  std::shared_ptr<audioapi::AudioBus> processNode(
      const std::shared_ptr<audioapi::AudioBus> &bus,
      int framesToProcess) override;

 private:
  std::unique_ptr<__DSP_CLASS__> fDsp;
  MapUI fUI;
  std::vector<float> fSilenceBuffer;
};

} // namespace __NAMESPACE__
