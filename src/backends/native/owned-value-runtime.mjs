/**
 * Bounded native value transactions layered on the retained-resource ledger.
 *
 * @file
 */

/**
 * Emit the private transaction runtime for a checked descriptor.
 *
 * @param limits - Immutable model limits, not host-controlled overrides.
 */
export const ownedNativeValueRuntime = limits => `
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "owned-leases.h"
_Static_assert(sizeof(void *) == 8 && sizeof(size_t) == 8, "owned native values require 64-bit Lean");
enum { OV_RESULT = 9 };
typedef struct {
  size_t bytes, visits;
  struct { const void *address; size_t type; } path[${limits.depth + 1}];
} ov_budget;
typedef struct ov_allocation {
  struct ov_allocation *next;
  max_align_t alignment;
  unsigned char data[];
} ov_allocation;
typedef struct {
  lb_owned_scope scope;
  ov_budget budget;
  ov_allocation *allocations;
} ov_transaction;
typedef struct ov_result_owner {
  struct ov_result_owner *self;
  lb_owned_context *context;
  lb_owned_batch batch;
  ov_allocation *allocations;
} ov_result_owner;

static inline void ov_release(ov_allocation *allocation) {
  while (allocation) {
    ov_allocation *next = allocation->next; LB_OWNED_FREE(allocation); allocation = next;
  }
}
static inline int ov_pointer(const void *value, size_t bytes, size_t alignment) {
  return value && (uintptr_t)value % alignment == 0 && bytes <= UINTPTR_MAX - (uintptr_t)value;
}
static inline int ov_charge(ov_budget *budget, size_t count, size_t width) {
  if (!width || count > budget->bytes / width) return LB_OWNED_LIMIT;
  budget->bytes -= count * width; return LB_OWNED_OK;
}
static inline int ov_visit(ov_budget *budget, size_t depth) {
  if (depth > ${limits.depth} || !budget->visits) return LB_OWNED_LIMIT;
  --budget->visits; return LB_OWNED_OK;
}
static inline int ov_enter(ov_budget *budget, const void *value, size_t type, size_t depth) {
  int status = ov_visit(budget, depth);
  if (status) return status;
  for (size_t i = 0; i < depth; ++i)
    if (budget->path[i].address == value && budget->path[i].type == type) return LB_OWNED_INVALID;
  budget->path[depth].address = value; budget->path[depth].type = type;
  return LB_OWNED_OK;
}
static inline int ov_span(ov_budget *budget, const void *value, size_t count, size_t width, size_t alignment) {
  int status = ov_charge(budget, count, width);
  if (status) return status;
  return !count || ov_pointer(value, count * width, alignment) ? LB_OWNED_OK : LB_OWNED_INVALID;
}
static inline int ov_allocate(ov_transaction *transaction, size_t count, size_t width, void **out) {
  *out = NULL; if (!count) return LB_OWNED_OK;
  int status = ov_charge(&transaction->budget, count, width);
  if (!status) status = ov_charge(&transaction->budget, 1, sizeof(ov_allocation));
  if (status) return status;
  ov_allocation *allocation = LB_OWNED_ALLOC(sizeof(*allocation) + count * width);
  if (!allocation) return LB_OWNED_ALLOC_FAILED;
  allocation->next = transaction->allocations; transaction->allocations = allocation;
  memset(allocation->data, 0, count * width); *out = allocation->data; return LB_OWNED_OK;
}
static inline int ov_utf8(const uint8_t *data, size_t length) {
  size_t i = 0;
  while (i < length) {
    uint32_t point = data[i++], minimum; size_t extra;
    if (point < 0x80) continue;
    if (point >= 0xc2 && point <= 0xdf) { point &= 0x1f; extra = 1; minimum = 0x80; }
    else if (point >= 0xe0 && point <= 0xef) { point &= 0x0f; extra = 2; minimum = 0x800; }
    else if (point >= 0xf0 && point <= 0xf4) { point &= 7; extra = 3; minimum = 0x10000; }
    else return 0;
    if (extra > length - i) return 0;
    while (extra--) { uint8_t next = data[i++]; if ((next & 0xc0) != 0x80) return 0; point = (point << 6) | (next & 0x3f); }
    if (point < minimum || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return 0;
  }
  return 1;
}
static inline lean_object *ov_nat_in(const uint32_t *data, size_t length) {
  lean_object *value = lean_box(0);
  while (length) {
    lean_object *shifted = lean_nat_shiftl(value, lean_box(32)); lean_dec(value);
    lean_object *limb = lean_uint32_to_nat(data[--length]);
    value = lean_nat_add(shifted, limb); lean_dec(shifted); lean_dec(limb);
  }
  return value;
}
static inline int ov_nat_out(lean_object *value, ov_transaction *transaction, const uint32_t **data, size_t *length) {
  *data = NULL; *length = 0;
  if (lean_nat_eq(value, lean_box(0))) return LB_OWNED_OK;
  lean_object *bits = lean_nat_log2(value);
  if (!lean_is_scalar(bits)) { lean_dec(bits); return LB_OWNED_LIMIT; }
  size_t count = lean_unbox(bits) / 32 + 1; lean_dec(bits);
  void *raw = NULL; int status = ov_allocate(transaction, count, sizeof(uint32_t), &raw);
  if (status) return status;
  uint32_t *limbs = raw; lean_inc(value);
  for (size_t i = 0; i < count; ++i) {
    limbs[i] = lean_uint32_of_nat(value);
    lean_object *next = lean_nat_shiftr(value, lean_box(32)); lean_dec(value); value = next;
  }
  lean_dec(value); *data = limbs; *length = count; return LB_OWNED_OK;
}
static inline lean_object *ov_carry(lean_object *value) {
  lean_object *carrier = lean_alloc_array(1, 1); lean_array_set_core(carrier, 0, value); return carrier;
}
static inline int ov_carrier(lean_object *value) {
  return value && !lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 1;
}
static inline int ov_finish(lean_object *value, lean_object **out) {
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  *out = value; return LB_OWNED_OK;
}
static inline int ov_owner_empty(const ov_result_owner *owner) {
  return owner && !owner->self && !owner->context && !owner->allocations
    && !owner->batch.context && !owner->batch.entries && !owner->batch.next;
}
static inline int ov_owner_clear(ov_result_owner *owner) {
  if (!owner) return LB_OWNED_INVALID;
  if (ov_owner_empty(owner)) return LB_OWNED_OK;
  if (owner->self != owner || !owner->context) return LB_OWNED_INVALID;
  lb_owned_context *context = owner->context;
  if (context->self != context) return LB_OWNED_INVALID;
  if (context->process != getpid()) return LB_OWNED_PROCESS;
  if (!pthread_equal(context->thread, pthread_self()) || context->thread_serial != lb_owned_thread_serial)
    return LB_OWNED_THREAD;
  int status = LB_OWNED_OK;
  if (owner->batch.context) status = lb_owned_batch_release(context, &owner->batch);
  /* A broker error can be reported after release has drained the batch. */
  if (owner->batch.context) return status;
  ov_release(owner->allocations); *owner = (ov_result_owner){0}; return status;
}
static inline int ov_begin(ov_transaction *transaction, lb_owned_context *context, ov_result_owner *owner, const char *component) {
  if (!ov_owner_empty(owner)) return LB_OWNED_INVALID;
  int status = lb_owned_ready(context);
  if (status) return status;
  if (strcmp(context->component, component)) return LB_OWNED_INVALID;
  *transaction = (ov_transaction){0};
  transaction->budget.bytes = ${limits.bytes}; transaction->budget.visits = ${limits.visits};
  return lb_owned_scope_begin(context, &transaction->scope);
}
static inline int ov_abort(ov_transaction *transaction, int status) {
  ov_release(transaction->allocations); transaction->allocations = NULL;
  if (transaction->scope.context) {
    if (status == OV_RESULT) lean_bridge_native_runtime_retire();
    int cleanup = lb_owned_scope_abort(&transaction->scope);
    if (!status) status = cleanup;
  }
  return status;
}
static inline int ov_commit(ov_transaction *transaction, ov_result_owner *owner) {
  lb_owned_context *context = transaction->scope.context;
  int status = lb_owned_scope_ready(&transaction->scope);
  if (status) return ov_abort(transaction, status);
  if (!transaction->allocations && !transaction->scope.outputs)
    return ov_abort(transaction, LB_OWNED_OK);
  status = lb_owned_scope_commit(&transaction->scope, &owner->batch);
  if (status) {
    /* Commit may have transferred outputs before dropping a failing input pin. */
    if (owner->batch.context) lb_owned_batch_release(context, &owner->batch);
    return ov_abort(transaction, status);
  }
  owner->self = owner; owner->context = context; owner->allocations = transaction->allocations;
  transaction->allocations = NULL; return LB_OWNED_OK;
}
`;
