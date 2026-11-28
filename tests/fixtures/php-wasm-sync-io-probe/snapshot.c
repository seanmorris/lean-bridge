#include <php.h>
#include "lean_bridge_native_runtime.h"
ZEND_BEGIN_ARG_INFO_EX(probe_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lean_bridge_test_snapshot) {
  lean_bridge_native_snapshot snapshot;
  lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_next_index_long(return_value, snapshot.abi_version);
  add_next_index_long(return_value, snapshot.runtime_state);
  add_next_index_long(return_value, snapshot.runtime_init_runs);
  add_next_index_long(return_value, snapshot.component_init_runs);
  add_next_index_long(return_value, snapshot.attached_components);
  add_next_index_long(return_value, snapshot.live_identities);
}
static const zend_function_entry probe_functions[] = {
  ZEND_FE(lean_bridge_test_snapshot, probe_args)
  PHP_FE_END
};
zend_module_entry probe_module_entry = {
  STANDARD_MODULE_HEADER, "lean_bridge_test_probe", probe_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(probe)
