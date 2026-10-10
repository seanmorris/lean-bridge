/**
 * Snapshot consuming JavaScript arguments and publish the atomic native handoff.
 * The flag lives in the call frame, so reentrant JS observes it without a hook.
 *
 * @file
 */

/**
 * Original owner slots remain pinned by JS until dispatch returns. Snapshot
 * batches supply the typed native walker; no allocation or host call occurs
 * between consuming those batches and marking every original owner moved.
 *
 * @param p - Component-private C identifier prefix.
 * @param context - Component-private native ownership context.
 * @param component - Checked component identity.
 */
export const ownedWasmInputTransferSource = (p, context, component) => `
typedef struct { const uint32_t *owners; uint32_t count; } ${p}_input_group;
typedef struct {
  uint32_t version, count;
  const ${p}_input_group *groups;
  uint32_t consumed;
} ${p}_input_frame;
_Static_assert(sizeof(${p}_input_frame) == 16 && offsetof(${p}_input_frame, consumed) == 12, "owned JS transfer frame");
_Static_assert(sizeof(${p}_input_group) == 8, "owned JS transfer group");
typedef struct ${p}_reservation {
  struct ${p}_reservation *next;
  ${p}_owner *slot;
} ${p}_reservation;
typedef struct {
  ${p}_input_frame *frame;
  ${p}_reservation *reserved;
  ov_result_owner *snapshots;
  ov_result_owner **owners;
  size_t count;
} ${p}_moves;
static ${p}_owner *${p}_slot(unsigned key) {
  if (!key) return NULL;
  for (size_t i = 0; i < 4096; ++i)
    if (${p}_owners[i].key == key) return &${p}_owners[i];
  return NULL;
}
static int ${p}_moves_finish(${p}_moves *moves, int status) {
  if (moves->snapshots) for (size_t i = 0; i < moves->count; ++i) {
    int cleanup = ov_owner_clear(&moves->snapshots[i]); if (!status) status = cleanup;
  }
  while (moves->reserved) {
    ${p}_reservation *entry = moves->reserved; moves->reserved = entry->next;
    entry->slot->moving = 0; LB_OWNED_FREE(entry);
  }
  LB_OWNED_FREE(moves->snapshots); LB_OWNED_FREE(moves->owners);
  *moves = (${p}_moves){0}; return status;
}
static int ${p}_moves_prepare(${p}_moves *moves, ${p}_input_frame *frame,
    size_t count, unsigned output) {
  if (!ov_pointer(frame, sizeof(*frame), _Alignof(${p}_input_frame)) ||
      frame->version != 1 || frame->count != count || frame->consumed ||
      !count || count > LB_OWNED_RETAINED_LIMIT ||
      !ov_pointer(frame->groups, count * sizeof(*frame->groups), _Alignof(${p}_input_group)))
    return LB_OWNED_INVALID;
  moves->frame = frame; moves->count = count;
  moves->snapshots = LB_OWNED_ALLOC(count * sizeof(*moves->snapshots));
  moves->owners = LB_OWNED_ALLOC(count * sizeof(*moves->owners));
  if (!moves->snapshots || !moves->owners) return LB_OWNED_ALLOC_FAILED;
  memset(moves->snapshots, 0, count * sizeof(*moves->snapshots));
  size_t reserved = 0, retained = 0;
  for (size_t i = 0; i < count; ++i) {
    const ${p}_input_group *group = &frame->groups[i];
    if (group->count > LB_OWNED_RETAINED_LIMIT - reserved ||
        (group->count && !ov_pointer(group->owners, group->count * sizeof(*group->owners), _Alignof(uint32_t))))
      return LB_OWNED_INVALID;
    reserved += group->count; moves->owners[i] = &moves->snapshots[i];
    ov_transaction snapshot = {0};
    int status = ov_begin(&snapshot, &${context}, moves->owners[i], ${JSON.stringify(component)});
    if (status) return status;
    for (size_t j = 0; j < group->count && !status; ++j) {
      ${p}_owner *slot = ${p}_slot(group->owners[j]);
      if (!slot || slot->key == output || !slot->published || slot->consumed || slot->moving) {
        status = LB_OWNED_INVALID; break;
      }
      ${p}_reservation *entry = LB_OWNED_ALLOC(sizeof(*entry));
      if (!entry) { status = LB_OWNED_ALLOC_FAILED; break; }
      entry->slot = slot; entry->next = moves->reserved; moves->reserved = entry; slot->moving = 1;
      for (lb_owned_entry *item = slot->value.batch.entries; item && !status; item = item->next) {
        if (retained++ == LB_OWNED_RETAINED_LIMIT) { status = LB_OWNED_LIMIT; break; }
        uint64_t token = 0;
        status = lb_owned_scope_acquire(&snapshot.scope, item->owner->kind, item->owner->value, &token);
        if (!status && token != item->owner->token) status = LB_OWNED_INVALID;
      }
    }
    if (status) return ov_abort(&snapshot, status);
    status = ov_commit(&snapshot, moves->owners[i]);
    if (status) return status;
  }
  return LB_OWNED_OK;
}
static void ${p}_moves_consume(void *context) {
  ${p}_moves *moves = context;
  for (${p}_reservation *entry = moves->reserved; entry; entry = entry->next)
    entry->slot->consumed = 1;
  moves->frame->consumed = 1;
}
`;
