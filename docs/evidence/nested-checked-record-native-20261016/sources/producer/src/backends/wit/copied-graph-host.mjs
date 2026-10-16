/**
 * Execute recursive copied values through the compiled Component Model and Lean.
 * Typed C helpers hide WIT's finite tables and own their returned native graphs.
 *
 * @file
 */
import { renderWitHostHeader, renderWitHostSource } from "./copied-host.mjs";
import { renderWitGraphConversions } from "./copied-graph-conversions.mjs";

const scope = name => `lb_graph_scope ${name} = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};`;
const functions = model => {
	const nodes = new Map(model.nodes.map(node => [node.id, node]));
	return model.layout.roots.map((root, index) => ({ ...root
		, parameters: root.parameters.map(id => nodes.get(id))
		, result: nodes.get(root.result)
		, witName: model.wire.functions[index].witName
		, helperName: `${model.layout.prefix}_wasmtime_value_${root.name.slice(model.layout.prefix.length + 1)}` }));
};
const signature = (fn, p) => `wasmtime_error_t *${fn.helperName}(${p}_wasmtime *session, ${fn.parameters.map((node, index) => `const ${node.name} *arg${index}`).concat(`${fn.result.name} *out`).join(", ")})`;

/**
 * Render the generic Wasmtime API plus typed, explicitly owned C graph calls.
 *
 * @param model - Validated recursive WIT model.
 */
export const renderWitGraphHostHeader = model => renderWitHostHeader(model.wire) + `
#include "${model.layout.prefix}-graph.h"
#ifdef __cplusplus
extern "C" {
#endif
/* Arguments borrow valid native graphs. Results require a fresh initialized
 * slot and own independent storage. Use the result type's _clear function.
 * These helpers cross the compiled component; they never call Lean directly. */
${functions(model).map(fn => signature(fn, model.layout.prefix) + ";").join("\n")}
#ifdef __cplusplus
}
#endif
`;

/**
 * Reuse established session/trap handling with graph-aware preflight, native
 * import adapters and typed helpers. Source markers fail closed on template drift.
 *
 * @param model - Validated recursive WIT projection.
 * @param componentBytes - Validated forwarding component binary.
 */
export const renderWitGraphHostSource = (model, componentBytes) => {
	const p = model.layout.prefix, exports = functions(model);
	const base = renderWitHostSource(model.wire, componentBytes);
	const unique = (source, marker) => {
		if(source.split(marker).length !== 2) throw new Error("WIT session source changed; review recursive host integration");
		return source.indexOf(marker);
	};
	let session = base.slice(unique(base, "static const uint8_t lb_component[]"));
	const start = unique(session, "  /* Validate before Wasmtime copies caller buffers, including allocation bounds. */");
	const end = unique(session, "  wasmtime_context_t *context = wasmtime_store_context(session->store);");
	if(end <= start) throw new Error("WIT graph validation must precede the component call");
	session = session.slice(0, start) + `  /* Check every referenced row before Wasmtime copies any caller value. */
  if (!lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("Invalid WIT argument storage");
  ${scope("validation")}
  bool valid = false;
${exports.map(fn => `  if (strcmp(name, "${fn.witName}") == 0) valid = count == ${fn.parameters.length}${fn.parameters.map((node, index) => ` && lb_graph_decode_${node.index}(&args[${index}], &validation, NULL)`).join("")};`).join("\n")}
  lb_scope_close(&validation.memory);
  if (!valid) return wasmtime_error_new("Unknown export, invalid copied graph or conversion limit");
` + session.slice(end);
	const callbacks = exports.map((fn, index) => `
static wasmtime_error_t *lb_call_${index}(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  (void)data; (void)context; (void)type;
  if (count != ${fn.parameters.length} || result_count != 1 || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("WIT graph import signature mismatch");
  ${scope("input")}
  ${scope("output")}
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t converted = {0};
  ${fn.result.name} value = {0};
${fn.parameters.map((node, position) => `  ${node.name} arg${position} = {0};`).join("\n")}
${fn.parameters.map((node, position) => `  if (!lb_graph_decode_${node.index}(&args[${position}], &input, &arg${position})) { failure = wasmtime_error_new("Invalid copied WIT graph, allocation failure or conversion limit"); goto done; }`).join("\n")}
  uint32_t status = ${fn.name}_graph(${fn.parameters.map((_, position) => `&arg${position}`).concat("&value").join(", ")});
  if (status) { failure = wasmtime_error_new("Native Lean graph call failed"); goto done; }
  if (!lb_graph_encode_${fn.result.index}(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }
  if (!lean_bridge_native_component_ready(${JSON.stringify(model.ir.component.id)})) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  ${fn.result.aggregate ? `${fn.result.name}_clear(&value);` : ""}
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}
`).join("\n");
	const helpers = exports.map(fn => `
${signature(fn, p)} {
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(${fn.result.name}))${fn.result.aggregate ? " || out->_bridge_owner || out->_bridge_release" : ""}) return wasmtime_error_new("Graph output requires a fresh initialized slot");
  ${scope("input")}
  ${scope("output")}
  wasmtime_error_t *failure = NULL;
  ${fn.parameters.length ? `wasmtime_component_val_t arguments[${fn.parameters.length}] = {{0}};` : ""}
  wasmtime_component_val_t result = {0};
  ${fn.result.name} converted = {0};
${fn.parameters.map((node, index) => `  if (!lb_graph_encode_${node.index}(arg${index}, &input, &arguments[${index}])) { failure = wasmtime_error_new("Invalid native graph input, allocation failure or conversion limit"); goto done; }`).join("\n")}
  failure = ${p}_wasmtime_call(session, "${fn.witName}", ${fn.parameters.length ? "arguments" : "NULL"}, ${fn.parameters.length}, &result);
  if (failure) goto done;
  if (!lb_graph_decode_${fn.result.index}(&result, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Graph result conversion limit or allocation failure" : "Malformed WIT graph result; runtime retired"); goto done;
  }
${fn.result.aggregate ? "  converted._bridge_owner = output.memory.allocations; converted._bridge_release = output.memory.allocations ? lb_graph_release : NULL; output.memory.allocations = NULL;" : ""}
  *out = converted;
done:
${fn.parameters.map((_, index) => `  wasmtime_component_val_delete(&arguments[${index}]);`).join("\n")}
  wasmtime_component_val_delete(&result);
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return failure;
}
`).join("\n");
	return `#include "${p}_wasmtime.h"
#include "lean_bridge_native_runtime.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
${renderWitGraphConversions(model)}
${callbacks}
${session}
${helpers}`;
};
