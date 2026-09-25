/**
 * Session-owned primitive callable values for the native Component Model host.
 *
 * @file
 */
import { renderWitConversions, witConversionPrelude } from "./copied-conversions.mjs";
import { renderCallableHostRuntime } from "./callable-host-runtime.mjs";
import { inlineCallableResult, renderCallableResultOwners } from "./callable-result-owners.mjs";

/**
 * Render the checked callable session API.
 *
 * @param root0 - Admitted WIT model.
 * @param root0.surface - Shared C surface.
 * @param root0.surface.prefix - Public C symbol prefix.
 */
export const renderCallableHostHeader = ({ surface: { prefix: p } }) => `#ifndef ${p.toUpperCase()}_WASMTIME_H
#define ${p.toUpperCase()}_WASMTIME_H
#include <stdint.h>
#include <wasmtime.h>
#include <wasmtime/component.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct ${p}_wasmtime ${p}_wasmtime;
/* Opaque, generation-checked identity. Never cast this token to a pointer. */
typedef uint64_t ${p}_wasmtime_function;
typedef struct {
  wasmtime_component_val_t value;
  ${p}_wasmtime_function function; /* Nonzero for a callable; value is unused. */
} ${p}_wasmtime_value;
/* Arguments are borrowed. Set out to an independently owned Wasmtime value,
 * or return an owned error. The adapter deletes either, including on failure.
 * Callbacks may reenter their session. Finalizers must not reenter it. */
typedef wasmtime_error_t *(*${p}_wasmtime_callback)(void *data,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out);
wasmtime_error_t *${p}_wasmtime_open(${p}_wasmtime **out);
/* Callable imports require an owning session. This returns an error; it never
 * partially populates a caller-owned linker. Copied-only packages support link. */
wasmtime_error_t *${p}_wasmtime_link(wasmtime_component_linker_t *linker);
/* signature is the resource name from this package's WIT interface.
 * data transfers only on success; release(data) runs once after active calls. */
wasmtime_error_t *${p}_wasmtime_callback_create(${p}_wasmtime *session,
    const char *signature, ${p}_wasmtime_callback callback, void *data,
    void (*release)(void *), ${p}_wasmtime_function *out);
/* Calls exports, including invoke-function-* exports, through the component.
 * Arguments borrow values/tokens. On success out owns a copied value or token.
 * On error out is unchanged. Use a fresh result slot. */
wasmtime_error_t *${p}_wasmtime_invoke(${p}_wasmtime *session, const char *name,
    const ${p}_wasmtime_value *args, size_t count, ${p}_wasmtime_value *out);
/* Compatibility API for exports without callable arguments or results. */
wasmtime_error_t *${p}_wasmtime_call(${p}_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out);
/* Zeroes the caller's token on success. Closing zero is harmless. Aliases become
 * invalid immediately; calls already in progress retain their inputs. */
wasmtime_error_t *${p}_wasmtime_function_close(${p}_wasmtime *session,
    ${p}_wasmtime_function *function);
/* Sessions/tokens are confined to their creating thread and process.
 * Close releases every token. During a call, destruction waits for its return.
 * No session API may be used after close; copied results remain independent. */
void ${p}_wasmtime_close(${p}_wasmtime *session);
#ifdef __cplusplus
}
#endif
#endif
`;

