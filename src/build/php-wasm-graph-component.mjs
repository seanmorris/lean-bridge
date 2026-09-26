/**
 * Regenerable private Zend and Lean transports for recursive PHP-Wasm packages.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../backends/php/copied-graph-zend.mjs";
import { generateCallablePhpGraphZendAdapter } from "../backends/php/callable-graph-zend.mjs";
import { generateNativeCopiedGraphAdapters } from "../backends/c/native-graph-adapters.mjs";
import { generateNativeCallableGraphCalls } from "../backends/c/native-callable-graph-calls.mjs";
import { generateNativeCallableGraphTrampolines } from "./native-callable-graph.mjs";
import { phpWasmGraphCarrierAbi } from "./php-wasm-graph-model.mjs";
import { nativeAllocationGuardHeader } from "./native-allocation-guard.mjs";

/**
 * Bind finite wasm32 layouts and runtime lifecycle checks to compiler metadata.
 *
 * @param model - Reconstructed fixed-width graph model.
 * @param adapters - Typed Lean wrappers generated from this model.
 */
export const generateCompiledPhpWasmGraph = (model, adapters) => {
	const initializer = `initialize_${adapters.module}`, abi = phpWasmGraphCarrierAbi(model);
	const callable = Boolean(abi.callbacks);
	const zend = callable ? generateCallablePhpGraphZendAdapter(model.bindingIr) : generateCopiedPhpGraphZendAdapter(model.bindingIr);
	const transport = callable ? generateNativeCallableGraphCalls(model.bindingIr, model.copiedGraph, { initializer, wordBits: 32 })
		: generateNativeCopiedGraphAdapters(model.bindingIr, abi, { initializer, wordBits: 32 });
	const manifest = JSON.parse(zend["graph-zend-manifest.json"]), prefix = transport.layout.prefix;
	const layout = callable ? { layout: transport.layout, descriptor: model.copiedGraph } : transport.layout;
	if(zend[`include/${prefix}-graph-types.h`] !== transport.typesHeader
		|| manifest.layoutSha256 !== sha256(canonicalJson(layout))) throw new Error("PHP-Wasm Zend and Lean graph layouts differ");
	const lifecycle = `#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include "${prefix}-graph.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "PHP-Wasm graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *${initializer}(uint8_t);
static void *lb_graph_initialize(uint8_t builtin) { return ${initializer}(builtin); }
uint32_t ${prefix}_graph_initialize(void) {
  return lean_bridge_native_component_initialize(${JSON.stringify(model.component.id)}, lb_graph_initialize) ? 0 : 5;
}
int ${prefix}_graph_ready(void) { return lean_bridge_native_component_ready(${JSON.stringify(model.component.id)}); }
void ${prefix}_graph_retire(void) { lean_bridge_native_runtime_retire(); }
`;
	const callbacks = callable ? generateNativeCallableGraphTrampolines(abi) : null;
	const files = { ...zend, "graph/transport.c": transport.source
		, "graph/runtime.c": lifecycle
		, "graph/allocation-guard.h": nativeAllocationGuardHeader };
	if(callable) files["graph/callbacks.c"] = callbacks;
	return { files
		, manifest, zendManifestPath: "graph-zend-manifest.json"
		, sources: ["graph/transport.c", "graph/runtime.c", ...callable ? ["graph/callbacks.c"] : [], `extension/${manifest.extension}.c`]
		, receipt: { schemaVersion: 1, layoutSha256: manifest.layoutSha256
			, transportSha256: sha256(transport.source)
			, lifecycleSha256: sha256(lifecycle)
			, ...callable ? { callbacksSha256: sha256(callbacks) } : {}
			, allocationGuardSha256: sha256(nativeAllocationGuardHeader) } };
};
