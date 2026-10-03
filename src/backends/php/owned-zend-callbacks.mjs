/**
 * Typed Lean-to-PHP callbacks with call-bound identities and recovery values.
 *
 * @file
 */

/**
 * Catch Zend bailouts before they cross compiled Lean. Replies are converted
 * while argument borrows are live; Lean's typed fallback unwinds on failure.
 *
 * @param model - Matching wasm32 PHP and native ownership schema.
 * @param carriers - Fresh compiler-derived helpers with hostCallbacks enabled.
 */
export const ownedZendCallbacks = (model, carriers) => {
	if(model.hostCallbacks === false) return "";
	const wholeOwners = model.anchoredResults || model.wholeOwners;
	const nodes = new Map(model.types.map(node => [node.id, node]));
	return model.callbacks.map(callback => {
		const node = nodes.get(callback.id), result = nodes.get(callback.result);
		const parameters = callback.parameters.slice(1).map(id => nodes.get(id));
		const anchored = callback.anchor !== undefined;
		const releaseArguments = parameters.map((_, index) => `  if (a${index}) lean_dec(a${index});`).join("\n");
		const symbol = carriers.symbols.types[callback.id], name = `lgo_host${callback.index}`;
		return `
typedef struct {
  ov_transaction arguments;
  lgo_borrow *borrow, *previous_borrow;
  lb_owned_scope *previous_inputs;
  zval values[${parameters.length + 1}];
  ${parameters.map((node, index) => `${node.cName} a${index};`).join("\n  ")}
  ${result.cName} reply;
	  lean_object *returned;
	${anchored ? "  lgo_lease *reply_pin;\n" : ""}\
	  int status;
} ${name}_frame;
static lean_object *${name}_invoke(void *context${parameters.map((_, index) => `, lean_object *a${index}`).join("")}) {
  lgo_host *host = context; lgo_call *call = host->call;
  ov_callback_frame *parent = ov_active_callback_frame;
  int status = !parent || parent->transaction->scope.context != &call->walk.state->native ? OV_CALLBACK : parent->status;
  if (!status) status = lgo_ready(call->walk.state);
  if (!status) status = call->walk.status;
  if (!status && (call->bailout || EG(exception))) status = OV_CALLBACK;
  ${name}_frame *frame = NULL;
  if (!status) {
    frame = lb_allocate(&call->walk.graph.scope, 1, sizeof(*frame));
    if (!frame) { lgo_walk_failure(&call->walk, 0); status = call->walk.status; }
  }
  if (status) {
${parameters.map((_, index) => `    lean_dec(a${index});`).join("\n")}
    ov_callback_fail(parent, status); return lean_alloc_array(0, 0);
  }
  ov_result_owner empty = {0};
  frame->status = ov_begin(&frame->arguments, &call->walk.state->native, &empty, ${JSON.stringify(model.layout.model.component.id)});
  if (!frame->status) frame->arguments.budget = parent->transaction->budget;
${parameters.map((node, index) => `  if (!frame->status) { frame->status = ${node.walker}_out(&frame->a${index}, a${index}, 0, &frame->arguments); a${index} = NULL; }`).join("\n")}
  if (!frame->status) frame->status = lgo_borrow_new(call->walk.state, &frame->arguments.scope, &frame->borrow);
  frame->previous_borrow = call->walk.borrow; frame->previous_inputs = call->walk.inputs;
  call->walk.borrow = frame->borrow; call->walk.inputs = &frame->arguments.scope;
${wholeOwners ? "  // Finish incoming Lean ownership before PHP can longjmp.\n" + releaseArguments + "\n" : ""}  zend_try {
    do {
      if (frame->status) break;
${parameters.map((node, index) => `      if (!lgo_from(&call->walk, ${node.index}, &frame->a${index}, &frame->values[${index}])) break;`).join("\n")}
      if (call_user_function(EG(function_table), NULL, &host->callback, &frame->values[${parameters.length}], ${parameters.length}, frame->values) != SUCCESS || EG(exception)) {
        frame->status = OV_CALLBACK; break;
      }
	      frame->status = lb_owned_scope_ready(&frame->arguments.scope);
	      zval *reply = &frame->values[${parameters.length}];${anchored ? `
	      ZVAL_DEREF(reply);
	      if (!frame->status && Z_TYPE_P(reply) == IS_ARRAY && !zend_array_is_list(Z_ARRVAL_P(reply))
	          && zend_hash_num_elements(Z_ARRVAL_P(reply)) == 2) {
	        zval *owner = zend_hash_str_find(Z_ARRVAL_P(reply), "owner", sizeof("owner") - 1);
	        zval *value = zend_hash_str_find(Z_ARRVAL_P(reply), "value", sizeof("value") - 1);
	        lgo_root *root = NULL;
	        if (!owner || !value) frame->status = LB_OWNED_INVALID;
	        else frame->status = lgo_root_fetch(owner, ${result.index}, call->walk.state, 0, &root);
	        if (!frame->status) frame->status = lgo_lease_pin(root->lease);
	        if (!frame->status) { frame->reply_pin = root->lease; reply = value; }
	      }` : ""}
	      if (frame->status || !lgo_to(&call->walk, ${result.index}, reply, &frame->reply)) break;
      frame->status = ${result.walker}_in(&frame->reply, 0, 1, &frame->arguments, &frame->returned);
    } while (0);
  } zend_catch { call->bailout = 1; frame->status = OV_CALLBACK; } zend_end_try();
  if (!frame->status) frame->status = call->walk.status;
  if (frame->arguments.scope.context) parent->transaction->budget = frame->arguments.budget;
	  frame->status = lgo_borrow_finish(&frame->borrow, &frame->arguments, frame->values, ${parameters.length + 1}, frame->status, &call->bailout);
	${anchored ? "  lgo_lease_unpin(frame->reply_pin); frame->reply_pin = NULL;\n" : ""}\
	  call->walk.borrow = frame->previous_borrow; call->walk.inputs = frame->previous_inputs;
${wholeOwners ? "" : releaseArguments + "\n"}\
  if (!frame->status && (call->bailout || EG(exception))) frame->status = OV_CALLBACK;
  if (frame->status) {
    ov_callback_fail(parent, frame->status);
    if (frame->returned) lean_dec(frame->returned);
    return lean_alloc_array(0, 0);
  }
  return frame->returned;
}
static int ${name}_begin(lgo_call *call, zval *input, ${node.cName} *out) {
  ZVAL_DEREF(input);
  if (Z_TYPE_P(input) == IS_RESOURCE) return lgo_to(&call->walk, ${node.index}, input, out);
  if (!lg_list(input, 3, true, &call->walk.graph.scope)) return lgo_walk_failure(&call->walk, 0);
  zval *callback = zend_hash_index_find(Z_ARRVAL_P(input), 0);
  zval *has_recovery = zend_hash_index_find(Z_ARRVAL_P(input), 1); ZVAL_DEREF(has_recovery);
  zval *recovery_value = zend_hash_index_find(Z_ARRVAL_P(input), 2);
  if ((Z_TYPE_P(has_recovery) != IS_TRUE && Z_TYPE_P(has_recovery) != IS_FALSE)
      || !zend_is_callable(callback, 0, NULL)) return lgo_walk_fail(&call->walk, LB_OWNED_INVALID, "Expected a typed synchronous callback descriptor", 1);
  int explicit_recovery = Z_TYPE_P(has_recovery) == IS_TRUE;
  ${callback.automaticRecovery ? "" : 'if (!explicit_recovery) return lgo_walk_fail(&call->walk, LB_OWNED_INVALID, "Callback requires an explicit typed recovery value", 1);'}
  lgo_host *host = lb_allocate(&call->walk.graph.scope, 1, sizeof(*host));
  if (!host) return lgo_walk_failure(&call->walk, 0);
  host->call = call; host->next = call->hosts; call->hosts = host;
  ZVAL_COPY(&host->callback, callback);
  ov_transaction transaction = {0}; lean_object *recovery = NULL;
  int status = ov_begin(&transaction, &call->walk.state->native, &host->owner, ${JSON.stringify(model.layout.model.component.id)});
  if (!status && explicit_recovery) {
    ${result.cName} raw = {0};
    // The callback's input scope is nested above the call's pinned inputs.
    lb_owned_scope *previous = call->walk.inputs; call->walk.inputs = &transaction.scope;
    if (!lgo_to(&call->walk, ${result.index}, recovery_value, &raw)) status = call->walk.status;
    call->walk.inputs = previous;
    if (!status) status = ${result.walker}_in(&raw, 0, 1, &transaction, &recovery);
  }
  if (!status) {
    host->token = lb_native_callback_register((void (*)(void))${name}_invoke, host);
    if (!host->token) status = LB_OWNED_LIMIT;
  }
  if (!status) {
    if (!recovery) recovery = lean_alloc_array(0, 0);
    lean_object *closure = ${symbol}_wrap((size_t)host->token, recovery); recovery = NULL;
    if (!ov_carrier(closure)) { lean_dec(closure); status = LB_OWNED_INVALID; }
    else status = ${node.walker}_out(out, closure, 0, &transaction);
  }
  if (recovery) lean_dec(recovery);
  if (!status) status = ov_commit(&transaction, &host->owner);
  else if (transaction.scope.context) status = ov_abort(&transaction, status);
  if (status) return lgo_walk_fail(&call->walk, status, "Cannot prepare the typed Lean callback", status == LB_OWNED_INVALID);
  return 1;
}
`;
	}).join("\n");
};
