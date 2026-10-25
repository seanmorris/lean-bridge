#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include "reviewedcallbacks-graph.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "PHP-Wasm graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNative99d469b3ee044240(uint8_t);
static void *lb_graph_initialize(uint8_t builtin) { return initialize_LeanBridgeNative99d469b3ee044240(builtin); }
uint32_t reviewedcallbacks_graph_initialize(void) {
  return lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", lb_graph_initialize) ? 0 : 5;
}
int reviewedcallbacks_graph_ready(void) { return lean_bridge_native_component_ready("reviewedcallbacks@1.0.0"); }
void reviewedcallbacks_graph_retire(void) { lean_bridge_native_runtime_retire(); }
