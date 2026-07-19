#pragma once

#include "__NODE_NAME__.h"

#include <audioapi/HostObjects/AudioNodeHostObject.h>
#include <audioapi/HostObjects/AudioParamHostObject.h>
#include <memory>
#include <string>
#include <unordered_map>

namespace __NAMESPACE__ {
using namespace facebook;

class __NODE_NAME__HostObject : public audioapi::AudioNodeHostObject {
 public:
  explicit __NODE_NAME__HostObject(
      const std::shared_ptr<__NODE_NAME__> &node);

  JSI_HOST_FUNCTION_DECL(getAudioParam);

 private:
  // One JS-facing AudioParam wrapper per address, created lazily. Sharing the
  // wrapper matters because AudioParamHostObject tracks scheduled-curve
  // exclusion per instance; handing out a second wrapper for the same
  // parameter would split that bookkeeping.
  // JS thread only.
  std::unordered_map<std::string,
                     std::shared_ptr<audioapi::AudioParamHostObject>>
      paramHosts_;
};

} // namespace __NAMESPACE__
