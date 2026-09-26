/**
 * Typed recursive WIT calls and callback registration without manual wire tables.
 * Public graph values keep copied ownership separate from function identities.
 *
 * @file
 */
import { witGraphCallableFunctions } from "./callable-graph-session.mjs";

const scope = name => `lb_graph_scope ${name} = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};`;
const field = (model, callback) => callback.publicName.slice(model.prefix.length + 1);
const callbackBase = (model, callback) => `${model.prefix}_wasmtime_callback_${field(model, callback)}`;
const helperName = (model, fn) => fn.callback ? `${model.prefix}_wasmtime_function_${field(model, fn.callback)}_call`
	: `${model.prefix}_wasmtime_value_${fn.field}`;
const parameters = (model, nodes) => nodes.map((node, i) => node.kind === "callback"
	? `${model.prefix}_wasmtime_function arg${i}` : `const ${node.name} *arg${i}`);
const output = (model, node) => `${node.kind === "callback" ? `${model.prefix}_wasmtime_function` : node.name} *out`;
const callSignature = (model, fn) => `wasmtime_error_t *${helperName(model, fn)}(${[`${model.prefix}_wasmtime *session`, ...parameters(model, fn.parameters), output(model, fn.result)].join(", ")})`;
const copySignature = node => `wasmtime_error_t *${node.name}_wasmtime_copy(const ${node.name} *value, ${node.name} *out)`;

const validateNames = model => {
	const names = new Set();
	const claim = name => {
		if(names.has(name)) throw new TypeError(`WIT typed helper name collision: ${name}`);
		names.add(name);
	};
	for(const node of model.nodes.filter(node => node.aggregate))
		for(const name of [node.name, `${node.name}_init`, `${node.name}_clear`, `${node.name}_wasmtime_copy`]) claim(name);
	for(const fn of witGraphCallableFunctions(model)) claim(helperName(model, fn));
	for(const callback of model.callbacks.values())
		for(const suffix of ["fn", "create", "context", "release", "invoke"]) claim(`${callbackBase(model, callback)}_${suffix}`);
};

/**
 * Describe helpers over original copied types and session-owned function tokens.
 *
 * @param model - Validated recursive callable WIT model.
 */
export const renderWitGraphCallableTypedHeader = model => {
	validateNames(model);
	return `
#include "${model.prefix}-graph.h"
#ifdef __cplusplus
extern "C" {
#endif
/* These helpers cross the compiled component. Inputs borrow immutable copied
 * values and function tokens; outputs require fresh initialized slots. Copied
 * results own independent storage and use the generated type's _clear function.
 * Returned function tokens use ${model.prefix}_wasmtime_function_close. */
${witGraphCallableFunctions(model).map(fn => callSignature(model, fn) + ";").join("\n")}
/* Make an independently owned copy for callback results. The source may borrow
 * callback arguments. A fresh destination is required; failure leaves it alone. */
${model.nodes.filter(node => node.aggregate).map(node => copySignature(node) + ";").join("\n")}
/* Typed callbacks borrow their arguments. Return an owned error, or place a
 * valid graph in out that survives until the adapter copies it. An owned root
 * transfers to the adapter on both success and failure. Use _wasmtime_copy to
 * return an independent graph. Callback data transfers only if create succeeds;
 * release(data) runs exactly once after active calls finish. */
${[...model.callbacks.values()].map(callback => {
	const base = callbackBase(model, callback);
	return `typedef wasmtime_error_t *(*${base}_fn)(${["void *data", ...parameters(model, callback.parameters), output(model, callback.result)].join(", ")});
wasmtime_error_t *${base}_create(${model.prefix}_wasmtime *session, ${base}_fn callback, void *data, void (*release)(void *), ${model.prefix}_wasmtime_function *out);`;
}).join("\n")}
#ifdef __cplusplus
}
#endif
`;
};

const fresh = (model, node) => `!lb_buffer(out, 1, sizeof(*out), _Alignof(${node.kind === "callback" ? `${model.prefix}_wasmtime_function` : node.name}))`
	+ (node.kind === "callback" ? " || *out" : node.aggregate ? " || out->_bridge_owner || out->_bridge_release" : "");
const attach = (node, value, arena) => node.aggregate
	? `  ${value}._bridge_owner = ${arena}.memory.allocations; ${value}._bridge_release = ${arena}.memory.allocations ? lb_graph_release : NULL; ${arena}.memory.allocations = NULL;`
	: "";

