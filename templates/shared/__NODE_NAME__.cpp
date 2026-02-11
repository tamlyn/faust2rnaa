#include "__NODE_NAME__.h"

#include <audioapi/core/BaseAudioContext.h>
#include <audioapi/utils/AudioArray.h>
#include <audioapi/utils/AudioBus.h>

namespace __NAMESPACE__ {
using namespace audioapi;

__NODE_NAME__::__NODE_NAME__(std::shared_ptr<BaseAudioContext> context)
    : AudioNode(std::move(context)) {
  fDsp = std::make_unique<__DSP_CLASS__>();

  auto ctx = context_.lock();
  int sampleRate = ctx ? static_cast<int>(ctx->getSampleRate()) : 44100;

  fDsp->init(sampleRate);
  fDsp->buildUserInterface(&fUI);

  numberOfInputs_ = fDsp->getNumInputs() > 0 ? 1 : 0;
  numberOfOutputs_ = 1;
  channelCount_ = std::max(fDsp->getNumInputs(), fDsp->getNumOutputs());

  isInitialized_ = true;
}

void __NODE_NAME__::setParam(const std::string &name, double value) {
  fUI.setParamValue(name.c_str(), static_cast<FAUSTFLOAT>(value));
}

double __NODE_NAME__::getParam(const std::string &name) {
  return static_cast<double>(fUI.getParamValue(name.c_str()));
}

int __NODE_NAME__::getParamCount() {
  return static_cast<int>(fUI.getFullpathMap().size());
}

std::string __NODE_NAME__::getParamAddress(int index) {
  return fUI.getParamAddress(index);
}

std::shared_ptr<AudioBus> __NODE_NAME__::processNode(
    const std::shared_ptr<AudioBus> &bus,
    int framesToProcess) {
  int numInputs = fDsp->getNumInputs();
  int numOutputs = fDsp->getNumOutputs();

  // Ensure silence buffer is large enough
  if (static_cast<int>(fSilenceBuffer.size()) < framesToProcess) {
    fSilenceBuffer.resize(framesToProcess, 0.0f);
  } else {
    std::fill(fSilenceBuffer.begin(),
              fSilenceBuffer.begin() + framesToProcess, 0.0f);
  }

  // Build input/output buffer pointer arrays
  std::vector<float *> inputs(numInputs);
  std::vector<float *> outputs(numOutputs);

  int busChannels = bus->getNumberOfChannels();

  for (int i = 0; i < numInputs; ++i) {
    if (i < busChannels) {
      inputs[i] = bus->getChannel(i)->getData();
    } else {
      inputs[i] = fSilenceBuffer.data();
    }
  }

  for (int i = 0; i < numOutputs; ++i) {
    if (i < busChannels) {
      outputs[i] = bus->getChannel(i)->getData();
    } else {
      outputs[i] = fSilenceBuffer.data();
    }
  }

  fDsp->compute(framesToProcess, inputs.data(), outputs.data());

  return bus;
}

} // namespace __NAMESPACE__
