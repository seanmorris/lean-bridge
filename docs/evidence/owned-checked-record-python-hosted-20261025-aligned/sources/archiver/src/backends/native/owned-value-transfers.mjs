/**
 * Validate input result owners before typed conversion and atomic consumption.
 * The public adapter supplies registered owners and a non-failing move callback.
 *
 * @file
 */
export const ownedNativeInputTransferRuntime = `
typedef struct {
  ov_result_owner *const *owners;
  size_t count;
  void (*consume)(void *context);
  void *context;
  int consumed;
} ov_input_transfers;

static inline int ov_transfers_prepare(ov_transaction *transaction,
    ov_input_transfers *transfer, size_t expected, lb_owned_batch **batches,
    size_t *batch_count) {
  int status = lb_owned_scope_ready(&transaction->scope);
  if (status) return status;
  if (!ov_pointer(transfer, sizeof(*transfer), _Alignof(ov_input_transfers)) ||
      transfer->count != expected || transfer->consumed || !transfer->consume)
    return LB_OWNED_INVALID;
  if (expected > LB_OWNED_RETAINED_LIMIT) return LB_OWNED_LIMIT;
  status = ov_span(&transaction->budget, transfer->owners, expected,
      sizeof(ov_result_owner *), _Alignof(ov_result_owner *));
  if (status) return status;
  *batch_count = 0;
  for (size_t i = 0; i < expected; ++i) {
    ov_result_owner *owner = transfer->owners[i];
    if (!ov_pointer(owner, sizeof(*owner), _Alignof(ov_result_owner))) return LB_OWNED_INVALID;
    for (size_t j = 0; j < i; ++j)
      if (owner == transfer->owners[j]) return LB_OWNED_INVALID;
    /* Empty variants can have a public owner but no native allocation or batch.
       Its registration and session are validated by the public adapter. */
    if (ov_owner_empty(owner)) continue;
    if (owner->self != owner || owner->context != transaction->scope.context)
      return LB_OWNED_INVALID;
    lb_owned_batch *batch = transaction->scope.context->batches;
    while (batch && batch != &owner->batch) batch = batch->next;
    if (!batch) return LB_OWNED_INVALID;
    batches[(*batch_count)++] = batch;
  }
  return LB_OWNED_OK;
}
`;
