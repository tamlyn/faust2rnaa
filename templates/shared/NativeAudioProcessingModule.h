#pragma once

#include <__CODEGEN_NAME__JSI.h>

#include <jsi/jsi.h>
#include <memory>
#include <string>

namespace facebook::react {

class NativeAudioProcessingModule
    : public NativeAudioProcessingModuleCxxSpec<NativeAudioProcessingModule> {
 public:
  NativeAudioProcessingModule(std::shared_ptr<CallInvoker> jsInvoker);
  void injectCustomProcessorInstaller(jsi::Runtime &runtime);
};

} // namespace facebook::react