const calls = model => witGraphCallableFunctions(model).map(fn => {
	const returned = fn.result.kind === "callback", result = fn.result;
	return `
${callSignature(model, fn)} {
  if (!lb_thread(session) || session->closing) return wasmtime_error_new("Invalid typed WIT session or wrong thread");
  if (${fresh(model, result)}) return wasmtime_error_new("Typed WIT result requires a fresh initialized slot");
  ${scope("input")}
  ${scope("output")}
  ${model.prefix}_wasmtime_value args[${Math.max(1, fn.parameters.length)}] = {0}, value = {0};
  wasmtime_error_t *failure = NULL;
${returned ? "" : `  ${result.name} converted = {0};`}
${fn.parameters.map((node, i) => node.kind === "callback" ? `  args[${i}].function = arg${i};`
		: `  if (!lb_graph_encode_${node.index}(arg${i}, &input, &args[${i}].value)) { failure = wasmtime_error_new("Invalid typed WIT input, conversion limit or allocation failure"); goto done; }`).join("\n")}
  failure = ${model.prefix}_wasmtime_invoke(session, "${fn.wire.witName}", args, ${fn.parameters.length}, &value);
  if (failure) goto done;
${returned ? "  *out = value.function;" : `  if (!lb_graph_decode_${result.index}(&value.value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Typed WIT result conversion limit or allocation failure" : "Malformed WIT result; runtime retired"); goto done;
  }
${attach(result, "converted", "output")}
  *out = converted;`}
done:
${fn.parameters.map((node, i) => node.kind === "callback" ? "" : `  wasmtime_component_val_delete(&args[${i}].value);`).filter(Boolean).join("\n")}
  wasmtime_component_val_delete(&value.value); lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}`;
}).join("\n");

const copies = model => model.nodes.filter(node => node.aggregate).map(node => `
${copySignature(node)} {
  if (${fresh(model, node)}) return wasmtime_error_new("Copied WIT result requires a fresh initialized slot");
  ${scope("input")}
  ${scope("output")}
  wasmtime_component_val_t wire = {0}; ${node.name} converted = {0};
  wasmtime_error_t *failure = NULL;
  if (!lb_graph_encode_${node.index}(value, &input, &wire) || !lb_graph_decode_${node.index}(&wire, &output, &converted)) {
    failure = wasmtime_error_new("Invalid copied WIT value, conversion limit or allocation failure"); goto done;
  }
${attach(node, "converted", "output")}
  *out = converted;
done:
  wasmtime_component_val_delete(&wire); lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}`).join("\n");

const callbacks = model => [...model.callbacks.values()].map(callback => {
	const base = callbackBase(model, callback), result = callback.result;
	return `
typedef struct { ${base}_fn callback; void *data; void (*release)(void *); } ${base}_context;
static void ${base}_release(void *data) {
  ${base}_context *context = data;
  if (context->release) context->release(context->data);
  free(context);
}
static wasmtime_error_t *${base}_invoke(void *data, const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  ${base}_context *context = data;
  if (count != ${callback.parameters.length}) return wasmtime_error_new("Typed WIT callback arity mismatch");
  ${scope("input")}
  ${scope("output")}
  wasmtime_error_t *failure = NULL;
  ${result.name} value = {0};
${callback.parameters.map((node, i) => `  ${node.name} arg${i} = {0};`).join("\n")}
${callback.parameters.map((node, i) => `  if (!lb_graph_decode_${node.index}(&args[${i}], &input, &arg${i})) { failure = wasmtime_error_new("Invalid typed WIT callback input, conversion limit or allocation failure"); goto done; }`).join("\n")}
  failure = context->callback(context->data, ${callback.parameters.map((_, i) => `&arg${i}`).concat("&value").join(", ")});
  if (failure) goto done;
  if (!lb_graph_encode_${result.index}(&value, &output, out)) failure = wasmtime_error_new("Invalid typed WIT callback result, conversion limit or allocation failure");
done:
  ${result.aggregate ? `${result.name}_clear(&value);` : ""}
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}
wasmtime_error_t *${base}_create(${model.prefix}_wasmtime *session, ${base}_fn callback, void *data, void (*release)(void *), ${model.prefix}_wasmtime_function *out) {
  if (!callback || !lb_thread(session) || session->closing || !lb_buffer(out, 1, sizeof(*out), _Alignof(${model.prefix}_wasmtime_function)) || *out) return wasmtime_error_new("Invalid typed WIT callback registration");
  ${base}_context *context = malloc(sizeof(*context));
  if (!context) return wasmtime_error_new("Cannot allocate typed WIT callback context");
  *context = (${base}_context){callback, data, release};
  wasmtime_error_t *failure = ${model.prefix}_wasmtime_callback_create(session, "${callback.resource.witName}", ${base}_invoke, context, ${base}_release, out);
  if (failure) free(context);
  return failure;
}`;
}).join("\n");

/**
 * Render owned typed calls and callbacks over the public component session API.
 *
 * @param model - Validated recursive callable WIT model.
 */
export const renderWitGraphCallableTypedSource = model => {
	validateNames(model);
	return copies(model) + calls(model) + callbacks(model);
};
