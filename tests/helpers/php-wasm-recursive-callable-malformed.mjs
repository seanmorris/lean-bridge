/**
 * Deliberately malformed native results, isolated from original package artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { compileCallablePhpGraphZendModel } from "../../src/backends/php/callable-graph-zend-model.mjs";

/**
 * Wrap two generated native exports without changing their Zend consumers.
 *
 * @param ir - Independently stated callable fixture.
 * @param generated - Actual generated wasm32 component source set.
 */
export const phpWasmRecursiveMalformedProbe = (ir, generated) => {
	const model = compileCallablePhpGraphZendModel(ir), prefix = model.layout.prefix;
	const call = model.functions.find(fn => fn.publicName === "call_recursive");
	const make = model.functions.find(fn => fn.publicName === "make_recursive");
	let transport = generated.files["graph/transport.c"];
	for(const [fn, name] of [[call, "probe_original_recursive"], [make, "probe_original_make"]])
	{
		assert.equal(transport.split("uint32_t " + fn.native + "(").length, 2);
		transport = transport.replace("uint32_t " + fn.native + "(", "uint32_t " + name + "(");
	}
	transport += `
uint32_t ${call.native}(const ${call.parameters[0].node.name} *input, const ${call.parameters[1].callback.borrowedType} *callback, ${call.result.node.name} *output) {
  uint32_t status = probe_original_recursive(input, callback, output);
  if (!status && probe_mode) {
    unsigned mode = probe_mode; probe_mode = 0; ++probe_poisoned;
    if (mode == 1) output->kind = UINT32_MAX;
    else if (mode == 3) lean_bridge_native_runtime_retire();
    else if (mode == 8) return 99;
    else {
      output->kind = STRUCTURED_TREE_T_KIND_BRANCH;
      output->cases.branch.children.length = mode == 4 ? SIZE_MAX : 1;
      output->cases.branch.children.data = mode == 2 ? (void *)output
        : mode == 4 ? (void *)1 : mode == 6 ? NULL : (void *)((uintptr_t)output + 1);
    }
  }
  return status;
}
uint32_t ${make.native}(const ${make.parameters[0].node.name} *input, uint64_t *output) {
  uint32_t status = probe_original_make(input, output);
  if (!status && probe_mode == 5) {
    probe_mode = 0; ++probe_poisoned; ${make.result.callback.dispose}(*output); *output = 0;
  }
  return status;
}
`;
	let lifecycle = generated.files["graph/runtime.c"];
	const retire = `void ${prefix}_graph_retire(void) { lean_bridge_native_runtime_retire(); }`;
	assert.equal(lifecycle.split(retire).length, 2);
	lifecycle = lifecycle.replace(retire, `void ${prefix}_graph_retire(void) {
  ++probe_retired;
#ifndef PROBE_IGNORE_RETIREMENT
  lean_bridge_native_runtime_retire();
#endif
}`);
	const declarations = `#include <php.h>
static unsigned probe_mode, probe_poisoned, probe_retired;
ZEND_BEGIN_ARG_INFO_EX(probe_poison_args, 0, 0, 1)
  ZEND_ARG_INFO(0, mode)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(recursive_probe_poison) {
  zend_long mode;
  ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(mode) ZEND_PARSE_PARAMETERS_END();
  if (mode < 1 || mode > 8) { zend_value_error("Invalid malformed-result case"); RETURN_THROWS(); }
  probe_mode = (unsigned)mode; RETURN_NULL();
}
`;
	return { transport, lifecycle, declarations
		, registration: "  ZEND_FE(recursive_probe_poison, probe_poison_args)\n"
		, statistics: '  add_assoc_long(return_value, "poisoned", probe_poisoned); add_assoc_long(return_value, "retirements", probe_retired);\n' };
};
