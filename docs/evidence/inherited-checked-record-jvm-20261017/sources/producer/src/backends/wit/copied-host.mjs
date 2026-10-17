/**
 * Generate a Wasmtime embedding library backed by the shared native Lean API.
 *
 * @file
 */
import { renderWitConversions, witConversionPrelude } from "./copied-conversions.mjs";
import { renderCallableHostHeader, renderCallableHostSource } from "./callable-host.mjs";

/**
 * Render the session API. Each session owns an engine and store for one thread.
 *
 * @param root0 - Admitted copied WIT model.
 * @param root0.surface - Shared C naming and function model.
 */
export const renderWitHostHeader = ({ surface }) => {
	if(surface.callbacks.size) return renderCallableHostHeader({ surface });
	const p = surface.prefix;
	return `#ifndef ${p.toUpperCase()}_WASMTIME_H
#define ${p.toUpperCase()}_WASMTIME_H
#include <wasmtime.h>
#include <wasmtime/component.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct ${p}_wasmtime ${p}_wasmtime;
/* Open the embedded, compiled component. Output is unchanged on failure. */
wasmtime_error_t *${p}_wasmtime_open(${p}_wasmtime **out);
/* Add this package's native import to a caller-owned linker. */
wasmtime_error_t *${p}_wasmtime_link(wasmtime_component_linker_t *linker);
/* Call a WIT export by name. Arguments borrow valid Wasmtime C values.
 * Result is independently owned; delete it with wasmtime_component_val_delete.
 * Use a fresh result slot. An error leaves it unchanged. */
wasmtime_error_t *${p}_wasmtime_call(${p}_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out);
/* Dispose the session; caller-owned results remain valid. */
void ${p}_wasmtime_close(${p}_wasmtime *session);
#ifdef __cplusplus
}
#endif
#endif
`;
};

/**
 * Lower and raise every admitted value across an actual Component Model call.
 *
 * @param model - Validated copied WIT projection.
 * @param componentBytes - Validated compiled component bytes to embed.
 */
