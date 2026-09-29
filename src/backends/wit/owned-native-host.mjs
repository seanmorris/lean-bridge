/**
 * Component Model imports that execute authenticated owned Lean adapters.
 * This private host is not an installed package or a public session API.
 *
 * @file
 */
import { renderOwnedWitGraphConversions } from "./owned-graph-conversions.mjs";
import { renderOwnedWitNativeResources } from "./owned-native-resources.mjs";

/**
 * Link nominal resources and every declared export, including returned closure
 * invocation. Host callback registration is a separate session responsibility.
 *
 * @param model - Owned WIT projection of the same IR as owned-values-codec.h.
 */
export const renderOwnedWitNativeHost = model => {
	const table = new Map(model.layout.nodes.map(node => [node.id, node]));
	const bodies = model.functions.map((fn, index) => {
		const native = fn.resource ? model.layout.callbacks.find(item => item.id === fn.resource.id)
			: model.layout.functions.find(item => item.id === fn.declaration.id);
		if(!native || native.parameters.length !== fn.parameters.length) throw new TypeError("Owned WIT/native signature mismatch");
		const result = table.get(native.result);
		return `
static wasmtime_error_t *ow_native_import_${index}(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  (void)type;
  ow_native_host *host = data;
  if (!ow_native_ready(host) || context != host->context || !host->call || host->failure
      || count != ${native.parameters.length} || result_count != 1
      || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t))
      || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("Unavailable owned WIT import or signature mismatch");
  ow_native_conversion input, output;
  ow_native_conversion_init(&input, host); ow_native_conversion_init(&output, host);
  ov_result_owner owner = {0}; ${result.cName} value = {0};
  wasmtime_component_val_t converted = {0}; wasmtime_error_t *failure = NULL;
  int status = 0;
${native.parameters.map((id, i) => `  ${table.get(id).cName} arg${i} = {0};`).join("\n")}
${native.parameters.map((id, i) => `  if (!ow_decode_${table.get(id).index}_input(&args[${i}], &input.scope, &arg${i})) {
    failure = wasmtime_error_new("Invalid owned WIT input, expired resource or conversion limit"); goto done;
  }`).join("\n")}
  status = ${native.symbol}(host->native, ${native.parameters.map((_, i) => `&arg${i}`).concat("&value", "&owner").join(", ")});
  if (status) {
    if (status == OV_RESULT) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new("Owned Lean call failed"); goto done;
  }
  if (!ow_encode_${result.index}_output(&value, &output.scope, &converted)) {
    failure = wasmtime_error_new("Owned WIT result conversion or resource acquisition failed"); goto done;
  }
  if (!ow_native_ready(host) || host->failure) { failure = wasmtime_error_new("Owned WIT session became unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  ow_value_delete(&output.scope, &converted);
  status = ov_owner_clear(&owner);
  if (status && !failure) failure = wasmtime_error_new("Owned Lean result release failed");
  ow_native_conversion_close(&output); ow_native_conversion_close(&input);
  return failure;
}
`;
	});
	return `#include <wasmtime.h>
#include <wasmtime/component.h>
#include "owned-values-codec.h"
${renderOwnedWitGraphConversions(model)}
${renderOwnedWitNativeResources(model)}
${bodies.join("\n")}
static inline wasmtime_error_t *ow_native_link(ow_native_host *host, wasmtime_component_linker_t *linker) {
  if (!ow_native_ready(host) || !linker) return wasmtime_error_new("Invalid owned WIT host");
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *native = NULL;
  wasmtime_error_t *error = wasmtime_component_linker_instance_add_instance(root, ${JSON.stringify(model.importName)}, ${model.importName.length}, &native);
  if (!error) {
${model.resources.map(resource => `    if (!error) {
      wasmtime_component_resource_type_t *type = wasmtime_component_resource_type_new_host(host->tags[${resource.node.index}]);
      error = wasmtime_component_linker_instance_add_resource(native, ${JSON.stringify(resource.witName)}, ${resource.witName.length}, type, ow_native_resource_drop, host, NULL);
      wasmtime_component_resource_type_delete(type);
    }`).join("\n")}
${model.functions.map((fn, i) => `    if (!error) error = wasmtime_component_linker_instance_add_func(native, ${JSON.stringify(fn.witName)}, ${fn.witName.length}, ow_native_import_${i}, host, NULL);`).join("\n")}
    wasmtime_component_linker_instance_delete(native);
  }
  wasmtime_component_linker_instance_delete(root); return error;
}
`;
};
