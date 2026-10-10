/**
 * Original owner slots and typed deep copies for owner-anchored Wasm results.
 *
 * @file
 */

/**
 * Keep empty owners registered and revoke their generations before deferred
 * storage cleanup. Active calls may pin storage without extending public life.
 *
 * @param p - Component-private identifier prefix.
 * @param context - Native ownership context.
 * @param symbols - Authenticated component entry points.
 */
export const ownedWasmBorrowOwners = (p, context, symbols) => `
static ${p}_owner *${p}_slot(unsigned key) {
  if (!key) return NULL;
  for (size_t i = 0; i < 4096; ++i)
    if (${p}_owners[i].key == key) return &${p}_owners[i];
  return NULL;
}
int ${symbols.alive}(unsigned key) {
  ${p}_owner *slot = ${p}_slot(key);
  return slot && !slot->closed && !slot->consumed &&
    lb_owned_batch_find(&${context}, &slot->value.batch, slot->value.batch.generation) != NULL;
}
int ${symbols.revoke}(unsigned key) {
  ${p}_owner *slot = ${p}_slot(key);
  if (!slot) return LB_OWNED_INVALID;
  int status = lb_owned_affinity(&${context}); if (status) return status;
  slot->closed = 1;
  if (slot->value.batch.context) slot->value.batch.expired = 1;
  return LB_OWNED_OK;
}
`;

/**
 * Consume the original registered batch, not a snapshot of its identity leaves.
 * Every argument names exactly one owner, including empty arrays and None.
 *
 * @param p - Component-private identifier prefix.
 * @param symbols - Authenticated component entry points.
 */
export const ownedWasmBorrowTransfers = (p, symbols) => `
typedef struct { const uint32_t *owners; uint32_t count; } ${p}_input_group;
typedef struct {
  uint32_t version, count;
  const ${p}_input_group *groups;
  uint32_t consumed;
} ${p}_input_frame;
_Static_assert(sizeof(${p}_input_frame) == 16 && offsetof(${p}_input_frame, consumed) == 12, "owned JS transfer frame");
_Static_assert(sizeof(${p}_input_group) == 8, "owned JS transfer group");
typedef struct {
  ${p}_input_frame *frame;
  ${p}_owner **slots;
  ov_result_owner **owners;
  size_t count;
} ${p}_moves;
static int ${p}_moves_finish(${p}_moves *moves, int status) {
  if (moves->slots) for (size_t i = 0; i < moves->count; ++i)
    if (moves->slots[i]) moves->slots[i]->moving = 0;
  LB_OWNED_FREE(moves->slots); LB_OWNED_FREE(moves->owners);
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
  moves->slots = LB_OWNED_ALLOC(count * sizeof(*moves->slots));
  if (!moves->slots) return LB_OWNED_ALLOC_FAILED;
  memset(moves->slots, 0, count * sizeof(*moves->slots));
  moves->owners = LB_OWNED_ALLOC(count * sizeof(*moves->owners));
  if (!moves->owners) return LB_OWNED_ALLOC_FAILED;
  for (size_t i = 0; i < count; ++i) {
    const ${p}_input_group *group = &frame->groups[i];
    if (group->count != 1 || !ov_pointer(group->owners, sizeof(uint32_t), _Alignof(uint32_t)))
      return LB_OWNED_INVALID;
    ${p}_owner *slot = ${p}_slot(group->owners[0]);
    if (!slot || slot->key == output || !slot->published || slot->moving ||
        !${symbols.alive}(slot->key) || slot->value.batch.borrowed) return LB_OWNED_INVALID;
    moves->slots[i] = slot; moves->owners[i] = &slot->value; slot->moving = 1;
  }
  return LB_OWNED_OK;
}
static void ${p}_moves_consume(void *opaque) {
  ${p}_moves *moves = opaque;
  for (size_t i = 0; i < moves->count; ++i) moves->slots[i]->consumed = 1;
  moves->frame->consumed = 1;
}
`;

/**
 * Dispatch with the checked original anchor and atomic input-owner transfer.
 *
 * @param options - Generated signature, storage checks and component identifiers.
 */
export const ownedWasmBorrowDispatch = options => {
	const { p, context, symbols, fn, index, checks, argumentsText, result, transfers } = options;
	const anchored = fn.anchor !== undefined, consuming = Boolean(fn.transfers?.length);
	const arguments_ = [...argumentsText, ...consuming ? ["&transfer"] : []
		, ...anchored ? ["&anchor"] : [], `(${result.cName} *)out`, "owner"];
	return `  case ${index}: {
    if (${[...checks, ...transfers && !consuming ? ["inputs != NULL"] : [], ...!anchored ? ["anchor_key != 0"] : []].join(" || ")}) return LB_OWNED_INVALID;
${anchored ? `    if (!${symbols.alive}(anchor_key) || anchor_key == key) return LB_OWNED_INVALID;
    ${p}_owner *parent = ${p}_slot(anchor_key);
    ov_input_anchor anchor = { &parent->value.batch, parent->value.batch.generation };
` : ""}${consuming ? `    ${p}_moves moves = {0};
    int status = ${p}_moves_prepare(&moves, inputs, ${fn.transfers.length}, key);
    ov_input_transfers transfer = { .owners = moves.owners, .count = ${fn.transfers.length}, .consume = ${p}_moves_consume, .context = &moves };
    if (!status) status = ${fn.symbol}(&${context}, ${arguments_.join(", ")});
    status = ${p}_moves_finish(&moves, status);` : `    int status = ${fn.symbol}(&${context}, ${arguments_.join(", ")});`}
    if (!status) ${p}_slot(key)->published = 1;
    return status;
  }`;
};

/**
 * Round-trip through the generated typed walkers to create an independent root.
 *
 * @param p - Component-private identifier prefix.
 * @param context - Native ownership context.
 * @param symbols - Authenticated component entry points.
 * @param native - Compiler-checked native layout.
 */
export const ownedWasmBorrowCopy = (p, context, symbols, native) => `
int ${symbols.copy}(unsigned type, const void *input, void *out, unsigned key) {
  ${p}_owner *slot = ${p}_slot(key);
  if (!slot || slot->published || slot->consumed || slot->moving || slot->closed) return LB_OWNED_INVALID;
  ov_transaction transaction = {0};
  int status = ov_begin(&transaction, &${context}, &slot->value, ${JSON.stringify(native.model.component.id)});
  if (status) return status;
  lean_object *value = NULL;
  switch (type) {
${native.nodes.filter(node => node.representation !== "copied").map(node => `  case ${node.index}:
    if (!ov_pointer(out, sizeof(${node.cName}), _Alignof(${node.cName}))) { status = LB_OWNED_INVALID; break; }
    status = ov_charge(&transaction.budget, 1, sizeof(${node.cName}));
    if (!status) status = ${node.walker}_in(input, 0, 1, &transaction, &value);
    if (!status) status = ${node.walker}_out(out, value, 0, &transaction);
    break;`).join("\n")}
  default: status = LB_OWNED_INVALID;
  }
  status = status ? ov_abort(&transaction, status) : ov_commit(&transaction, &slot->value);
  if (!status) slot->published = 1;
  return status;
}
`;
