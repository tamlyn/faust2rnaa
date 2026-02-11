#pragma once

#include "__NODE_NAME__.h"

#include <audioapi/HostObjects/AudioNodeHostObject.h>
#include <memory>

namespace __NAMESPACE__ {
using namespace facebook;

class __NODE_NAME__HostObject : public audioapi::AudioNodeHostObject {
 public:
  explicit __NODE_NAME__HostObject(
      const std::shared_ptr<__NODE_NAME__> &node);

  JSI_HOST_FUNCTION_DECL(setParam);
  JSI_HOST_FUNCTION_DECL(getParam);
  JSI_HOST_FUNCTION_DECL(getParamCount);
  JSI_HOST_FUNCTION_DECL(getParamAddress);
};

} // namespace __NAMESPACE__
