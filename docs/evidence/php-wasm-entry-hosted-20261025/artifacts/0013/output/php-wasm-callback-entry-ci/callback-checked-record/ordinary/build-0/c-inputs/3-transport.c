#include <lean/lean.h>
#ifndef LEAN_BRIDGE_697151F2FC3CF6B95FF12B69_STRUCTURED_CALLBACK_CONTROLS_DEFINED
#define LEAN_BRIDGE_697151F2FC3CF6B95FF12B69_STRUCTURED_CALLBACK_CONTROLS_DEFINED
typedef struct lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls {
  lean_object *(*recovery)(void *);
  lean_object *(*reject)(void *, lean_object *);
} lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls;
#endif
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_wrap(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_invoke(size_t, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_recovery(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_reject(size_t, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_wrap(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_invoke(size_t, lean_object *, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_recovery(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_reject(size_t, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_apply(lean_object *, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_wrap(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_invoke(size_t, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_recovery(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_reject(size_t, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_d885a7d82ec894d17b81e7a67a36bc2930adca13_apply(lean_object *, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_wrap(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_invoke(size_t, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_recovery(size_t);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_reject(size_t, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2e292aebff8c53f6a465ec3d5745e74400590434_apply(lean_object *, lean_object *, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_8994592329ecba032f0abfaa9703e59a57f3c6a1_apply(lean_object *, lean_object *);
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_lean(lean_object *);
lean_object *lean_bridge_413afe4aaf66162bb3ba3d3c_lean(lean_object *);
lean_object *lean_bridge_184bfb6b98fb39095f0bfec8_lean(lean_object *);
lean_object *lean_bridge_f168e18f231fdb7eb1733b0e_lean(lean_object *);
lean_object *lean_bridge_97d7a19c3e5ee22681017ca9_lean(lean_object *);
lean_object *lean_bridge_74ed57fc03e7ed555389a3ab_lean(lean_object *);
lean_object *lean_bridge_bbabc0c3fa2252f4f7a67708_lean(lean_object *);
lean_object *lean_bridge_77496697d09177e0d1ebadfd_lean(lean_object *);

#include "callbackcheckedrecords-callable-borrows.h"
#include "callbackcheckedrecords-graph.h"

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
extern lean_object *initialize_LeanBridgeNative82670d9206f05718(uint8_t);
static void *ng_initialize(uint8_t builtin) { return initialize_LeanBridgeNative82670d9206f05718(builtin); }
static int ng_ready(void) { return lean_bridge_native_component_ready("callbackcheckedrecords@1.0.0"); }
static inline uint32_t ng_38a8689c2f20ead532ea_check(const callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *, size_t, int, ng_budget *);
static inline lean_object *ng_38a8689c2f20ead532ea_in(const callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *);
static inline uint32_t ng_38a8689c2f20ead532ea_out(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_branch(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_none(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_make0(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_field0(lean_object *);
static inline uint32_t ng_7ee21eb6b8ea120b53f0_check(const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *, size_t, int, ng_budget *);
static inline lean_object *ng_7ee21eb6b8ea120b53f0_in(const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *);
static inline uint32_t ng_7ee21eb6b8ea120b53f0_out(callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_627c7a16d6bab0b64509_make(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_627c7a16d6bab0b64509_items(lean_object *);
static inline uint32_t ng_29468227bdfd05da1480_check(const callbackcheckedrecords_graph_29468227bdfd05da1480_t *, size_t, int, ng_budget *);
static inline lean_object *ng_29468227bdfd05da1480_in(const callbackcheckedrecords_graph_29468227bdfd05da1480_t *);
static inline uint32_t ng_29468227bdfd05da1480_out(callbackcheckedrecords_graph_29468227bdfd05da1480_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_branch(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_make0(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_field0(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_make1(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_field1(lean_object *);
static inline uint32_t ng_24a62d902437d65e855a_check(const callbackcheckedrecords_interval_t *, size_t, int, ng_budget *);
static inline lean_object *ng_24a62d902437d65e855a_in(const callbackcheckedrecords_interval_t *);
static inline uint32_t ng_24a62d902437d65e855a_out(callbackcheckedrecords_interval_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_f77ed079c22c7f9e48ec_make(lean_object *, lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_f77ed079c22c7f9e48ec_field0(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_f77ed079c22c7f9e48ec_field1(lean_object *);
static inline uint32_t ng_667e2053b2091be13381_check(const callbackcheckedrecords_weighted_t *, size_t, int, ng_budget *);
static inline lean_object *ng_667e2053b2091be13381_in(const callbackcheckedrecords_weighted_t *);
static inline uint32_t ng_667e2053b2091be13381_out(callbackcheckedrecords_weighted_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_250c7a8f81cfc2c8e740_make(lean_object *, lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_250c7a8f81cfc2c8e740_field0(lean_object *);
extern lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_recursive_250c7a8f81cfc2c8e740_field1(lean_object *);
static inline uint32_t ng_5f971a64123919686824_check(const callbackcheckedrecords_scalar_nat_t *, size_t, int, ng_budget *);
static inline lean_object *ng_5f971a64123919686824_in(const callbackcheckedrecords_scalar_nat_t *);
static inline uint32_t ng_5f971a64123919686824_out(callbackcheckedrecords_scalar_nat_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_b9cf7c895f258ccf97e9_check(const callbackcheckedrecords_scalar_string_t *, size_t, int, ng_budget *);
static inline lean_object *ng_b9cf7c895f258ccf97e9_in(const callbackcheckedrecords_scalar_string_t *);
static inline uint32_t ng_b9cf7c895f258ccf97e9_out(callbackcheckedrecords_scalar_string_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_79a0fdaea5f8b1c7df7d_check(const uint8_t *, size_t, int, ng_budget *);
static inline lean_object *ng_79a0fdaea5f8b1c7df7d_in(const uint8_t *);
static inline uint32_t ng_79a0fdaea5f8b1c7df7d_out(uint8_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_38a8689c2f20ead532ea_check(const callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 0, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->has_value > 1) return NG_INVALID;
  if (value->has_value) {
  if ((status = ng_24a62d902437d65e855a_check(&value->value, depth + 1, 0, budget))) return status;
  }
  return NG_OK;
}
static inline lean_object *ng_38a8689c2f20ead532ea_in(const callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *value) {
  (void)value; LB_GRAPH_DECODE();
  if (!value->has_value) return lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_none(lean_box(0));
  if (value->has_value) return lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_make0(ng_24a62d902437d65e855a_in(&value->value));
  return lean_alloc_array(0, 0);
}
static inline uint32_t ng_38a8689c2f20ead532ea_out(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_branch(value);
  if (branch > 1) { lean_dec(value); return NG_RESULT; }
  out->has_value = branch;
  uint32_t status = NG_OK;
  if (out->has_value) {
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_24a62d902437d65e855a_out(&out->value, lean_bridge_697151f2fc3cf6b95ff12b69_recursive_e88ff0d30fe89ddedb96_field0(value), depth + 1, arena);
    }
  }
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_7ee21eb6b8ea120b53f0_check(const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 1, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > budget->nodes) return NG_LIMIT;
  status = ng_span(value->data, value->length, sizeof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t), _Alignof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t), budget);
  if (status) return status;
  for (size_t i = 0; i < value->length; ++i) if ((status = ng_38a8689c2f20ead532ea_check(value->data + i, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_7ee21eb6b8ea120b53f0_in(const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(items, i, ng_38a8689c2f20ead532ea_in(value->data + i));
  return lean_bridge_697151f2fc3cf6b95ff12b69_recursive_627c7a16d6bab0b64509_make(items);
}
static inline uint32_t ng_7ee21eb6b8ea120b53f0_out(callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  value = lean_bridge_697151f2fc3cf6b95ff12b69_recursive_627c7a16d6bab0b64509_items(value);
  if (lean_is_scalar(value) || !lean_is_array(value)) { lean_dec(value); return NG_RESULT; }
  size_t count = lean_array_size(value);
  if (count > arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  void *raw;
  uint32_t status = ng_allocate(arena, count, sizeof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t), &raw);
  out->data = raw; out->length = count; callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = ng_38a8689c2f20ead532ea_out(data + i, child, depth + 1, arena);
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_29468227bdfd05da1480_check(const callbackcheckedrecords_graph_29468227bdfd05da1480_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(callbackcheckedrecords_graph_29468227bdfd05da1480_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 2, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->is_ok > 1) return NG_INVALID;
  if (value->is_ok) {
  if ((status = ng_38a8689c2f20ead532ea_check(&value->ok, depth + 1, 0, budget))) return status;
  }
  if (!value->is_ok) {
  if ((status = ng_b9cf7c895f258ccf97e9_check(&value->error, depth + 1, 0, budget))) return status;
  }
  return NG_OK;
}
static inline lean_object *ng_29468227bdfd05da1480_in(const callbackcheckedrecords_graph_29468227bdfd05da1480_t *value) {
  (void)value; LB_GRAPH_DECODE();
  if (value->is_ok) return lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_make0(ng_38a8689c2f20ead532ea_in(&value->ok));
  if (!value->is_ok) return lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_make1(ng_b9cf7c895f258ccf97e9_in(&value->error));
  return lean_alloc_array(0, 0);
}
static inline uint32_t ng_29468227bdfd05da1480_out(callbackcheckedrecords_graph_29468227bdfd05da1480_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_branch(value);
  if (branch > 1) { lean_dec(value); return NG_RESULT; }
  out->is_ok = branch == 0;
  uint32_t status = NG_OK;
  if (out->is_ok) {
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_38a8689c2f20ead532ea_out(&out->ok, lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_field0(value), depth + 1, arena);
    }
  }
  }
  if (!out->is_ok) {
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_b9cf7c895f258ccf97e9_out(&out->error, lean_bridge_697151f2fc3cf6b95ff12b69_recursive_cb7f8c41a24eac8674b6_field1(value), depth + 1, arena);
    }
  }
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *ng_24a62d902437d65e855a_make(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_dec(items);
  return lean_bridge_697151f2fc3cf6b95ff12b69_recursive_f77ed079c22c7f9e48ec_make(a0, a1);
}
static inline uint32_t ng_24a62d902437d65e855a_check(const callbackcheckedrecords_interval_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(callbackcheckedrecords_interval_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 3, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if ((status = ng_5f971a64123919686824_check(&value->lo, depth + 1, 0, budget))) return status;
  if ((status = ng_5f971a64123919686824_check(&value->hi, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_24a62d902437d65e855a_in(const callbackcheckedrecords_interval_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(2, 2);
  lean_array_set_core(items, 0, ng_5f971a64123919686824_in(&value->lo));
  lean_array_set_core(items, 1, ng_5f971a64123919686824_in(&value->hi));
  return ng_24a62d902437d65e855a_make(items);
}
static inline uint32_t ng_24a62d902437d65e855a_out(callbackcheckedrecords_interval_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  uint32_t status = NG_OK;
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->lo, lean_bridge_697151f2fc3cf6b95ff12b69_recursive_f77ed079c22c7f9e48ec_field0(value), depth + 1, arena);
    }
  }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->hi, lean_bridge_697151f2fc3cf6b95ff12b69_recursive_f77ed079c22c7f9e48ec_field1(value), depth + 1, arena);
    }
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *ng_667e2053b2091be13381_make(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_dec(items);
  return lean_bridge_697151f2fc3cf6b95ff12b69_recursive_250c7a8f81cfc2c8e740_make(a0, a1);
}
static inline uint32_t ng_667e2053b2091be13381_check(const callbackcheckedrecords_weighted_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(callbackcheckedrecords_weighted_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 4, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if ((status = ng_5f971a64123919686824_check(&value->weight, depth + 1, 0, budget))) return status;
  if ((status = ng_5f971a64123919686824_check(&value->limit, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_667e2053b2091be13381_in(const callbackcheckedrecords_weighted_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(2, 2);
  lean_array_set_core(items, 0, ng_5f971a64123919686824_in(&value->weight));
  lean_array_set_core(items, 1, ng_5f971a64123919686824_in(&value->limit));
  return ng_667e2053b2091be13381_make(items);
}
static inline uint32_t ng_667e2053b2091be13381_out(callbackcheckedrecords_weighted_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  uint32_t status = NG_OK;
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->weight, lean_bridge_697151f2fc3cf6b95ff12b69_recursive_250c7a8f81cfc2c8e740_field0(value), depth + 1, arena);
    }
  }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->limit, lean_bridge_697151f2fc3cf6b95ff12b69_recursive_250c7a8f81cfc2c8e740_field1(value), depth + 1, arena);
    }
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_5f971a64123919686824_check(const callbackcheckedrecords_scalar_nat_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(callbackcheckedrecords_scalar_nat_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 5, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  status = ng_span(value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t), budget);
  if (status) return status;
  return NG_OK;
}
static inline lean_object *ng_5f971a64123919686824_in(const callbackcheckedrecords_scalar_nat_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *carrier = lean_alloc_array(1, 1);
  lean_array_set_core(carrier, 0, ng_nat_in(value->data, value->length));
  return carrier;
}
static inline uint32_t ng_5f971a64123919686824_out(callbackcheckedrecords_scalar_nat_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  uint32_t status = NG_OK;
  status = ng_nat_out(child, arena, &out->data, &out->length);
  lean_dec(child); return status;
}
static inline uint32_t ng_b9cf7c895f258ccf97e9_check(const callbackcheckedrecords_scalar_string_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(callbackcheckedrecords_scalar_string_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 6, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  status = ng_span(value->data, value->length, 1, 1, budget);
  if (status) return status;
  if (!ng_utf8((const uint8_t *)value->data, value->length)) return NG_INVALID;
  return NG_OK;
}
static inline lean_object *ng_b9cf7c895f258ccf97e9_in(const callbackcheckedrecords_scalar_string_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *carrier = lean_alloc_array(1, 1);
  lean_array_set_core(carrier, 0, lean_mk_string_from_bytes(value->length ? value->data : "", value->length));
  return carrier;
}
static inline uint32_t ng_b9cf7c895f258ccf97e9_out(callbackcheckedrecords_scalar_string_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  uint32_t status = NG_OK;
  if (lean_is_scalar(child) || !lean_is_string(child)) { lean_dec(child); return NG_RESULT; }
  size_t length = lean_string_size(child) - 1;
  if (!ng_utf8((const uint8_t *)lean_string_cstr(child), length)) { lean_dec(child); return NG_RESULT; }
  void *data;
  status = ng_allocate(arena, length, 1, &data);
  if (!status) {
    if (length) memcpy(data, lean_string_cstr(child), length);
    out->data = data; out->length = length;
  }
  lean_dec(child); return status;
}
static inline uint32_t ng_79a0fdaea5f8b1c7df7d_check(const uint8_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(uint8_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 7, depth, budget);
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
typedef struct { lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls controls; callbackcheckedrecords_callback_2663a58c7c0e71654db1d87936875f8677e197b2 callback; ng_borrow_frame *frame; } ng_borrow_2663a58c7c0e71654db1d87936875f8677e197b2;
static inline lean_object *ng_invoke_2663a58c7c0e71654db1d87936875f8677e197b2(void *context, lean_object *value0) {
  ng_borrow_2663a58c7c0e71654db1d87936875f8677e197b2 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_graph_29468227bdfd05da1480_t reply = {0};
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_38a8689c2f20ead532ea_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_29468227bdfd05da1480_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_29468227bdfd05da1480_in(&reply);
cleanup:
  callbackcheckedrecords_graph_29468227bdfd05da1480_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
static inline lean_object *ng_recovery_2663a58c7c0e71654db1d87936875f8677e197b2(void *context) {
  ng_borrow_2663a58c7c0e71654db1d87936875f8677e197b2 *host = context; ng_borrow_frame *frame = host->frame;
  ng_borrow_observe(frame);
  if (!frame->status && !host->callback.recovery) ng_borrow_fail(frame, NG_INVALID);
  if (!frame->status) ng_borrow_fail(frame, ng_29468227bdfd05da1480_check(host->callback.recovery, 0, 1, &frame->budget));
  return frame->status ? lean_alloc_array(0, 0) : ng_29468227bdfd05da1480_in(host->callback.recovery);
}
static inline lean_object *ng_reject_2663a58c7c0e71654db1d87936875f8677e197b2(void *context, lean_object *recovery) {
  ng_borrow_2663a58c7c0e71654db1d87936875f8677e197b2 *host = context;
  ng_borrow_fail(host->frame, NG_CALLBACK_RESULT);
  return recovery;
}
typedef struct { lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls controls; callbackcheckedrecords_callback_526ba4a0f03797057c1f9a17ca435a5a42131510 callback; ng_borrow_frame *frame; } ng_borrow_526ba4a0f03797057c1f9a17ca435a5a42131510;
static inline lean_object *ng_invoke_526ba4a0f03797057c1f9a17ca435a5a42131510(void *context, lean_object *value0, lean_object *value1) {
  ng_borrow_526ba4a0f03797057c1f9a17ca435a5a42131510 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_interval_t reply = {0};
  callbackcheckedrecords_scalar_nat_t arg0 = {0};
  callbackcheckedrecords_interval_t arg1 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg1)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_out(&arg1, value1, 0, &arena));
  value1 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &arg1, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_24a62d902437d65e855a_in(&reply);
cleanup:
  callbackcheckedrecords_interval_t_clear(&reply);
  if (value0) lean_dec(value0);
  if (value1) lean_dec(value1);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
static inline lean_object *ng_recovery_526ba4a0f03797057c1f9a17ca435a5a42131510(void *context) {
  ng_borrow_526ba4a0f03797057c1f9a17ca435a5a42131510 *host = context; ng_borrow_frame *frame = host->frame;
  ng_borrow_observe(frame);
  if (!frame->status && !host->callback.recovery) ng_borrow_fail(frame, NG_INVALID);
  if (!frame->status) ng_borrow_fail(frame, ng_24a62d902437d65e855a_check(host->callback.recovery, 0, 1, &frame->budget));
  return frame->status ? lean_alloc_array(0, 0) : ng_24a62d902437d65e855a_in(host->callback.recovery);
}
static inline lean_object *ng_reject_526ba4a0f03797057c1f9a17ca435a5a42131510(void *context, lean_object *recovery) {
  ng_borrow_526ba4a0f03797057c1f9a17ca435a5a42131510 *host = context;
  ng_borrow_fail(host->frame, NG_CALLBACK_RESULT);
  return recovery;
}
typedef struct { callbackcheckedrecords_callback_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa callback; ng_borrow_frame *frame; } ng_borrow_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa;
static inline lean_object *ng_invoke_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa(void *context, lean_object *value0) {
  ng_borrow_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_scalar_nat_t reply = {0};
  callbackcheckedrecords_interval_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  callbackcheckedrecords_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls controls; callbackcheckedrecords_callback_00652748bed3eb7036c9091f570efa39888f5490 callback; ng_borrow_frame *frame; } ng_borrow_00652748bed3eb7036c9091f570efa39888f5490;
static inline lean_object *ng_invoke_00652748bed3eb7036c9091f570efa39888f5490(void *context, lean_object *value0) {
  ng_borrow_00652748bed3eb7036c9091f570efa39888f5490 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_interval_t reply = {0};
  callbackcheckedrecords_interval_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_24a62d902437d65e855a_in(&reply);
cleanup:
  callbackcheckedrecords_interval_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
static inline lean_object *ng_recovery_00652748bed3eb7036c9091f570efa39888f5490(void *context) {
  ng_borrow_00652748bed3eb7036c9091f570efa39888f5490 *host = context; ng_borrow_frame *frame = host->frame;
  ng_borrow_observe(frame);
  if (!frame->status && !host->callback.recovery) ng_borrow_fail(frame, NG_INVALID);
  if (!frame->status) ng_borrow_fail(frame, ng_24a62d902437d65e855a_check(host->callback.recovery, 0, 1, &frame->budget));
  return frame->status ? lean_alloc_array(0, 0) : ng_24a62d902437d65e855a_in(host->callback.recovery);
}
static inline lean_object *ng_reject_00652748bed3eb7036c9091f570efa39888f5490(void *context, lean_object *recovery) {
  ng_borrow_00652748bed3eb7036c9091f570efa39888f5490 *host = context;
  ng_borrow_fail(host->frame, NG_CALLBACK_RESULT);
  return recovery;
}
typedef struct { callbackcheckedrecords_callback_d885a7d82ec894d17b81e7a67a36bc2930adca13 callback; ng_borrow_frame *frame; } ng_borrow_d885a7d82ec894d17b81e7a67a36bc2930adca13;
static inline lean_object *ng_invoke_d885a7d82ec894d17b81e7a67a36bc2930adca13(void *context, lean_object *value0) {
  ng_borrow_d885a7d82ec894d17b81e7a67a36bc2930adca13 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_scalar_nat_t reply = {0};
  callbackcheckedrecords_weighted_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_667e2053b2091be13381_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_5f971a64123919686824_in(&reply);
cleanup:
  callbackcheckedrecords_scalar_nat_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls controls; callbackcheckedrecords_callback_cd01d463066ae86d043223e65eab1640e16b22ab callback; ng_borrow_frame *frame; } ng_borrow_cd01d463066ae86d043223e65eab1640e16b22ab;
static inline lean_object *ng_invoke_cd01d463066ae86d043223e65eab1640e16b22ab(void *context, lean_object *value0) {
  ng_borrow_cd01d463066ae86d043223e65eab1640e16b22ab *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_weighted_t reply = {0};
  callbackcheckedrecords_weighted_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_667e2053b2091be13381_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_667e2053b2091be13381_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_667e2053b2091be13381_in(&reply);
cleanup:
  callbackcheckedrecords_weighted_t_clear(&reply);
  if (value0) lean_dec(value0);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
static inline lean_object *ng_recovery_cd01d463066ae86d043223e65eab1640e16b22ab(void *context) {
  ng_borrow_cd01d463066ae86d043223e65eab1640e16b22ab *host = context; ng_borrow_frame *frame = host->frame;
  ng_borrow_observe(frame);
  if (!frame->status && !host->callback.recovery) ng_borrow_fail(frame, NG_INVALID);
  if (!frame->status) ng_borrow_fail(frame, ng_667e2053b2091be13381_check(host->callback.recovery, 0, 1, &frame->budget));
  return frame->status ? lean_alloc_array(0, 0) : ng_667e2053b2091be13381_in(host->callback.recovery);
}
static inline lean_object *ng_reject_cd01d463066ae86d043223e65eab1640e16b22ab(void *context, lean_object *recovery) {
  ng_borrow_cd01d463066ae86d043223e65eab1640e16b22ab *host = context;
  ng_borrow_fail(host->frame, NG_CALLBACK_RESULT);
  return recovery;
}
typedef struct { callbackcheckedrecords_callback_2e292aebff8c53f6a465ec3d5745e74400590434 callback; ng_borrow_frame *frame; } ng_borrow_2e292aebff8c53f6a465ec3d5745e74400590434;
static inline lean_object *ng_invoke_2e292aebff8c53f6a465ec3d5745e74400590434(void *context, lean_object *value0, lean_object *value1) {
  ng_borrow_2e292aebff8c53f6a465ec3d5745e74400590434 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_interval_t reply = {0};
  callbackcheckedrecords_scalar_nat_t arg0 = {0};
  callbackcheckedrecords_interval_t arg1 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg1)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_out(&arg1, value1, 0, &arena));
  value1 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &arg1, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_24a62d902437d65e855a_in(&reply);
cleanup:
  callbackcheckedrecords_interval_t_clear(&reply);
  if (value0) lean_dec(value0);
  if (value1) lean_dec(value1);
  ng_release(arena.head);
  ng_borrow_observe(frame);
  if (frame->status && returned) { lean_dec(returned); returned = NULL; }
  return returned ? returned : lean_alloc_array(0, 0);
}
typedef struct { callbackcheckedrecords_callback_8994592329ecba032f0abfaa9703e59a57f3c6a1 callback; ng_borrow_frame *frame; } ng_borrow_8994592329ecba032f0abfaa9703e59a57f3c6a1;
static inline lean_object *ng_invoke_8994592329ecba032f0abfaa9703e59a57f3c6a1(void *context, lean_object *value0) {
  ng_borrow_8994592329ecba032f0abfaa9703e59a57f3c6a1 *host = context; ng_borrow_frame *frame = host->frame;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  lean_object *returned = NULL;
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t reply = {0};
  callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t arg0 = {0};
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg0)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_7ee21eb6b8ea120b53f0_out(&arg0, value0, 0, &arena));
  value0 = NULL;
  if (frame->status) goto cleanup;
  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  ng_borrow_fail(frame, host->callback.call(host->callback.context, &arg0, &reply));
  ng_borrow_observe(frame);
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_38a8689c2f20ead532ea_check(&reply, 0, 1, &frame->budget));
  if (!frame->status) returned = ng_38a8689c2f20ead532ea_in(&reply);
cleanup:
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t_clear(&reply);
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
const char *callbackcheckedrecords_callable_graph_error(void) {
  const char *result = ng_refinement_length ? ng_refinement_message : NULL;
  ng_refinement_length = 0;
  return result;
}

extern uint8_t lean_bridge_697151f2fc3cf6b95ff12b69_structured_2e292aebff8c53f6a465ec3d5745e74400590434_closure_graph_refinement_1_c356a7238da028f9ec99(lean_object *);
extern uint8_t lean_bridge_697151f2fc3cf6b95ff12b69_structured_8994592329ecba032f0abfaa9703e59a57f3c6a1_closure_graph_refinement_0_c356a7238da028f9ec99(lean_object *);
extern uint8_t lean_bridge_697151f2fc3cf6b95ff12b69_structured_d885a7d82ec894d17b81e7a67a36bc2930adca13_closure_graph_refinement_0_93110217dc013facd35d(lean_object *);
extern uint8_t lean_bridge_697151f2fc3cf6b95ff12b69_structured_d885a7d82ec894d17b81e7a67a36bc2930adca13_closure_graph_refinement_0_b50ad1ac24da4bc3a6eb(lean_object *);
extern uint8_t lean_bridge_697151f2fc3cf6b95ff12b69_structured_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_closure_graph_refinement_0_c356a7238da028f9ec99(lean_object *);
static uint32_t ng_refinement_3303857a6fac846ca5a8(const callbackcheckedrecords_interval_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3f800a9c0732aae1ed43(const callbackcheckedrecords_weighted_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_5b6130a515bd9e03ec4d(const callbackcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_675a4728a90251c33825(const callbackcheckedrecords_interval_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_71ac891d91fb9d96e68e(const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_28c813d699bd1c795144(const callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_b522258272fe83a91092(const callbackcheckedrecords_interval_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3303857a6fac846ca5a8(const callbackcheckedrecords_interval_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_697151f2fc3cf6b95ff12b69_structured_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_closure_graph_refinement_0_c356a7238da028f9ec99(ng_24a62d902437d65e855a_in(value)))
    return ng_refinement_reject(" was rejected by CallbackCheckedRecords.mkInterval");
  return NG_OK;
}
static uint32_t ng_refinement_3f800a9c0732aae1ed43(const callbackcheckedrecords_weighted_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark0 = ng_refinement_mark();
  if (!ng_refinement_text(".weight", sizeof(".weight") - 1)) return NG_LIMIT;
  uint32_t status0 = ng_refinement_5b6130a515bd9e03ec4d(&value->weight, depth + 1, nodes);
  if (status0) return status0;
  ng_refinement_restore(mark0);
  if (!lean_bridge_697151f2fc3cf6b95ff12b69_structured_d885a7d82ec894d17b81e7a67a36bc2930adca13_closure_graph_refinement_0_93110217dc013facd35d(ng_667e2053b2091be13381_in(value)))
    return ng_refinement_reject(" was rejected by CallbackCheckedRecords.mkWeighted");
  return NG_OK;
}
static uint32_t ng_refinement_5b6130a515bd9e03ec4d(const callbackcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_697151f2fc3cf6b95ff12b69_structured_d885a7d82ec894d17b81e7a67a36bc2930adca13_closure_graph_refinement_0_b50ad1ac24da4bc3a6eb(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by CallbackCheckedRecords.checkedPositive");
  return NG_OK;
}
static uint32_t ng_refinement_675a4728a90251c33825(const callbackcheckedrecords_interval_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_697151f2fc3cf6b95ff12b69_structured_2e292aebff8c53f6a465ec3d5745e74400590434_closure_graph_refinement_1_c356a7238da028f9ec99(ng_24a62d902437d65e855a_in(value)))
    return ng_refinement_reject(" was rejected by CallbackCheckedRecords.mkInterval");
  return NG_OK;
}
static uint32_t ng_refinement_71ac891d91fb9d96e68e(const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i2 = 0; i2 < value->length; ++i2) {
    size_t mark3 = ng_refinement_mark();
    if (!ng_refinement_index(i2)) return NG_LIMIT;
    uint32_t status3 = ng_refinement_28c813d699bd1c795144(value->data + i2, depth + 1, nodes);
    if (status3) return status3;
    ng_refinement_restore(mark3);
  }
  return NG_OK;
}
static uint32_t ng_refinement_28c813d699bd1c795144(const callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark1 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status1 = ng_refinement_b522258272fe83a91092(&value->value, depth + 1, nodes);
    if (status1) return status1;
    ng_refinement_restore(mark1);
  }
  return NG_OK;
}
static uint32_t ng_refinement_b522258272fe83a91092(const callbackcheckedrecords_interval_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_697151f2fc3cf6b95ff12b69_structured_8994592329ecba032f0abfaa9703e59a57f3c6a1_closure_graph_refinement_0_c356a7238da028f9ec99(ng_24a62d902437d65e855a_in(value)))
    return ng_refinement_reject(" was rejected by CallbackCheckedRecords.mkInterval");
  return NG_OK;
}
static uint32_t ng_closure_refusal_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa(const callbackcheckedrecords_interval_t *a0) {
  uint32_t status;
  ng_refinement_reset();
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_3303857a6fac846ca5a8(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  return NG_OK;
}
static uint32_t ng_closure_refusal_d885a7d82ec894d17b81e7a67a36bc2930adca13(const callbackcheckedrecords_weighted_t *a0) {
  uint32_t status;
  ng_refinement_reset();
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_3f800a9c0732aae1ed43(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  return NG_OK;
}
static uint32_t ng_closure_refusal_2e292aebff8c53f6a465ec3d5745e74400590434(const callbackcheckedrecords_scalar_nat_t *a0, const callbackcheckedrecords_interval_t *a1) {
  (void)a0;
  uint32_t status;
  ng_refinement_reset();
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg1", sizeof("arg1") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_675a4728a90251c33825(a1, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  return NG_OK;
}
static uint32_t ng_closure_refusal_8994592329ecba032f0abfaa9703e59a57f3c6a1(const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *a0) {
  uint32_t status;
  ng_refinement_reset();
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_71ac891d91fb9d96e68e(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  return NG_OK;
}
uint32_t lean_bridge_697151f2fc3cf6b95ff12b69_graph(const callbackcheckedrecords_callback_00652748bed3eb7036c9091f570efa39888f5490 *a0, callbackcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_scalar_nat_t result = {0};
  lean_object *value = NULL;
  ng_borrow_00652748bed3eb7036c9091f570efa39888f5490 host0 = {0};
  uint64_t token0 = 0;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  if (!ng_pointer(a0, sizeof(*a0), _Alignof(callbackcheckedrecords_callback_00652748bed3eb7036c9091f570efa39888f5490)) || !a0->call || !a0->recovery) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  host0 = (ng_borrow_00652748bed3eb7036c9091f570efa39888f5490){{ng_recovery_00652748bed3eb7036c9091f570efa39888f5490, ng_reject_00652748bed3eb7036c9091f570efa39888f5490}, *a0, frame};
  token0 = lb_native_callback_register((void (*)(void))ng_invoke_00652748bed3eb7036c9091f570efa39888f5490, &host0);
  if (!token0) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  call->tokens[call->count++] = token0;
  value = lean_bridge_697151f2fc3cf6b95ff12b69_lean(lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_wrap((size_t)token0));
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
uint32_t lean_bridge_413afe4aaf66162bb3ba3d3c_graph(const callbackcheckedrecords_callback_2663a58c7c0e71654db1d87936875f8677e197b2 *a0, callbackcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_scalar_nat_t result = {0};
  lean_object *value = NULL;
  ng_borrow_2663a58c7c0e71654db1d87936875f8677e197b2 host0 = {0};
  uint64_t token0 = 0;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  if (!ng_pointer(a0, sizeof(*a0), _Alignof(callbackcheckedrecords_callback_2663a58c7c0e71654db1d87936875f8677e197b2)) || !a0->call || !a0->recovery) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  host0 = (ng_borrow_2663a58c7c0e71654db1d87936875f8677e197b2){{ng_recovery_2663a58c7c0e71654db1d87936875f8677e197b2, ng_reject_2663a58c7c0e71654db1d87936875f8677e197b2}, *a0, frame};
  token0 = lb_native_callback_register((void (*)(void))ng_invoke_2663a58c7c0e71654db1d87936875f8677e197b2, &host0);
  if (!token0) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  call->tokens[call->count++] = token0;
  value = lean_bridge_413afe4aaf66162bb3ba3d3c_lean(lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_wrap((size_t)token0));
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
uint32_t lean_bridge_184bfb6b98fb39095f0bfec8_graph(const callbackcheckedrecords_callback_526ba4a0f03797057c1f9a17ca435a5a42131510 *a0, callbackcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_scalar_nat_t result = {0};
  lean_object *value = NULL;
  ng_borrow_526ba4a0f03797057c1f9a17ca435a5a42131510 host0 = {0};
  uint64_t token0 = 0;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  if (!ng_pointer(a0, sizeof(*a0), _Alignof(callbackcheckedrecords_callback_526ba4a0f03797057c1f9a17ca435a5a42131510)) || !a0->call || !a0->recovery) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  host0 = (ng_borrow_526ba4a0f03797057c1f9a17ca435a5a42131510){{ng_recovery_526ba4a0f03797057c1f9a17ca435a5a42131510, ng_reject_526ba4a0f03797057c1f9a17ca435a5a42131510}, *a0, frame};
  token0 = lb_native_callback_register((void (*)(void))ng_invoke_526ba4a0f03797057c1f9a17ca435a5a42131510, &host0);
  if (!token0) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  call->tokens[call->count++] = token0;
  value = lean_bridge_184bfb6b98fb39095f0bfec8_lean(lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_wrap((size_t)token0));
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
uint32_t lean_bridge_f168e18f231fdb7eb1733b0e_graph(const callbackcheckedrecords_callback_cd01d463066ae86d043223e65eab1640e16b22ab *a0, callbackcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_scalar_nat_t result = {0};
  lean_object *value = NULL;
  ng_borrow_cd01d463066ae86d043223e65eab1640e16b22ab host0 = {0};
  uint64_t token0 = 0;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  if (!ng_pointer(a0, sizeof(*a0), _Alignof(callbackcheckedrecords_callback_cd01d463066ae86d043223e65eab1640e16b22ab)) || !a0->call || !a0->recovery) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  host0 = (ng_borrow_cd01d463066ae86d043223e65eab1640e16b22ab){{ng_recovery_cd01d463066ae86d043223e65eab1640e16b22ab, ng_reject_cd01d463066ae86d043223e65eab1640e16b22ab}, *a0, frame};
  token0 = lb_native_callback_register((void (*)(void))ng_invoke_cd01d463066ae86d043223e65eab1640e16b22ab, &host0);
  if (!token0) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  call->tokens[call->count++] = token0;
  value = lean_bridge_f168e18f231fdb7eb1733b0e_lean(lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_wrap((size_t)token0));
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
uint32_t lean_bridge_97d7a19c3e5ee22681017ca9_graph(const callbackcheckedrecords_scalar_nat_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_97d7a19c3e5ee22681017ca9_lean(ng_5f971a64123919686824_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "callbackcheckedrecords@1.0.0:graph-callback:e014092ff0a1ee8527eeeb58a78e2de63bdf09fa");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "callbackcheckedrecords@1.0.0:graph-callback:e014092ff0a1ee8527eeeb58a78e2de63bdf09fa");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_74ed57fc03e7ed555389a3ab_graph(const callbackcheckedrecords_scalar_nat_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_74ed57fc03e7ed555389a3ab_lean(ng_5f971a64123919686824_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "callbackcheckedrecords@1.0.0:graph-callback:8994592329ecba032f0abfaa9703e59a57f3c6a1");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "callbackcheckedrecords@1.0.0:graph-callback:8994592329ecba032f0abfaa9703e59a57f3c6a1");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_bbabc0c3fa2252f4f7a67708_graph(const callbackcheckedrecords_scalar_nat_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_bbabc0c3fa2252f4f7a67708_lean(ng_5f971a64123919686824_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "callbackcheckedrecords@1.0.0:graph-callback:2e292aebff8c53f6a465ec3d5745e74400590434");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "callbackcheckedrecords@1.0.0:graph-callback:2e292aebff8c53f6a465ec3d5745e74400590434");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t lean_bridge_77496697d09177e0d1ebadfd_graph(const callbackcheckedrecords_scalar_nat_t *a0, uint64_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(uint64_t))) return NG_INVALID;
  if (*out) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  uint64_t result = {0};
  lean_object *value = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  value = lean_bridge_77496697d09177e0d1ebadfd_lean(ng_5f971a64123919686824_in(a0));
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }
  result = ng_closure_store(value, "callbackcheckedrecords@1.0.0:graph-callback:d885a7d82ec894d17b81e7a67a36bc2930adca13");
  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }
  value = NULL;
cleanup:
  if (value) lean_dec(value);
  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();
  uint32_t status = ng_call_leave(call);
  ng_refinement_reset();
  if (status) {
    if (result) ng_closure_drop(result, "callbackcheckedrecords@1.0.0:graph-callback:d885a7d82ec894d17b81e7a67a36bc2930adca13");
    ng_release(arena.head); return status;
  }
  ng_release(arena.head);
  *out = result; return NG_OK;
}
uint32_t callbackcheckedrecords_callback_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_lease_call(uint64_t self, const callbackcheckedrecords_interval_t *a0, callbackcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  int refused = 0;
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_scalar_nat_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "callbackcheckedrecords@1.0.0:graph-callback:e014092ff0a1ee8527eeeb58a78e2de63bdf09fa");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_697151f2fc3cf6b95ff12b69_structured_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_apply(closure, ng_24a62d902437d65e855a_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    refused = ng_closure_refusal_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa(a0) == NG_INVALID;
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
void callbackcheckedrecords_callback_e014092ff0a1ee8527eeeb58a78e2de63bdf09fa_lease_dispose(uint64_t token) { ng_closure_drop(token, "callbackcheckedrecords@1.0.0:graph-callback:e014092ff0a1ee8527eeeb58a78e2de63bdf09fa"); }
uint32_t callbackcheckedrecords_callback_d885a7d82ec894d17b81e7a67a36bc2930adca13_lease_call(uint64_t self, const callbackcheckedrecords_weighted_t *a0, callbackcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  int refused = 0;
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_scalar_nat_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_667e2053b2091be13381_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "callbackcheckedrecords@1.0.0:graph-callback:d885a7d82ec894d17b81e7a67a36bc2930adca13");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_697151f2fc3cf6b95ff12b69_structured_d885a7d82ec894d17b81e7a67a36bc2930adca13_apply(closure, ng_667e2053b2091be13381_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    refused = ng_closure_refusal_d885a7d82ec894d17b81e7a67a36bc2930adca13(a0) == NG_INVALID;
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
void callbackcheckedrecords_callback_d885a7d82ec894d17b81e7a67a36bc2930adca13_lease_dispose(uint64_t token) { ng_closure_drop(token, "callbackcheckedrecords@1.0.0:graph-callback:d885a7d82ec894d17b81e7a67a36bc2930adca13"); }
uint32_t callbackcheckedrecords_callback_2e292aebff8c53f6a465ec3d5745e74400590434_lease_call(uint64_t self, const callbackcheckedrecords_scalar_nat_t *a0, const callbackcheckedrecords_interval_t *a1, callbackcheckedrecords_interval_t *out) {
  ng_refinement_reset();
  int refused = 0;
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_interval_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_interval_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_5f971a64123919686824_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_check(a1, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "callbackcheckedrecords@1.0.0:graph-callback:2e292aebff8c53f6a465ec3d5745e74400590434");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_697151f2fc3cf6b95ff12b69_structured_2e292aebff8c53f6a465ec3d5745e74400590434_apply(closure, ng_5f971a64123919686824_in(a0), ng_24a62d902437d65e855a_in(a1));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    refused = ng_closure_refusal_2e292aebff8c53f6a465ec3d5745e74400590434(a0, a1) == NG_INVALID;
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_24a62d902437d65e855a_out(&result, value, 0, &arena));
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
void callbackcheckedrecords_callback_2e292aebff8c53f6a465ec3d5745e74400590434_lease_dispose(uint64_t token) { ng_closure_drop(token, "callbackcheckedrecords@1.0.0:graph-callback:2e292aebff8c53f6a465ec3d5745e74400590434"); }
uint32_t callbackcheckedrecords_callback_8994592329ecba032f0abfaa9703e59a57f3c6a1_lease_call(uint64_t self, const callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t *a0, callbackcheckedrecords_graph_38a8689c2f20ead532ea_t *out) {
  ng_refinement_reset();
  int refused = 0;
  if (!ng_pointer(out, sizeof(*out), _Alignof(callbackcheckedrecords_graph_38a8689c2f20ead532ea_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  if (!lean_bridge_native_component_initialize("callbackcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;
  ng_borrow_frame *frame = &call->borrowed;
  ng_arena arena = { .head = NULL, .budget = &frame->budget };
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t result = {0};
  lean_object *value = NULL;
  lean_object *closure = NULL;
  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));
  if (frame->status) goto cleanup;
  ng_borrow_fail(frame, ng_7ee21eb6b8ea120b53f0_check(a0, 0, 1, &frame->budget));
  if (frame->status) goto cleanup;
  closure = ng_closure_borrow(self, "callbackcheckedrecords@1.0.0:graph-callback:8994592329ecba032f0abfaa9703e59a57f3c6a1");
  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }
  value = lean_bridge_697151f2fc3cf6b95ff12b69_structured_8994592329ecba032f0abfaa9703e59a57f3c6a1_apply(closure, ng_7ee21eb6b8ea120b53f0_in(a0));
  closure = NULL; /* The typed Lean apply consumed this call's reference. */
  ng_call_observe(frame);
  if (frame->status) goto cleanup;
  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {
    refused = ng_closure_refusal_8994592329ecba032f0abfaa9703e59a57f3c6a1(a0) == NG_INVALID;
    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;
  }
  ng_borrow_fail(frame, ng_38a8689c2f20ead532ea_out(&result, value, 0, &arena));
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
void callbackcheckedrecords_callback_8994592329ecba032f0abfaa9703e59a57f3c6a1_lease_dispose(uint64_t token) { ng_closure_drop(token, "callbackcheckedrecords@1.0.0:graph-callback:8994592329ecba032f0abfaa9703e59a57f3c6a1"); }
