#include "__NODE_NAME__HostObject.h"

#include <memory>

namespace __NAMESPACE__ {

__NODE_NAME__HostObject::__NODE_NAME__HostObject(
    const std::shared_ptr<__NODE_NAME__> &node)
    : AudioNodeHostObject(node) {
  addFunctions(
      JSI_EXPORT_FUNCTION(__NODE_NAME__HostObject, setParam),
      JSI_EXPORT_FUNCTION(__NODE_NAME__HostObject, getParam),
      JSI_EXPORT_FUNCTION(__NODE_NAME__HostObject, getParamCount),
      JSI_EXPORT_FUNCTION(__NODE_NAME__HostObject, getParamAddress));
}

JSI_HOST_FUNCTION_IMPL(__NODE_NAME__HostObject, setParam) {
  auto processorNode = std::static_pointer_cast<__NODE_NAME__>(node_);
  auto name = args[0].getString(runtime).utf8(runtime);
  auto value = args[1].getNumber();
  processorNode->setParam(name, value);
  return jsi::Value::undefined();
}

JSI_HOST_FUNCTION_IMPL(__NODE_NAME__HostObject, getParam) {
  auto processorNode = std::static_pointer_cast<__NODE_NAME__>(node_);
  auto name = args[0].getString(runtime).utf8(runtime);
  return jsi::Value(processorNode->getParam(name));
}

JSI_HOST_FUNCTION_IMPL(__NODE_NAME__HostObject, getParamCount) {
  auto processorNode = std::static_pointer_cast<__NODE_NAME__>(node_);
  return jsi::Value(processorNode->getParamCount());
}

JSI_HOST_FUNCTION_IMPL(__NODE_NAME__HostObject, getParamAddress) {
  auto processorNode = std::static_pointer_cast<__NODE_NAME__>(node_);
  auto index = static_cast<int>(args[0].getNumber());
  auto address = processorNode->getParamAddress(index);
  return jsi::String::createFromUtf8(runtime, address);
}

} // namespace __NAMESPACE__
