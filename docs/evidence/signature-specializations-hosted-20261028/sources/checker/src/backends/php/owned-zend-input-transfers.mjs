/**
 * Zend reservations retain original leases and snapshot each consuming argument.
 *
 * @file
 */

/** Call-frame storage; the walk and ownership declarations precede this block. */
export const ownedZendInputTransferTypes = `
typedef struct lgo_input_entry {
  struct lgo_input_entry *next;
  lgo_lease *lease;
} lgo_input_entry;
struct lgo_input_group {
  lgo_input_entry *leases;
  ov_result_owner owner;
};
`;

/**
 * All original leases stay live until the non-failing handoff hook marks the set.
 * The ordinary call cleanup releases both snapshots and reserved references.
 *
 * @param model - Compiler-authenticated Zend ownership model.
 */
export const ownedZendInputTransferSource = model => `
static int lgo_input_reserve(lgo_walk *walk, lgo_handle *handle, lean_object *value) {
  lgo_input_group *group = walk->input_group;
  lgo_lease *lease = handle->lease;
  if (!group || !lease || handle->borrow || !lease->published || lease->consumed)
    return LB_OWNED_INVALID;
  if (lease->input_move && lease->input_move != group) return LB_OWNED_INVALID;
  if (!lease->input_move) {
    lgo_input_entry *entry = lb_allocate(&walk->graph.scope, 1, sizeof(*entry));
    if (!entry) { lgo_walk_failure(walk, 0); return walk->status; }
    int status = lgo_lease_retain(lease); if (status) return status;
    entry->lease = lease; entry->next = group->leases; group->leases = entry;
    lease->input_move = group;
  }
  uint64_t token = 0;
  int status = lb_owned_scope_acquire(walk->inputs, lgo_kind(handle->type), value, &token);
  return status ? status : token == handle->token ? LB_OWNED_OK : LB_OWNED_INVALID;
}
static int lgo_input_begin(lgo_call *call, size_t index) {
  if (index >= call->move_count || call->walk.input_group || call->move_input.scope.context)
    return call->walk.status = LB_OWNED_ORDER;
  lgo_input_group *group = &call->moves[index];
  int status = ov_begin(&call->move_input, &call->walk.state->native, &group->owner,
    ${JSON.stringify(model.layout.model.component.id)});
  if (!status) { call->walk.input_group = group; call->walk.inputs = &call->move_input.scope; }
  call->walk.status = status; return status;
}
static int lgo_input_commit(lgo_call *call) {
  lgo_input_group *group = call->walk.input_group;
  if (!group) return call->walk.status = LB_OWNED_ORDER;
  int status = ov_commit(&call->move_input, &group->owner);
  call->walk.input_group = NULL; call->walk.inputs = &call->inputs.scope;
  call->walk.status = status; return status;
}
/* The native walker has validated every argument and moved every snapshot.
   This hook does not allocate, release storage, call PHP, or fail. */
static void lgo_input_consume(void *context) {
  lgo_call *call = context;
  for (size_t index = 0; index < call->move_count; ++index)
    for (lgo_input_entry *entry = call->moves[index].leases; entry; entry = entry->next)
      entry->lease->consumed = 1;
}
static void lgo_inputs_finish(lgo_call *call) {
  if (call->move_input.scope.context)
    call->walk.status = ov_abort(&call->move_input, call->walk.status);
  call->walk.input_group = NULL; call->walk.inputs = &call->inputs.scope;
  for (size_t index = 0; index < call->move_count; ++index) {
    lgo_input_group *group = &call->moves[index];
    int status = ov_owner_clear(&group->owner);
    if (!call->walk.status) call->walk.status = status;
    for (lgo_input_entry *entry = group->leases; entry; entry = entry->next) {
      lgo_lease *lease = entry->lease;
      if (lease->input_move != group) {
        lean_bridge_native_runtime_retire();
        if (!call->walk.status) call->walk.status = OV_RESULT;
      }
      lease->input_move = NULL;
      if (lease->consumed) {
        status = ov_owner_clear(&lease->owner);
        if (!call->walk.status) call->walk.status = status;
      }
      lgo_lease_release(lease); entry->lease = NULL;
    }
    group->leases = NULL;
  }
  call->move_count = 0; call->moves = NULL;
}
`;
