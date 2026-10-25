#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include "callbacksubtypes-graph.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "PHP-Wasm graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNative730462696d8af341(uint8_t);
static void *lb_graph_initialize(uint8_t builtin) { return initialize_LeanBridgeNative730462696d8af341(builtin); }
uint32_t callbacksubtypes_graph_initialize(void) {
  return lean_bridge_native_component_initialize("callbacksubtypes@1.0.0", lb_graph_initialize) ? 0 : 5;
}
int callbacksubtypes_graph_ready(void) { return lean_bridge_native_component_ready("callbacksubtypes@1.0.0"); }
void callbacksubtypes_graph_retire(void) { lean_bridge_native_runtime_retire(); }
