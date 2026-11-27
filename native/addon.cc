#include <node_api.h>

#include "input.h"

namespace input {
std::atomic<uint32_t> keys{0};
std::atomic<uint32_t> clicks{0};
std::atomic<uint32_t> scroll{0};
std::atomic<bool> active{false};
}

namespace {
void SetNumber(napi_env env, napi_value object, const char* key, uint32_t value) {
  napi_value number;
  napi_create_uint32(env, value, &number);
  napi_set_named_property(env, object, key, number);
}

napi_value Read(napi_env env, napi_callback_info) {
  napi_value result;
  napi_create_object(env, &result);
  SetNumber(env, result, "keys", input::keys.exchange(0));
  SetNumber(env, result, "clicks", input::clicks.exchange(0));
  SetNumber(env, result, "scroll", input::scroll.exchange(0));
  SetNumber(env, result, "active", input::active.load() ? 1 : 0);
  return result;
}

template <bool (*Action)()>
napi_value Run(napi_env env, napi_callback_info) {
  napi_value result;
  napi_get_boolean(env, Action(), &result);
  return result;
}

void CleanUp(void*) {
  input::Stop();
  input::keys.store(0);
  input::clicks.store(0);
  input::scroll.store(0);
}

napi_value Stop(napi_env env, napi_callback_info) {
  CleanUp(nullptr);
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

napi_value Init(napi_env env, napi_value exports) {
  const napi_property_descriptor methods[] = {
      {"hasPermission", nullptr, Run<input::HasPermission>},
      {"requestPermission", nullptr, Run<input::RequestPermission>},
      {"start", nullptr, Run<input::Start>},
      {"stop", nullptr, Stop},
      {"takeActivity", nullptr, Read},
  };
  napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods);
  napi_add_env_cleanup_hook(env, CleanUp, nullptr);
  return exports;
}
}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
