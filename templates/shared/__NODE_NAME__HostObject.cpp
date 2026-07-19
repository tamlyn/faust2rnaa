#include "__NODE_NAME__HostObject.h"

#include <memory>

namespace __NAMESPACE__ {

__NODE_NAME__HostObject::__NODE_NAME__HostObject(
    const std::shared_ptr<__NODE_NAME__> &node)
    : AudioNodeHostObject(node, __NODE_NAME__::defaultOptions()) {
  addFunctions(JSI_EXPORT_FUNCTION(__NODE_NAME__HostObject, getAudioParam));
}

JSI_HOST_FUNCTION_IMPL(__NODE_NAME__HostObject, getAudioParam) {
  if (count < 1 || !args[0].isString()) {
    throw jsi::JSError(runtime,
                       "getAudioParam expects a parameter address string");
  }

  auto processorNode = std::static_pointer_cast<__NODE_NAME__>(node_);
  auto name = args[0].getString(runtime).utf8(runtime);

  auto it = paramHosts_.find(name);
  if (it == paramHosts_.end()) {
    auto param = processorNode->getAudioParam(name);
    if (param == nullptr) {
      throw jsi::JSError(runtime, "No such parameter: " + name);
    }
    it = paramHosts_
             .emplace(name, std::make_shared<audioapi::AudioParamHostObject>(
                                param))
             .first;
  }
  return jsi::Object::createFromHostObject(runtime, it->second);
}

} // namespace __NAMESPACE__
