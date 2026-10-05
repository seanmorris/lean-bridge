/**
 * Call-scoped C host callbacks with typed recovery and transactional resource pins.
 *
 * @file
 */

/**
 * Generate per-signature borrowed callback frames. Temporary argument owners
 * expire after each invocation; reply resources stay pinned in the parent call.
 *
 * @param values - Public C types and private native walkers.
 * @param carriers - Compiler-authenticated callback helpers.
 */
export const ownedCCallbacks = (values, carriers) => {
	const p = values.prefix, nodes = new Map(values.nodes.map(node => [node.id, node]));
	const anchored = values.anchoredResults === true;
	const component = JSON.stringify(values.native.model.component.id), lines = [];
	for(const item of values.callbacks)
	{
		const node = nodes.get(item.id), result = nodes.get(item.result);
		const params = item.parameters.slice(1).map(id => nodes.get(id));
		const name = `oc_host_v${node.index}`, symbol = carriers.symbols.types[node.id];
		lines.push(`typedef struct ${name} {`
			, `  ${node.cName}_host descriptor;`, "  oc_session *session;", "  ov_budget *budget;"
			, "  uint64_t token;", "  ov_result_owner owner;", `} ${name};`
			, `static lean_object *${name}_invoke(void *context${params.map((_, i) => `, lean_object *a${i}`).join("")}) {`
			, `  ${name} *borrow = context; ov_callback_frame *frame = ov_active_callback_frame;`
			, "  int status = !frame || frame->transaction->scope.context != &borrow->session->native ? OV_CALLBACK : frame->status;"
			, "  ov_transaction arguments = {0}; ov_result_owner argument_owner = {0};"
			, ...anchored ? ["  oc_view *argument_views = NULL;"] : []
			, `  oc_arena views = { .budget = borrow->budget${anchored ? ", .session = borrow->session, .view_batch = &argument_owner.batch, .views = &argument_views" : ""} }, reply_input = { .budget = borrow->budget${anchored ? ", .session = borrow->session" : ""} };`
			, `  ${p}_result *reply_owner = NULL; lean_object *returned = NULL;`
			, ...params.flatMap((param, i) => [`  ${param.nativeName} raw${i} = {0};`, `  ${param.cName} view${i} = {0};`])
			, `  ${result.cName} reply = {0}; ${result.nativeName} raw_reply = {0};`
			, `  if (!status) status = ov_begin(&arguments, &borrow->session->native, &argument_owner, ${component});`
			, "  if (!status) arguments.budget = frame->transaction->budget;"
			, ...params.map((param, i) => `  if (!status) { status = ${param.walker}_out(&raw${i}, a${i}, 0, &arguments); a${i} = NULL; }`)
			, "  if (arguments.scope.context) frame->transaction->budget = arguments.budget;"
			, "  if (!status) status = ov_commit(&arguments, &argument_owner);"
			, "  else if (arguments.scope.context) status = ov_abort(&arguments, status);"
			, ...params.map((param, i) => `  if (!status) status = oc_v${param.index}_from(&raw${i}, &view${i}, 0, &views);`)
			, "  if (!status) {"
			, `    ${p}_status host_status = borrow->descriptor.call(borrow->descriptor.context, (${p}_session *)(uintptr_t)borrow->session->key, ${[
				...params.map((param, i) => `${param.leaf ? "" : "&"}view${i}`)
				, "&reply", "&reply_owner"
			].join(", ")});`
			, "    if (host_status) status = OV_CALLBACK;"
			, "    if (!status) status = lb_owned_scope_ready(&frame->transaction->scope);", "  }"
			, `  if (!status) status = oc_v${result.index}_to(&reply, &raw_reply, 0, &reply_input);`
			, `  if (!status) status = ${result.walker}_in(&raw_reply, 0, 1, frame->transaction, &returned);`
			, `  int cleanup = ${p}_result_release(&reply_owner); if (!status) status = cleanup;`
			, "  cleanup = ov_owner_clear(&argument_owner); if (!status) status = cleanup;"
			, ...anchored ? ["  cleanup = oc_views_clear(&argument_views); if (!status) status = cleanup;"] : []
			, "  oc_release(reply_input.head); oc_release(views.head);"
			, ...params.map((_, i) => `  if (a${i}) lean_dec(a${i});`)
			, "  if (status) { ov_callback_fail(frame, status); if (returned) lean_dec(returned); return lean_alloc_array(0, 0); }"
			, "  return returned;", "}"
			, `static inline int ${name}_end(${name} *borrow) {`
			, "  int status = LB_OWNED_OK;"
			, "  if (borrow->token) {"
			, "    if (lb_native_callback_wrong_thread(borrow->token)) status = LB_OWNED_THREAD;"
			, "    lb_native_callback_release(borrow->token); borrow->token = 0;", "  }"
			, "  int cleanup = ov_owner_clear(&borrow->owner); return status ? status : cleanup;", "}"
			, `static inline int ${name}_begin(${name} *borrow, const ${node.cName}_host *input, oc_session *session, ov_budget *budget, ${node.nativeName} *out) {`
			, `  if (!ov_pointer(input, sizeof(*input), _Alignof(${node.cName}_host))) return LB_OWNED_INVALID;`
			, "  borrow->descriptor = *input; borrow->session = session; borrow->budget = budget;"
			, "  if ((!input->call) == (!input->closure)) return LB_OWNED_INVALID;"
			, "  if (input->closure) {"
			, "    if (input->context || input->recovery) return LB_OWNED_INVALID;"
			, `    oc_arena arena = { .budget = budget${anchored ? ", .session = session" : ""} };`
			, `    return oc_v${node.index}_to(&input->closure, out, 0, &arena);`, "  }"
			, `  borrow->token = lb_native_callback_register((void (*)(void))${name}_invoke, borrow);`
			, "  if (!borrow->token) return LB_OWNED_LIMIT;"
			, `  ov_transaction transaction = {0}; oc_arena arena = { .budget = budget${anchored ? ", .session = session" : ""} };`
			, `  int status = ov_begin(&transaction, &session->native, &borrow->owner, ${component});`
			, "  lean_object *recovery = NULL;"
			, "  if (!status && input->recovery) {"
			, `    ${result.nativeName} raw = {0}; status = oc_v${result.index}_to(input->recovery, &raw, 0, &arena);`
			, `    if (!status) status = ${result.walker}_in(&raw, 0, 1, &transaction, &recovery);`, "  }"
			, "  if (!status) {"
			, "    if (!recovery) recovery = lean_alloc_array(0, 0);"
			, `    lean_object *closure = ${symbol}_wrap((size_t)borrow->token, recovery);`
			, "    if (!ov_carrier(closure)) { lean_dec(closure); status = LB_OWNED_INVALID; }"
			, `    else status = ${node.walker}_out(out, closure, 0, &transaction);`, "  }"
			, "  oc_release(arena.head);"
			, "  if (!status) status = ov_commit(&transaction, &borrow->owner);"
			, "  else if (transaction.scope.context) status = ov_abort(&transaction, status);"
			, "  if (status) (void)" + name + "_end(borrow);"
			, "  return status;", "}");
	}
	return lines.join("\n") + "\n";
};
