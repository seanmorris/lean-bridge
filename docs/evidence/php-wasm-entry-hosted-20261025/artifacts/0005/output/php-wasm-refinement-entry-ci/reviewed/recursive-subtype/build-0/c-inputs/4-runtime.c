#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include "recursivesubtypes-graph.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "PHP-Wasm graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNative597c05ce6432c0d3(uint8_t);
static void *lb_graph_initialize(uint8_t builtin) { return initialize_LeanBridgeNative597c05ce6432c0d3(builtin); }
uint32_t recursivesubtypes_graph_initialize(void) {
  return lean_bridge_native_component_initialize("recursivesubtypes@1.0.0", lb_graph_initialize) ? 0 : 5;
}
int recursivesubtypes_graph_ready(void) { return lean_bridge_native_component_ready("recursivesubtypes@1.0.0"); }
void recursivesubtypes_graph_retire(void) { lean_bridge_native_runtime_retire(); }
