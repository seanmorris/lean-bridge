/**
 * Count native handoffs and allocations around the unmodified Zend transport.
 *
 * @file
 */

/**
 * Add diagnostics without replacing any argument or result conversion.
 *
 * @param source - Complete generated consuming Zend extension.
 * @param options - Test-only instrumentation hook selection.
 * @param options.consume - Exact original-owner handoff declaration.
 */
export const ownedPhpWasmTransferProbe = (source, { consume = "static void lgo_input_consume(void *context) {" } = {}) => {
	if(source.split(consume).length !== 2 || source.split("  PHP_FE_END").length !== 2)
		throw new TypeError("Expected one consuming hook and Zend registration table");
	return `#include <php.h>
#include <stdlib.h>
static size_t probe_live, probe_native_live, probe_attempts, probe_fail_at, probe_failures, probe_handoffs;
static void *probe_allocate(size_t count, size_t width) {
  if (++probe_attempts == probe_fail_at) { ++probe_failures; return NULL; }
  void *value = calloc(count, width); if (value) ++probe_live; return value;
}
static void probe_free(void *value) { if (value) { --probe_live; free(value); } }
static void *probe_native_allocate(size_t bytes) {
  void *value = probe_allocate(1, bytes); if (value) ++probe_native_live; return value;
}
static void probe_native_free(void *value) { if (value) --probe_native_live; probe_free(value); }
#define LB_ZEND_CALLOC probe_allocate
#define LB_ZEND_FREE probe_free
#define LB_OWNED_ALLOC probe_native_allocate
#define LB_OWNED_FREE probe_native_free
ZEND_BEGIN_ARG_INFO_EX(probe_no_args, 0, 0, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(probe_fault_args, 0, 0, 1)
  ZEND_ARG_INFO(0, point)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(owned_transfer_stats);
static ZEND_FUNCTION(owned_transfer_fault);
static ZEND_FUNCTION(owned_transfer_bailout);
` + source.replace(consume, consume + "\n  ++probe_handoffs;")
		.replace("  PHP_FE_END", `  ZEND_FE(owned_transfer_stats, probe_no_args)
  ZEND_FE(owned_transfer_fault, probe_fault_args)
  ZEND_FE(owned_transfer_bailout, probe_no_args)
  PHP_FE_END`) + `
static ZEND_FUNCTION(owned_transfer_stats) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_assoc_long(return_value, "live", probe_live);
  add_assoc_long(return_value, "nativeLive", probe_native_live);
  add_assoc_long(return_value, "identities", snapshot.live_identities);
  add_assoc_long(return_value, "runtimeState", snapshot.runtime_state);
  add_assoc_long(return_value, "attempts", probe_attempts);
  add_assoc_long(return_value, "failures", probe_failures);
  add_assoc_long(return_value, "handoffs", probe_handoffs);
  add_assoc_long(return_value, "scopes", lgo_current ? lgo_current->native.scopes : 0);
  add_assoc_long(return_value, "depth", lgo_depth);
  add_assoc_long(return_value, "phpBits", sizeof(zend_long) * 8);
  add_assoc_bool(return_value, "current", lgo_current != NULL);
}
static ZEND_FUNCTION(owned_transfer_fault) {
  zend_long point; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(point) ZEND_PARSE_PARAMETERS_END();
  if (point < 0) { zend_value_error("Expected a nonnegative allocation point"); RETURN_THROWS(); }
  probe_attempts = 0; probe_fail_at = (size_t)point; RETURN_NULL();
}
static ZEND_FUNCTION(owned_transfer_bailout) { EG(exit_status) = 0; zend_bailout(); }
`;
};
