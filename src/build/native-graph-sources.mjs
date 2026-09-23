/**
 * Reconstruct native graph adapter sources from verified compiler evidence.
 *
 * @file
 */
import { generateNativeCopiedGraphAdapters } from "../backends/c/native-graph-adapters.mjs";
import { nativeGraphCarrierAbi } from "./native-graph-model.mjs";

/**
 * Return exact private headers and implementation for a checked graph component.
 *
 * @param model - Verified native component model.
 * @param receipt - Verified component compilation receipt.
 */
export const nativeGraphProjectionSources = (model, receipt) => {
	const native = generateNativeCopiedGraphAdapters(model.bindingIr, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
	const p = native.layout.prefix;
	return {
		[`include/detail/${p}-graph-types.h`]: native.typesHeader
		, [`include/detail/${p}-graph.h`]: `${native.header}\n#ifdef __cplusplus\nextern "C" {\n#endif\nuint32_t ${p}_graph_initialize(void);\nint ${p}_graph_ready(void);\nvoid ${p}_graph_retire(void);\n#ifdef __cplusplus\n}\n#endif\n`
		, "src/native.c": `#include "component.h"\n${native.source}
uint32_t ${p}_graph_initialize(void) { return lean_bridge_native_component_initialize(${JSON.stringify(model.component.id)}, ng_initialize) ? 0 : 5; }
int ${p}_graph_ready(void) { return ng_ready(); }
void ${p}_graph_retire(void) { lean_bridge_native_runtime_retire(); }
__attribute__((destructor)) static void lb_graph_detach(void) { lean_bridge_native_component_detach(${JSON.stringify(model.component.id)}); }
` };
};
