/**
 * Adversarial identities and lifetime counters inside the actual wasm32 adapter.
 * Probes retain uint64 tokens in C, never in a 32-bit PHP integer.
 *
 * @file
 */
import { compileCallablePhpGraphZendModel } from "../../src/backends/php/callable-graph-zend-model.mjs";

/**
 * Add private test functions without replacing the generated callback machinery.
 *
 * @param ir - Independently stated recursive callable signatures.
 */
export const phpWasmRecursiveOwnershipProbe = ir => {
	const model = compileCallablePhpGraphZendModel(ir);
	const callbacks = [...model.callbacks.values()];
	const recursive = model.functions.find(fn => fn.publicName === "make_recursive").result.callback;
	const array = model.functions.find(fn => fn.publicName === "make_array").result.callback;
	const declarations = `#include <php.h>
static void probe_lifetime_stats(zval *output);
static unsigned probe_construction_attempts, probe_construction_at, probe_construction_bailouts;
static void probe_construct(void) {
  if (++probe_construction_attempts == probe_construction_at) {
    ++probe_construction_bailouts; EG(exit_status) = 0; zend_bailout();
  }
}
#define PROBE_ARRAY_INIT(value) do { probe_construct(); array_init(value); } while (0)
#define PROBE_ARRAY_INIT_SIZE(value, count) do { probe_construct(); array_init_size(value, count); } while (0)
#define PROBE_STRING(value, text, count) do { probe_construct(); ZVAL_STRINGL(value, text, count); } while (0)
ZEND_BEGIN_ARG_INFO_EX(probe_context_args, 0, 0, 1)
  ZEND_ARG_INFO(0, mode)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(probe_lease_args, 0, 0, 2)
  ZEND_ARG_INFO(0, resource)
  ZEND_ARG_INFO(0, mode)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(recursive_probe_contexts);
static ZEND_FUNCTION(recursive_probe_lease);
static ZEND_FUNCTION(recursive_probe_bailout);
static ZEND_FUNCTION(recursive_probe_construction);
`;
	const definitions = `
static uintptr_t probe_saved_context;
static uint64_t probe_saved_token;
static unsigned probe_context_checks;
static ZEND_FUNCTION(recursive_probe_bailout) {
  ZEND_PARSE_PARAMETERS_NONE();
  EG(exit_status) = 0; zend_bailout();
}
static ZEND_FUNCTION(recursive_probe_construction) {
  zend_long point;
  ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(point) ZEND_PARSE_PARAMETERS_END();
  if (point < 0 || point > 262144) { zend_value_error("Invalid construction abort point"); RETURN_THROWS(); }
  probe_construction_at = (unsigned)point; probe_construction_attempts = 0; RETURN_NULL();
}
static void probe_lifetime_stats(zval *output) {
  unsigned count = 0;
  for (lgc_borrow *borrow = lgc_borrows; borrow; borrow = borrow->next) ++count;
  add_assoc_long(output, "borrowedContexts", count);
  add_assoc_long(output, "callDepth", lgc_depth);
  add_assoc_long(output, "contextChecks", probe_context_checks);
  add_assoc_bool(output, "contextsExhausted", lgc_next_identity == UINTPTR_MAX);
  add_assoc_long(output, "constructionAttempts", probe_construction_attempts);
  add_assoc_long(output, "constructionBailouts", probe_construction_bailouts);
}
static int probe_context_rejected(uintptr_t identity, unsigned excluded) {
${callbacks.map(cb => `  if (excluded != ${cb.index}) {
    ${cb.result.name} output; unsigned char before[sizeof(output)];
    memset(&output, 0x5a, sizeof(output)); memcpy(before, &output, sizeof(output));
    uint32_t status = lgc_callback${cb.index}((void *)identity, ${[...cb.parameters.map(node => `(const ${node.name} *)1`), "&output"].join(", ")});
    if (status != 6 || memcmp(before, &output, sizeof(output))) return 0;
    ++probe_context_checks;
  }`).join("\n")}
  return 1;
}
static ZEND_FUNCTION(recursive_probe_contexts) {
  zend_long mode;
  ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(mode) ZEND_PARSE_PARAMETERS_END();
  unsigned before = probe_context_checks;
  if (mode == 1) {
    if (!lgc_borrows || !lgc_depth) { zend_value_error("Expected an active callback"); RETURN_THROWS(); }
    lgc_borrow *borrow = lgc_borrows; lgc_call snapshot = *borrow->call;
    probe_saved_context = borrow->identity;
    if (!probe_context_rejected(borrow->identity, borrow->signature)
        || memcmp(&snapshot, borrow->call, sizeof(snapshot))) {
      zend_throw_error(NULL, "wrong_signature_context_changed_frame"); RETURN_THROWS();
    }
  } else {
    if (lgc_borrows || lgc_depth) { zend_value_error("Expected no active callback"); RETURN_THROWS(); }
    if (mode == 0) {
      if (!probe_context_rejected(0, UINT_MAX) || !probe_context_rejected(1, UINT_MAX)
          || !probe_context_rejected(UINTPTR_MAX, UINT_MAX)) {
        zend_throw_error(NULL, "forged_context_was_accepted"); RETURN_THROWS();
      }
    } else if (mode == 2) {
      if (!probe_saved_context || !probe_context_rejected(probe_saved_context, UINT_MAX)) {
        zend_throw_error(NULL, "expired_context_was_accepted"); RETURN_THROWS();
      }
    } else if (mode == 3) {
      if (lgc_next_identity >= UINTPTR_MAX - 1) { zend_value_error("Context exhaustion already armed"); RETURN_THROWS(); }
      lgc_next_identity = UINTPTR_MAX - 1;
    } else { zend_value_error("Unknown context probe"); RETURN_THROWS(); }
  }
  RETURN_LONG(probe_context_checks - before);
}
static ZEND_FUNCTION(recursive_probe_lease) {
  zval *resource; zend_long mode;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_RESOURCE(resource) Z_PARAM_LONG(mode) ZEND_PARSE_PARAMETERS_END();
  lgc_owned *owner = zend_fetch_resource_ex(resource, "Lean graph closure", lgc_owned_type);
  if (!owner) RETURN_THROWS();
  if (!owner->token || owner->signature != ${recursive.index}) { zend_value_error("Expected a live recursive closure"); RETURN_THROWS(); }
  if (mode == 0) {
    probe_saved_token = owner->token;
    RETURN_BOOL(probe_saved_token > UINT32_MAX);
  }
  if (mode != 1 || !probe_saved_token || owner->token == probe_saved_token
      || (uint32_t)owner->token != (uint32_t)probe_saved_token
      || (uint32_t)(owner->token >> 32) == (uint32_t)(probe_saved_token >> 32)) {
    zend_throw_error(NULL, "closure_slot_did_not_advance_generation"); RETURN_THROWS();
  }
  bool selected = true;
  ${recursive.parameters[1].name} input = {0}; input.kind = STRUCTURED_TREE_T_KIND_BRANCH;
  uint64_t rejected[] = {0, UINT64_MAX, probe_saved_token, owner->token ^ (UINT64_C(1) << 32)};
  for (unsigned index = 0; index < sizeof(rejected) / sizeof(*rejected); ++index) {
    ${recursive.result.name} output = {0}; output.kind = UINT32_MAX;
    unsigned char before[sizeof(output)]; memcpy(before, &output, sizeof(output));
    uint32_t status = ${recursive.call}(rejected[index], &selected, &input, &output);
    if (status != 1 || memcmp(before, &output, sizeof(output))) {
      zend_throw_error(NULL, "stale_or_forged_lease_was_accepted"); RETURN_THROWS();
    }
  }
  ${array.parameters[1].name} array_input = {0}, array_output = {0};
  if (${array.call}(owner->token, &selected, &array_input, &array_output) != 1) {
    zend_throw_error(NULL, "wrong_signature_lease_was_accepted"); RETURN_THROWS();
  }
  ${recursive.dispose}(probe_saved_token);
  ${recursive.result.name} output = {0};
  uint32_t status = ${recursive.call}(owner->token, &selected, &input, &output);
  ${recursive.result.name}_clear(&output);
  if (status) { zend_throw_error(NULL, "stale_disposal_invalidated_fresh_lease"); RETURN_THROWS(); }
  RETURN_LONG(6);
}
`;
	return { declarations, definitions, callbacks: callbacks.length
		, privateArrayCall: model.transport + "\\call" + model.functions.find(fn => fn.publicName === "call_array").index
		, registration: "  ZEND_FE(recursive_probe_contexts, probe_context_args)\n  ZEND_FE(recursive_probe_lease, probe_lease_args)\n  ZEND_FE(recursive_probe_bailout, probe_args)\n  ZEND_FE(recursive_probe_construction, probe_context_args)\n"
		, statistics: "  probe_lifetime_stats(return_value);\n" };
};
