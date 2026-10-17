#include "component.h"
#include "recursivecheckedrecords-graph.h"

#include <lean/lean.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>
_Static_assert(sizeof(size_t) == 8 && sizeof(void *) == 8, "native graph transport requires 64-bit Lean");
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
const char *recursivecheckedrecords_graph_error(void) {
  const char *result = ng_refinement_length ? ng_refinement_message : NULL;
  ng_refinement_length = 0;
  return result;
}

extern uint8_t lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_71ba01578b385b329e98(lean_object *);
extern uint8_t lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object *);
extern uint8_t lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_71ba01578b385b329e98(lean_object *);
extern uint8_t lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object *);
extern uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_71ba01578b385b329e98(lean_object *);
extern uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object *);
extern uint8_t lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_262d1fa6be548d6d1dd0(lean_object *);
extern uint8_t lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_88f1c5c2e3a6ba3c4460(lean_object *);
extern uint8_t lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_262d1fa6be548d6d1dd0(lean_object *);
extern uint8_t lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_88f1c5c2e3a6ba3c4460(lean_object *);
static const uint32_t ng_fin_4e07408562bedb8b60ce[1] = {0x3u};
static uint32_t ng_refinement_934c7c427f00271b904f(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_a46c1ddfa1e6bfcc71c5(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_7a693145c989fb494463(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_cf87b4a49a09d8be6797(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_9d6994ce070de4a60e0a(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_39e0e5421beffcb8cd07(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_50b2a165e1ce596defc6(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_215840a64c733ad0b72b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_a0802564ce640941d23c(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_ebf4666d4647d93ffae7(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_377fe831a1410835959b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_102f2e72f4c66707bfa7(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_824aa5c289713a787b1b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_aab2d2c761959867a441(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_8b5ddfa97b91b6301c00(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_c7ab0dcde5d58e59d488(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_68468944d9cff87af4c8(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_4bcec70d8baba7c6d0b2(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_f02d247f1fef15201666(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_c574613170d9d11a69d6(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_5579cb76d74dc958dc92(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_6e92f7ed8b90850b6cf4(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_2bcd73ec4fb3468c00d5(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_47307a75f3b1c8942c27(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_bc531f1056dd65639cbe(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_8bfd282d5a5297629744(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3b7bb56c4968c4440a1d(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_1b7287d9c051a8a31f42(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_d6c84e261ebe0fc027bf(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_d2ead72ad1b5d8405fb7(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_a33124d0497c85199d6a(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_a4bb79fa94f62793eddf(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_299bd3b3948e28b6d6fc(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_fa856affcc607eb064ff(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_f9ba3ea2f80f8264213b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_59ef9fe05163b6b6bc43(const recursivecheckedrecords_packet_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_815b2ac78d0a20d093d3(const recursivecheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_bd8437588677ebda1134(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, uint32_t, uint32_t *);
#include "lean_bridge_native_runtime.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "native graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNativea1d30b9a0f384ed5(uint8_t);
static void *ng_initialize(uint8_t builtin) { return initialize_LeanBridgeNativea1d30b9a0f384ed5(builtin); }
static int ng_ready(void) { return lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0"); }
static inline uint32_t ng_bf065e9a21862d87767f_check(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, size_t, int, ng_budget *);
static inline lean_object *ng_bf065e9a21862d87767f_in(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *);
static inline uint32_t ng_bf065e9a21862d87767f_out(recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_make(lean_object *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_items(lean_object *);
static inline uint32_t ng_2c3080f9e24fa7c11cff_check(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, size_t, int, ng_budget *);
static inline lean_object *ng_2c3080f9e24fa7c11cff_in(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *);
static inline uint32_t ng_2c3080f9e24fa7c11cff_out(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_branch(lean_object *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_none(lean_object *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_make0(lean_object *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_field0(lean_object *);
static inline uint32_t ng_570f6a0949de55fd682b_check(const recursivecheckedrecords_packet_t *, size_t, int, ng_budget *);
static inline lean_object *ng_570f6a0949de55fd682b_in(const recursivecheckedrecords_packet_t *);
static inline uint32_t ng_570f6a0949de55fd682b_out(recursivecheckedrecords_packet_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_make(lean_object *, lean_object *, lean_object *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field0(lean_object *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field1(lean_object *);
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field2(lean_object *);
static inline uint32_t ng_5f971a64123919686824_check(const recursivecheckedrecords_scalar_nat_t *, size_t, int, ng_budget *);
static inline lean_object *ng_5f971a64123919686824_in(const recursivecheckedrecords_scalar_nat_t *);
static inline uint32_t ng_5f971a64123919686824_out(recursivecheckedrecords_scalar_nat_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_bf065e9a21862d87767f_check(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivecheckedrecords_graph_bf065e9a21862d87767f_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 0, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > budget->nodes) return NG_LIMIT;
  status = ng_span(value->data, value->length, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t), _Alignof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t), budget);
  if (status) return status;
  for (size_t i = 0; i < value->length; ++i) if ((status = ng_2c3080f9e24fa7c11cff_check(value->data + i, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_bf065e9a21862d87767f_in(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(items, i, ng_2c3080f9e24fa7c11cff_in(value->data + i));
  return lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_make(items);
}
static inline uint32_t ng_bf065e9a21862d87767f_out(recursivecheckedrecords_graph_bf065e9a21862d87767f_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  value = lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_items(value);
  if (lean_is_scalar(value) || !lean_is_array(value)) { lean_dec(value); return NG_RESULT; }
  size_t count = lean_array_size(value);
  if (count > arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  void *raw;
  uint32_t status = ng_allocate(arena, count, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t), &raw);
  out->data = raw; out->length = count; recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = ng_2c3080f9e24fa7c11cff_out(data + i, child, depth + 1, arena);
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_2c3080f9e24fa7c11cff_check(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 1, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->has_value > 1) return NG_INVALID;
  if (value->has_value) {
  if ((status = ng_570f6a0949de55fd682b_check(value->value, depth + 1, 1, budget))) return status;
  }
  return NG_OK;
}
static inline lean_object *ng_2c3080f9e24fa7c11cff_in(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value) {
  (void)value; LB_GRAPH_DECODE();
  if (!value->has_value) return lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_none(lean_box(0));
  if (value->has_value) return lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_make0(ng_570f6a0949de55fd682b_in(value->value));
  return lean_alloc_array(0, 0);
}
static inline uint32_t ng_2c3080f9e24fa7c11cff_out(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_branch(value);
  if (branch > 1) { lean_dec(value); return NG_RESULT; }
  out->has_value = branch;
  uint32_t status = NG_OK;
  if (out->has_value) {
  if (!status) {
    void *raw;
    status = ng_allocate(arena, 1, sizeof(recursivecheckedrecords_packet_t), &raw);
    out->value = raw;
    if (!status) {
      lean_inc(value);
      status = ng_570f6a0949de55fd682b_out(raw, lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_field0(value), depth + 1, arena);
    }
  }
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *ng_570f6a0949de55fd682b_make(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_object *a2 = lean_array_get_core(items, 2); lean_inc(a2);
  lean_dec(items);
  return lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_make(a0, a1, a2);
}
static inline uint32_t ng_570f6a0949de55fd682b_check(const recursivecheckedrecords_packet_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivecheckedrecords_packet_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 2, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if ((status = ng_5f971a64123919686824_check(&value->value, depth + 1, 0, budget))) return status;
  if ((status = ng_5f971a64123919686824_check(&value->digit, depth + 1, 0, budget))) return status;
  if ((status = ng_2c3080f9e24fa7c11cff_check(value->tail, depth + 1, 1, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_570f6a0949de55fd682b_in(const recursivecheckedrecords_packet_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(3, 3);
  lean_array_set_core(items, 0, ng_5f971a64123919686824_in(&value->value));
  lean_array_set_core(items, 1, ng_5f971a64123919686824_in(&value->digit));
  lean_array_set_core(items, 2, ng_2c3080f9e24fa7c11cff_in(value->tail));
  return ng_570f6a0949de55fd682b_make(items);
}
static inline uint32_t ng_570f6a0949de55fd682b_out(recursivecheckedrecords_packet_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  uint32_t status = NG_OK;
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->value, lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field0(value), depth + 1, arena);
    }
  }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->digit, lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field1(value), depth + 1, arena);
    }
  }
  if (!status) {
    void *raw;
    status = ng_allocate(arena, 1, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t), &raw);
    out->tail = raw;
    if (!status) {
      lean_inc(value);
      status = ng_2c3080f9e24fa7c11cff_out(raw, lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field2(value), depth + 1, arena);
    }
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_5f971a64123919686824_check(const recursivecheckedrecords_scalar_nat_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(recursivecheckedrecords_scalar_nat_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 3, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  status = ng_span(value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t), budget);
  if (status) return status;
  return NG_OK;
}
static inline lean_object *ng_5f971a64123919686824_in(const recursivecheckedrecords_scalar_nat_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *carrier = lean_alloc_array(1, 1);
  lean_array_set_core(carrier, 0, ng_nat_in(value->data, value->length));
  return carrier;
}
static inline uint32_t ng_5f971a64123919686824_out(recursivecheckedrecords_scalar_nat_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  uint32_t status = NG_OK;
  status = ng_nat_out(child, arena, &out->data, &out->length);
  lean_dec(child); return status;
}
static uint32_t ng_refinement_934c7c427f00271b904f(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark0 = ng_refinement_mark();
  if (!ng_refinement_text(".digit", sizeof(".digit") - 1)) return NG_LIMIT;
  uint32_t status0 = ng_refinement_a46c1ddfa1e6bfcc71c5(&value->digit, depth + 1, nodes);
  if (status0) return status0;
  ng_refinement_restore(mark0);
  size_t mark2 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status2 = ng_refinement_7a693145c989fb494463(value->tail, depth + 1, nodes);
  if (status2) return status2;
  ng_refinement_restore(mark2);
  return NG_OK;
}
static uint32_t ng_refinement_a46c1ddfa1e6bfcc71c5(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_7a693145c989fb494463(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark1 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status1 = ng_refinement_934c7c427f00271b904f(value->value, depth + 1, nodes);
    if (status1) return status1;
    ng_refinement_restore(mark1);
  }
  return NG_OK;
}
static uint32_t ng_refinement_cf87b4a49a09d8be6797(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark3 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status3 = ng_refinement_9d6994ce070de4a60e0a(&value->value, depth + 1, nodes);
  if (status3) return status3;
  ng_refinement_restore(mark3);
  size_t mark5 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status5 = ng_refinement_39e0e5421beffcb8cd07(value->tail, depth + 1, nodes);
  if (status5) return status5;
  ng_refinement_restore(mark5);
  if (!lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_8b6f9e05ee7b31aa9e96(ng_570f6a0949de55fd682b_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.mkPacket");
  return NG_OK;
}
static uint32_t ng_refinement_9d6994ce070de4a60e0a(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_71ba01578b385b329e98(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_39e0e5421beffcb8cd07(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark4 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status4 = ng_refinement_cf87b4a49a09d8be6797(value->value, depth + 1, nodes);
    if (status4) return status4;
    ng_refinement_restore(mark4);
  }
  return NG_OK;
}
static uint32_t ng_refinement_50b2a165e1ce596defc6(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i10 = 0; i10 < value->length; ++i10) {
    size_t mark11 = ng_refinement_mark();
    if (!ng_refinement_index(i10)) return NG_LIMIT;
    uint32_t status11 = ng_refinement_215840a64c733ad0b72b(value->data + i10, depth + 1, nodes);
    if (status11) return status11;
    ng_refinement_restore(mark11);
  }
  return NG_OK;
}
static uint32_t ng_refinement_215840a64c733ad0b72b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark9 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status9 = ng_refinement_a0802564ce640941d23c(value->value, depth + 1, nodes);
    if (status9) return status9;
    ng_refinement_restore(mark9);
  }
  return NG_OK;
}
static uint32_t ng_refinement_a0802564ce640941d23c(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark6 = ng_refinement_mark();
  if (!ng_refinement_text(".digit", sizeof(".digit") - 1)) return NG_LIMIT;
  uint32_t status6 = ng_refinement_ebf4666d4647d93ffae7(&value->digit, depth + 1, nodes);
  if (status6) return status6;
  ng_refinement_restore(mark6);
  size_t mark8 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status8 = ng_refinement_377fe831a1410835959b(value->tail, depth + 1, nodes);
  if (status8) return status8;
  ng_refinement_restore(mark8);
  return NG_OK;
}
static uint32_t ng_refinement_ebf4666d4647d93ffae7(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_377fe831a1410835959b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark7 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status7 = ng_refinement_a0802564ce640941d23c(value->value, depth + 1, nodes);
    if (status7) return status7;
    ng_refinement_restore(mark7);
  }
  return NG_OK;
}
static uint32_t ng_refinement_102f2e72f4c66707bfa7(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i16 = 0; i16 < value->length; ++i16) {
    size_t mark17 = ng_refinement_mark();
    if (!ng_refinement_index(i16)) return NG_LIMIT;
    uint32_t status17 = ng_refinement_824aa5c289713a787b1b(value->data + i16, depth + 1, nodes);
    if (status17) return status17;
    ng_refinement_restore(mark17);
  }
  return NG_OK;
}
static uint32_t ng_refinement_824aa5c289713a787b1b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark15 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status15 = ng_refinement_aab2d2c761959867a441(value->value, depth + 1, nodes);
    if (status15) return status15;
    ng_refinement_restore(mark15);
  }
  return NG_OK;
}
static uint32_t ng_refinement_aab2d2c761959867a441(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark12 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status12 = ng_refinement_8b5ddfa97b91b6301c00(&value->value, depth + 1, nodes);
  if (status12) return status12;
  ng_refinement_restore(mark12);
  size_t mark14 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status14 = ng_refinement_c7ab0dcde5d58e59d488(value->tail, depth + 1, nodes);
  if (status14) return status14;
  ng_refinement_restore(mark14);
  if (!lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_88f1c5c2e3a6ba3c4460(ng_570f6a0949de55fd682b_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.normalizePacket");
  return NG_OK;
}
static uint32_t ng_refinement_8b5ddfa97b91b6301c00(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_262d1fa6be548d6d1dd0(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.plusTwo");
  return NG_OK;
}
static uint32_t ng_refinement_c7ab0dcde5d58e59d488(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark13 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status13 = ng_refinement_aab2d2c761959867a441(value->value, depth + 1, nodes);
    if (status13) return status13;
    ng_refinement_restore(mark13);
  }
  return NG_OK;
}
static uint32_t ng_refinement_68468944d9cff87af4c8(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark18 = ng_refinement_mark();
  if (!ng_refinement_text(".digit", sizeof(".digit") - 1)) return NG_LIMIT;
  uint32_t status18 = ng_refinement_4bcec70d8baba7c6d0b2(&value->digit, depth + 1, nodes);
  if (status18) return status18;
  ng_refinement_restore(mark18);
  size_t mark20 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status20 = ng_refinement_f02d247f1fef15201666(value->tail, depth + 1, nodes);
  if (status20) return status20;
  ng_refinement_restore(mark20);
  return NG_OK;
}
static uint32_t ng_refinement_4bcec70d8baba7c6d0b2(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_f02d247f1fef15201666(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark19 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status19 = ng_refinement_68468944d9cff87af4c8(value->value, depth + 1, nodes);
    if (status19) return status19;
    ng_refinement_restore(mark19);
  }
  return NG_OK;
}
static uint32_t ng_refinement_c574613170d9d11a69d6(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark21 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status21 = ng_refinement_5579cb76d74dc958dc92(&value->value, depth + 1, nodes);
  if (status21) return status21;
  ng_refinement_restore(mark21);
  size_t mark23 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status23 = ng_refinement_6e92f7ed8b90850b6cf4(value->tail, depth + 1, nodes);
  if (status23) return status23;
  ng_refinement_restore(mark23);
  if (!lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_8b6f9e05ee7b31aa9e96(ng_570f6a0949de55fd682b_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.mkPacket");
  return NG_OK;
}
static uint32_t ng_refinement_5579cb76d74dc958dc92(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_71ba01578b385b329e98(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_6e92f7ed8b90850b6cf4(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark22 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status22 = ng_refinement_c574613170d9d11a69d6(value->value, depth + 1, nodes);
    if (status22) return status22;
    ng_refinement_restore(mark22);
  }
  return NG_OK;
}
static uint32_t ng_refinement_2bcd73ec4fb3468c00d5(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i28 = 0; i28 < value->length; ++i28) {
    size_t mark29 = ng_refinement_mark();
    if (!ng_refinement_index(i28)) return NG_LIMIT;
    uint32_t status29 = ng_refinement_47307a75f3b1c8942c27(value->data + i28, depth + 1, nodes);
    if (status29) return status29;
    ng_refinement_restore(mark29);
  }
  return NG_OK;
}
static uint32_t ng_refinement_47307a75f3b1c8942c27(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark27 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status27 = ng_refinement_bc531f1056dd65639cbe(value->value, depth + 1, nodes);
    if (status27) return status27;
    ng_refinement_restore(mark27);
  }
  return NG_OK;
}
static uint32_t ng_refinement_bc531f1056dd65639cbe(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark24 = ng_refinement_mark();
  if (!ng_refinement_text(".digit", sizeof(".digit") - 1)) return NG_LIMIT;
  uint32_t status24 = ng_refinement_8bfd282d5a5297629744(&value->digit, depth + 1, nodes);
  if (status24) return status24;
  ng_refinement_restore(mark24);
  size_t mark26 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status26 = ng_refinement_3b7bb56c4968c4440a1d(value->tail, depth + 1, nodes);
  if (status26) return status26;
  ng_refinement_restore(mark26);
  return NG_OK;
}
static uint32_t ng_refinement_8bfd282d5a5297629744(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_3b7bb56c4968c4440a1d(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark25 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status25 = ng_refinement_bc531f1056dd65639cbe(value->value, depth + 1, nodes);
    if (status25) return status25;
    ng_refinement_restore(mark25);
  }
  return NG_OK;
}
static uint32_t ng_refinement_1b7287d9c051a8a31f42(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i34 = 0; i34 < value->length; ++i34) {
    size_t mark35 = ng_refinement_mark();
    if (!ng_refinement_index(i34)) return NG_LIMIT;
    uint32_t status35 = ng_refinement_d6c84e261ebe0fc027bf(value->data + i34, depth + 1, nodes);
    if (status35) return status35;
    ng_refinement_restore(mark35);
  }
  return NG_OK;
}
static uint32_t ng_refinement_d6c84e261ebe0fc027bf(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark33 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status33 = ng_refinement_d2ead72ad1b5d8405fb7(value->value, depth + 1, nodes);
    if (status33) return status33;
    ng_refinement_restore(mark33);
  }
  return NG_OK;
}
static uint32_t ng_refinement_d2ead72ad1b5d8405fb7(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark30 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status30 = ng_refinement_a33124d0497c85199d6a(&value->value, depth + 1, nodes);
  if (status30) return status30;
  ng_refinement_restore(mark30);
  size_t mark32 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status32 = ng_refinement_a4bb79fa94f62793eddf(value->tail, depth + 1, nodes);
  if (status32) return status32;
  ng_refinement_restore(mark32);
  if (!lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_8b6f9e05ee7b31aa9e96(ng_570f6a0949de55fd682b_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.mkPacket");
  return NG_OK;
}
static uint32_t ng_refinement_a33124d0497c85199d6a(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_71ba01578b385b329e98(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_a4bb79fa94f62793eddf(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark31 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status31 = ng_refinement_d2ead72ad1b5d8405fb7(value->value, depth + 1, nodes);
    if (status31) return status31;
    ng_refinement_restore(mark31);
  }
  return NG_OK;
}
static uint32_t ng_refinement_299bd3b3948e28b6d6fc(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark36 = ng_refinement_mark();
  if (!ng_refinement_text(".digit", sizeof(".digit") - 1)) return NG_LIMIT;
  uint32_t status36 = ng_refinement_fa856affcc607eb064ff(&value->digit, depth + 1, nodes);
  if (status36) return status36;
  ng_refinement_restore(mark36);
  size_t mark38 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status38 = ng_refinement_f9ba3ea2f80f8264213b(value->tail, depth + 1, nodes);
  if (status38) return status38;
  ng_refinement_restore(mark38);
  return NG_OK;
}
static uint32_t ng_refinement_fa856affcc607eb064ff(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_f9ba3ea2f80f8264213b(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark37 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status37 = ng_refinement_299bd3b3948e28b6d6fc(value->value, depth + 1, nodes);
    if (status37) return status37;
    ng_refinement_restore(mark37);
  }
  return NG_OK;
}
static uint32_t ng_refinement_59ef9fe05163b6b6bc43(const recursivecheckedrecords_packet_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark39 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status39 = ng_refinement_815b2ac78d0a20d093d3(&value->value, depth + 1, nodes);
  if (status39) return status39;
  ng_refinement_restore(mark39);
  size_t mark41 = ng_refinement_mark();
  if (!ng_refinement_text(".tail", sizeof(".tail") - 1)) return NG_LIMIT;
  uint32_t status41 = ng_refinement_bd8437588677ebda1134(value->tail, depth + 1, nodes);
  if (status41) return status41;
  ng_refinement_restore(mark41);
  if (!lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_88f1c5c2e3a6ba3c4460(ng_570f6a0949de55fd682b_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.normalizePacket");
  return NG_OK;
}
static uint32_t ng_refinement_815b2ac78d0a20d093d3(const recursivecheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_262d1fa6be548d6d1dd0(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by RecursiveCheckedRecords.plusTwo");
  return NG_OK;
}
static uint32_t ng_refinement_bd8437588677ebda1134(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark40 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status40 = ng_refinement_59ef9fe05163b6b6bc43(value->value, depth + 1, nodes);
    if (status40) return status40;
    ng_refinement_restore(mark40);
  }
  return NG_OK;
}
extern lean_object *lean_bridge_9a14c44da851e2d4fdfbfb9b_lean(lean_object *);
uint32_t recursivecheckedrecords_echo_graph(const recursivecheckedrecords_packet_t *a0, recursivecheckedrecords_packet_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivecheckedrecords_packet_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_570f6a0949de55fd682b_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_934c7c427f00271b904f(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_cf87b4a49a09d8be6797(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_570f6a0949de55fd682b_in(a0);
  lean_object *value = lean_bridge_9a14c44da851e2d4fdfbfb9b_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivecheckedrecords_packet_t result = {0};
  status = ng_570f6a0949de55fd682b_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_b1c46fbb29fb86a306017349_lean(lean_object *);
uint32_t recursivecheckedrecords_echo_groups_graph(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *a0, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivecheckedrecords_graph_bf065e9a21862d87767f_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_bf065e9a21862d87767f_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_50b2a165e1ce596defc6(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_102f2e72f4c66707bfa7(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_bf065e9a21862d87767f_in(a0);
  lean_object *value = lean_bridge_b1c46fbb29fb86a306017349_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t result = {0};
  status = ng_bf065e9a21862d87767f_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_8540c0aac676a8863cdff838_lean(lean_object *);
uint32_t recursivecheckedrecords_first_graph(const recursivecheckedrecords_packet_t *a0, recursivecheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_570f6a0949de55fd682b_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_68468944d9cff87af4c8(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_c574613170d9d11a69d6(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_570f6a0949de55fd682b_in(a0);
  lean_object *value = lean_bridge_8540c0aac676a8863cdff838_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivecheckedrecords_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_24b13094b4039f73d0959480_lean(lean_object *);
uint32_t recursivecheckedrecords_groups_graph(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *a0, recursivecheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_bf065e9a21862d87767f_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_2bcd73ec4fb3468c00d5(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_1b7287d9c051a8a31f42(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_bf065e9a21862d87767f_in(a0);
  lean_object *value = lean_bridge_24b13094b4039f73d0959480_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivecheckedrecords_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_df0f714db6fdbd3762d5e0a5_lean(lean_object *);
uint32_t recursivecheckedrecords_produce_graph(const recursivecheckedrecords_scalar_nat_t *a0, recursivecheckedrecords_packet_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivecheckedrecords_packet_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_5f971a64123919686824_check(a0, 0, 1, &budget))) return status;
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_5f971a64123919686824_in(a0);
  lean_object *value = lean_bridge_df0f714db6fdbd3762d5e0a5_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivecheckedrecords_packet_t result = {0};
  status = ng_570f6a0949de55fd682b_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_c3338006aea7f276ff222c0c_lean(lean_object *);
uint32_t recursivecheckedrecords_second_graph(const recursivecheckedrecords_packet_t *a0, recursivecheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_570f6a0949de55fd682b_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_299bd3b3948e28b6d6fc(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_59ef9fe05163b6b6bc43(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_570f6a0949de55fd682b_in(a0);
  lean_object *value = lean_bridge_c3338006aea7f276ff222c0c_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  recursivecheckedrecords_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
uint32_t recursivecheckedrecords_graph_initialize(void) { return lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize) ? 0 : 5; }
int recursivecheckedrecords_graph_ready(void) { return ng_ready(); }
void recursivecheckedrecords_graph_retire(void) { lean_bridge_native_runtime_retire(); }
__attribute__((destructor)) static void lb_graph_detach(void) { lean_bridge_native_component_detach("recursivecheckedrecords@1.0.0"); }
