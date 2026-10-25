/**
 * Whole-owner Zend downcalls over the original native anchor and transfer slots.
 *
 * @file
 */

const declarations = model => [
	...model.functions.map(fn => ({ ...fn, entry: `call${fn.index}` }))
	, ...model.callbacks.map(fn => ({ ...fn, entry: `invoke${fn.index}` }))
	, ...model.types.filter(node => node.representation !== "copied").map(node => ({
		entry: `copy${node.index}`, copy: true, result: node.id
		, parameters: [node.id], hostArguments: [false]
	}))
];

/**
 * Register every whole-owner export and typed copy entry.
 *
 * @param model - Whole-owner Zend schema.
 */
export const ownedZendBorrowEntries = model => declarations(model).map(fn => [fn.entry, fn.entry]);

const helpers = `
struct lgo_input_group { lgo_lease *lease; };
typedef struct { lgo_input_group *groups; size_t count; } lgo_whole_transfers;
static void lgo_whole_consume(void *opaque) {
  lgo_whole_transfers *moves = opaque;
  for (size_t index = 0; index < moves->count; ++index) {
    moves->groups[index].lease->consumed = 1;
    moves->groups[index].lease->invalid = 1;
  }
}
static int lgo_whole_input(lgo_call *call, zval *envelope, unsigned type,
    lgo_lease **pin, zval **payload) {
  ZVAL_DEREF(envelope); *pin = NULL; *payload = NULL;
  if (Z_TYPE_P(envelope) != IS_ARRAY || zend_hash_num_elements(Z_ARRVAL_P(envelope)) != 2
      || !zend_array_is_list(Z_ARRVAL_P(envelope))) return LB_OWNED_INVALID;
  zval *owner = zend_hash_index_find(Z_ARRVAL_P(envelope), 0);
  *payload = zend_hash_index_find(Z_ARRVAL_P(envelope), 1);
  if (!owner || !*payload) return LB_OWNED_INVALID;
  lgo_root *root = NULL;
  int status = lgo_root_fetch(owner, type, call->walk.state, 0, &root);
  if (!status) status = lgo_lease_pin(root->lease);
  if (!status) *pin = root->lease;
  return status;
}
static int lgo_whole_reserve(lgo_input_group *group, lgo_lease *lease) {
  int status = lgo_lease_check(lease); if (status) return status;
  if (!lease->whole || !lease->roots || !lease->published || lease->consumed
      || lease->anchor || lease->owner.batch.borrowed) return LB_OWNED_INVALID;
  if (lease->input_move) return LB_OWNED_ORDER;
  group->lease = lease; lease->input_move = group; return LB_OWNED_OK;
}
static void lgo_whole_finish(lgo_input_group *groups, size_t count,
    lgo_lease **pins, size_t pin_count) {
  for (size_t index = 0; index < count; ++index) {
    lgo_lease *lease = groups[index].lease;
    if (!lease) continue;
    if (lease->input_move != &groups[index]) lean_bridge_native_runtime_retire();
    else lease->input_move = NULL;
    groups[index].lease = NULL;
  }
  for (size_t index = 0; index < pin_count; ++index) {
    lgo_lease *lease = pins[index]; pins[index] = NULL; lgo_lease_unpin(lease);
  }
}
`;

/**
 * Use an opaque root beside the converted payload only for anchored or moved
 * arguments. Original batches, including empty ones, cross the native boundary.
 *
 * @param model - Checked wasm32 value and callable schema.
 */