const callableBodies = model => {
	const { surface, resources } = model, p = surface.prefix, m = p.toUpperCase();
	return resources.map((resource, index) => {
		const signature = resource.type.callable;
		const copies = signature.parameters.map(site => surface.copy(site.type)), result = surface.copy(signature.result.type);
		const inline = inlineCallableResult(result), arena = inline ? "owner->result" : "(*owner)";
		const unit = result.scalarName === "unit", owned = `${p}_owned_${resource.field}`;
		const parameters = copies.map((copy, i) => `${copy.aggregate ? "const " : ""}${copy.name}${copy.aggregate ? " *" : " "}arg${i}`);
		return `static ${p}_status lb_callback_${index}(void *data, ${parameters.concat(unit ? [] : [`${result.name} *out`]).concat(`${p}_error *error`).join(", ")}) {
  lb_entry *entry = data;
  ${p}_wasmtime *session = entry->session;
  if (!entry->active || session->poisoned || session->closing) return lb_native_error(session, error, "Unavailable WIT callable");
  if (entry->owned) return ${owned}_call(entry->owned, ${copies.map((_, i) => `arg${i}`).concat(unit ? [] : ["out"]).concat("error").join(", ")});
  lb_scope scope = {.remaining = LB_BUDGET};
  wasmtime_component_val_t args[${copies.length}] = {{0}}, value = {0};
  wasmtime_error_t *failure = NULL;
  ${p}_status status = ${m}_STATUS_OK;
  ${result.name} converted = {0};
${copies.map((copy, i) => `  if (!lb_out_${copy.index}(${copy.aggregate ? "" : "&"}arg${i}, &scope, &args[${i}])) { failure = wasmtime_error_new("WIT callback input conversion limit"); goto done; }`).join("\n")}
  failure = entry->callback(entry->data, args, ${copies.length}, &value);
  if (failure || session->poisoned || session->closing) goto done;
${result.aggregate ? `${inline ? `  if (!lb_charge(&scope, 1, sizeof(lb_shared_result))) { failure = wasmtime_error_new("WIT callback result ownership limit"); goto done; }\n` : ""}  ${inline ? "lb_shared_result" : "lb_result"} *owner = calloc(1, sizeof(*owner));
  if (!owner) { failure = wasmtime_error_new("Cannot allocate WIT callback result"); goto done; }
  ${inline ? "owner->references = 1;\n  " : ""}${inline ? `${arena}.scope` : "owner->scope"}.remaining = scope.remaining;
  if (!lb_in_${result.index}(&value, &${inline ? `${arena}.scope` : "owner->scope"}, &converted)) {
    lb_result_release(${inline ? `&${arena}` : "owner"}); failure = wasmtime_error_new("Invalid WIT callback result or conversion limit"); goto done;
  }
  ${inline ? `${arena}.value` : "owner->value"} = value; value = (wasmtime_component_val_t){0};
  ${inline ? `lb_result_attach_${result.index}(&converted, owner); lb_shared_result_release(owner);` : "converted.owner = owner; converted.release = lb_result_release;"}
  *out = converted;` : `  if (!lb_in_${result.index}(&value, &scope, &converted)) { failure = wasmtime_error_new("Invalid WIT callback result or conversion limit"); goto done; }
  ${unit ? "(void)converted;" : "*out = converted;"}`}
done:
  if (failure) { lb_record_error(session, failure); wasmtime_error_delete(failure); }
  if (failure || session->poisoned || session->closing) status = lb_native_error(session, error, "WIT callback failed or session closed");
  for (size_t i = 0; i < ${copies.length}; ++i) wasmtime_component_val_delete(&args[i]);
  wasmtime_component_val_delete(&value); lb_scope_close(&scope);
  return status;
}
static inline void lb_owned_drop_${index}(void *pointer) {
  ${owned} *owned = pointer; ${owned}_dispose(&owned);
}`;
	}).join("\n\n");
};

