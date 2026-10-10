/**
 * Recursive PHP-Wasm Zend callbacks with copied payloads and owned closures.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateNativeCallableGraphCalls } from "../c/native-callable-graph-calls.mjs";
import { graphZendDescriptorSource } from "./copied-graph-zend.mjs";
import { graphZendSupport } from "./copied-graph-zend-runtime.mjs";
import { compileCallablePhpGraphZendModel } from "./callable-graph-zend-model.mjs";
import { generateCallablePhpGraphZendPhp } from "./callable-graph-zend-php.mjs";
import { zendGraphCallState, zendGraphOwners, zendGraphTrampolines } from "./callable-graph-zend-runtime.mjs";
import { zendGraphCalls } from "./callable-graph-zend-calls.mjs";

/**
 * Emit regenerable sources, with no installed-consumer admission claim.
 *
 * @param ir - Compiler-authenticated public callable semantics.
 */
export const generateCallablePhpGraphZendAdapter = ir => {
	const model = compileCallablePhpGraphZendModel(ir), prefix = model.layout.prefix;
	const native = generateNativeCallableGraphCalls(ir, model.descriptor, { wordBits: 32
		, initializer: `initialize_LeanBridgeNative${sha256(ir.component.id).slice(0, 16)}` });
	if(canonicalJson(native.layout) !== canonicalJson(model.layout) || native.typesHeader !== model.typesHeader)
		throw new TypeError("Zend callable payloads differ from their native ABI");
	const files = generateCallablePhpGraphZendPhp(model);
	files[`include/${prefix}-graph-types.h`] = native.typesHeader;
	files[`include/${prefix}-callable-borrows.h`] = native.borrowsHeader;
	files[`include/${prefix}-graph.h`] = native.header + `uint32_t ${prefix}_graph_initialize(void);\nint ${prefix}_graph_ready(void);\nvoid ${prefix}_graph_retire(void);\n`;
	files[`extension/${model.stem}.c`] = `#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "${prefix}-graph.h"
_Static_assert(sizeof(zend_long) == 4 && sizeof(size_t) == 4 && sizeof(void *) == 4, "Recursive PHP-Wasm requires a 32-bit host and graph ABI");
_Static_assert(sizeof(bool) == 1, "Bool markers require one byte");
#if PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000
#error This adapter requires PHP 8.2 through 8.x
#endif
#ifdef ZTS
#error This adapter requires a non-thread-safe PHP runtime
#endif
${graphZendSupport}
${graphZendDescriptorSource(model, true)}
${zendGraphCallState}
${zendGraphOwners(model)}
${zendGraphTrampolines(model)}
${zendGraphCalls(model)}
ZEND_BEGIN_ARG_INFO_EX(lgc_retire_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_retire) {
  if (ZEND_NUM_ARGS()) { zend_argument_count_error("Expected no arguments"); RETURN_THROWS(); }
  ${prefix}_graph_retire(); RETURN_NULL();
}
static const zend_function_entry lgc_functions[] = {
${model.functions.map(fn => `  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, call${fn.index}, zif_lgc_call${fn.index}, lgc_args_call${fn.index})`).join("\n")}
${[...model.callbacks.values()].flatMap(cb => [
	`  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, invoke${cb.index}, zif_lgc_invoke${cb.index}, lgc_args_invoke${cb.index})`
	, `  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, close${cb.index}, zif_lgc_close${cb.index}, lgc_close_args${cb.index})`
]).join("\n")}
  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, retire, zif_lgc_retire, lgc_retire_args)
  PHP_FE_END
};
static PHP_MINIT_FUNCTION(${model.stem}) {
  lgc_owned_type = zend_register_list_destructors_ex(lgc_owned_destroy, NULL, "Lean graph closure", module_number);
  return SUCCESS;
}
zend_module_entry ${model.stem}_module_entry = {
  STANDARD_MODULE_HEADER, "${model.stem}", lgc_functions, PHP_MINIT(${model.stem}), NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(${model.stem})
`;
	files["graph-zend-manifest.json"] = canonicalJson({ schemaVersion: 1
		, kind: "lean-bridge-graph-zend-source"
		, component: ir.component.id, bindingIrSha256: model.identity
		, integerBits: 32, wordBits: 32
		, extension: model.stem, library: model.library
		, transport: model.transport, namespace: model.namespace
		, layoutSha256: model.layoutSha256, aliases: model.aliases
		, exports: model.functions.map(fn => ({ declaration: fn.declaration.id
			, function: `${model.namespace}\\${fn.publicName}`
			, transport: `${model.transport}\\call${fn.index}`, cSymbol: fn.native }))
		, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, { sha256: sha256(source), bytes: Buffer.byteLength(source) }])) });
	return Object.freeze(files);
};
