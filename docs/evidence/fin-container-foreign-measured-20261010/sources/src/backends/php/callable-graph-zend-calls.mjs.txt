/**
 * Bounded recursive Zend downcalls, including generation-checked Lean closures.
 *
 * @file
 */

/**
 * Emit scoped calls with root cleanup on errors, exceptions and Zend bailouts.
 *
 * @param model - Original public exports and copied wasm32 payloads.
 */
export const zendGraphCalls = model => {
	const functions = model.functions.map(fn => ({ ...fn, entry: `call${fn.index}` }));
	for(const cb of model.callbacks.values()) functions.push({
		entry: `invoke${cb.index}`, native: cb.call
		, parameters: cb.parameters.map(node => ({ node }))
		, result: { node: cb.result }, closure: cb
	});
	return functions.map(({ entry, native, parameters, result, closure }) => {
		const offset = closure ? 1 : 0, arity = parameters.length + offset, owned = Boolean(result.callback);
		const prefix = model.layout.prefix;
		const dispose = owned ? `${result.callback.dispose}(ctx->output); ctx->output = 0;`
			: result.node.aggregate ? `${result.node.name}_clear(&ctx->output);` : "";
		return `typedef struct {
  lgc_call call;
  ${parameters.map((site, index) => `${site.callback ? site.callback.borrowedType : site.node.name} input${index};`).join("\n  ")}
  ${owned ? "uint64_t" : result.node.name} output;
} lgc_context_${entry};
static void lgc_cleanup_${entry}(lgc_context_${entry} *ctx) {
  ${dispose}
  lgc_clear(&ctx->call);
}
static void lgc_execute_${entry}(lgc_context_${entry} *ctx, zval *args) {
  (void)args; lgc_call *call = &ctx->call;
  ${closure ? `lgc_owned *owner = zend_fetch_resource_ex(&args[0], "Lean graph closure", lgc_owned_type);
  if (!owner) return;
  if (owner->signature != ${closure.index} || !owner->token) { lb_fail(&call->walk.scope, "Closed or wrong-signature Lean closure", 1); return; }` : ""}
${parameters.map((site, index) => site.callback ? `  ctx->input${index}.call = lgc_callback${site.callback.index};
  ctx->input${index}.context = lgc_register(call, ${site.callback.index}, &args[${index + offset}]);
  if (!ctx->input${index}.context) return;` : `  if (!lg_to(&call->walk, ${site.node.index}, &args[${index + offset}], &ctx->input${index})) return;`).join("\n")}
  call->status = ${prefix}_graph_initialize();
  if (!call->status) {
    uint32_t status = ${native}(${[...closure ? ["owner->token"] : [], ...parameters.map((_, index) => `&ctx->input${index}`), "&ctx->output"].join(", ")});
    if (!call->status) call->status = status;
  }
  if (call->status == 4 || call->status > 6) { ${prefix}_graph_retire(); call->status = 4; }
  if (call->status || EG(exception) || call->bailout || call->walk.scope.error) return;
  ${owned ? `if (!ctx->output) { ${prefix}_graph_retire(); call->status = 4; return; }
  if (!lb_charge(&call->walk.scope, 1, sizeof(lgc_owned))) return;
  lgc_owned *returned = LB_ZEND_CALLOC(1, sizeof(*returned));
  if (!returned) { call->walk.scope.failure = 3; lb_fail(&call->walk.scope, "Lean closure resource allocation failed", 0); return; }
  zend_resource *resource = NULL;
  zend_try { resource = zend_register_resource(returned, lgc_owned_type); }
  zend_catch { LB_ZEND_FREE(returned); zend_bailout(); } zend_end_try();
  returned->signature = ${result.callback.index}; returned->token = ctx->output; ctx->output = 0;
  ZVAL_RES(&call->wire, resource);` : `if (!lgc_from(call, ${result.node.index}, &ctx->output, &call->wire)) return;`}
  if (!${prefix}_graph_ready()) call->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_args_${entry}, 0, 0, ${arity})
${Array.from({ length: arity }, (_, index) => `  ZEND_ARG_INFO(0, arg${index})`).join("\n")}
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_${entry}) {
  if (ZEND_NUM_ARGS() != ${arity}) { zend_argument_count_error("Expected exactly ${arity} arguments"); RETURN_THROWS(); }
  if (lgc_depth == 64) { zend_value_error("Lean calls exceed 64 reentry levels"); RETURN_THROWS(); }
  zval args[${Math.max(1, arity)}];
  ${arity ? `if (zend_get_parameters_array_ex(${arity}, args) != SUCCESS) RETURN_THROWS();` : ""}
  if (sizeof(lgc_context_${entry}) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lgc_context_${entry} *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->call.walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->call.walk.visits = 262144;
  ZVAL_UNDEF(&ctx->call.wire); ZVAL_NULL(return_value); ++lgc_depth;
  zend_try { lgc_execute_${entry}(ctx, args); }
  zend_catch { ctx->call.bailout = 1; } zend_end_try();
  uint32_t status = ctx->call.status;
  const char *message = ctx->call.walk.scope.error; int type_error = ctx->call.walk.scope.type_error;
  if (!status && !message && !ctx->call.bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(return_value, &ctx->call.wire); ZVAL_UNDEF(&ctx->call.wire);
  }
  lgc_cleanup_${entry}(ctx);
  int bailout = ctx->call.bailout; LB_ZEND_FREE(ctx); --lgc_depth;
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}`;
	}).join("\n\n");
};
