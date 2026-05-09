#include "__NODE_NAME__.h"

#include <audioapi/core/BaseAudioContext.h>

#include <algorithm>

namespace __NAMESPACE__ {
using namespace audioapi;

AudioNodeOptions __NODE_NAME__::defaultOptions() {
  __DSP_CLASS__ tempDsp;
  int numIn = tempDsp.getNumInputs();
  int numOut = tempDsp.getNumOutputs();

  AudioNodeOptions opts;
  opts.numberOfInputs = numIn > 0 ? 1 : 0;
  opts.numberOfOutputs = 1;
  opts.channelCount = std::max({1, numIn, numOut});
  opts.requiresTailProcessing = true;
  return opts;
}

__NODE_NAME__::__NODE_NAME__(
    const std::shared_ptr<BaseAudioContext> &context)
    : AudioNode(context, defaultOptions()) {
  fDsp = std::make_unique<__DSP_CLASS__>();

  int sampleRate =
      context ? static_cast<int>(context->getSampleRate()) : 44100;

  fDsp->init(sampleRate);
  fDsp->buildUserInterface(&fUI);

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

std::shared_ptr<DSPAudioBuffer> __NODE_NAME__::processNode(
    const std::shared_ptr<DSPAudioBuffer> &buffer,
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

  int bufferChannels = static_cast<int>(buffer->getNumberOfChannels());

  for (int i = 0; i < numInputs; ++i) {
    if (i < bufferChannels) {
      inputs[i] = buffer->getChannel(i)->begin();
    } else {
      inputs[i] = fSilenceBuffer.data();
    }
  }

  for (int i = 0; i < numOutputs; ++i) {
    if (i < bufferChannels) {
      outputs[i] = buffer->getChannel(i)->begin();
    } else {
      outputs[i] = fSilenceBuffer.data();
    }
  }

  fDsp->compute(framesToProcess, inputs.data(), outputs.data());

  // The FAUST DSP only writes to its own numOutputs channels (channel 0
  // for a mono node). If the AudioNode's channel-count negotiation has
  // promoted the bus past numOutputs (e.g. a mono node sitting on a
  // stereo bus, which is the WAA default once any GainNode is involved),
  // the extra buffer channels still hold the *pre-compute()* upstream
  // input — i.e. the unprocessed signal. Without this mirror, those
  // channels leak past the node and the destination's downmix averages
  // them back in. Mirror channel 0's processed output into all extra
  // buffer channels so the node's effect applies to the whole bus.
  if (numOutputs > 0 && numOutputs < bufferChannels) {
    const float *src = outputs[0];
    for (int c = numOutputs; c < bufferChannels; ++c) {
      float *dst = buffer->getChannel(c)->begin();
      std::copy(src, src + framesToProcess, dst);
    }
  }

  return buffer;
}

} // namespace __NAMESPACE__
