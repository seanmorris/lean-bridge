#include "owned-values.h"
#include "carriers.h"

#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "owned-leases.h"
_Static_assert(sizeof(void *) == 4 && sizeof(size_t) == 4, "owned native values require 32-bit Lean");
enum { OV_RESULT = 9 };
typedef struct {
  size_t bytes, visits;
  struct { const void *address; size_t type; } path[129];
} ov_budget;
typedef struct ov_allocation {
  struct ov_allocation *next;
  max_align_t alignment;
  unsigned char data[];
} ov_allocation;
typedef struct {
  lb_owned_scope scope;
  lb_owned_batch *input_owner;
  int input_transfer;
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
#ifdef __wasm__
  if ((uint64_t)(uintptr_t)value + bytes > (uint64_t)__builtin_wasm_memory_size(0) * 65536) return 0;
#endif
  return value && (uintptr_t)value % alignment == 0 && bytes <= UINTPTR_MAX - (uintptr_t)value;
}
static inline int ov_charge(ov_budget *budget, size_t count, size_t width) {
  if (!width || count > budget->bytes / width) return LB_OWNED_LIMIT;
  budget->bytes -= count * width; return LB_OWNED_OK;
}
static inline int ov_visit(ov_budget *budget, size_t depth) {
  if (depth > 128 || !budget->visits) return LB_OWNED_LIMIT;
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
  transaction->budget.bytes = 16777216; transaction->budget.visits = 262144;
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

static inline int lbov_e9cb893ef976a1a687d1_v82551d965c182180b0dd_in(const lbov_e9cb893ef976a1a687d1_t82551d965c182180b0dd *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v82551d965c182180b0dd_out(lbov_e9cb893ef976a1a687d1_t82551d965c182180b0dd *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v659ec6a690764999d00d_in(const lbov_e9cb893ef976a1a687d1_t659ec6a690764999d00d *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v659ec6a690764999d00d_out(lbov_e9cb893ef976a1a687d1_t659ec6a690764999d00d *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v817592654f48ba756bd4_in(const lbov_e9cb893ef976a1a687d1_t817592654f48ba756bd4 *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v817592654f48ba756bd4_out(lbov_e9cb893ef976a1a687d1_t817592654f48ba756bd4 *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v5faad500583201774348_in(const lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v5faad500583201774348_out(lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_in(const lbov_e9cb893ef976a1a687d1_t550e0acb733e8dd08e4e *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_out(lbov_e9cb893ef976a1a687d1_t550e0acb733e8dd08e4e *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_in(const lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_out(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_vf098e5912ebfda269f53_in(const lbov_e9cb893ef976a1a687d1_tf098e5912ebfda269f53 *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_vf098e5912ebfda269f53_out(lbov_e9cb893ef976a1a687d1_tf098e5912ebfda269f53 *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v11140334dba7a15b6b99_in(const lbov_e9cb893ef976a1a687d1_t11140334dba7a15b6b99 *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v11140334dba7a15b6b99_out(lbov_e9cb893ef976a1a687d1_t11140334dba7a15b6b99 *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v167081552b6f9c1d1afd_in(const lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_v167081552b6f9c1d1afd_out(lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_vdc0347e1f7f5c4d928f1_in(const lbov_e9cb893ef976a1a687d1_tdc0347e1f7f5c4d928f1 *, size_t, int, ov_transaction *, lean_object **);
static inline int lbov_e9cb893ef976a1a687d1_vdc0347e1f7f5c4d928f1_out(lbov_e9cb893ef976a1a687d1_tdc0347e1f7f5c4d928f1 *, lean_object *, size_t, ov_transaction *);
static inline int lbov_e9cb893ef976a1a687d1_v82551d965c182180b0dd_in(const lbov_e9cb893ef976a1a687d1_t82551d965c182180b0dd *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t82551d965c182180b0dd))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 0, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > transaction->budget.visits) return LB_OWNED_LIMIT;
  status = ov_span(&transaction->budget, value->data, value->length, sizeof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c), _Alignof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c));
  if (status) return status;
  lean_object *items = lean_alloc_array(0, value->length);
  for (size_t i = 0; i < value->length; ++i) {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_in(value->data + i, depth + 1, 0, transaction, &child);
    if (status) { lean_dec(items); return status; }
    items = lean_array_push(items, child);
  }
  return ov_finish(lean_bridge_owned_2f491879aa1a54f87d6d12e2_t82551d965c182180b0dd_make(items), out);
}
static inline int lbov_e9cb893ef976a1a687d1_v82551d965c182180b0dd_out(lbov_e9cb893ef976a1a687d1_t82551d965c182180b0dd *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  size_t limit = transaction->budget.bytes / sizeof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c);
  if (limit > transaction->budget.visits) limit = transaction->budget.visits;
  if (depth == 128) limit = 0;
  size_t remaining = LB_OWNED_RETAINED_LIMIT - transaction->scope.retained;
  if (limit > remaining) limit = remaining;
  value = lean_bridge_owned_2f491879aa1a54f87d6d12e2_t82551d965c182180b0dd_itemsBounded(value, lean_box(limit));
  if (!value || lean_is_scalar(value) || !lean_is_array(value)) { if (value) lean_dec(value); return OV_RESULT; }
  size_t count = lean_array_size(value);
  if (count > limit) { lean_dec(value); return LB_OWNED_LIMIT; }
  void *raw = NULL;
  status = ov_allocate(transaction, count, sizeof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c), &raw);
  out->data = raw; out->length = count; lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_out(data + i, child, depth + 1, transaction);
  }
  lean_dec(value); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_v659ec6a690764999d00d_in(const lbov_e9cb893ef976a1a687d1_t659ec6a690764999d00d *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t659ec6a690764999d00d))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 1, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > transaction->budget.visits) return LB_OWNED_LIMIT;
  status = ov_span(&transaction->budget, value->data, value->length, sizeof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c), _Alignof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c));
  if (status) return status;
  lean_object *items = lean_alloc_array(0, value->length);
  for (size_t i = 0; i < value->length; ++i) {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_in(value->data + i, depth + 1, 0, transaction, &child);
    if (status) { lean_dec(items); return status; }
    items = lean_array_push(items, child);
  }
  return ov_finish(lean_bridge_owned_2f491879aa1a54f87d6d12e2_t659ec6a690764999d00d_make(items), out);
}
static inline int lbov_e9cb893ef976a1a687d1_v659ec6a690764999d00d_out(lbov_e9cb893ef976a1a687d1_t659ec6a690764999d00d *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  size_t limit = transaction->budget.bytes / sizeof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c);
  if (limit > transaction->budget.visits) limit = transaction->budget.visits;
  if (depth == 128) limit = 0;
  size_t remaining = LB_OWNED_RETAINED_LIMIT - transaction->scope.retained;
  if (limit > remaining) limit = remaining;
  value = lean_bridge_owned_2f491879aa1a54f87d6d12e2_t659ec6a690764999d00d_itemsBounded(value, lean_box(limit));
  if (!value || lean_is_scalar(value) || !lean_is_array(value)) { if (value) lean_dec(value); return OV_RESULT; }
  size_t count = lean_array_size(value);
  if (count > limit) { lean_dec(value); return LB_OWNED_LIMIT; }
  void *raw = NULL;
  status = ov_allocate(transaction, count, sizeof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c), &raw);
  out->data = raw; out->length = count; lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_out(data + i, child, depth + 1, transaction);
  }
  lean_dec(value); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_v817592654f48ba756bd4_in(const lbov_e9cb893ef976a1a687d1_t817592654f48ba756bd4 *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t817592654f48ba756bd4))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 2, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  if (value->tag > 1) return LB_OWNED_INVALID;
  if (!value->tag) return ov_finish(lean_bridge_owned_2f491879aa1a54f87d6d12e2_t817592654f48ba756bd4_none(lean_box(0)), out);
  if (value->tag == 1) {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_in(&value->f0, depth + 1, 0, transaction, &child);
    if (status) return status;
    return ov_finish(lean_bridge_owned_2f491879aa1a54f87d6d12e2_t817592654f48ba756bd4_make0(child), out);
  }
  return LB_OWNED_INVALID;
}
static inline int lbov_e9cb893ef976a1a687d1_v817592654f48ba756bd4_out(lbov_e9cb893ef976a1a687d1_t817592654f48ba756bd4 *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  lean_inc(value);
  uint32_t tag = lean_bridge_owned_2f491879aa1a54f87d6d12e2_t817592654f48ba756bd4_branch(value);
  if (tag > 1) { lean_dec(value); return OV_RESULT; }
  out->tag = (uint8_t)tag;
  if (out->tag == 1) {
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_out(&out->f0, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t817592654f48ba756bd4_field0(value), depth + 1, transaction);
    }
  }
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *lbov_e9cb893ef976a1a687d1_v5faad500583201774348_make(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_object *a2 = lean_array_get_core(items, 2); lean_inc(a2);
  lean_object *a3 = lean_array_get_core(items, 3); lean_inc(a3);
  lean_object *a4 = lean_array_get_core(items, 4); lean_inc(a4);
  lean_dec(items);
  return lean_bridge_owned_2f491879aa1a54f87d6d12e2_t5faad500583201774348_make(a0, a1, a2, a3, a4);
}
static inline int lbov_e9cb893ef976a1a687d1_v5faad500583201774348_in(const lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t5faad500583201774348))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 3, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  lean_object *items = lean_alloc_array(0, 5);
  lean_object *child = NULL;
  status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_in(&value->f0, depth + 1, 0, transaction, &child);
  if (status) { lean_dec(items); return status; }
  items = lean_array_push(items, child);
  status = lbov_e9cb893ef976a1a687d1_v817592654f48ba756bd4_in(value->f1, depth + 1, 1, transaction, &child);
  if (status) { lean_dec(items); return status; }
  items = lean_array_push(items, child);
  status = lbov_e9cb893ef976a1a687d1_v659ec6a690764999d00d_in(value->f2, depth + 1, 1, transaction, &child);
  if (status) { lean_dec(items); return status; }
  items = lean_array_push(items, child);
  status = lbov_e9cb893ef976a1a687d1_v82551d965c182180b0dd_in(value->f3, depth + 1, 1, transaction, &child);
  if (status) { lean_dec(items); return status; }
  items = lean_array_push(items, child);
  status = lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_in(value->f4, depth + 1, 1, transaction, &child);
  if (status) { lean_dec(items); return status; }
  items = lean_array_push(items, child);
  return ov_finish(lbov_e9cb893ef976a1a687d1_v5faad500583201774348_make(items), out);
}
static inline int lbov_e9cb893ef976a1a687d1_v5faad500583201774348_out(lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_out(&out->f0, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t5faad500583201774348_field0(value), depth + 1, transaction);
    }
  }
  if (!status) {
    void *raw = NULL;
    status = ov_allocate(transaction, 1, sizeof(lbov_e9cb893ef976a1a687d1_t817592654f48ba756bd4), &raw);
    out->f1 = raw;
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_v817592654f48ba756bd4_out(raw, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t5faad500583201774348_field1(value), depth + 1, transaction);
    }
  }
  if (!status) {
    void *raw = NULL;
    status = ov_allocate(transaction, 1, sizeof(lbov_e9cb893ef976a1a687d1_t659ec6a690764999d00d), &raw);
    out->f2 = raw;
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_v659ec6a690764999d00d_out(raw, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t5faad500583201774348_field2(value), depth + 1, transaction);
    }
  }
  if (!status) {
    void *raw = NULL;
    status = ov_allocate(transaction, 1, sizeof(lbov_e9cb893ef976a1a687d1_t82551d965c182180b0dd), &raw);
    out->f3 = raw;
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_v82551d965c182180b0dd_out(raw, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t5faad500583201774348_field3(value), depth + 1, transaction);
    }
  }
  if (!status) {
    void *raw = NULL;
    status = ov_allocate(transaction, 1, sizeof(lbov_e9cb893ef976a1a687d1_t550e0acb733e8dd08e4e), &raw);
    out->f4 = raw;
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_out(raw, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t5faad500583201774348_field4(value), depth + 1, transaction);
    }
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_make(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_dec(items);
  return lean_bridge_owned_2f491879aa1a54f87d6d12e2_t550e0acb733e8dd08e4e_make(a0, a1);
}
static inline int lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_in(const lbov_e9cb893ef976a1a687d1_t550e0acb733e8dd08e4e *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t550e0acb733e8dd08e4e))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 4, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  lean_object *items = lean_alloc_array(0, 2);
  lean_object *child = NULL;
  status = lbov_e9cb893ef976a1a687d1_v11140334dba7a15b6b99_in(&value->f0, depth + 1, 0, transaction, &child);
  if (status) { lean_dec(items); return status; }
  items = lean_array_push(items, child);
  status = lbov_e9cb893ef976a1a687d1_vf098e5912ebfda269f53_in(&value->f1, depth + 1, 0, transaction, &child);
  if (status) { lean_dec(items); return status; }
  items = lean_array_push(items, child);
  return ov_finish(lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_make(items), out);
}
static inline int lbov_e9cb893ef976a1a687d1_v550e0acb733e8dd08e4e_out(lbov_e9cb893ef976a1a687d1_t550e0acb733e8dd08e4e *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_v11140334dba7a15b6b99_out(&out->f0, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t550e0acb733e8dd08e4e_field0(value), depth + 1, transaction);
    }
  }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = lbov_e9cb893ef976a1a687d1_vf098e5912ebfda269f53_out(&out->f1, lean_bridge_owned_2f491879aa1a54f87d6d12e2_t550e0acb733e8dd08e4e_field1(value), depth + 1, transaction);
    }
  }
  lean_dec(value); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_in(const lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 5, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  lean_object *child = NULL;
  status = transaction->input_transfer
  ? lb_owned_scope_transfer_borrow(&transaction->scope, transaction->input_owner, "resource:Owned.Ticket", value->token, &child)
  : lb_owned_scope_borrow(&transaction->scope, "resource:Owned.Ticket", value->token, &child);
  if (status) return status;
  lean_inc(child); return ov_finish(ov_carry(child), out);
}
static inline int lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_out(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  lean_object *child = lean_array_get_core(value, 0);
  if (lean_is_scalar(child)) { lean_dec(value); return OV_RESULT; }
  status = lb_owned_scope_acquire(&transaction->scope, "resource:Owned.Ticket", child, &out->token);
  lean_dec(value); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_vf098e5912ebfda269f53_in(const lbov_e9cb893ef976a1a687d1_tf098e5912ebfda269f53 *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_tf098e5912ebfda269f53))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 6, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  status = ov_span(&transaction->budget, value->data, value->length, 1, 1);
  if (status) return status;
  lean_object *bytes = lean_alloc_sarray(1, value->length, value->length);
  if (value->length) memcpy(lean_sarray_cptr(bytes), value->data, value->length);
  return ov_finish(ov_carry(bytes), out);
}
static inline int lbov_e9cb893ef976a1a687d1_vf098e5912ebfda269f53_out(lbov_e9cb893ef976a1a687d1_tf098e5912ebfda269f53 *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  if (lean_is_scalar(child) || !lean_is_sarray(child)) { lean_dec(child); return OV_RESULT; }
  if (lean_sarray_elem_size(child) != 1) { lean_dec(child); return OV_RESULT; }
  size_t length = lean_sarray_size(child);
  void *data = NULL;
  status = ov_allocate(transaction, length, 1, &data);
  if (!status) {
    if (length) memcpy(data, lean_sarray_cptr(child), length);
    out->data = data; out->length = length;
  }
  lean_dec(child); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_v11140334dba7a15b6b99_in(const lbov_e9cb893ef976a1a687d1_t11140334dba7a15b6b99 *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t11140334dba7a15b6b99))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 7, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  status = ov_span(&transaction->budget, value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t));
  if (status) return status;
  if (value->negative > 1) return LB_OWNED_INVALID;
  lean_object *integer = lean_nat_to_int(ov_nat_in(value->data, value->length));
  if (value->negative) { lean_object *negative = lean_int_neg(integer); lean_dec(integer); integer = negative; }
  return ov_finish(ov_carry(integer), out);
}
static inline int lbov_e9cb893ef976a1a687d1_v11140334dba7a15b6b99_out(lbov_e9cb893ef976a1a687d1_t11140334dba7a15b6b99 *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  if (!lean_is_scalar(child) && !lean_is_mpz(child)) { lean_dec(child); return OV_RESULT; }
  out->negative = lean_int_lt(child, lean_box(0));
  lean_object *magnitude = lean_nat_abs(child); lean_dec(child); child = magnitude;
  status = ov_nat_out(child, transaction, &out->data, &out->length);
  lean_dec(child); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_v167081552b6f9c1d1afd_in(const lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 8, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  status = ov_span(&transaction->budget, value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t));
  if (status) return status;
  return ov_finish(ov_carry(ov_nat_in(value->data, value->length)), out);
}
static inline int lbov_e9cb893ef976a1a687d1_v167081552b6f9c1d1afd_out(lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  if (!lean_is_scalar(child) && !lean_is_mpz(child)) { lean_dec(child); return OV_RESULT; }
  status = ov_nat_out(child, transaction, &out->data, &out->length);
  lean_dec(child); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_vdc0347e1f7f5c4d928f1_in(const lbov_e9cb893ef976a1a687d1_tdc0347e1f7f5c4d928f1 *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {
  *out = NULL;
  if (!ov_pointer(value, sizeof(*value), _Alignof(lbov_e9cb893ef976a1a687d1_tdc0347e1f7f5c4d928f1))) return LB_OWNED_INVALID;
  int status = ov_enter(&transaction->budget, value, 9, depth);
  if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));
  if (status) return status;
  status = ov_span(&transaction->budget, value->data, value->length, 1, 1);
  if (status) return status;
  if (!ov_utf8((const uint8_t *)value->data, value->length)) return LB_OWNED_INVALID;
  return ov_finish(ov_carry(lean_mk_string_from_bytes(value->length ? value->data : "", value->length)), out);
}
static inline int lbov_e9cb893ef976a1a687d1_vdc0347e1f7f5c4d928f1_out(lbov_e9cb893ef976a1a687d1_tdc0347e1f7f5c4d928f1 *out, lean_object *value, size_t depth, ov_transaction *transaction) {
  int status = ov_visit(&transaction->budget, depth);
  if (status) { if (value) lean_dec(value); return status; }
  if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  if (lean_is_scalar(child) || !lean_is_string(child)) { lean_dec(child); return OV_RESULT; }
  size_t length = lean_string_size(child) - 1;
  if (!ov_utf8((const uint8_t *)lean_string_cstr(child), length)) { lean_dec(child); return OV_RESULT; }
  void *data = NULL;
  status = ov_allocate(transaction, length, 1, &data);
  if (!status) {
    if (length) memcpy(data, lean_string_cstr(child), length);
    out->data = data; out->length = length;
  }
  lean_dec(child); return status;
}
static inline int lbov_e9cb893ef976a1a687d1_f080cb47999bb83cdc0c1(lb_owned_context *context, const lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *a0, lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *out, ov_result_owner *owner) {
  if (!ov_pointer(out, sizeof(*out), _Alignof(lbov_e9cb893ef976a1a687d1_t5faad500583201774348)) || !ov_pointer(owner, sizeof(*owner), _Alignof(ov_result_owner))) return LB_OWNED_INVALID;
  ov_transaction transaction = {0};
  int status = ov_begin(&transaction, context, owner, "owned-subtypes@1.0.0");
  if (status) return status;
  status = ov_charge(&transaction.budget, 1, sizeof(*out));
  if (status) return ov_abort(&transaction, status);
  lean_object *arguments = lean_alloc_array(0, 1);
  {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_v5faad500583201774348_in(a0, 0, 1, &transaction, &child);
    if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }
    lean_inc(child);
    if (!lean_bridge_owned_refine_14adb93498676f4c30f0(child)) { lean_dec(child); lean_dec(arguments); return ov_abort(&transaction, LB_OWNED_INVALID); }
    arguments = lean_array_push(arguments, child);
  }
  lean_object *v0 = lean_array_get_core(arguments, 0); lean_inc(v0);
  lean_dec(arguments);
  lean_object *returned = lean_bridge_owned_2f491879aa1a54f87d6d12e2_f080cb47999bb83cdc0c1(v0);
  status = lb_owned_scope_ready(&transaction.scope);
  if (status) { lean_dec(returned); return ov_abort(&transaction, status); }
  lbov_e9cb893ef976a1a687d1_t5faad500583201774348 converted = {0};
  status = lbov_e9cb893ef976a1a687d1_v5faad500583201774348_out(&converted, returned, 0, &transaction);
  if (status) return ov_abort(&transaction, status);
  status = ov_commit(&transaction, owner);
  if (!status) *out = converted;
  return status;
}
static inline int lbov_e9cb893ef976a1a687d1_f579c430cd49e7c98161f(lb_owned_context *context, const lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *a0, lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *out, ov_result_owner *owner) {
  if (!ov_pointer(out, sizeof(*out), _Alignof(lbov_e9cb893ef976a1a687d1_t5faad500583201774348)) || !ov_pointer(owner, sizeof(*owner), _Alignof(ov_result_owner))) return LB_OWNED_INVALID;
  ov_transaction transaction = {0};
  int status = ov_begin(&transaction, context, owner, "owned-subtypes@1.0.0");
  if (status) return status;
  status = ov_charge(&transaction.budget, 1, sizeof(*out));
  if (status) return ov_abort(&transaction, status);
  lean_object *arguments = lean_alloc_array(0, 1);
  {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_v5faad500583201774348_in(a0, 0, 1, &transaction, &child);
    if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }
    lean_inc(child);
    if (!lean_bridge_owned_refine_a32d032838dcef0ffcc0(child)) { lean_dec(child); lean_dec(arguments); return ov_abort(&transaction, LB_OWNED_INVALID); }
    arguments = lean_array_push(arguments, child);
  }
  lean_object *v0 = lean_array_get_core(arguments, 0); lean_inc(v0);
  lean_dec(arguments);
  lean_object *returned = lean_bridge_owned_2f491879aa1a54f87d6d12e2_f579c430cd49e7c98161f(v0);
  status = lb_owned_scope_ready(&transaction.scope);
  if (status) { lean_dec(returned); return ov_abort(&transaction, status); }
  lbov_e9cb893ef976a1a687d1_t5faad500583201774348 converted = {0};
  status = lbov_e9cb893ef976a1a687d1_v5faad500583201774348_out(&converted, returned, 0, &transaction);
  if (status) return ov_abort(&transaction, status);
  status = ov_commit(&transaction, owner);
  if (!status) *out = converted;
  return status;
}
static inline int lbov_e9cb893ef976a1a687d1_f9735b5a0a586b46ce0b8(lb_owned_context *context, const lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd *a0, const lbov_e9cb893ef976a1a687d1_tdc0347e1f7f5c4d928f1 *a1, lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *out, ov_result_owner *owner) {
  if (!ov_pointer(out, sizeof(*out), _Alignof(lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c)) || !ov_pointer(owner, sizeof(*owner), _Alignof(ov_result_owner))) return LB_OWNED_INVALID;
  ov_transaction transaction = {0};
  int status = ov_begin(&transaction, context, owner, "owned-subtypes@1.0.0");
  if (status) return status;
  status = ov_charge(&transaction.budget, 1, sizeof(*out));
  if (status) return ov_abort(&transaction, status);
  lean_object *arguments = lean_alloc_array(0, 2);
  {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_v167081552b6f9c1d1afd_in(a0, 0, 1, &transaction, &child);
    if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }
    arguments = lean_array_push(arguments, child);
  }
  {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_vdc0347e1f7f5c4d928f1_in(a1, 0, 1, &transaction, &child);
    if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }
    arguments = lean_array_push(arguments, child);
  }
  lean_object *v0 = lean_array_get_core(arguments, 0); lean_inc(v0);
  lean_object *v1 = lean_array_get_core(arguments, 1); lean_inc(v1);
  lean_dec(arguments);
  lean_object *returned = lean_bridge_owned_2f491879aa1a54f87d6d12e2_f9735b5a0a586b46ce0b8(v0, v1);
  status = lb_owned_scope_ready(&transaction.scope);
  if (status) { lean_dec(returned); return ov_abort(&transaction, status); }
  lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c converted = {0};
  status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_out(&converted, returned, 0, &transaction);
  if (status) return ov_abort(&transaction, status);
  status = ov_commit(&transaction, owner);
  if (!status) *out = converted;
  return status;
}
static inline int lbov_e9cb893ef976a1a687d1_f52957d819a8a28259bf1(lb_owned_context *context, const lbov_e9cb893ef976a1a687d1_t6de8e950bc342c30091c *a0, lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd *out, ov_result_owner *owner) {
  if (!ov_pointer(out, sizeof(*out), _Alignof(lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd)) || !ov_pointer(owner, sizeof(*owner), _Alignof(ov_result_owner))) return LB_OWNED_INVALID;
  ov_transaction transaction = {0};
  int status = ov_begin(&transaction, context, owner, "owned-subtypes@1.0.0");
  if (status) return status;
  status = ov_charge(&transaction.budget, 1, sizeof(*out));
  if (status) return ov_abort(&transaction, status);
  lean_object *arguments = lean_alloc_array(0, 1);
  {
    lean_object *child = NULL;
    status = lbov_e9cb893ef976a1a687d1_v6de8e950bc342c30091c_in(a0, 0, 1, &transaction, &child);
    if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }
    arguments = lean_array_push(arguments, child);
  }
  lean_object *v0 = lean_array_get_core(arguments, 0); lean_inc(v0);
  lean_dec(arguments);
  lean_object *returned = lean_bridge_owned_2f491879aa1a54f87d6d12e2_f52957d819a8a28259bf1(v0);
  status = lb_owned_scope_ready(&transaction.scope);
  if (status) { lean_dec(returned); return ov_abort(&transaction, status); }
  lbov_e9cb893ef976a1a687d1_t167081552b6f9c1d1afd converted = {0};
  status = lbov_e9cb893ef976a1a687d1_v167081552b6f9c1d1afd_out(&converted, returned, 0, &transaction);
  if (status) return ov_abort(&transaction, status);
  status = ov_commit(&transaction, owner);
  if (!status) *out = converted;
  return status;
}
static inline int lbov_e9cb893ef976a1a687d1_f973a6e63b7dad7a3d147(lb_owned_context *context, const lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *a0, ov_input_transfers *transfer, lbov_e9cb893ef976a1a687d1_t5faad500583201774348 *out, ov_result_owner *owner) {
  if (!ov_pointer(out, sizeof(*out), _Alignof(lbov_e9cb893ef976a1a687d1_t5faad500583201774348)) || !ov_pointer(owner, sizeof(*owner), _Alignof(ov_result_owner))) return LB_OWNED_INVALID;
  ov_transaction transaction = {0};
  int status = ov_begin(&transaction, context, owner, "owned-subtypes@1.0.0");
  if (status) return status;
  status = ov_charge(&transaction.budget, 1, sizeof(*out));
  if (status) return ov_abort(&transaction, status);
  lb_owned_batch *batches[1] = {0}; size_t batch_count = 0;
  status = ov_transfers_prepare(&transaction, transfer, 1, batches, &batch_count);
  if (status) return ov_abort(&transaction, status);
  lean_object *arguments = lean_alloc_array(0, 1);
  {
    lean_object *child = NULL;
    transaction.input_transfer = 1;
    transaction.input_owner = &transfer->owners[0]->batch;
    status = lbov_e9cb893ef976a1a687d1_v5faad500583201774348_in(a0, 0, 1, &transaction, &child);
    if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }
    lean_inc(child);
    if (!lean_bridge_owned_refine_14adb93498676f4c30f0(child)) { lean_dec(child); lean_dec(arguments); return ov_abort(&transaction, LB_OWNED_INVALID); }
    arguments = lean_array_push(arguments, child);
  }
  transaction.input_transfer = 0; transaction.input_owner = NULL;
  status = lb_owned_scope_transfer_many(&transaction.scope, batches, batch_count);
  if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }
  transfer->consumed = 1; transfer->consume(transfer->context);
  lean_object *v0 = lean_array_get_core(arguments, 0); lean_inc(v0);
  lean_dec(arguments);
  lean_object *returned = lean_bridge_owned_2f491879aa1a54f87d6d12e2_f973a6e63b7dad7a3d147(v0);
  status = lb_owned_scope_ready(&transaction.scope);
  if (status) { lean_dec(returned); return ov_abort(&transaction, status); }
  lbov_e9cb893ef976a1a687d1_t5faad500583201774348 converted = {0};
  status = lbov_e9cb893ef976a1a687d1_v5faad500583201774348_out(&converted, returned, 0, &transaction);
  if (status) return ov_abort(&transaction, status);
  status = ov_commit(&transaction, owner);
  if (!status) *out = converted;
  return status;
}
