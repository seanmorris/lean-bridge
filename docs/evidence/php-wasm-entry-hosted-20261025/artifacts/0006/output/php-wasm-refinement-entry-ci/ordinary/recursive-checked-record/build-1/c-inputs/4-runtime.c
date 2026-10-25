#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include "recursivecheckedrecords-graph.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "PHP-Wasm graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNativea1d30b9a0f384ed5(uint8_t);
static void *lb_graph_initialize(uint8_t builtin) { return initialize_LeanBridgeNativea1d30b9a0f384ed5(builtin); }
uint32_t recursivecheckedrecords_graph_initialize(void) {
  return lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", lb_graph_initialize) ? 0 : 5;
}
int recursivecheckedrecords_graph_ready(void) { return lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0"); }
void recursivecheckedrecords_graph_retire(void) { lean_bridge_native_runtime_retire(); }
