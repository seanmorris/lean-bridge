/**
 * Zend downcalls and typed callbacks over compiler-authenticated owned carriers.
 *
 * @file
 */
import { canonicalJson } from "../../capsule/node.mjs";
import { compileOwnedPhpZendModel } from "./owned-zend-model.mjs";
import { ownedZendWalkSource } from "./owned-zend-walk.mjs";
import { ownedZendCallbacks } from "./owned-zend-callbacks.mjs";
import { ownedZendBorrowCalls, ownedZendBorrowEntries, ownedZendBorrowHandles } from "./owned-zend-borrow-calls.mjs";

const calls = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const signatures = new Map(model.callbacks.map(callback => [callback.id, callback.index]));
	const declarations = [...model.functions.map(fn => ({ ...fn, entry: `call${fn.index}` }))
		, ...model.callbacks.map(fn => ({ ...fn, entry: `invoke${fn.index}` }))];
	return declarations.map(fn => {
		const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		const transfers = fn.transfers ?? [];
		return `
typedef struct {
  lgo_call call;
  ${parameters.map((node, index) => `${node.cName} a${index};`).join("\n  ")}
  ${result.cName} output;${transfers.length ? `
  lgo_input_group moves[${transfers.length}];
  ov_result_owner *input_owners[${transfers.length}];
  ov_input_transfers transfer;` : ""}
} lgo_${fn.entry}_frame;
static void lgo_${fn.entry}_execute(lgo_${fn.entry}_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;${transfers.length ? `
  call->moves = frame->moves; call->move_count = ${transfers.length};
  for (size_t index = 0; index < ${transfers.length}; ++index) frame->input_owners[index] = &frame->moves[index].owner;
  frame->transfer = (ov_input_transfers){ .owners = frame->input_owners, .count = ${transfers.length},
    .consume = lgo_input_consume, .context = call };` : ""}
${parameters.map((node, index) => `${transfers.includes(index) ? `  if (lgo_input_begin(call, ${transfers.indexOf(index)})) return;\n` : ""}  if (!${fn.hostArguments[index] ? `lgo_host${signatures.get(node.id)}_begin(call, &arguments[${index}], &frame->a${index})`
		: `lgo_to(&call->walk, ${node.index}, &arguments[${index}], &frame->a${index})`}) return;${transfers.includes(index) ? "\n  if (lgo_input_commit(call)) return;" : ""}`).join("\n")}
  call->walk.status = ${fn.symbol}(&call->walk.state->native, ${[...parameters.map((_, index) => `&frame->a${index}`), ...transfers.length ? ["&frame->transfer"] : [], "&frame->output", "&call->walk.lease->owner"].join(", ")});
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, ${result.index}, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_${fn.entry}_args, 0, 0, ${parameters.length})
${parameters.map((_, index) => `  ZEND_ARG_INFO(0, arg${index})`).join("\n")}
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_${fn.entry}) {
  if (ZEND_NUM_ARGS() != ${parameters.length}) { zend_argument_count_error("Expected exactly ${parameters.length} arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_${fn.entry}_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[${Math.max(1, parameters.length)}];
  ${parameters.length ? `if (zend_get_parameters_array_ex(${parameters.length}, arguments) != SUCCESS) RETURN_THROWS();` : ""}
  lgo_${fn.entry}_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_${fn.entry}_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}
`;
	}).join("\n");
};

const handles = `
ZEND_BEGIN_ARG_INFO_EX(lgo_handle_args, 0, 0, 2)
  ZEND_ARG_INFO(0, type)
  ZEND_ARG_INFO(0, value)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(lgo_no_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static int lgo_typed_handle(zend_long type, zval *value, int closing, lgo_handle **out) {
  *out = NULL;
  if (type < 0 || (uint64_t)type > UINT_MAX || !lgo_kind((unsigned)type)) return LB_OWNED_INVALID;
  if (!closing) return lgo_handle_fetch(value, (unsigned)type, NULL, out);
  ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_RESOURCE || Z_RES_P(value)->type != lgo_resource_type || !Z_RES_P(value)->ptr)
    return LB_OWNED_INVALID;
  lgo_handle *handle = Z_RES_P(value)->ptr;
  if (handle->type != (unsigned)type) return LB_OWNED_INVALID;
  *out = handle; return LB_OWNED_OK;
}
static ZEND_FUNCTION(lgo_check) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = lgo_typed_handle(type, value, 0, &handle);
  if (!status) status = lgo_drain(lgo_handle_state(handle));
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_retain) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = lgo_typed_handle(type, value, 0, &handle);
  if (!status) status = lgo_handle_retain(handle, return_value);
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS();
}
static ZEND_FUNCTION(lgo_close) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = lgo_typed_handle(type, value, 1, &handle);
  if (!status) status = lgo_handle_close(handle);
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_shutdown_entry) {
  ZEND_PARSE_PARAMETERS_NONE();
  int status = lgo_shutdown(); lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_retire) {
  ZEND_PARSE_PARAMETERS_NONE();
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  lean_bridge_native_runtime_retire(); RETURN_NULL();
}
`;

