/**
 * Atomic input-owner consumption over the shared native resource ledger.
 * Backend admission and public moved-value state remain separate integration.
 *
 * @file
 */
import { ownedAggregateLeaseSource } from "./owned-aggregate-leases.mjs";

/**
 * The caller converts and validates every argument before this operation. It
 * consumes complete, private owner batches immediately before invoking Lean.
 * Failure leaves every batch unchanged. Success moves the retained entries into
 * the call's input scope, so both a successful call and a later call failure
 * release them through the existing scope cleanup. It does not allocate, drop
 * a reference, invoke user code, or publish a partially consumed input set.
 *
 * Copied payload storage and host wrapper invalidation belong to the caller.
 * The array is generated adapter storage, not an untrusted public C span.
 */
export const ownedAggregateTransferLeaseSource = ownedAggregateLeaseSource + `
/* Conversion may inspect an input only through the owner supplied for that
   argument. Do not pin it again: the registered batch retains it until the
   atomic move, after which the call scope retains the very same entries.
   The caller must construct all Lean argument carriers before moving batches. */
static inline int lb_owned_scope_transfer_borrow(lb_owned_scope *scope,
    const lb_owned_batch *candidate, const char *kind, uint64_t token,
    lean_object **out) {
  int status = lb_owned_scope_ready(scope);
  if (status) return status;
  if (!kind || !*kind || !out) return LB_OWNED_INVALID;
  lb_owned_batch *batch = scope->context->batches;
  while (batch && batch != candidate) batch = batch->next;
  if (!batch) return LB_OWNED_INVALID;
  for (lb_owned_entry *entry = batch->entries; entry; entry = entry->next) {
    if (entry->owner->token == token && !strcmp(entry->owner->kind, kind)) {
      *out = entry->owner->value; return LB_OWNED_OK;
    }
  }
  return LB_OWNED_INVALID;
}

static inline int lb_owned_scope_transfer_many(lb_owned_scope *scope,
    lb_owned_batch *const *batches, size_t count) {
  int status = lb_owned_scope_ready(scope);
  if (status) return status;
  if (count > LB_OWNED_RETAINED_LIMIT) return LB_OWNED_LIMIT;
  if (count && !batches) return LB_OWNED_INVALID;
  lb_owned_context *context = scope->context;
  size_t retained = 0;
  /* Validate the entire set before changing any source owner. Membership is
     checked by address before dereferencing foreign or stale batch pointers. */
  for (size_t i = 0; i < count; ++i) {
    for (size_t j = 0; j < i; ++j)
      if (batches[i] == batches[j]) return LB_OWNED_INVALID;
    lb_owned_batch *batch = context->batches;
    while (batch && batch != batches[i]) batch = batch->next;
    if (!batch || batch->context != context) return LB_OWNED_INVALID;
    for (lb_owned_entry *entry = batch->entries; entry; entry = entry->next) {
      if (retained >= LB_OWNED_RETAINED_LIMIT - scope->retained) return LB_OWNED_LIMIT;
      ++retained;
    }
  }
  /* No fallible operation occurs after this point. The same-thread call scope
     prevents mutation between validation and moving the original entries. */
  for (size_t i = 0; i < count; ++i) {
    lb_owned_batch *batch = batches[i];
    lb_owned_batch **position = &context->batches;
    while (*position != batch) position = &(*position)->next;
    *position = batch->next;
    if (batch->entries) {
      lb_owned_entry *last = batch->entries;
      while (last->next) last = last->next;
      last->next = scope->inputs; scope->inputs = batch->entries;
    }
    *batch = (lb_owned_batch){0};
  }
  scope->retained += retained;
  return LB_OWNED_OK;
}
`;