export const renderWitHostSource = (model, componentBytes) => {
	const { surface } = model, p = surface.prefix;
	if(surface.callbacks.size) return renderCallableHostSource(model, componentBytes);
	const callbacks = surface.functions.map((fn, index) => {
		const result = surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
		return `static wasmtime_error_t *lb_call_${index}(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  (void)data; (void)context; (void)type;
  if (count != ${fn.parameters.length} || result_count != 1 || (${fn.parameters.length} && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  ${p}_error native_error = {0};
  ${result.name} value = {0};
  wasmtime_component_val_t converted = {0};
${fn.parameters.map(parameter => `  ${parameter.copy.name} ${parameter.name} = {0};`).join("\n")}
${fn.parameters.map((parameter, i) => `  if (!lb_in_${parameter.copy.index}(&args[${i}], &scope, &${parameter.name})) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }`).join("\n")}
  if (${fn.name}(${fn.parameters.map(parameter => `${parameter.copy.aggregate ? "&" : ""}${parameter.name}`).concat(unit ? [] : ["&value"]).concat("&native_error").join(", ")}) != ${p.toUpperCase()}_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_${result.index}(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  ${result.aggregate ? `${result.name}_clear(&value);` : ""}
  lb_scope_close(&scope);
  return failure;
}`;
	}).join("\n\n");
	return `#include "${p}_wasmtime.h"
#include "${p}.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
${witConversionPrelude}
${renderWitConversions(model)}
${callbacks}

static const uint8_t lb_component[] = {${[...componentBytes].join(",")}};
struct ${p}_wasmtime {
  wasm_engine_t *engine;
  wasmtime_component_t *component;
  wasmtime_store_t *store;
  wasmtime_component_linker_t *linker;
  wasmtime_component_instance_t instance;
};
wasmtime_error_t *${p}_wasmtime_link(wasmtime_component_linker_t *linker) {
  if (!linker) return wasmtime_error_new("Missing Wasmtime linker");
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *host = NULL;
  wasmtime_error_t *error = wasmtime_component_linker_instance_add_instance(root, "${model.importName}", ${model.importName.length}, &host);
  if (!error) {
${surface.functions.map((fn, i) => `    if (!error) error = wasmtime_component_linker_instance_add_func(host, "${fn.witName}", ${fn.witName.length}, lb_call_${i}, NULL, NULL);`).join("\n")}
    wasmtime_component_linker_instance_delete(host);
  }
  wasmtime_component_linker_instance_delete(root);
  return error;
}
static wasmtime_error_t *lb_refresh(${p}_wasmtime *session) {
  if (session->store) wasmtime_store_delete(session->store);
  session->store = wasmtime_store_new(session->engine, NULL, NULL);
  wasmtime_error_t *error = wasmtime_component_linker_instantiate(session->linker, wasmtime_store_context(session->store), session->component, &session->instance);
  if (error) { wasmtime_store_delete(session->store); session->store = NULL; }
  return error;
}
void ${p}_wasmtime_close(${p}_wasmtime *session) {
  if (!session) return;
  if (session->linker) wasmtime_component_linker_delete(session->linker);
  if (session->store) wasmtime_store_delete(session->store);
  if (session->component) wasmtime_component_delete(session->component);
  if (session->engine) wasm_engine_delete(session->engine);
  free(session);
}
wasmtime_error_t *${p}_wasmtime_open(${p}_wasmtime **out) {
  if (!out) return wasmtime_error_new("Missing session output");
  ${p}_wasmtime *session = calloc(1, sizeof(*session));
  if (!session) return wasmtime_error_new("Cannot allocate Wasmtime session");
  wasm_config_t *config = wasm_config_new();
  if (!config) { free(session); return wasmtime_error_new("Cannot allocate Wasmtime configuration"); }
  wasmtime_config_wasm_component_model_set(config, true);
  session->engine = wasm_engine_new_with_config(config);
  wasmtime_error_t *error = wasmtime_component_new(session->engine, lb_component, sizeof(lb_component), &session->component);
  if (!error) {
    session->linker = wasmtime_component_linker_new(session->engine);
    error = ${p}_wasmtime_link(session->linker);
    if (!error) error = lb_refresh(session);
  }
  if (error) { ${p}_wasmtime_close(session); return error; }
  *out = session; return NULL;
}
wasmtime_error_t *${p}_wasmtime_call(${p}_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  if (!session || !session->store || !name || !out || (count && !args)) return wasmtime_error_new("Invalid WIT call arguments or unavailable session");
  /* Validate before Wasmtime copies caller buffers, including allocation bounds. */
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  (void)scope; /* A package may contain only zero-argument exports. */
  bool valid = false;
${surface.functions.map(fn => `  if (strcmp(name, "${fn.witName}") == 0) valid = count == ${fn.parameters.length}${fn.parameters.map((parameter, i) => ` && lb_in_${parameter.copy.index}(&args[${i}], &scope, NULL)`).join("")};`).join("\n")}
  if (!valid) return wasmtime_error_new("Unknown export, invalid WIT input or 16 MiB conversion limit");
  wasmtime_context_t *context = wasmtime_store_context(session->store);
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&session->instance, context, NULL, "${model.exportName}", ${model.exportName.length});
  if (!api) return wasmtime_error_new("Component API export is missing");
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&session->instance, context, api, name, strlen(name));
  wasmtime_component_export_index_delete(api);
  if (!index) return wasmtime_error_new("Component function export is missing");
  wasmtime_component_func_t function;
  bool found = wasmtime_component_instance_get_func(&session->instance, context, index, &function);
  wasmtime_component_export_index_delete(index);
  if (!found) return wasmtime_error_new("Component export is not a function");
  wasmtime_component_val_t result = {0};
  wasmtime_error_t *error = wasmtime_component_func_call(&function, context, args, count, &result, 1);
  if (error) {
    wasmtime_component_val_delete(&result);
    /* A trap bypasses canonical post-return. Dispose its store and scratch memory. */
    wasmtime_error_t *reset_error = lb_refresh(session);
    if (reset_error) wasmtime_error_delete(reset_error);
    return error;
  }
  *out = result; return NULL;
}
`;
};
