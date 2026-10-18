/**
 * Execute recursive callbacks and owned Lean closures through the component.
 * Native graph reply owners survive until Lean finishes copying their values.
 *
 * @file
 */
import { renderCallableHostHeader } from "./callable-host.mjs";
import { renderWitGraphConversions } from "./copied-graph-conversions.mjs";
import { renderWitGraphCallableSession, witGraphCallableFunctions } from "./callable-graph-session.mjs";
import { renderWitGraphCallableTypedHeader, renderWitGraphCallableTypedSource } from "./callable-graph-typed.mjs";

const scope = name => `lb_graph_scope ${name} = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};`;
const tag = (model, callback) => model.wire.resources.indexOf(callback.resource) + 1;

/**
 * Expose session-owned callable identities separately from finite copied values.
 *
 * @param model - Validated recursive callable WIT model.
 */
export const renderWitGraphCallableHostHeader = model => {
	const guard = `${model.prefix.toUpperCase()}_WASMTIME_CALLABLE_GRAPH_H`;
	return `#ifndef ${guard}\n#define ${guard}\n` + renderCallableHostHeader(model.wire)
		+ renderWitGraphCallableTypedHeader(model) + `\n#endif /* ${guard} */\n`;
};

const callbackBodies = model => [...model.callbacks.values()].map(callback => {
	const index = tag(model, callback), result = callback.result;
	return `
static uint32_t lb_graph_callback_${index}(void *data, ${callback.parameters.map((node, i) => `const ${node.name} *arg${i}`).concat(`${result.name} *out`).join(", ")}) {
  lb_entry *entry = lb_graph_callback_entry(data, ${index});
  if (!entry) return 1;
  ${model.prefix}_wasmtime *session = entry->session;
  if (session->poisoned || session->closing) return 1;
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(${result.name}))${result.aggregate ? " || out->_bridge_owner || out->_bridge_release" : ""}) return 1;
  if (entry->owned) {
    uint32_t status = ${callback.call}(((lb_graph_lease *)entry->owned)->token, ${callback.parameters.map((_, i) => `arg${i}`).concat("out").join(", ")});
    if (status) lb_record_text(session, "Native Lean closure call failed", sizeof("Native Lean closure call failed") - 1);
    return status;
  }
  ${scope("input")}
  ${scope("output")}
  wasmtime_component_val_t args[${Math.max(1, callback.parameters.length)}] = {{0}}, reply = {0};
  wasmtime_error_t *failure = NULL;
  uint32_t status = 0;
  ${result.name} converted = {0};
${result.aggregate ? "  lb_result *owner = NULL;" : ""}
${callback.parameters.map((node, i) => `  if (!lb_graph_encode_${node.index}(arg${i}, &input, &args[${i}])) {
    if (!input.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(input.memory.failure ? "WIT callback input conversion limit or allocation failure" : "Malformed native callback input; runtime retired"); goto done;
  }`).join("\n")}
  failure = entry->callback(entry->data, args, ${callback.parameters.length}, &reply);
  if (failure || session->poisoned || session->closing) goto done;
  if (!lb_graph_decode_${result.index}(&reply, &output, &converted)) { failure = wasmtime_error_new("Invalid WIT callback result, conversion limit or allocation failure"); goto done; }
  if (!lean_bridge_native_component_ready(${JSON.stringify(model.ir.component.id)})) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
${result.aggregate ? `  if (!lb_charge(&output.memory, 1, sizeof(*owner))) { failure = wasmtime_error_new("WIT callback reply ownership limit"); goto done; }
  owner = calloc(1, sizeof(*owner));
  if (!owner) { failure = wasmtime_error_new("Cannot allocate WIT callback reply owner"); goto done; }
  owner->scope = output.memory; output.memory.allocations = NULL;
  owner->value = reply; reply = (wasmtime_component_val_t){0};
  converted._bridge_owner = owner; converted._bridge_release = lb_result_release;` : ""}
  *out = converted;
done:
  if (failure) { lb_record_error(session, failure); wasmtime_error_delete(failure); }
  if (session->closing && !session->poisoned) lb_record_text(session, "WIT session closed during callback", sizeof("WIT session closed during callback") - 1);
  if (session->poisoned) status = 1;
  for (size_t i = 0; i < ${callback.parameters.length}; ++i) wasmtime_component_val_delete(&args[i]);
  wasmtime_component_val_delete(&reply); lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return status;
}
static inline void lb_graph_owned_drop_${index}(void *data) {
  lb_graph_lease *lease = data; ${callback.dispose}(lease->token); free(lease);
}`;
}).join("\n");

const importBodies = model => witGraphCallableFunctions(model).map((fn, index) => {
	const returned = fn.result.kind === "callback", result = fn.result;
	const call = fn.callback ? `lb_graph_callback_${tag(model, fn.callback)}(entry0, ${fn.parameters.slice(1).map((_, i) => `&arg${i + 1}`).concat("&value").join(", ")})`
		: `${fn.native}(${fn.parameters.map((_, i) => `&arg${i}`).concat("&value").join(", ")})`;
	return `
static wasmtime_error_t *lb_call_${index}(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  (void)type; (void)context;
  ${model.prefix}_wasmtime *session = data;
  if (!session->frame || session->poisoned || session->closing || count != ${fn.parameters.length} || result_count != 1
      || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t))
      || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("Unavailable WIT graph import or signature mismatch");
  ${scope("input")}
  ${scope("output")}
  wasmtime_error_t *failure = NULL;
  ${returned ? "uint64_t" : result.name} value = {0};
  wasmtime_component_val_t converted = {0};
${fn.parameters.map((node, i) => node.kind === "callback"
		? `  lb_entry *entry${i} = NULL;${fn.callback ? "" : `\n  ${node.name} arg${i} = {0};`}`
		: `  ${node.name} arg${i} = {0};`).join("\n")}
${fn.parameters.map((node, i) => node.kind === "callback"
		? `  failure = lb_borrow(session, context, &args[${i}], ${tag(model, node)}, &entry${i});
  if (failure) goto done;
${fn.callback ? "" : `  arg${i} = (${node.name}){.call = lb_graph_callback_${tag(model, node)}, .context = entry${i}};`}`
		: `  if (!lb_graph_decode_${node.index}(&args[${i}], &input, &arg${i})) { failure = wasmtime_error_new("Invalid WIT graph input, conversion limit or allocation failure"); goto done; }`).join("\n")}
  if (${call}) { failure = wasmtime_error_new("Native Lean graph call failed"); goto done; }
  if (session->poisoned || session->closing) { failure = wasmtime_error_new("WIT callback failed or session closed"); goto done; }
${returned ? `  if (!value) { lean_bridge_native_runtime_retire(); failure = wasmtime_error_new("Missing native closure identity; runtime retired"); goto done; }
  session->frame->pending = lb_entry_new(session, ${tag(model, result)});
  if (!session->frame->pending) { failure = wasmtime_error_new("WIT callable capacity exhausted"); goto done; }
  lb_graph_lease *lease = malloc(sizeof(*lease));
  if (!lease) { failure = wasmtime_error_new("Cannot allocate WIT closure identity owner"); goto done; }
  lease->token = value; value = 0;
  session->frame->pending->owned = lease; session->frame->pending->release = lb_graph_owned_drop_${tag(model, result)};
  failure = lb_proxy(session, context, session->frame->pending, &converted);
  if (failure) goto done;` : `  if (!lb_graph_encode_${result.index}(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }`}
  if (!lean_bridge_native_component_ready(${JSON.stringify(model.ir.component.id)})) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  if (failure) lb_record_error(session, failure);
  wasmtime_component_val_delete(&converted);
  ${returned ? `if (value) ${result.dispose}(value);` : result.aggregate ? `${result.name}_clear(&value);` : ""}
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}`;
}).join("\n");

/**
 * Render the component host over the original native recursive callback ABI.
 *
 * @param model - Validated recursive callable WIT model.
 * @param componentBytes - Validated forwarding component bytes.
 */
export const renderWitGraphCallableHostSource = (model, componentBytes) => {
	const { prelude, api } = renderWitGraphCallableSession(model, componentBytes);
	return `#include "${model.prefix}_wasmtime.h"
#include "${model.prefix}-graph.h"
#include "lean_bridge_native_runtime.h"
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
${renderWitGraphConversions(model, { allRoots: true })}
${prelude}
typedef struct { uint64_t token; } lb_graph_lease;
${callbackBodies(model)}
${importBodies(model)}
${api}
${renderWitGraphCallableTypedSource(model)}`;
};
