/**
 * Independent C producers for testing Zend conversion, not Lean execution.
 *
 * @file
 */

/**
 * Instrument call-owned scratch and provide typed echo/malformed C outputs.
 *
 * @param model - Finite wasm32 graph contract.
 */
export const phpGraphZendFixture = model => {
	const table = new Map(model.types.map(node => [node.id, node]));
	const prelude = `#include <php.h>
#include <stdlib.h>
#include <stdint.h>
#include "recursive-graph.h"
static size_t probe_live, probe_attempts, probe_fail, probe_owners, probe_clears, probe_calls, probe_inits, probe_strings;
static unsigned probe_mode, probe_retired;
static void *probe_calloc(size_t count, size_t width) {
  probe_attempts++; if (probe_fail && probe_attempts == probe_fail) return NULL;
  void *result = calloc(count, width); if (result) probe_live++; return result;
}
static void probe_free(void *value) { if (value) { probe_live--; free(value); } }
#define LB_ZEND_CALLOC probe_calloc
#define LB_ZEND_FREE probe_free
static void probe_string(zval *out, const char *text, size_t length) {
  probe_strings++;
  if (probe_mode == 6 && probe_strings == 4) zend_bailout();
  ZVAL_STRINGL(out, text, length);
}
#undef ZVAL_STRINGL
#define ZVAL_STRINGL(out, text, length) probe_string(out, text, length)
static void probe_release(void *owner) { probe_owners--; probe_clears++; free(owner); }
static int probe_owner(void **owner, void (**release)(void *)) {
  *owner = calloc(1, 1); if (!*owner) return 0; probe_owners++; *release = probe_release; return 1;
}
uint32_t recursive_graph_initialize(void) { probe_inits++; return probe_retired ? 5 : 0; }
int recursive_graph_ready(void) { return !probe_retired; }
void recursive_graph_retire(void) { probe_retired = 1; }
`;
	const providers = model.layout.roots.map(root => {
		const output = table.get(root.result), inputs = root.parameters.map(id => table.get(id));
		let body;
		if(inputs.length && inputs[0].id === output.id) body = "*out = *input0;";
		else if(root.name === "recursive_empty") body = "out->kind = RECURSIVE_TREE_T_KIND_BRANCH;";
		else if(root.name === "recursive_word_max") body = "*out = *input0 == UINT32_MAX;";
		else if(root.name === "recursive_signed_min") body = "*out = *input0 == INT32_MIN;";
		else if(root.name === "recursive_inspect") body = "*out = input0->u32 == UINT32_MAX && input0->u64 == UINT64_MAX && input0->i64 == INT64_MIN && input0->word == UINT32_MAX && input0->signed_word == INT32_MIN;";
		else throw new Error(`Missing independent C producer for ${root.name}`);
		return `uint32_t ${root.name}_graph(${[...inputs.map((node, index) => `const ${node.name} *input${index}`), `${output.name} *out`].join(", ")}) {
  probe_calls++; ${inputs.map((_, index) => `(void)input${index};`).join(" ")}
  if (probe_mode >= 10 && probe_mode <= 15) return probe_mode - 10;
  ${body}
  ${output.aggregate ? "if (!probe_owner(&out->_bridge_owner, &out->_bridge_release)) return 3;" : ""}
  ${output.publicType === "Tree" ? `if (probe_mode == 1) out->kind = 999;
  if (probe_mode == 2) { out->kind = RECURSIVE_TREE_T_KIND_BRANCH; out->cases.branch.children.data = out; out->cases.branch.children.length = 1; }
  if (probe_mode == 7) { out->kind = RECURSIVE_TREE_T_KIND_BRANCH; out->cases.branch.children.data = (const recursive_tree_t *)UINTPTR_MAX; out->cases.branch.children.length = 1; }
  if (probe_mode == 8) { out->kind = RECURSIVE_TREE_T_KIND_BRANCH; out->cases.branch.children.length = 262145; }
  if (probe_mode == 5) zend_bailout();` : ""}
  ${output.publicType === "Scalars" ? `if (probe_mode == 3) { out->text.data = "\\xed\\xa0\\x80"; out->text.length = 3; }
  if (probe_mode == 9) { static const uint32_t zero = 0; out->natural.data = &zero; out->natural.length = 1; }` : ""}
  if (probe_mode == 4) probe_retired = 1;
  return 0;
}`;
	}).join("\n");
	const controls = `ZEND_BEGIN_ARG_INFO_EX(probe_noargs, 0, 0, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(probe_reset_args, 0, 0, 2)
  ZEND_ARG_INFO(0, mode)
  ZEND_ARG_INFO(0, fail)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(graph_probe_reset) {
  zend_long mode, fail; if (zend_parse_parameters(ZEND_NUM_ARGS(), "ll", &mode, &fail) == FAILURE) RETURN_THROWS();
  if (mode < 0 || fail < 0 || probe_live || probe_owners) { zend_throw_error(NULL, "Invalid reset or leaked call allocation"); RETURN_THROWS(); }
  probe_mode = (unsigned)mode; probe_fail = (size_t)fail; probe_attempts = probe_strings = 0; RETURN_NULL();
}
static ZEND_FUNCTION(graph_probe_stats) {
  array_init(return_value);
${["live", "attempts", "owners", "clears", "calls", "inits", "retired", "strings"].map(name => `  add_assoc_long(return_value, "${name}", (zend_long)probe_${name});`).join("\n")}
}
`;
	return { prelude: prelude + providers + controls
		, entries: "  ZEND_FE(graph_probe_reset, probe_reset_args)\n  ZEND_FE(graph_probe_stats, probe_noargs)\n" };
};