/**
 * Generate complete C source, including every signature's typed trampoline.
 * Package admission and archive verification are performed by the build layer.
 *
 * @param generated - Private native adapters generated with wordBits32 and hostCallbacks.
 */
export const generateOwnedPhpZendExtension = generated => {
	const transferredInputs = generated.layout.functions.some(fn => fn.transfers?.length);
	const anchoredResults = generated.layout.functions.some(fn => fn.anchor !== undefined);
	const model = compileOwnedPhpZendModel(generated.carriers.model.bindingIr, { transferredInputs, anchoredResults });
	if(canonicalJson(model.layout) !== canonicalJson(generated.layout)) throw new TypeError("Zend transport requires its exact wasm32 native layout");
	if(generated.carriers.hostCallbacks?.length !== model.callbacks.length || !generated.carriers.callbackSource)
		throw new TypeError("Zend transport requires compiler-authenticated host callback carriers");
	const registrations = anchoredResults ? ownedZendBorrowEntries(model) : [...model.functions.map(fn => [`call${fn.index}`, `call${fn.index}`])
		, ...model.callbacks.map(cb => [`invoke${cb.index}`, `invoke${cb.index}`])];
	const source = `#include <php.h>
#include <stdbool.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "owned-values-codec.h"
_Static_assert(sizeof(void *) == 4 && sizeof(zend_long) == 4, "32-bit PHP-Wasm required");
${ownedZendWalkSource(model)}
extern lean_object *initialize_${generated.carriers.module}(uint8_t);
static void *lgo_component_initialize(uint8_t builtin) { return initialize_${generated.carriers.module}(builtin); }
static int lgo_initialize(void) {
  return lean_bridge_native_component_initialize(${JSON.stringify(model.layout.model.component.id)}, lgo_component_initialize)
    ? LB_OWNED_OK : LB_OWNED_RUNTIME;
}
${ownedZendCallbacks(model, generated.carriers)}
${anchoredResults ? ownedZendBorrowCalls(model) : calls(model)}
${handles}
${anchoredResults ? ownedZendBorrowHandles(model) : ""}\
static PHP_MINIT_FUNCTION(${model.stem}) {
  lgo_resource_type = zend_register_list_destructors_ex(lgo_resource_destroy, NULL, ${JSON.stringify(model.namespace + " owned value")}, module_number);
${anchoredResults ? `  lgo_root_resource_type = zend_register_list_destructors_ex(lgo_root_destroy, NULL, ${JSON.stringify(model.namespace + " whole owner")}, module_number);\n` : ""}\
  return SUCCESS;
}
static PHP_RSHUTDOWN_FUNCTION(${model.stem}) { (void)lgo_shutdown(); return SUCCESS; }
static const zend_function_entry lgo_functions[] = {
${registrations.map(([entry, info]) => `  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, ${entry}, ZEND_FN(lgo_${entry}), lgo_${info}_args)`).join("\n")}
  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, check, ZEND_FN(lgo_check), lgo_handle_args)
  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, retain, ZEND_FN(lgo_retain), lgo_handle_args)
  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, close, ZEND_FN(lgo_close), lgo_handle_args)
  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, shutdown, ZEND_FN(lgo_shutdown_entry), lgo_no_args)
  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, retire, ZEND_FN(lgo_retire), lgo_no_args)
${anchoredResults ? ["check", "close", "share"].map(name => `  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, owner_${name}, ZEND_FN(lgo_owner_${name}), lgo_handle_args)`).join("\n") + `\n  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, equal, ZEND_FN(lgo_equal), lgo_equal_args)\n` : ""}\
  PHP_FE_END
};
zend_module_entry ${model.stem}_module_entry = {
  STANDARD_MODULE_HEADER, ${JSON.stringify(model.stem)}, lgo_functions,
  PHP_MINIT(${model.stem}), NULL, NULL, PHP_RSHUTDOWN(${model.stem}), NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(${model.stem})
`;
	if(Buffer.byteLength(source) > 16 * 1024 * 1024) throw new TypeError("Owned Zend source exceeds 16 MiB");
	return { model, source };
};
