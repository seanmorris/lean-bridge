/**
 * Test-only allocation accounting around the unmodified generated transport.
 *
 * @file
 */
import { ownedZendOutputProbe } from "./owned-php-zend-output-probe.mjs";

/**
 * Add diagnostic entrypoints without substituting adapters or Lean values.
 *
 * @param source - Original complete generated Zend extension source.
 * @param model - Exact fixture schema for targeted malformed-output tests.
 */
export const ownedZendGeneratedProbe = (source, model) => {
	if(source.split("  PHP_FE_END").length !== 2) throw new TypeError("Expected one generated Zend registration table");
	const corruption = ownedZendOutputProbe(model);
	const before = `#include <php.h>
#include <stdlib.h>
static size_t probe_live, probe_attempts, probe_fail_at, probe_failures;
static void *probe_allocate(size_t count, size_t width) {
  if (++probe_attempts == probe_fail_at) { ++probe_failures; return NULL; }
  void *value = calloc(count, width); if (value) ++probe_live; return value;
}
static void probe_free(void *value) { if (value) { --probe_live; free(value); } }
#define LB_ZEND_CALLOC probe_allocate
#define LB_ZEND_FREE probe_free
#define LB_OWNED_ALLOC(bytes) probe_allocate(1, bytes)
#define LB_OWNED_FREE probe_free
ZEND_BEGIN_ARG_INFO_EX(probe_no_args, 0, 0, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(probe_fault_args, 0, 0, 1)
  ZEND_ARG_INFO(0, point)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(owned_generated_stats);
static ZEND_FUNCTION(owned_generated_fault);
static ZEND_FUNCTION(owned_generated_bailout);
`;
	const after = `
static ZEND_FUNCTION(owned_generated_stats) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_assoc_long(return_value, "live", probe_live);
  add_assoc_long(return_value, "identities", snapshot.live_identities);
  add_assoc_long(return_value, "attempts", probe_attempts);
  add_assoc_long(return_value, "failures", probe_failures);
  add_assoc_long(return_value, "scopes", lgo_current ? lgo_current->native.scopes : 0);
  add_assoc_long(return_value, "depth", lgo_depth);
  add_assoc_long(return_value, "phpBits", sizeof(zend_long) * 8);
  add_assoc_long(return_value, "runtimeState", snapshot.runtime_state);
  add_assoc_bool(return_value, "current", lgo_current != NULL);
}
static ZEND_FUNCTION(owned_generated_fault) {
  zend_long point; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(point) ZEND_PARSE_PARAMETERS_END();
  if (point < 0) { zend_value_error("Expected a nonnegative allocation point"); RETURN_THROWS(); }
  probe_attempts = 0; probe_fail_at = (size_t)point; RETURN_NULL();
}
static ZEND_FUNCTION(owned_generated_bailout) { EG(exit_status) = 0; zend_bailout(); }
`;
	return before + corruption.declarations + corruption.instrument(source).replace("  PHP_FE_END", `  ZEND_FE(owned_generated_stats, probe_no_args)
  ZEND_FE(owned_generated_fault, probe_fault_args)
  ZEND_FE(owned_generated_bailout, probe_no_args)
  ZEND_FE(owned_generated_corrupt, probe_fault_args)
  PHP_FE_END`) + after + corruption.definitions;
};