export const ownedZendBorrowCalls = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const signatures = new Map(model.callbacks.map(callback => [callback.id, callback.index]));
	return helpers + declarations(model).map(fn => {
		const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		const transfers = fn.transfers ?? [], anchored = fn.anchor !== undefined;
		const whole = result.representation !== "copied";
		const count = Math.max(1, parameters.length), moves = Math.max(1, transfers.length);
		const argumentsList = [
			...parameters.map((_, index) => `&frame->a${index}`)
			, ...transfers.length ? ["&frame->transfer"] : []
			, ...anchored ? ["&frame->anchor"] : []
			, "&frame->output", "&call->walk.lease->owner"
		];
		const copy = fn.copy ? `
  ov_transaction transaction = {0}; lean_object *value = NULL;
  call->walk.status = ov_begin(&transaction, &call->walk.state->native, &call->walk.lease->owner,
    ${JSON.stringify(model.layout.model.component.id)});
  if (!call->walk.status) call->walk.status = ov_charge(&transaction.budget, 1, sizeof(frame->output));
  if (!call->walk.status) call->walk.status = ${result.walker}_in(&frame->a0, 0, 1, &transaction, &value);
  if (!call->walk.status) call->walk.status = ${result.walker}_out(&frame->output, value, 0, &transaction);
  if (!call->walk.status) call->walk.status = ov_commit(&transaction, &call->walk.lease->owner);
  else if (transaction.scope.context) call->walk.status = ov_abort(&transaction, call->walk.status);` : `
  call->walk.status = ${fn.symbol}(&call->walk.state->native, ${argumentsList.join(", ")});`;
		return `
typedef struct {
  lgo_call call;
  lgo_lease *pins[${count}];
  lgo_input_group moves[${moves}];
  zval root_wire, whole_wire;
  ${parameters.map((node, index) => `${node.cName} a${index};`).join("\n  ")}
  ${result.cName} output;${anchored ? "\n  ov_input_anchor anchor;" : ""}${transfers.length ? `
  ov_result_owner *input_owners[${transfers.length}];
  lgo_whole_transfers move_context;
  ov_input_transfers transfer;` : ""}
} lgo_${fn.entry}_frame;
static void lgo_${fn.entry}_execute(lgo_${fn.entry}_frame *frame, zval *arguments) {
  (void)arguments; lgo_call *call = &frame->call;
  ZVAL_UNDEF(&frame->root_wire); ZVAL_UNDEF(&frame->whole_wire);
  if (lgo_call_open(call, sizeof(*frame))) return;
${parameters.map((node, index) => {
			const wholeInput = fn.anchor === index || transfers.includes(index);
			return `  zval *input${index} = &arguments[${index}];${wholeInput ? `
  call->walk.status = lgo_whole_input(call, input${index}, ${node.index}, &frame->pins[${index}], &input${index});
  if (call->walk.status) return;` : ""}${transfers.includes(index) ? `
  call->walk.status = lgo_whole_reserve(&frame->moves[${transfers.indexOf(index)}], frame->pins[${index}]);
  if (call->walk.status) return;
  frame->input_owners[${transfers.indexOf(index)}] = &frame->pins[${index}]->owner;` : ""}
  if (!${fn.hostArguments[index] ? `lgo_host${signatures.get(node.id)}_begin(call, input${index}, &frame->a${index})`
				: `lgo_to(&call->walk, ${node.index}, input${index}, &frame->a${index})`}) return;`;
}).join("\n")}${anchored ? `
  call->walk.status = lgo_lease_check(frame->pins[${fn.anchor}]);
  if (!call->walk.status) call->walk.status = lgo_lease_retain(frame->pins[${fn.anchor}]);
  if (call->walk.status) return;
  call->walk.lease->anchor = frame->pins[${fn.anchor}];
  frame->anchor = (ov_input_anchor){ &frame->pins[${fn.anchor}]->owner.batch,
    frame->pins[${fn.anchor}]->owner.batch.generation };` : ""}${transfers.length ? `
  frame->move_context = (lgo_whole_transfers){ frame->moves, ${transfers.length} };
  frame->transfer = (ov_input_transfers){ .owners = frame->input_owners, .count = ${transfers.length},
    .consume = lgo_whole_consume, .context = &frame->move_context };` : ""}${copy}${anchored ? `
  int anchor_status = lgo_lease_check(frame->pins[${fn.anchor}]);
  if (anchor_status) call->walk.status = anchor_status;` : ""}
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, ${result.index}, &frame->output, &call->wire);${whole ? `
  if (!call->walk.status && !call->bailout && !EG(exception)) {
    call->walk.status = lgo_root_wrap(call->walk.lease, ${result.index}, &frame->root_wire);
    if (call->walk.status) return;
    array_init_size(&frame->whole_wire, 2);
    add_next_index_zval(&frame->whole_wire, &frame->root_wire); ZVAL_UNDEF(&frame->root_wire);
    add_next_index_zval(&frame->whole_wire, &call->wire); ZVAL_UNDEF(&call->wire);
    ZVAL_COPY_VALUE(&call->wire, &frame->whole_wire); ZVAL_UNDEF(&frame->whole_wire);
  }` : ""}
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
  zval arguments[${count}];
  ${parameters.length ? `if (zend_get_parameters_array_ex(${parameters.length}, arguments) != SUCCESS) RETURN_THROWS();` : ""}
  lgo_${fn.entry}_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_${fn.entry}_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_clear_zvals(&frame->root_wire, 1, &frame->call.bailout);
  lgo_clear_zvals(&frame->whole_wire, 1, &frame->call.bailout);
  lgo_call_finish(&frame->call, return_value);
  lgo_whole_finish(frame->moves, ${transfers.length}, frame->pins, ${parameters.length});
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

/**
 * Expose opaque whole-owner operations and canonical identity comparison.
 *
 * @param model - Whole-owner Zend schema.
 */
export const ownedZendBorrowHandles = model => `
static int lgo_typed_root(zend_long type, zval *value, int closing, lgo_root **out) {
  if (type < 0 || (uint64_t)type >= ${model.types.length}) return LB_OWNED_INVALID;
  return lgo_root_fetch(value, (unsigned)type, NULL, closing, out);
}
static ZEND_FUNCTION(lgo_owner_check) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_root *root = NULL; int status = lgo_typed_root(type, value, 0, &root);
  if (!status) status = lgo_drain(root->lease->state);
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_owner_close) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_root *root = NULL; int status = lgo_typed_root(type, value, 1, &root);
  if (!status) lgo_root_release(root);
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_owner_share) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_root *root = NULL; int status = lgo_typed_root(type, value, 0, &root);
  if (!status) status = lgo_root_wrap(root->lease, (unsigned)type, return_value);
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS();
}
ZEND_BEGIN_ARG_INFO_EX(lgo_equal_args, 0, 0, 3)
  ZEND_ARG_INFO(0, type)
  ZEND_ARG_INFO(0, left)
  ZEND_ARG_INFO(0, right)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_equal) {
  zend_long type; zval *left, *right;
  ZEND_PARSE_PARAMETERS_START(3, 3) Z_PARAM_LONG(type) Z_PARAM_ZVAL(left) Z_PARAM_ZVAL(right) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *a = NULL, *b = NULL;
  int status = lgo_typed_handle(type, left, 0, &a);
  if (!status) status = lgo_typed_handle(type, right, 0, &b);
  if (!status && lgo_handle_state(a) != lgo_handle_state(b)) status = LB_OWNED_INVALID;
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS();
  RETURN_BOOL(a->token == b->token);
}
`;