const importBodies = model => {
	const { surface, resources, functions } = model, p = surface.prefix;
	const resourceFor = copy => resources.find(resource => resource.index === copy.resourceIndex);
	return functions.map((fn, index) => {
		const result = fn.resultCopy, returned = result.resource ? resourceFor(result) : null;
		const unit = result.scalarName === "unit";
		const params = fn.parameters.map((parameter, i) => ({ ...parameter, name: `arg${i}`, resource: parameter.copy.resource ? resourceFor(parameter.copy) : null }));
		const nativeArgs = params.map(parameter => `${parameter.copy.aggregate || parameter.resource ? "&" : ""}${parameter.name}`);
		const call = fn.resource
			? `lb_callback_${resources.indexOf(fn.resource)}(entry0, ${nativeArgs.slice(1).concat(unit ? [] : ["&value"]).concat("&native_error").join(", ")})`
			: `${fn.name}(${nativeArgs.concat(unit ? [] : ["&value"]).concat("&native_error").join(", ")})`;
		return `static wasmtime_error_t *lb_call_${index}(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  (void)type; (void)context;
  ${p}_wasmtime *session = data;
  if (!session->frame || session->poisoned || session->closing || count != ${params.length} || result_count != 1 || (${params.length} && !args) || !results)
    return wasmtime_error_new("Unavailable WIT import or signature mismatch");
  lb_scope scope = {.remaining = LB_BUDGET};
  wasmtime_error_t *failure = NULL;
  ${p}_error native_error = {0};
  ${returned ? `${p}_owned_${returned.field} *` : result.name + " "}value = {0};
  wasmtime_component_val_t converted = {0};
${params.map((parameter, i) => parameter.resource ? `  lb_entry *entry${i} = NULL;${fn.resource ? "" : `\n  ${parameter.resource.name} ${parameter.name} = {0};`}` : `  ${parameter.copy.name} ${parameter.name} = {0};`).join("\n")}
${params.map((parameter, i) => parameter.resource ? `  failure = lb_borrow(session, context, &args[${i}], ${resources.indexOf(parameter.resource) + 1}, &entry${i});
  if (failure) goto done;
${fn.resource ? "" : `  ${parameter.name} = (${parameter.resource.name}){.call = lb_callback_${resources.indexOf(parameter.resource)}, .context = entry${i}};`}` : `  if (!lb_in_${parameter.copy.index}(&args[${i}], &scope, &${parameter.name})) { failure = wasmtime_error_new("Invalid WIT input or conversion limit"); goto done; }`).join("\n")}
  if (${call} != ${p.toUpperCase()}_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (session->poisoned || session->closing) { failure = wasmtime_error_new("WIT call failed or session closed"); goto done; }
${returned ? `  session->frame->pending = lb_entry_new(session, ${resources.indexOf(returned) + 1});
  if (!session->frame->pending) { failure = wasmtime_error_new("WIT callable capacity exhausted"); goto done; }
  session->frame->pending->owned = value; value = NULL;
  session->frame->pending->release = lb_owned_drop_${resources.indexOf(returned)};
  failure = lb_proxy(session, context, session->frame->pending, &converted);
  if (failure) goto done;` : `  if (!lb_out_${result.index}(&value, &scope, &converted)) { failure = wasmtime_error_new("WIT result conversion limit"); goto done; }`}
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  if (failure) lb_record_error(session, failure);
  wasmtime_component_val_delete(&converted);
  ${returned ? `${p}_owned_${returned.field}_dispose(&value);` : result.aggregate ? `${result.name}_clear(&value);` : ""}
  lb_scope_close(&scope); return failure;
}`;
	}).join("\n\n");
};

/**
 * Generate the native callable host without changing copied-only packages.
 *
 * @param model - Admitted callable projection.
 * @param componentBytes - Validated embedded component.
 */
export const renderCallableHostSource = (model, componentBytes) => {
	const { surface: { prefix: p } } = model;
	const { prelude, api } = renderCallableHostRuntime(model, componentBytes);
	const owners = model.resources.some(resource => inlineCallableResult(model.surface.copy(resource.type.callable.result.type)))
		? renderCallableResultOwners(model.surface) : "";
	return `#include "${p}_wasmtime.h"
#include "${p}.h"
#include "lean_bridge_native_runtime.h"
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
${witConversionPrelude}
${renderWitConversions(model)}
${prelude}${owners ? "\n" + owners : ""}
${callableBodies(model)}
${importBodies(model)}
${api}`;
};
