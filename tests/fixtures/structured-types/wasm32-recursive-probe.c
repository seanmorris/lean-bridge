/* Test-only Zend entry point for the real compiled Lean graph transport. */
#include <php.h>
#include <stdio.h>
#include <lean_bridge_native_runtime.h>
#include "check.c"

_Static_assert(sizeof(void *) == 4 && sizeof(size_t) == 4 && sizeof(zend_long) == 4, "Actual wasm32 execution required");
_Static_assert(sizeof(((recursive_scalars_t *)0)->word) == 4, "Lean USize must have 32-bit storage");
_Static_assert(sizeof(((recursive_scalars_t *)0)->signed_word) == 4, "Lean ISize must have 32-bit storage");
_Static_assert(sizeof(((recursive_scalars_t *)0)->u64) == 8, "UInt64 must retain its full width");

extern lean_object *initialize_Wasm32Carriers(uint8_t);
static void *probe_initialize(uint8_t builtin) { return initialize_Wasm32Carriers(builtin); }

ZEND_BEGIN_ARG_INFO_EX(probe_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lean_bridge_wasm32_recursive_probe) {
  CHECK(lean_bridge_native_component_initialize("recursive@1.0.0", probe_initialize));
  uint32_t transport_checks = native_graph_check(lean_box(0));
  uint32_t boundary_checks = wasm32_boundary_checks();
  lean_bridge_native_snapshot snapshot;
  lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_assoc_long(return_value, "checks", transport_checks);
  add_assoc_long(return_value, "boundaryChecks", boundary_checks);
  add_assoc_long(return_value, "wordBits", sizeof(size_t) * 8);
  add_assoc_long(return_value, "phpBits", sizeof(zend_long) * 8);
  add_assoc_string(return_value, "phpVersion", PHP_VERSION);
  add_assoc_long(return_value, "live", live);
  add_assoc_long(return_value, "runtimeInitializations", snapshot.runtime_init_runs);
  add_assoc_long(return_value, "componentInitializations", snapshot.component_init_runs);
}
static const zend_function_entry probe_functions[] = {
  ZEND_FE(lean_bridge_wasm32_recursive_probe, probe_args)
  PHP_FE_END
};
zend_module_entry probe_module_entry = {
  STANDARD_MODULE_HEADER, "lean_bridge_wasm32_recursive_probe", probe_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(probe)
