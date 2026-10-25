#include "recursivesubtypes-graph.h"

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
const char *recursivesubtypes_graph_error(void) {
  const char *result = ng_refinement_length ? ng_refinement_message : NULL;
  ng_refinement_length = 0;
  return result;
}

extern uint8_t lean_bridge_5f9ebf1241c61a39ed1bdebf_graph_refinement_0_f47f84e548df9f42ce87(lean_object *);
extern uint8_t lean_bridge_61edaca9ace2104f41ea6e59_graph_refinement_0_f47f84e548df9f42ce87(lean_object *);
extern uint8_t lean_bridge_890e535d855edd42581629d4_graph_refinement_0_f47f84e548df9f42ce87(lean_object *);
extern uint8_t lean_bridge_9e8d2cbaa99dca92eb622921_graph_refinement_0_053cd996a2b855a7fe90(lean_object *);
extern uint8_t lean_bridge_a9ae70188abbca81b8f235ce_graph_refinement_0_f47f84e548df9f42ce87(lean_object *);
static const uint32_t ng_fin_4e07408562bedb8b60ce[1] = {0x3u};
static uint32_t ng_refinement_a6cc8fd286d94c8cdc9e(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_5ffe90a72beb88c7b8e7(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_cc8af7004677ec59a287(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_5bbe75738d0c65b46fcd(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_183effcd1bb99975496c(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_7f1eeda0908b5f3406a2(const recursivesubtypes_graph_170e86bf9eebb9860794_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_f8d651967e83d8792229(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_6405d703971b4e626aea(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_85eba3fcaad745150589(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_c8de47acbe7db3240afc(const recursivesubtypes_graph_170e86bf9eebb9860794_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_35b9335ad7c6eda51ed4(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_fd7140b78e04291849d7(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_111f3bd3896c66090dfb(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3b76089db460ae26c904(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_18fcc7f4a6504d0118d1(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_e0c7add3396e1ec9f860(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_1466b762991bfa06e995(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_20ae13575c20e17490d8(const recursivesubtypes_graph_170e86bf9eebb9860794_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_fba34b0e22d223f57b55(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_a23ef32a7d74cedc24d2(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_d384bdba76e0f46ed617(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_e68a22caa5cf65bff2c5(const recursivesubtypes_graph_170e86bf9eebb9860794_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_5447d659f50f5211a68b(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_44a111c7491e429f27b2(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_5fdfcb24755519ec7c15(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_2f5cb23194ad3288fad2(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_546235744133919abad0(const recursivesubtypes_chain_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_09232c1a092d06b314ca(const recursivesubtypes_scalar_nat_t *, uint32_t, uint32_t *);
#include "lean_bridge_native_runtime.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "native graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNative597c05ce6432c0d3(uint8_t);
static void *ng_initialize(uint8_t builtin) { return initialize_LeanBridgeNative597c05ce6432c0d3(builtin); }
static int ng_ready(void) { return lean_bridge_native_component_ready("recursivesubtypes@1.0.0"); }
static inline uint32_t ng_170e86bf9eebb9860794_check(const recursivesubtypes_graph_170e86bf9eebb9860794_t *, size_t, int, ng_budget *);
static inline lean_object *ng_170e86bf9eebb9860794_in(const recursivesubtypes_graph_170e86bf9eebb9860794_t *);
static inline uint32_t ng_170e86bf9eebb9860794_out(recursivesubtypes_graph_170e86bf9eebb9860794_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_branch(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_none(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_make0(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_field0(lean_object *);
static inline uint32_t ng_69c0b33a73ddceecbd00_check(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *, size_t, int, ng_budget *);
static inline lean_object *ng_69c0b33a73ddceecbd00_in(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *);
static inline uint32_t ng_69c0b33a73ddceecbd00_out(recursivesubtypes_graph_69c0b33a73ddceecbd00_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_make(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_items(lean_object *);
static inline uint32_t ng_6c2f0144ffb165538c8b_check(const recursivesubtypes_chain_t *, size_t, int, ng_budget *);
static inline lean_object *ng_6c2f0144ffb165538c8b_in(const recursivesubtypes_chain_t *);
static inline uint32_t ng_6c2f0144ffb165538c8b_out(recursivesubtypes_chain_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_branch(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make0(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make1(lean_object *, lean_object *, lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field0(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field1(lean_object *);
extern lean_object *lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field2(lean_object *);
static inline uint32_t ng_5f971a64123919686824_check(const recursivesubtypes_scalar_nat_t *, size_t, int, ng_budget *);
static inline lean_object *ng_5f971a64123919686824_in(const recursivesubtypes_scalar_nat_t *);
static inline uint32_t ng_5f971a64123919686824_out(recursivesubtypes_scalar_nat_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_170e86bf9eebb9860794_check(const recursivesubtypes_graph_170e86bf9eebb9860794_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivesubtypes_graph_170e86bf9eebb9860794_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 0, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->has_value > 1) return NG_INVALID;
  if (value->has_value) {
  if ((status = ng_6c2f0144ffb165538c8b_check(&value->value, depth + 1, 0, budget))) return status;
  }
  return NG_OK;
}
static inline lean_object *ng_170e86bf9eebb9860794_in(const recursivesubtypes_graph_170e86bf9eebb9860794_t *value) {
  (void)value; LB_GRAPH_DECODE();
  if (!value->has_value) return lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_none(lean_box(0));
  if (value->has_value) return lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_make0(ng_6c2f0144ffb165538c8b_in(&value->value));
  return lean_alloc_array(0, 0);
}
static inline uint32_t ng_170e86bf9eebb9860794_out(recursivesubtypes_graph_170e86bf9eebb9860794_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_branch(value);
  if (branch > 1) { lean_dec(value); return NG_RESULT; }
  out->has_value = branch;
  uint32_t status = NG_OK;
  if (out->has_value) {
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_6c2f0144ffb165538c8b_out(&out->value, lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_field0(value), depth + 1, arena);
    }
  }
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_69c0b33a73ddceecbd00_check(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivesubtypes_graph_69c0b33a73ddceecbd00_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 1, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > budget->nodes) return NG_LIMIT;
  status = ng_span(value->data, value->length, sizeof(recursivesubtypes_graph_170e86bf9eebb9860794_t), _Alignof(recursivesubtypes_graph_170e86bf9eebb9860794_t), budget);
  if (status) return status;
  for (size_t i = 0; i < value->length; ++i) if ((status = ng_170e86bf9eebb9860794_check(value->data + i, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_69c0b33a73ddceecbd00_in(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(items, i, ng_170e86bf9eebb9860794_in(value->data + i));
  return lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_make(items);
}
static inline uint32_t ng_69c0b33a73ddceecbd00_out(recursivesubtypes_graph_69c0b33a73ddceecbd00_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  value = lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_items(value);
  if (lean_is_scalar(value) || !lean_is_array(value)) { lean_dec(value); return NG_RESULT; }
  size_t count = lean_array_size(value);
  if (count > arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  void *raw;
  uint32_t status = ng_allocate(arena, count, sizeof(recursivesubtypes_graph_170e86bf9eebb9860794_t), &raw);
  out->data = raw; out->length = count; recursivesubtypes_graph_170e86bf9eebb9860794_t *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = ng_170e86bf9eebb9860794_out(data + i, child, depth + 1, arena);
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *ng_6c2f0144ffb165538c8b_make1(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_object *a2 = lean_array_get_core(items, 2); lean_inc(a2);
  lean_dec(items);
  return lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make1(a0, a1, a2);
}
static inline uint32_t ng_6c2f0144ffb165538c8b_check(const recursivesubtypes_chain_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivesubtypes_chain_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 2, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  switch (value->kind) {
  case 0:
  break;
  case 1:
  if ((status = ng_5f971a64123919686824_check(&value->cases.node.value, depth + 1, 0, budget))) return status;
  if ((status = ng_5f971a64123919686824_check(&value->cases.node.digit, depth + 1, 0, budget))) return status;
  if ((status = ng_6c2f0144ffb165538c8b_check(value->cases.node.tail, depth + 1, 1, budget))) return status;
  break;
  default: return NG_INVALID;
  }
  return NG_OK;
}
static inline lean_object *ng_6c2f0144ffb165538c8b_in(const recursivesubtypes_chain_t *value) {
  (void)value; LB_GRAPH_DECODE();
  switch (value->kind) {
  case 0: {
  return lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make0(lean_box(0));
  }
  case 1: {
  lean_object *items = lean_alloc_array(3, 3);
  lean_array_set_core(items, 0, ng_5f971a64123919686824_in(&value->cases.node.value));
  lean_array_set_core(items, 1, ng_5f971a64123919686824_in(&value->cases.node.digit));
  lean_array_set_core(items, 2, ng_6c2f0144ffb165538c8b_in(value->cases.node.tail));
  return ng_6c2f0144ffb165538c8b_make1(items);
  }
  default: return lean_alloc_array(0, 0);
  }
}
static inline uint32_t ng_6c2f0144ffb165538c8b_out(recursivesubtypes_chain_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_branch(value), status = NG_OK;
  out->kind = branch;
  switch (branch) {
  case 0: {
  break;
  }
  case 1: {
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->cases.node.value, lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field0(value), depth + 1, arena);
    }
  }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->cases.node.digit, lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field1(value), depth + 1, arena);
    }
  }
  if (!status) {
    void *raw;
    status = ng_allocate(arena, 1, sizeof(recursivesubtypes_chain_t), &raw);
    out->cases.node.tail = raw;
    if (!status) {
      lean_inc(value);
      status = ng_6c2f0144ffb165538c8b_out(raw, lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field2(value), depth + 1, arena);
    }
  }
  break;
  }
  default: status = NG_RESULT;
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_5f971a64123919686824_check(const recursivesubtypes_scalar_nat_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivesubtypes_scalar_nat_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 3, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  status = ng_span(value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t), budget);
  if (status) return status;
  return NG_OK;
}
static inline lean_object *ng_5f971a64123919686824_in(const recursivesubtypes_scalar_nat_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *carrier = lean_alloc_array(1, 1);
  lean_array_set_core(carrier, 0, ng_nat_in(value->data, value->length));
  return carrier;
}
static inline uint32_t ng_5f971a64123919686824_out(recursivesubtypes_scalar_nat_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  uint32_t status = NG_OK;
  status = ng_nat_out(child, arena, &out->data, &out->length);
  lean_dec(child); return status;
}
static uint32_t ng_refinement_a6cc8fd286d94c8cdc9e(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark0 = ng_refinement_mark();
    if (!ng_refinement_text(".node.digit", sizeof(".node.digit") - 1)) return NG_LIMIT;
    uint32_t status0 = ng_refinement_5ffe90a72beb88c7b8e7(&value->cases.node.digit, depth + 1, nodes);
    if (status0) return status0;
    ng_refinement_restore(mark0);
    size_t mark1 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status1 = ng_refinement_a6cc8fd286d94c8cdc9e(value->cases.node.tail, depth + 1, nodes);
    if (status1) return status1;
    ng_refinement_restore(mark1);
  }
  return NG_OK;
}
static uint32_t ng_refinement_5ffe90a72beb88c7b8e7(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_cc8af7004677ec59a287(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark2 = ng_refinement_mark();
    if (!ng_refinement_text(".node.value", sizeof(".node.value") - 1)) return NG_LIMIT;
    uint32_t status2 = ng_refinement_5bbe75738d0c65b46fcd(&value->cases.node.value, depth + 1, nodes);
    if (status2) return status2;
    ng_refinement_restore(mark2);
    size_t mark3 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status3 = ng_refinement_cc8af7004677ec59a287(value->cases.node.tail, depth + 1, nodes);
    if (status3) return status3;
    ng_refinement_restore(mark3);
  }
  return NG_OK;
}
static uint32_t ng_refinement_5bbe75738d0c65b46fcd(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_890e535d855edd42581629d4_graph_refinement_0_f47f84e548df9f42ce87(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveSubtypes.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_183effcd1bb99975496c(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i7 = 0; i7 < value->length; ++i7) {
    size_t mark8 = ng_refinement_mark();
    if (!ng_refinement_index(i7)) return NG_LIMIT;
    uint32_t status8 = ng_refinement_7f1eeda0908b5f3406a2(value->data + i7, depth + 1, nodes);
    if (status8) return status8;
    ng_refinement_restore(mark8);
  }
  return NG_OK;
}
static uint32_t ng_refinement_7f1eeda0908b5f3406a2(const recursivesubtypes_graph_170e86bf9eebb9860794_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark6 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status6 = ng_refinement_f8d651967e83d8792229(&value->value, depth + 1, nodes);
    if (status6) return status6;
    ng_refinement_restore(mark6);
  }
  return NG_OK;
}
static uint32_t ng_refinement_f8d651967e83d8792229(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark4 = ng_refinement_mark();
    if (!ng_refinement_text(".node.digit", sizeof(".node.digit") - 1)) return NG_LIMIT;
    uint32_t status4 = ng_refinement_6405d703971b4e626aea(&value->cases.node.digit, depth + 1, nodes);
    if (status4) return status4;
    ng_refinement_restore(mark4);
    size_t mark5 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status5 = ng_refinement_f8d651967e83d8792229(value->cases.node.tail, depth + 1, nodes);
    if (status5) return status5;
    ng_refinement_restore(mark5);
  }
  return NG_OK;
}
static uint32_t ng_refinement_6405d703971b4e626aea(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_85eba3fcaad745150589(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i12 = 0; i12 < value->length; ++i12) {
    size_t mark13 = ng_refinement_mark();
    if (!ng_refinement_index(i12)) return NG_LIMIT;
    uint32_t status13 = ng_refinement_c8de47acbe7db3240afc(value->data + i12, depth + 1, nodes);
    if (status13) return status13;
    ng_refinement_restore(mark13);
  }
  return NG_OK;
}
static uint32_t ng_refinement_c8de47acbe7db3240afc(const recursivesubtypes_graph_170e86bf9eebb9860794_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark11 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status11 = ng_refinement_35b9335ad7c6eda51ed4(&value->value, depth + 1, nodes);
    if (status11) return status11;
    ng_refinement_restore(mark11);
  }
  return NG_OK;
}
static uint32_t ng_refinement_35b9335ad7c6eda51ed4(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark9 = ng_refinement_mark();
    if (!ng_refinement_text(".node.value", sizeof(".node.value") - 1)) return NG_LIMIT;
    uint32_t status9 = ng_refinement_fd7140b78e04291849d7(&value->cases.node.value, depth + 1, nodes);
    if (status9) return status9;
    ng_refinement_restore(mark9);
    size_t mark10 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status10 = ng_refinement_35b9335ad7c6eda51ed4(value->cases.node.tail, depth + 1, nodes);
    if (status10) return status10;
    ng_refinement_restore(mark10);
  }
  return NG_OK;
}
static uint32_t ng_refinement_fd7140b78e04291849d7(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_61edaca9ace2104f41ea6e59_graph_refinement_0_f47f84e548df9f42ce87(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveSubtypes.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_111f3bd3896c66090dfb(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark14 = ng_refinement_mark();
    if (!ng_refinement_text(".node.digit", sizeof(".node.digit") - 1)) return NG_LIMIT;
    uint32_t status14 = ng_refinement_3b76089db460ae26c904(&value->cases.node.digit, depth + 1, nodes);
    if (status14) return status14;
    ng_refinement_restore(mark14);
    size_t mark15 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status15 = ng_refinement_111f3bd3896c66090dfb(value->cases.node.tail, depth + 1, nodes);
    if (status15) return status15;
    ng_refinement_restore(mark15);
  }
  return NG_OK;
}
static uint32_t ng_refinement_3b76089db460ae26c904(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_18fcc7f4a6504d0118d1(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark16 = ng_refinement_mark();
    if (!ng_refinement_text(".node.value", sizeof(".node.value") - 1)) return NG_LIMIT;
    uint32_t status16 = ng_refinement_e0c7add3396e1ec9f860(&value->cases.node.value, depth + 1, nodes);
    if (status16) return status16;
    ng_refinement_restore(mark16);
    size_t mark17 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status17 = ng_refinement_18fcc7f4a6504d0118d1(value->cases.node.tail, depth + 1, nodes);
    if (status17) return status17;
    ng_refinement_restore(mark17);
  }
  return NG_OK;
}
static uint32_t ng_refinement_e0c7add3396e1ec9f860(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_a9ae70188abbca81b8f235ce_graph_refinement_0_f47f84e548df9f42ce87(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveSubtypes.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_1466b762991bfa06e995(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i21 = 0; i21 < value->length; ++i21) {
    size_t mark22 = ng_refinement_mark();
    if (!ng_refinement_index(i21)) return NG_LIMIT;
    uint32_t status22 = ng_refinement_20ae13575c20e17490d8(value->data + i21, depth + 1, nodes);
    if (status22) return status22;
    ng_refinement_restore(mark22);
  }
  return NG_OK;
}
static uint32_t ng_refinement_20ae13575c20e17490d8(const recursivesubtypes_graph_170e86bf9eebb9860794_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark20 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status20 = ng_refinement_fba34b0e22d223f57b55(&value->value, depth + 1, nodes);
    if (status20) return status20;
    ng_refinement_restore(mark20);
  }
  return NG_OK;
}
static uint32_t ng_refinement_fba34b0e22d223f57b55(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark18 = ng_refinement_mark();
    if (!ng_refinement_text(".node.digit", sizeof(".node.digit") - 1)) return NG_LIMIT;
    uint32_t status18 = ng_refinement_a23ef32a7d74cedc24d2(&value->cases.node.digit, depth + 1, nodes);
    if (status18) return status18;
    ng_refinement_restore(mark18);
    size_t mark19 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status19 = ng_refinement_fba34b0e22d223f57b55(value->cases.node.tail, depth + 1, nodes);
    if (status19) return status19;
    ng_refinement_restore(mark19);
  }
  return NG_OK;
}
static uint32_t ng_refinement_a23ef32a7d74cedc24d2(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_d384bdba76e0f46ed617(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i26 = 0; i26 < value->length; ++i26) {
    size_t mark27 = ng_refinement_mark();
    if (!ng_refinement_index(i26)) return NG_LIMIT;
    uint32_t status27 = ng_refinement_e68a22caa5cf65bff2c5(value->data + i26, depth + 1, nodes);
    if (status27) return status27;
    ng_refinement_restore(mark27);
  }
  return NG_OK;
}
static uint32_t ng_refinement_e68a22caa5cf65bff2c5(const recursivesubtypes_graph_170e86bf9eebb9860794_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark25 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status25 = ng_refinement_5447d659f50f5211a68b(&value->value, depth + 1, nodes);
    if (status25) return status25;
    ng_refinement_restore(mark25);
  }
  return NG_OK;
}
static uint32_t ng_refinement_5447d659f50f5211a68b(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark23 = ng_refinement_mark();
    if (!ng_refinement_text(".node.value", sizeof(".node.value") - 1)) return NG_LIMIT;
    uint32_t status23 = ng_refinement_44a111c7491e429f27b2(&value->cases.node.value, depth + 1, nodes);
    if (status23) return status23;
    ng_refinement_restore(mark23);
    size_t mark24 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status24 = ng_refinement_5447d659f50f5211a68b(value->cases.node.tail, depth + 1, nodes);
    if (status24) return status24;
    ng_refinement_restore(mark24);
  }
  return NG_OK;
}
static uint32_t ng_refinement_44a111c7491e429f27b2(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_5f9ebf1241c61a39ed1bdebf_graph_refinement_0_f47f84e548df9f42ce87(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveSubtypes.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_5fdfcb24755519ec7c15(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark28 = ng_refinement_mark();
    if (!ng_refinement_text(".node.digit", sizeof(".node.digit") - 1)) return NG_LIMIT;
    uint32_t status28 = ng_refinement_2f5cb23194ad3288fad2(&value->cases.node.digit, depth + 1, nodes);
    if (status28) return status28;
    ng_refinement_restore(mark28);
    size_t mark29 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status29 = ng_refinement_5fdfcb24755519ec7c15(value->cases.node.tail, depth + 1, nodes);
    if (status29) return status29;
    ng_refinement_restore(mark29);
  }
  return NG_OK;
}
static uint32_t ng_refinement_2f5cb23194ad3288fad2(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_546235744133919abad0(const recursivesubtypes_chain_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark30 = ng_refinement_mark();
    if (!ng_refinement_text(".node.value", sizeof(".node.value") - 1)) return NG_LIMIT;
    uint32_t status30 = ng_refinement_09232c1a092d06b314ca(&value->cases.node.value, depth + 1, nodes);
    if (status30) return status30;
    ng_refinement_restore(mark30);
    size_t mark31 = ng_refinement_mark();
    if (!ng_refinement_text(".node.tail", sizeof(".node.tail") - 1)) return NG_LIMIT;
    uint32_t status31 = ng_refinement_546235744133919abad0(value->cases.node.tail, depth + 1, nodes);
    if (status31) return status31;
    ng_refinement_restore(mark31);
  }
  return NG_OK;
}
static uint32_t ng_refinement_09232c1a092d06b314ca(const recursivesubtypes_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_9e8d2cbaa99dca92eb622921_graph_refinement_0_053cd996a2b855a7fe90(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveSubtypes.plusTwo");
  return NG_OK;
}
extern lean_object *lean_bridge_890e535d855edd42581629d4_lean(lean_object *);
uint32_t recursivesubtypes_echo_graph(const recursivesubtypes_chain_t *a0, recursivesubtypes_chain_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivesubtypes_chain_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_6c2f0144ffb165538c8b_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_a6cc8fd286d94c8cdc9e(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_cc8af7004677ec59a287(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivesubtypes@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_6c2f0144ffb165538c8b_in(a0);
  lean_object *value = lean_bridge_890e535d855edd42581629d4_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivesubtypes_chain_t result = {0};
  status = ng_6c2f0144ffb165538c8b_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_61edaca9ace2104f41ea6e59_lean(lean_object *);
uint32_t recursivesubtypes_echo_groups_graph(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *a0, recursivesubtypes_graph_69c0b33a73ddceecbd00_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivesubtypes_graph_69c0b33a73ddceecbd00_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_69c0b33a73ddceecbd00_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_183effcd1bb99975496c(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_85eba3fcaad745150589(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivesubtypes@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_69c0b33a73ddceecbd00_in(a0);
  lean_object *value = lean_bridge_61edaca9ace2104f41ea6e59_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivesubtypes_graph_69c0b33a73ddceecbd00_t result = {0};
  status = ng_69c0b33a73ddceecbd00_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_a9ae70188abbca81b8f235ce_lean(lean_object *);
uint32_t recursivesubtypes_first_graph(const recursivesubtypes_chain_t *a0, recursivesubtypes_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivesubtypes_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_6c2f0144ffb165538c8b_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_111f3bd3896c66090dfb(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_18fcc7f4a6504d0118d1(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivesubtypes@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_6c2f0144ffb165538c8b_in(a0);
  lean_object *value = lean_bridge_a9ae70188abbca81b8f235ce_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivesubtypes_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_5f9ebf1241c61a39ed1bdebf_lean(lean_object *);
uint32_t recursivesubtypes_groups_graph(const recursivesubtypes_graph_69c0b33a73ddceecbd00_t *a0, recursivesubtypes_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivesubtypes_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_69c0b33a73ddceecbd00_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_1466b762991bfa06e995(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_d384bdba76e0f46ed617(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivesubtypes@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_69c0b33a73ddceecbd00_in(a0);
  lean_object *value = lean_bridge_5f9ebf1241c61a39ed1bdebf_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivesubtypes_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_cc48993941d89731cae43d8e_lean(lean_object *);
uint32_t recursivesubtypes_produce_graph(const recursivesubtypes_scalar_nat_t *a0, recursivesubtypes_chain_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivesubtypes_chain_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_5f971a64123919686824_check(a0, 0, 1, &budget))) return status;
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivesubtypes@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_5f971a64123919686824_in(a0);
  lean_object *value = lean_bridge_cc48993941d89731cae43d8e_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivesubtypes_chain_t result = {0};
  status = ng_6c2f0144ffb165538c8b_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_9e8d2cbaa99dca92eb622921_lean(lean_object *);
uint32_t recursivesubtypes_second_graph(const recursivesubtypes_chain_t *a0, recursivesubtypes_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivesubtypes_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_6c2f0144ffb165538c8b_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_5fdfcb24755519ec7c15(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_546235744133919abad0(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivesubtypes@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_6c2f0144ffb165538c8b_in(a0);
  lean_object *value = lean_bridge_9e8d2cbaa99dca92eb622921_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivesubtypes_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}