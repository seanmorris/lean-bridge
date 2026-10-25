#include <lean/lean.h>
#ifndef LEAN_BRIDGE_FA450D817B39ECC8598F3607_STRUCTURED_CALLBACK_CONTROLS_DEFINED
#define LEAN_BRIDGE_FA450D817B39ECC8598F3607_STRUCTURED_CALLBACK_CONTROLS_DEFINED
typedef struct lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls {
  lean_object *(*recovery)(void *);
  lean_object *(*reject)(void *, lean_object *);
} lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls;
#endif
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_wrap(size_t);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_invoke(size_t, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_recovery(size_t);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_reject(size_t, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950_apply(lean_object *, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_423e0c37f5780352153f2e471aebd23d81e23f74_apply(lean_object *, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_wrap(size_t);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_invoke(size_t, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_apply(lean_object *, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_3b911dc0ceee9737631b7e83276319d96008e83d_apply(lean_object *, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_wrap(size_t);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_invoke(size_t, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_recovery(size_t);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_reject(size_t, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_wrap(size_t);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_invoke(size_t, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_apply(lean_object *, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_wrap(size_t);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_invoke(size_t, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_apply(lean_object *, lean_object *);
lean_object *lean_bridge_fa450d817b39ecc8598f3607_lean(lean_object *, lean_object *);
lean_object *lean_bridge_53b0de0e75e4c429aaad48c8_lean(lean_object *);
lean_object *lean_bridge_8477254b8ea47a726adc68ad_lean(lean_object *);
lean_object *lean_bridge_fb3aeed37b46e0e2a78ba51c_lean(lean_object *);
lean_object *lean_bridge_2f9e82778120400da600fcee_lean(lean_object *, lean_object *);
lean_object *lean_bridge_e429d90b6e2575f2175e6951_lean(lean_object *);
lean_object *lean_bridge_b6410c4c69dffaa409842d74_lean(lean_object *);
lean_object *lean_bridge_a4054277eb23862f1406fddb_lean(lean_object *);

#include "reviewedcallbacks-callable-borrows.h"
#include "reviewedcallbacks-graph.h"

#include <lean/lean.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>
_Static_assert(sizeof(size_t) == 4 && sizeof(void *) == 4, "native graph transport requires 32-bit Lean");
_Static_assert(sizeof(bool) == 1, "native graph transport requires byte Bool storage");
#ifndef LB_GRAPH_MALLOC
#define LB_GRAPH_MALLOC malloc
#endif
#ifndef LB_GRAPH_FREE
#define LB_GRAPH_FREE free
#endif
#ifndef LB_GRAPH_DECODE
#define LB_GRAPH_DECODE() ((void)0)
#endif
#ifndef LB_GRAPH_ENCODE
#define LB_GRAPH_ENCODE(value) (value)
#endif
enum { NG_OK = 0, NG_INVALID = 1, NG_LIMIT = 2, NG_ALLOC = 3, NG_RESULT = 4, NG_RUNTIME = 5 };
typedef struct {
  size_t bytes, nodes;
  struct { const void *address; size_t type; } path[129];
} ng_budget;
typedef struct ng_allocation {
  struct ng_allocation *next;
  max_align_t alignment;
  unsigned char data[];
} ng_allocation;
typedef struct { ng_allocation *head; ng_budget *budget; } ng_arena;
static void ng_release(void *owner) {
  ng_allocation *allocation = owner;
  while (allocation) {
    ng_allocation *next = allocation->next;
    LB_GRAPH_FREE(allocation); allocation = next;
  }
}
static inline uint32_t ng_charge(ng_budget *budget, size_t count, size_t width) {
  if (!width || count > budget->bytes / width) return NG_LIMIT;
  budget->bytes -= count * width; return NG_OK;
}
static inline int ng_pointer(const void *pointer, size_t bytes, size_t alignment) {
#ifdef __wasm__
  if ((uint64_t)(uintptr_t)pointer + bytes > (uint64_t)__builtin_wasm_memory_size(0) * 65536) return 0;
#endif
  return pointer && (uintptr_t)pointer % alignment == 0 && bytes <= UINTPTR_MAX - (uintptr_t)pointer;
}
static inline uint32_t ng_enter(const void *value, size_t type, size_t depth, ng_budget *budget) {
  if (depth > 128 || !budget->nodes) return NG_LIMIT;
  for (size_t i = 0; i < depth; ++i)
    if (budget->path[i].address == value && budget->path[i].type == type) return NG_INVALID;
  budget->path[depth].address = value; budget->path[depth].type = type;
  --budget->nodes; return NG_OK;
}
static inline uint32_t ng_allocate(ng_arena *arena, size_t count, size_t width, void **out) {
  *out = NULL;
  if (!count) return NG_OK;
  uint32_t status = ng_charge(arena->budget, count, width);
  if (!status) status = ng_charge(arena->budget, 1, sizeof(ng_allocation));
  if (status) return status;
  ng_allocation *allocation = LB_GRAPH_MALLOC(sizeof(*allocation) + count * width);
  if (!allocation) return NG_ALLOC;
  allocation->next = arena->head; arena->head = allocation;
  memset(allocation->data, 0, count * width); *out = allocation->data; return NG_OK;
}
static inline uint32_t ng_span(const void *data, size_t count, size_t width, size_t alignment, ng_budget *budget) {
  uint32_t status = ng_charge(budget, count, width);
  if (status) return status;
  return !count || ng_pointer(data, count * width, alignment) ? NG_OK : NG_INVALID;
}
static inline int ng_utf8(const uint8_t *data, size_t length) {
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
static inline lean_object *ng_nat_in(const uint32_t *data, size_t length) {
  lean_object *value = lean_box(0);
  while (length) {
    lean_object *shifted = lean_nat_shiftl(value, lean_box(32)); lean_dec(value);
    lean_object *limb = lean_uint32_to_nat(data[--length]);
    value = lean_nat_add(shifted, limb); lean_dec(shifted); lean_dec(limb);
  }
  return value;
}
/* Borrow value, allocate exactly the required limbs, and own every temporary. */
static inline uint32_t ng_nat_out(lean_object *value, ng_arena *arena, const uint32_t **data, size_t *length) {
  *data = NULL; *length = 0;
  if (lean_nat_eq(value, lean_box(0))) return NG_OK;
  lean_object *bits = lean_nat_log2(value);
  if (!lean_is_scalar(bits)) { lean_dec(bits); return NG_LIMIT; }
  size_t count = lean_unbox(bits) / 32 + 1; lean_dec(bits);
  void *raw; uint32_t status = ng_allocate(arena, count, sizeof(uint32_t), &raw);
  if (status) return status;
  uint32_t *limbs = raw; lean_inc(value);
  for (size_t i = 0; i < count; ++i) {
    limbs[i] = lean_uint32_of_nat(value);
    lean_object *next = lean_nat_shiftr(value, lean_box(32)); lean_dec(value); value = next;
  }
  lean_dec(value); *data = limbs; *length = count; return NG_OK;
}

#include "lean_bridge_native_runtime.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "native graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNative99d469b3ee044240(uint8_t);
static void *ng_initialize(uint8_t builtin) { return initialize_LeanBridgeNative99d469b3ee044240(builtin); }
static int ng_ready(void) { return lean_bridge_native_component_ready("reviewedcallbacks@1.0.0"); }
static inline uint32_t ng_fe146e5012c4f116e9b6_check(const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *, size_t, int, ng_budget *);
static inline lean_object *ng_fe146e5012c4f116e9b6_in(const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *);
static inline uint32_t ng_fe146e5012c4f116e9b6_out(reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_make(lean_object *);
extern lean_object *lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_items(lean_object *);
static inline uint32_t ng_3dda423e616bb2bf79f0_check(const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *, size_t, int, ng_budget *);
static inline lean_object *ng_3dda423e616bb2bf79f0_in(const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *);
static inline uint32_t ng_3dda423e616bb2bf79f0_out(reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_make(lean_object *);
extern lean_object *lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_items(lean_object *);
static inline uint32_t ng_60624d85b8f2c91d5629_check(const reviewedcallbacks_tile_t *, size_t, int, ng_budget *);
static inline lean_object *ng_60624d85b8f2c91d5629_in(const reviewedcallbacks_tile_t *);
static inline uint32_t ng_60624d85b8f2c91d5629_out(reviewedcallbacks_tile_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_make(lean_object *, lean_object *);
extern lean_object *lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field0(lean_object *);
extern lean_object *lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field1(lean_object *);
static inline uint32_t ng_5f971a64123919686824_check(const reviewedcallbacks_scalar_nat_t *, size_t, int, ng_budget *);
static inline lean_object *ng_5f971a64123919686824_in(const reviewedcallbacks_scalar_nat_t *);
static inline uint32_t ng_5f971a64123919686824_out(reviewedcallbacks_scalar_nat_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_79a0fdaea5f8b1c7df7d_check(const uint8_t *, size_t, int, ng_budget *);
static inline lean_object *ng_79a0fdaea5f8b1c7df7d_in(const uint8_t *);
static inline uint32_t ng_79a0fdaea5f8b1c7df7d_out(uint8_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_fe146e5012c4f116e9b6_check(const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(reviewedcallbacks_graph_fe146e5012c4f116e9b6_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 0, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > budget->nodes) return NG_LIMIT;
  status = ng_span(value->data, value->length, sizeof(reviewedcallbacks_tile_t), _Alignof(reviewedcallbacks_tile_t), budget);
  if (status) return status;
  for (size_t i = 0; i < value->length; ++i) if ((status = ng_60624d85b8f2c91d5629_check(value->data + i, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_fe146e5012c4f116e9b6_in(const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(items, i, ng_60624d85b8f2c91d5629_in(value->data + i));
  return lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_make(items);
}
static inline uint32_t ng_fe146e5012c4f116e9b6_out(reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  value = lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_items(value);
  if (lean_is_scalar(value) || !lean_is_array(value)) { lean_dec(value); return NG_RESULT; }
  size_t count = lean_array_size(value);
  if (count > arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  void *raw;
  uint32_t status = ng_allocate(arena, count, sizeof(reviewedcallbacks_tile_t), &raw);
  out->data = raw; out->length = count; reviewedcallbacks_tile_t *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = ng_60624d85b8f2c91d5629_out(data + i, child, depth + 1, arena);
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_3dda423e616bb2bf79f0_check(const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(reviewedcallbacks_graph_3dda423e616bb2bf79f0_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 1, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > budget->nodes) return NG_LIMIT;
  status = ng_span(value->data, value->length, sizeof(reviewedcallbacks_scalar_nat_t), _Alignof(reviewedcallbacks_scalar_nat_t), budget);
  if (status) return status;
  for (size_t i = 0; i < value->length; ++i) if ((status = ng_5f971a64123919686824_check(value->data + i, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_3dda423e616bb2bf79f0_in(const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(items, i, ng_5f971a64123919686824_in(value->data + i));
  return lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_make(items);
}
static inline uint32_t ng_3dda423e616bb2bf79f0_out(reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  value = lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_items(value);
  if (lean_is_scalar(value) || !lean_is_array(value)) { lean_dec(value); return NG_RESULT; }
  size_t count = lean_array_size(value);
  if (count > arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  void *raw;
  uint32_t status = ng_allocate(arena, count, sizeof(reviewedcallbacks_scalar_nat_t), &raw);
  out->data = raw; out->length = count; reviewedcallbacks_scalar_nat_t *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = ng_5f971a64123919686824_out(data + i, child, depth + 1, arena);
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *ng_60624d85b8f2c91d5629_make(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_dec(items);
  return lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_make(a0, a1);
}
static inline uint32_t ng_60624d85b8f2c91d5629_check(const reviewedcallbacks_tile_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(reviewedcallbacks_tile_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 2, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if ((status = ng_5f971a64123919686824_check(&value->digit, depth + 1, 0, budget))) return status;
  if ((status = ng_5f971a64123919686824_check(&value->count, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_60624d85b8f2c91d5629_in(const reviewedcallbacks_tile_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(2, 2);
  lean_array_set_core(items, 0, ng_5f971a64123919686824_in(&value->digit));
  lean_array_set_core(items, 1, ng_5f971a64123919686824_in(&value->count));
  return ng_60624d85b8f2c91d5629_make(items);
}
static inline uint32_t ng_60624d85b8f2c91d5629_out(reviewedcallbacks_tile_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  uint32_t status = NG_OK;
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->digit, lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field0(value), depth + 1, arena);
    }
  }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->count, lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field1(value), depth + 1, arena);
    }
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_5f971a64123919686824_check(const reviewedcallbacks_scalar_nat_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 3, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  status = ng_span(value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t), budget);
  if (status) return status;
  return NG_OK;
}
static inline lean_object *ng_5f971a64123919686824_in(const reviewedcallbacks_scalar_nat_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *carrier = lean_alloc_array(1, 1);
  lean_array_set_core(carrier, 0, ng_nat_in(value->data, value->length));
  return carrier;
}
static inline uint32_t ng_5f971a64123919686824_out(reviewedcallbacks_scalar_nat_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  uint32_t status = NG_OK;
  status = ng_nat_out(child, arena, &out->data, &out->length);
  lean_dec(child); return status;
}
static inline uint32_t ng_79a0fdaea5f8b1c7df7d_check(const uint8_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(uint8_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 4, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (*value) return NG_INVALID;
  return NG_OK;
}
static inline lean_object *ng_79a0fdaea5f8b1c7df7d_in(const uint8_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *carrier = lean_alloc_array(1, 1);
  lean_array_set_core(carrier, 0, lean_box(0));
  return carrier;
}
static inline uint32_t ng_79a0fdaea5f8b1c7df7d_out(uint8_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  uint32_t status = NG_OK;
  if (!lean_is_scalar(child) || lean_unbox(child) > 0) { lean_dec(child); return NG_RESULT; }
  *out = (uint8_t)lean_unbox(child);
  lean_dec(child); return status;
}
enum { NG_CALLBACK = 6, NG_CALLBACK_RESULT = 10 };
typedef struct ng_borrow_frame { ng_budget budget; uint32_t status; void (*observe)(struct ng_borrow_frame *); } ng_borrow_frame;
static inline void ng_borrow_fail(ng_borrow_frame *frame, uint32_t status) {
  if (!frame->status && status) frame->status = status == NG_CALLBACK_RESULT ? status : status <= NG_CALLBACK ? status : NG_CALLBACK;
}
static inline void ng_borrow_observe(ng_borrow_frame *frame) { if (frame->observe) frame->observe(frame); }
typedef struct { lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls controls; reviewedcallbacks_callback_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096 callback; ng_borrow_frame *frame; } ng_borrow_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096;
static inline lean_object *ng_invoke_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096(void *context, lean_object *value0) {
  ng_borrow_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_scalar_nat_t reply = {0};
  reviewedcallbacks_scalar_nat_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  reviewedcallbacks_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
static inline lean_object *ng_recovery_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096(void *context) {
  ng_borrow_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096 *host = context; ng_borrow_frame *frame = host->frame;
  ng_borrow_observe(frame);
  if (!frame->status && !host->callback.recovery) ng_borrow_fail(frame, NG_INVALID);
  if (!frame->status) ng_borrow_fail(frame, ng_5f971a64123919686824_check(host->callback.recovery, 0, 1, &frame->budget));
  return frame->status ? lean_alloc_array(0, 0) : ng_5f971a64123919686824_in(host->callback.recovery);
}
static inline lean_object *ng_reject_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096(void *context, lean_object *recovery) {
  ng_borrow_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096 *host = context;
  ng_borrow_fail(host->frame, NG_CALLBACK_RESULT);
  return recovery;
}
typedef struct { reviewedcallbacks_callback_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950 callback; ng_borrow_frame *frame; } ng_borrow_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950;
static inline lean_object *ng_invoke_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950(void *context, lean_object *value0) {
  ng_borrow_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_scalar_nat_t reply = {0};
  reviewedcallbacks_scalar_nat_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  reviewedcallbacks_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { reviewedcallbacks_callback_423e0c37f5780352153f2e471aebd23d81e23f74 callback; ng_borrow_frame *frame; } ng_borrow_423e0c37f5780352153f2e471aebd23d81e23f74;
static inline lean_object *ng_invoke_423e0c37f5780352153f2e471aebd23d81e23f74(void *context, lean_object *value0) {
  ng_borrow_423e0c37f5780352153f2e471aebd23d81e23f74 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_scalar_nat_t reply = {0};
  reviewedcallbacks_graph_3dda423e616bb2bf79f0_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_3dda423e616bb2bf79f0_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  reviewedcallbacks_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { reviewedcallbacks_callback_ce903715575b2b74e1c334bc071ce4eceaad0558 callback; ng_borrow_frame *frame; } ng_borrow_ce903715575b2b74e1c334bc071ce4eceaad0558;
static inline lean_object *ng_invoke_ce903715575b2b74e1c334bc071ce4eceaad0558(void *context, lean_object *value0) {
  ng_borrow_ce903715575b2b74e1c334bc071ce4eceaad0558 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_scalar_nat_t reply = {0};
  reviewedcallbacks_graph_fe146e5012c4f116e9b6_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_fe146e5012c4f116e9b6_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  reviewedcallbacks_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { reviewedcallbacks_callback_3b911dc0ceee9737631b7e83276319d96008e83d callback; ng_borrow_frame *frame; } ng_borrow_3b911dc0ceee9737631b7e83276319d96008e83d;
static inline lean_object *ng_invoke_3b911dc0ceee9737631b7e83276319d96008e83d(void *context, lean_object *value0) {
  ng_borrow_3b911dc0ceee9737631b7e83276319d96008e83d *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_scalar_nat_t reply = {0};
  reviewedcallbacks_scalar_nat_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  reviewedcallbacks_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls controls; reviewedcallbacks_callback_ffe59c1b227e089c6c50c0421d94e57562f09578 callback; ng_borrow_frame *frame; } ng_borrow_ffe59c1b227e089c6c50c0421d94e57562f09578;
static inline lean_object *ng_invoke_ffe59c1b227e089c6c50c0421d94e57562f09578(void *context, lean_object *value0) {
  ng_borrow_ffe59c1b227e089c6c50c0421d94e57562f09578 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_scalar_nat_t reply = {0};
  reviewedcallbacks_scalar_nat_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  reviewedcallbacks_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
static inline lean_object *ng_recovery_ffe59c1b227e089c6c50c0421d94e57562f09578(void *context) {
  ng_borrow_ffe59c1b227e089c6c50c0421d94e57562f09578 *host = context; ng_borrow_frame *frame = host->frame;
  ng_borrow_observe(frame);
  if (!frame->status && !host->callback.recovery) ng_borrow_fail(frame, NG_INVALID);
  if (!frame->status) ng_borrow_fail(frame, ng_5f971a64123919686824_check(host->callback.recovery, 0, 1, &frame->budget));
  return frame->status ? lean_alloc_array(0, 0) : ng_5f971a64123919686824_in(host->callback.recovery);
}
static inline lean_object *ng_reject_ffe59c1b227e089c6c50c0421d94e57562f09578(void *context, lean_object *recovery) {
  ng_borrow_ffe59c1b227e089c6c50c0421d94e57562f09578 *host = context;
  ng_borrow_fail(host->frame, NG_CALLBACK_RESULT);
  return recovery;
}
typedef struct { reviewedcallbacks_callback_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e callback; ng_borrow_frame *frame; } ng_borrow_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e;
static inline lean_object *ng_invoke_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e(void *context, lean_object *value0) {
  ng_borrow_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_tile_t reply = {0};
  reviewedcallbacks_scalar_nat_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_60624d85b8f2c91d5629_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_60624d85b8f2c91d5629_in(&reply);
cleanup:
  reviewedcallbacks_tile_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { reviewedcallbacks_callback_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d callback; ng_borrow_frame *frame; } ng_borrow_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d;
static inline lean_object *ng_invoke_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d(void *context, lean_object *value0) {
  ng_borrow_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  reviewedcallbacks_scalar_nat_t reply = {0};
  reviewedcallbacks_scalar_nat_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  reviewedcallbacks_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}


#include <pthread.h>
#include <unistd.h>
typedef struct {
  ng_borrow_frame borrowed;
  uint64_t tokens[32];
  size_t count;
} ng_call_frame;
static _Thread_local ng_call_frame ng_call_frames[64];
static _Thread_local size_t ng_call_depth;
static void ng_call_observe(ng_borrow_frame *borrowed) {
  ng_call_frame *frame = (ng_call_frame *)borrowed;
  if (!ng_ready()) ng_borrow_fail(borrowed, NG_RUNTIME);
  if (lb_native_callback_take_error()) ng_borrow_fail(borrowed, NG_INVALID);
  for (size_t i = 0; i < frame->count; ++i)
    if (lb_native_callback_wrong_thread(frame->tokens[i])) ng_borrow_fail(borrowed, NG_INVALID);
}
static ng_call_frame *ng_call_enter(void) {
  if (ng_call_depth) ng_call_observe(&ng_call_frames[ng_call_depth - 1].borrowed);
  if (ng_call_depth == 64) return NULL;
  ng_call_frame *frame = &ng_call_frames[ng_call_depth++];
  *frame = (ng_call_frame){ .borrowed = {
    .budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144 },
    .observe = ng_call_observe } };
  return frame;
}
static uint32_t ng_call_leave(ng_call_frame *frame) {
  ng_call_observe(&frame->borrowed);
  for (size_t i = 0; i < frame->count; ++i) lb_native_callback_release(frame->tokens[i]);
  frame->count = 0; --ng_call_depth;
  return frame->borrowed.status;
}
typedef struct {
  uint64_t token;
  lean_object *value;
  const char *kind;
  uint64_t thread;
  pid_t process;
} ng_closure_lease;
static ng_closure_lease ng_closure_leases[4096];
static pthread_mutex_t ng_closure_mutex = PTHREAD_MUTEX_INITIALIZER;
/* pthread_t and TLS addresses can be reused after a thread exits. A lease must
   stay bound to the original thread lifetime, not a recycled OS identifier. */
static uint64_t ng_closure_thread_serial;
static _Thread_local uint64_t ng_closure_thread;
static uint64_t ng_closure_store(lean_object *value, const char *kind) {
  uint64_t token = 0;
  pthread_mutex_lock(&ng_closure_mutex);
  if (!ng_closure_thread) {
    if (ng_closure_thread_serial == UINT64_MAX) { pthread_mutex_unlock(&ng_closure_mutex); return 0; }
    ng_closure_thread = ++ng_closure_thread_serial;
  }
  for (size_t i = 0; i < 4096; ++i) {
    ng_closure_lease *slot = &ng_closure_leases[i];
    if (slot->token) continue;
    token = lean_bridge_native_identity_acquire(kind, slot);
    if (token) {
      lean_mark_mt(value);
      *slot = (ng_closure_lease){token, value, kind, ng_closure_thread, getpid()};
    }
    break;
  }
  pthread_mutex_unlock(&ng_closure_mutex);
  return token;
}
static lean_object *ng_closure_borrow(uint64_t token, const char *kind) {
  lean_object *value = NULL;
  pthread_mutex_lock(&ng_closure_mutex);
  for (size_t i = 0; token && i < 4096; ++i) {
    ng_closure_lease *slot = &ng_closure_leases[i];
    if (slot->token == token && !strcmp(slot->kind, kind) && slot->process == getpid()
        && slot->thread == ng_closure_thread) {
      value = slot->value; lean_inc(value); break;
    }
  }
  pthread_mutex_unlock(&ng_closure_mutex);
  return value;
}
static void ng_closure_drop(uint64_t token, const char *kind) {
  lean_object *value = NULL;
  pthread_mutex_lock(&ng_closure_mutex);
  for (size_t i = 0; token && i < 4096; ++i) {
    ng_closure_lease *slot = &ng_closure_leases[i];
    if (slot->token == token && !strcmp(slot->kind, kind) && slot->process == getpid()) {
      value = slot->value;
      (void)lean_bridge_native_identity_release(token, kind, slot);
      *slot = (ng_closure_lease){0}; break;
    }
  }
  pthread_mutex_unlock(&ng_closure_mutex);
  if (value) lean_dec(value);
}


enum { NG_REFINEMENT_MESSAGE_LIMIT = 16384 };
static _Thread_local char ng_refinement_message[NG_REFINEMENT_MESSAGE_LIMIT + 1];
static _Thread_local size_t ng_refinement_length;
static inline void ng_refinement_reset(void) { ng_refinement_length = 0; ng_refinement_message[0] = 0; }
static inline size_t ng_refinement_mark(void) { return ng_refinement_length; }
static inline void ng_refinement_restore(size_t mark) { ng_refinement_length = mark; ng_refinement_message[mark] = 0; }
static inline void ng_refinement_overflow(void) {
  static const char message[] = "Refinement diagnostic exceeds 16 KiB";
  memcpy(ng_refinement_message, message, sizeof(message)); ng_refinement_length = sizeof(message) - 1;
}
static inline int ng_refinement_text(const char *text, size_t length) {
  if (length > NG_REFINEMENT_MESSAGE_LIMIT - ng_refinement_length) { ng_refinement_overflow(); return 0; }
  memcpy(ng_refinement_message + ng_refinement_length, text, length); ng_refinement_length += length;
  ng_refinement_message[ng_refinement_length] = 0; return 1;
}
static inline int ng_refinement_index(size_t value) {
  char digits[3 * sizeof(size_t) + 1]; size_t length = 0;
  do { digits[length++] = (char)('0' + value % 10); value /= 10; } while (value);
  if (!ng_refinement_text("[", 1)) return 0;
  while (length) if (!ng_refinement_text(&digits[--length], 1)) return 0;
  return ng_refinement_text("]", 1);
}
static inline uint32_t ng_refinement_reject(const char *suffix) {
  return ng_refinement_text(suffix, strlen(suffix)) ? NG_INVALID : NG_LIMIT;
}
static inline int ng_fin_below(const uint32_t *data, size_t length, const uint32_t *bound, size_t bound_length) {
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}
const char *reviewedcallbacks_callable_graph_error(void) {
  const char *result = ng_refinement_length ? ng_refinement_message : NULL;
  ng_refinement_length = 0;
  return result;
}

static const uint32_t ng_fin_4a44dc15364204a80fe8[1] = {0xau};
static const uint32_t ng_fin_4e07408562bedb8b60ce[1] = {0x3u};
static const uint32_t ng_fin_ef2d127de37b942baad0[1] = {0x5u};
static uint32_t ng_refinement_af941ea718d998c52d4b(const reviewedcallbacks_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_006244a9d363525ebf2f(const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_06621ee956a8a399b888(const reviewedcallbacks_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_ad02af5902b1652b35af(const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3435580d35048f105719(const reviewedcallbacks_tile_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_7b1b98558060ac96331c(const reviewedcallbacks_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_af941ea718d998c52d4b(const reviewedcallbacks_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4a44dc15364204a80fe8, 1))
    return ng_refinement_reject(" is not below its Fin 10 bound");
  return NG_OK;
}
static uint32_t ng_refinement_006244a9d363525ebf2f(const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i0 = 0; i0 < value->length; ++i0) {
    size_t mark1 = ng_refinement_mark();
    if (!ng_refinement_index(i0)) return NG_LIMIT;
    uint32_t status1 = ng_refinement_06621ee956a8a399b888(value->data + i0, depth + 1, nodes);
    if (status1) return status1;
    ng_refinement_restore(mark1);
  }
  return NG_OK;
}
static uint32_t ng_refinement_06621ee956a8a399b888(const reviewedcallbacks_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_ad02af5902b1652b35af(const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i3 = 0; i3 < value->length; ++i3) {
    size_t mark4 = ng_refinement_mark();
    if (!ng_refinement_index(i3)) return NG_LIMIT;
    uint32_t status4 = ng_refinement_3435580d35048f105719(value->data + i3, depth + 1, nodes);
    if (status4) return status4;
    ng_refinement_restore(mark4);
  }
  return NG_OK;
}
static uint32_t ng_refinement_3435580d35048f105719(const reviewedcallbacks_tile_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark2 = ng_refinement_mark();
  if (!ng_refinement_text(".digit", sizeof(".digit") - 1)) return NG_LIMIT;
  uint32_t status2 = ng_refinement_7b1b98558060ac96331c(&value->digit, depth + 1, nodes);
  if (status2) return status2;
  ng_refinement_restore(mark2);
  return NG_OK;
}
static uint32_t ng_refinement_7b1b98558060ac96331c(const reviewedcallbacks_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_ef2d127de37b942baad0, 1))
    return ng_refinement_reject(" is not below its Fin 5 bound");
  return NG_OK;
}
static uint32_t ng_closure_refusal_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950(const reviewedcallbacks_scalar_nat_t *a0) {
  uint32_t status;
  ng_refinement_reset();
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_af941ea718d998c52d4b(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  return NG_OK;
}
static uint32_t ng_closure_refusal_423e0c37f5780352153f2e471aebd23d81e23f74(const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *a0) {
  uint32_t status;
  ng_refinement_reset();
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_006244a9d363525ebf2f(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  return NG_OK;
}
static uint32_t ng_closure_refusal_ce903715575b2b74e1c334bc071ce4eceaad0558(const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *a0) {
  uint32_t status;
  ng_refinement_reset();
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_ad02af5902b1652b35af(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  return NG_OK;
}
uint32_t lean_bridge_fa450d817b39ecc8598f3607_graph(const reviewedcallbacks_callback_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d *a0, const reviewedcallbacks_scalar_nat_t *a1, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  ng_borrow_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d host0 = {0};
  uint64_t token0 = 0;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  if (!ng_pointer(a0, sizeof(*a0), _Alignof(reviewedcallbacks_callback_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d)) || !a0->call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a1, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  host0 = (ng_borrow_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d){*a0, frame};
  token0 = lb_native_callback_register((void (*)(void))ng_invoke_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d, &host0);
  if (!token0) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  call->tokens[call->count++] = token0;
  value = lean_bridge_fa450d817b39ecc8598f3607_lean(lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_wrap((size_t)token0), ng_5f971a64123919686824_in(a1));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
uint32_t lean_bridge_53b0de0e75e4c429aaad48c8_graph(const reviewedcallbacks_scalar_nat_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_53b0de0e75e4c429aaad48c8_lean(ng_5f971a64123919686824_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "reviewedcallbacks@1.0.0:graph-callback:3b911dc0ceee9737631b7e83276319d96008e83d");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "reviewedcallbacks@1.0.0:graph-callback:3b911dc0ceee9737631b7e83276319d96008e83d");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_8477254b8ea47a726adc68ad_graph(const uint8_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_79a0fdaea5f8b1c7df7d_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_8477254b8ea47a726adc68ad_lean(ng_79a0fdaea5f8b1c7df7d_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "reviewedcallbacks@1.0.0:graph-callback:423e0c37f5780352153f2e471aebd23d81e23f74");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "reviewedcallbacks@1.0.0:graph-callback:423e0c37f5780352153f2e471aebd23d81e23f74");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_fb3aeed37b46e0e2a78ba51c_graph(const reviewedcallbacks_scalar_nat_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_fb3aeed37b46e0e2a78ba51c_lean(ng_5f971a64123919686824_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "reviewedcallbacks@1.0.0:graph-callback:c9f9ab9808d5ed4cd9eb0c5380d7151c17138950");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "reviewedcallbacks@1.0.0:graph-callback:c9f9ab9808d5ed4cd9eb0c5380d7151c17138950");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_2f9e82778120400da600fcee_graph(const reviewedcallbacks_callback_ffe59c1b227e089c6c50c0421d94e57562f09578 *a0, const reviewedcallbacks_scalar_nat_t *a1, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  ng_borrow_ffe59c1b227e089c6c50c0421d94e57562f09578 host0 = {0};
  uint64_t token0 = 0;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  if (!ng_pointer(a0, sizeof(*a0), _Alignof(reviewedcallbacks_callback_ffe59c1b227e089c6c50c0421d94e57562f09578)) || !a0->call || !a0->recovery) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a1, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  host0 = (ng_borrow_ffe59c1b227e089c6c50c0421d94e57562f09578){{ng_recovery_ffe59c1b227e089c6c50c0421d94e57562f09578, ng_reject_ffe59c1b227e089c6c50c0421d94e57562f09578}, *a0, frame};
  token0 = lb_native_callback_register((void (*)(void))ng_invoke_ffe59c1b227e089c6c50c0421d94e57562f09578, &host0);
  if (!token0) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  call->tokens[call->count++] = token0;
  value = lean_bridge_2f9e82778120400da600fcee_lean(lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_wrap((size_t)token0), ng_5f971a64123919686824_in(a1));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
uint32_t lean_bridge_e429d90b6e2575f2175e6951_graph(const reviewedcallbacks_scalar_nat_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_e429d90b6e2575f2175e6951_lean(ng_5f971a64123919686824_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "reviewedcallbacks@1.0.0:graph-callback:d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "reviewedcallbacks@1.0.0:graph-callback:d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_b6410c4c69dffaa409842d74_graph(const uint8_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_79a0fdaea5f8b1c7df7d_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_b6410c4c69dffaa409842d74_lean(ng_79a0fdaea5f8b1c7df7d_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "reviewedcallbacks@1.0.0:graph-callback:ce903715575b2b74e1c334bc071ce4eceaad0558");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "reviewedcallbacks@1.0.0:graph-callback:ce903715575b2b74e1c334bc071ce4eceaad0558");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_a4054277eb23862f1406fddb_graph(const reviewedcallbacks_callback_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096 *a0, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  ng_borrow_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096 host0 = {0};
  uint64_t token0 = 0;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  if (!ng_pointer(a0, sizeof(*a0), _Alignof(reviewedcallbacks_callback_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096)) || !a0->call || !a0->recovery) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  host0 = (ng_borrow_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096){{ng_recovery_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096, ng_reject_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096}, *a0, frame};
  token0 = lb_native_callback_register((void (*)(void))ng_invoke_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096, &host0);
  if (!token0) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  call->tokens[call->count++] = token0;
  value = lean_bridge_a4054277eb23862f1406fddb_lean(lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_wrap((size_t)token0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
uint32_t reviewedcallbacks_callback_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950_lease_call(uint64_t self, const reviewedcallbacks_scalar_nat_t *a0, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  int refused = 0;
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "reviewedcallbacks@1.0.0:graph-callback:c9f9ab9808d5ed4cd9eb0c5380d7151c17138950");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_fa450d817b39ecc8598f3607_structured_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950_apply(closure, ng_5f971a64123919686824_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    refused = ng_closure_refusal_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950(a0) == NG_INVALID;
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (closure) lean_dec(closure);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  if (status != NG_INVALID || !refused) ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
void reviewedcallbacks_callback_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950_lease_dispose(uint64_t token) { ng_closure_drop(token, "reviewedcallbacks@1.0.0:graph-callback:c9f9ab9808d5ed4cd9eb0c5380d7151c17138950"); }
uint32_t reviewedcallbacks_callback_423e0c37f5780352153f2e471aebd23d81e23f74_lease_call(uint64_t self, const reviewedcallbacks_graph_3dda423e616bb2bf79f0_t *a0, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  int refused = 0;
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_3dda423e616bb2bf79f0_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "reviewedcallbacks@1.0.0:graph-callback:423e0c37f5780352153f2e471aebd23d81e23f74");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_fa450d817b39ecc8598f3607_structured_423e0c37f5780352153f2e471aebd23d81e23f74_apply(closure, ng_3dda423e616bb2bf79f0_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    refused = ng_closure_refusal_423e0c37f5780352153f2e471aebd23d81e23f74(a0) == NG_INVALID;
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (closure) lean_dec(closure);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  if (status != NG_INVALID || !refused) ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
void reviewedcallbacks_callback_423e0c37f5780352153f2e471aebd23d81e23f74_lease_dispose(uint64_t token) { ng_closure_drop(token, "reviewedcallbacks@1.0.0:graph-callback:423e0c37f5780352153f2e471aebd23d81e23f74"); }
uint32_t reviewedcallbacks_callback_ce903715575b2b74e1c334bc071ce4eceaad0558_lease_call(uint64_t self, const reviewedcallbacks_graph_fe146e5012c4f116e9b6_t *a0, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  int refused = 0;
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_fe146e5012c4f116e9b6_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "reviewedcallbacks@1.0.0:graph-callback:ce903715575b2b74e1c334bc071ce4eceaad0558");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_apply(closure, ng_fe146e5012c4f116e9b6_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    refused = ng_closure_refusal_ce903715575b2b74e1c334bc071ce4eceaad0558(a0) == NG_INVALID;
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (closure) lean_dec(closure);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  if (status != NG_INVALID || !refused) ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
void reviewedcallbacks_callback_ce903715575b2b74e1c334bc071ce4eceaad0558_lease_dispose(uint64_t token) { ng_closure_drop(token, "reviewedcallbacks@1.0.0:graph-callback:ce903715575b2b74e1c334bc071ce4eceaad0558"); }
uint32_t reviewedcallbacks_callback_3b911dc0ceee9737631b7e83276319d96008e83d_lease_call(uint64_t self, const reviewedcallbacks_scalar_nat_t *a0, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "reviewedcallbacks@1.0.0:graph-callback:3b911dc0ceee9737631b7e83276319d96008e83d");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_fa450d817b39ecc8598f3607_structured_3b911dc0ceee9737631b7e83276319d96008e83d_apply(closure, ng_5f971a64123919686824_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (closure) lean_dec(closure);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
void reviewedcallbacks_callback_3b911dc0ceee9737631b7e83276319d96008e83d_lease_dispose(uint64_t token) { ng_closure_drop(token, "reviewedcallbacks@1.0.0:graph-callback:3b911dc0ceee9737631b7e83276319d96008e83d"); }
uint32_t reviewedcallbacks_callback_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_lease_call(uint64_t self, const reviewedcallbacks_scalar_nat_t *a0, reviewedcallbacks_tile_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_tile_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_tile_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "reviewedcallbacks@1.0.0:graph-callback:d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_apply(closure, ng_5f971a64123919686824_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_60624d85b8f2c91d5629_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (closure) lean_dec(closure);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
void reviewedcallbacks_callback_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_lease_dispose(uint64_t token) { ng_closure_drop(token, "reviewedcallbacks@1.0.0:graph-callback:d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e"); }
uint32_t reviewedcallbacks_callback_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_lease_call(uint64_t self, const reviewedcallbacks_scalar_nat_t *a0, reviewedcallbacks_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(reviewedcallbacks_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("reviewedcallbacks@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  reviewedcallbacks_scalar_nat_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "reviewedcallbacks@1.0.0:graph-callback:8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_apply(closure, ng_5f971a64123919686824_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&result, value, 0, &arena));
  value = NULL; /* The walker consumes its carrier on every path. */
cleanup:
  if (value) lean_dec(value);
  if (closure) lean_dec(closure);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    ng_release(arena.head); return status;
  }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
void reviewedcallbacks_callback_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_lease_dispose(uint64_t token) { ng_closure_drop(token, "reviewedcallbacks@1.0.0:graph-callback:8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d"); }
