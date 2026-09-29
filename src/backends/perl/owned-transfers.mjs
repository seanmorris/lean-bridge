/**
 * Save-stack cleanup keeps Perl input aliases tied to native handoff decisions.
 *
 * @file
 */

/**
 * Track only identities visited in the current consuming argument's scope.
 *
 * @param prefix - Validated public ownership C prefix.
 */
export const ownedPerlTransfers = prefix => `
typedef struct lpo_input_entry lpo_input_entry;
typedef struct lpo_input_scope lpo_input_scope;
typedef struct lpo_input_group {
  ${prefix}_result *result;
  lpo_input_entry *entries;
  int armed;
} lpo_input_group;
struct lpo_input_entry {
  lpo_owner *owner;
  lpo_input_group *group;
  lpo_input_entry *next;
  int finished;
};
struct lpo_input_scope {
  lpg_scope *scope;
  lpo_input_scope *previous;
  lpo_input_group *groups;
  size_t count, selected;
};
static lpo_input_scope *lpo_inputs;
static int lpo_input_consumed(lpo_owner *owner) {
  lpo_input_group *group = owner->input_move;
  return group && group->armed && !group->result;
}
static void lpo_input_entry_end(pTHX_ void *data) {
  lpo_input_entry *entry = data;
  if (entry->finished) return;
  entry->finished = 1;
  lpo_owner *owner = entry->owner;
  if (owner->input_move != entry->group) {
    if (!lpo_state.cleanup_status) lpo_state.cleanup_status = 9;
    return;
  }
  int consumed = lpo_input_consumed(owner);
  if (consumed) owner->valid = 0;
  owner->input_move = NULL;
  /* Other aliases still see their group's consumed slot during finalizers. */
  if (consumed) lpo_release_native(aTHX_ owner);
}
static void lpo_input_group_end(pTHX_ void *data) {
  lpo_input_group *group = data;
  if (!group->result) return;
  if (!lpo_origin(aTHX)) { group->result = NULL; return; }
  unsigned status = ${prefix}_result_release(&group->result);
  if (status && !lpo_state.cleanup_status) lpo_state.cleanup_status = (int)status;
}
static void lpo_input_scope_end(pTHX_ void *data) {
  lpo_input_scope *inputs = data;
  if (lpo_inputs != inputs) {
    if (!lpo_state.cleanup_status) lpo_state.cleanup_status = 9;
    return;
  }
  lpo_inputs = inputs->previous;
  PERL_UNUSED_CONTEXT;
}
static lpo_input_scope *lpo_begin_inputs(pTHX_ lpg_scope *scope, size_t count) {
  lpo_input_scope *inputs = lpg_allocate(aTHX_ scope, 1, sizeof(*inputs));
  inputs->scope = scope; inputs->count = count; inputs->selected = SIZE_MAX;
  inputs->previous = lpo_inputs;
  SSGROW(4); SAVEDESTRUCTOR_X(lpo_input_scope_end, inputs);
  lpo_inputs = inputs;
  inputs->groups = lpg_allocate(aTHX_ scope, count, sizeof(*inputs->groups));
  for (size_t index = 0; index < count; ++index) {
    SSGROW(4); SAVEDESTRUCTOR_X(lpo_input_group_end, &inputs->groups[index]);
  }
  return inputs;
}
static void *lpo_input_borrow(pTHX_ lpg_scope *scope, SV *value, size_t type) {
  /* The converter fetched this scalar before charging its value depth. */
  lpo_wrapper *wrapper = lpo_get_fetched(aTHX_ value, type);
  if (lpo_closed(wrapper)) croak("Lean identity is closed or its callback borrow has expired");
  lpo_owner *owner = wrapper->owner;
  SSGROW(4); lpo_hold(aTHX_ owner); SAVEDESTRUCTOR_X(lpo_unpin, owner);
  lpo_input_scope *inputs = lpo_inputs;
  if (!inputs || inputs->scope != scope || inputs->selected == SIZE_MAX) return wrapper->handle;
  if (inputs->selected >= inputs->count || owner->borrowed || !owner->published)
    lpo_status(aTHX_ 1);
  lpo_input_group *group = &inputs->groups[inputs->selected];
  if (owner->input_move) {
    if (owner->input_move != group) lpo_status(aTHX_ 1);
    return wrapper->handle;
  }
  lpo_input_entry *entry = lpg_allocate(aTHX_ scope, 1, sizeof(*entry));
  entry->owner = owner; entry->group = group; entry->next = group->entries;
  SSGROW(4); SAVEDESTRUCTOR_X(lpo_input_entry_end, entry);
  owner->input_move = group; group->entries = entry;
  return wrapper->handle;
}
static void lpo_arm_inputs(pTHX_ lpo_input_scope *inputs) {
  lpo_context(aTHX);
  if (lpo_state.closed) lpo_status(aTHX_ 4);
  inputs->selected = SIZE_MAX;
  for (size_t index = 0; index < inputs->count; ++index) {
    lpo_input_group *group = &inputs->groups[index];
    if (!group->result) lpo_status(aTHX_ 9);
    for (lpo_input_entry *entry = group->entries; entry; entry = entry->next)
      if (entry->finished || !entry->owner->valid || entry->owner->input_move != group)
        lpo_status(aTHX_ 4);
  }
  for (size_t index = 0; index < inputs->count; ++index) inputs->groups[index].armed = 1;
}
static void lpo_finish_inputs(pTHX_ lpo_input_scope *inputs) {
  for (size_t index = 0; index < inputs->count; ++index)
    for (lpo_input_entry *entry = inputs->groups[index].entries; entry; entry = entry->next)
      lpo_input_entry_end(aTHX_ entry);
}
`;
