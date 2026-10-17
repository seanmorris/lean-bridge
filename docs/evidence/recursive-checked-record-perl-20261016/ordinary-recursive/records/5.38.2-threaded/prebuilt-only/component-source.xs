#include "runtime.h"
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
#include "recursivecheckedrecords-graph.h"

#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <stdlib.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdio.h>
_Static_assert(sizeof(void *) == 8 && sizeof(IV) == 8 && sizeof(UV) == 8, "Perl graph conversion requires a 64-bit ABI");
#ifndef LB_PERL_GRAPH_MALLOC
#define LB_PERL_GRAPH_MALLOC malloc
#endif
#ifndef LB_PERL_GRAPH_FREE
#define LB_PERL_GRAPH_FREE free
#endif
#ifndef LB_PERL_GRAPH_CHECKPOINT
#define LB_PERL_GRAPH_CHECKPOINT() ((void)0)
#endif
typedef struct lpg_allocation {
  struct lpg_allocation *next;
  max_align_t alignment;
  unsigned char data[];
} lpg_allocation;
typedef struct {
  lpg_allocation *allocations;
  void *output;
  void (*clear)(void *);
  void (*retire)(void);
  size_t native_bytes, storage_bytes, nodes;
  struct { const void *address; size_t type; } path[129];
} lpg_scope;
static void lpg_close(lpg_scope *scope) {
  void *output = scope->output; scope->output = NULL;
  if (output && scope->clear) scope->clear(output);
  lpg_allocation *allocation = scope->allocations; scope->allocations = NULL;
  while (allocation) {
    lpg_allocation *next = allocation->next;
    LB_PERL_GRAPH_FREE(allocation); allocation = next;
  }
}
static void lpg_end(pTHX_ void *value) {
  PERL_UNUSED_CONTEXT;
  lpg_scope *scope = value; lpg_close(scope); LB_PERL_GRAPH_FREE(scope);
}
static lpg_scope *lpg_begin(pTHX_ void (*retire)(void)) {
  /* Grow Perl's save stack before acquiring memory needing its destructor. */
  SSGROW(4);
  LB_PERL_GRAPH_CHECKPOINT();
  lpg_scope *scope = LB_PERL_GRAPH_MALLOC(sizeof(*scope));
  if (!scope) croak("Perl graph allocation failed");
  memset(scope, 0, sizeof(*scope));
  SAVEDESTRUCTOR_X(lpg_end, scope);
  scope->retire = retire;
  scope->native_bytes = scope->storage_bytes = 16 * 1024 * 1024;
  scope->nodes = 262144;
  return scope;
}
static void lpg_charge(pTHX_ size_t *remaining, size_t count, size_t width) {
  if (!width || count > *remaining / width) croak("Perl copied graph storage limit exceeded");
  *remaining -= count * width;
}
static void *lpg_allocate(pTHX_ lpg_scope *scope, size_t count, size_t width) {
  if (!count) return NULL;
  lpg_charge(aTHX_ &scope->storage_bytes, count, width);
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(lpg_allocation));
  LB_PERL_GRAPH_CHECKPOINT();
  lpg_allocation *allocation = LB_PERL_GRAPH_MALLOC(sizeof(*allocation) + count * width);
  if (!allocation) croak("Perl graph allocation failed");
  allocation->next = scope->allocations; scope->allocations = allocation;
  memset(allocation->data, 0, count * width); return allocation->data;
}
static void lpg_invalid(pTHX_ lpg_scope *scope, const char *message) {
  if (scope->retire) scope->retire();
  croak("Invalid native copied graph: %s", message);
}
static void lpg_enter(pTHX_ lpg_scope *scope, const void *value, size_t type, size_t depth, size_t native_storage, int output) {
  if (depth > 128 || !scope->nodes) croak("Perl copied graph depth or node limit exceeded");
  --scope->nodes;
  lpg_charge(aTHX_ &scope->native_bytes, native_storage, 1);
  for (size_t i = 0; value && i < depth; ++i) if (scope->path[i].address == value && scope->path[i].type == type) {
    if (output) lpg_invalid(aTHX_ scope, "cycle");
    croak("Cyclic Perl copied value");
  }
  scope->path[depth].address = value; scope->path[depth].type = type;
}
static void lpg_pointer(pTHX_ lpg_scope *scope, const void *pointer, size_t count, size_t width, size_t alignment) {
  if (!count) return;
  if (!pointer || (uintptr_t)pointer % alignment || count > (UINTPTR_MAX - (uintptr_t)pointer) / width)
    lpg_invalid(aTHX_ scope, "missing, misaligned or overflowing span");
  /* Authenticated native producers supply readable process memory. */
}
static SV *lpg_pin(pTHX_ SV *value) {
  EXTEND_MORTAL(1); return sv_2mortal(SvREFCNT_inc(value));
}
static SV *lpg_sv(pTHX_ lpg_scope *scope) {
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(SV) + 64);
  LB_PERL_GRAPH_CHECKPOINT(); EXTEND_MORTAL(1);
  return sv_2mortal(newSV(0));
}
static SV *lpg_text(pTHX_ lpg_scope *scope, const char *text, size_t length, int unicode) {
  lpg_charge(aTHX_ &scope->storage_bytes, length + 1, 1);
  SV *value = lpg_sv(aTHX_ scope);
  LB_PERL_GRAPH_CHECKPOINT(); sv_setpvn(value, length ? text : "", length);
  if (unicode) SvUTF8_on(value);
  return value;
}
static HV *lpg_hash(pTHX_ lpg_scope *scope) {
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(HV) + 128);
  LB_PERL_GRAPH_CHECKPOINT(); EXTEND_MORTAL(1);
  return (HV *)sv_2mortal((SV *)newHV());
}
static AV *lpg_array(pTHX_ lpg_scope *scope, size_t length) {
  lpg_charge(aTHX_ &scope->storage_bytes, length, sizeof(SV *) + sizeof(SV) + 64);
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(AV) + 128);
  LB_PERL_GRAPH_CHECKPOINT(); EXTEND_MORTAL(1);
  AV *value = (AV *)sv_2mortal((SV *)newAV());
  if (length) { LB_PERL_GRAPH_CHECKPOINT(); av_extend(value, length - 1); }
  return value;
}
static SV *lpg_reference(pTHX_ lpg_scope *scope, SV *referent, const char *package) {
  SV *value = lpg_sv(aTHX_ scope);
  LB_PERL_GRAPH_CHECKPOINT(); sv_setrv_inc(value, referent);
  if (package) { LB_PERL_GRAPH_CHECKPOINT(); sv_bless(value, gv_stashpv(package, GV_ADD)); }
  return value;
}
static void lpg_store(pTHX_ lpg_scope *scope, HV *hash, const char *field, SV *value) {
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(SV) + 64 + strlen(field));
  LB_PERL_GRAPH_CHECKPOINT(); SV **slot = hv_fetch(hash, field, strlen(field), 1);
  if (!slot) croak("Perl graph field allocation failed");
  LB_PERL_GRAPH_CHECKPOINT(); sv_setsv(*slot, value);
}
static void lpg_append(pTHX_ AV *array, size_t index, SV *value) {
  LB_PERL_GRAPH_CHECKPOINT(); SV **slot = av_fetch(array, index, 1);
  if (!slot) croak("Perl graph element allocation failed");
  LB_PERL_GRAPH_CHECKPOINT(); sv_setsv(*slot, value);
}
static int lpg_branch(SV *value, const char *package) {
  if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVHV || SvMAGICAL(SvRV(value)) || !SvOBJECT(SvRV(value))) return 0;
  HV *stash = SvSTASH(SvRV(value));
  const char *name = stash ? HvNAME(stash) : NULL;
  return name && strEQ(name, package);
}
static SV **lpg_fields(pTHX_ lpg_scope *scope, SV *value, const char *package, const char *const *fields, size_t count) {
  if (!lpg_branch(value, package)) croak("Expected exact %s with a plain untied hash", package);
  HV *input = (HV *)lpg_pin(aTHX_ SvRV(value));
  if (HvUSEDKEYS(input) != count) croak("Perl graph fields do not match the generated schema");
  SV **slots = lpg_allocate(aTHX_ scope, count, sizeof(SV *));
  /* Pin every slot before a child conversion can invoke Perl. */
  for (size_t i = 0; i < count; ++i) {
    SV **entry = hv_fetch(input, fields[i], strlen(fields[i]), 0);
    if (!entry) croak("Missing Perl graph field %s", fields[i]);
    slots[i] = lpg_pin(aTHX_ *entry);
  }
  return slots;
}
static SV **lpg_sequence(pTHX_ lpg_scope *scope, SV *value, size_t *length) {
  if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVAV || SvOBJECT(SvRV(value)) ||
      (SvMAGICAL(SvRV(value)) && mg_find(SvRV(value), PERL_MAGIC_tied))) croak("Expected a plain untied array reference");
  AV *array = (AV *)lpg_pin(aTHX_ SvRV(value)); *length = av_count(array);
  if (*length > scope->nodes) croak("Perl copied graph node limit exceeded");
  SV **slots = lpg_allocate(aTHX_ scope, *length, sizeof(SV *));
  for (size_t i = 0; i < *length; ++i) {
    SV **entry = av_fetch(array, i, 0);
    if (!entry) croak("Sparse Perl copied arrays are unsupported");
    slots[i] = lpg_pin(aTHX_ *entry);
  }
  return slots;
}
static uint64_t lpg_unsigned(pTHX_ SV *value, uint64_t maximum) {
  if (!SvIOK(value) || (!SvIsUV(value) && SvIV(value) < 0) || SvUV(value) > maximum)
    croak("Unsigned integer is out of range or not an exact integer scalar");
  return (uint64_t)SvUV(value);
}
static int64_t lpg_signed(pTHX_ SV *value, int64_t minimum, int64_t maximum) {
  if (!SvIOK(value) || (SvIsUV(value) && SvUV(value) > (uint64_t)maximum) ||
      (!SvIsUV(value) && (SvIV(value) < minimum || SvIV(value) > maximum)))
    croak("Signed integer is out of range or not an exact integer scalar");
  return (int64_t)SvIV(value);
}
static SV *lpg_bigint_text(pTHX_ lpg_scope *scope, SV *value, int natural) {
  if (!SvROK(value) || !sv_derived_from(value, "Math::BigInt")) croak("Expected Math::BigInt");
  LB_PERL_GRAPH_CHECKPOINT();
  dSP; PUSHMARK(SP); XPUSHs(value); PUTBACK;
  int count = call_method("bstr", G_SCALAR); SPAGAIN;
  if (count != 1) { SP -= count; PUTBACK; croak("Math::BigInt must return one decimal value"); }
  SV *text = POPs; PUTBACK; lpg_pin(aTHX_ text); SvGETMAGIC(text);
  if (SvROK(text) || (!SvPOK(text) && !SvIOK(text) && !SvNOK(text))) croak("Math::BigInt must return a decimal scalar");
  LB_PERL_GRAPH_CHECKPOINT();
  STRLEN length; const char *bytes = SvPV_nomg(text, length);
  lpg_charge(aTHX_ &scope->storage_bytes, length, 1);
  size_t i = 0;
  if (!length) croak("Invalid Math::BigInt");
  if (bytes[0] == '-') { if (natural) croak("Nat cannot be negative"); i = 1; }
  if (i == length) croak("Invalid Math::BigInt");
  for (; i < length; ++i) if (bytes[i] < '0' || bytes[i] > '9') croak("Math::BigInt must be finite and integral");
  return text;
}
static const uint32_t *lpg_limbs(pTHX_ lpg_scope *scope, SV *value, int natural, size_t *count, int *negative) {
  SV *text = lpg_bigint_text(aTHX_ scope, value, natural);
  STRLEN length; const char *bytes = SvPV_nomg(text, length);
  *negative = bytes[0] == '-'; bytes += *negative; length -= *negative;
  while (length && *bytes == '0') { ++bytes; --length; }
  if (!length) { *count = 0; *negative = 0; return NULL; }
  size_t capacity = length / 9 + 1;
  uint32_t *limbs = lpg_allocate(aTHX_ scope, capacity, sizeof(uint32_t));
  size_t used = 0;
  while (length) {
    size_t digits = length % 9; if (!digits) digits = 9;
    uint32_t factor = 1, chunk = 0;
    for (size_t i = 0; i < digits; ++i) { factor *= 10; chunk = chunk * 10 + (bytes[i] - '0'); }
    uint64_t carry = chunk;
    for (size_t i = 0; i < used; ++i) { carry += (uint64_t)limbs[i] * factor; limbs[i] = (uint32_t)carry; carry >>= 32; }
    if (carry) { if (used == capacity) croak("Perl graph limb capacity exceeded"); limbs[used++] = (uint32_t)carry; }
    bytes += digits; length -= digits;
  }
  lpg_charge(aTHX_ &scope->native_bytes, used, sizeof(uint32_t));
  *count = used; return limbs;
}
static SV *lpg_bigint(pTHX_ lpg_scope *scope, const uint32_t *limbs, size_t count, int negative) {
  while (count && !limbs[count - 1]) --count;
  uint32_t *work = lpg_allocate(aTHX_ scope, count, sizeof(uint32_t));
  if (count) memcpy(work, limbs, count * sizeof(uint32_t));
  size_t capacity = count * 2 + 1;
  uint32_t *chunks = lpg_allocate(aTHX_ scope, capacity, sizeof(uint32_t));
  size_t used = 0;
  while (count) {
    uint64_t remainder = 0;
    for (size_t i = count; i > 0; --i) { uint64_t value = (remainder << 32) | work[i - 1]; work[i - 1] = value / 1000000000; remainder = value % 1000000000; }
    chunks[used++] = remainder;
    while (count && !work[count - 1]) --count;
  }
  char *bytes = lpg_allocate(aTHX_ scope, used * 9 + 3, 1), *cursor = bytes;
  if (negative && used) *cursor++ = '-';
  if (!used) *cursor++ = '0';
  else { cursor += sprintf(cursor, "%u", chunks[--used]); while (used) cursor += sprintf(cursor, "%09u", chunks[--used]); }
  SV *text = lpg_text(aTHX_ scope, bytes, cursor - bytes, 0), *klass = lpg_text(aTHX_ scope, "Math::BigInt", 12, 0);
  LB_PERL_GRAPH_CHECKPOINT(); dSP; PUSHMARK(SP); XPUSHs(klass); XPUSHs(text); PUTBACK;
  int returns = call_method("new", G_SCALAR); SPAGAIN;
  if (returns != 1) { SP -= returns; PUTBACK; croak("Math::BigInt construction failed"); }
  SV *result = POPs; PUTBACK; lpg_pin(aTHX_ result);
  if (!SvROK(result) || !sv_derived_from(result, "Math::BigInt")) croak("Math::BigInt constructor returned an invalid value");
  return result;
}

#include "recursivecheckedrecords-graph-types.h"
static void lpg_read0(pTHX_ lpg_scope *, SV *, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, size_t, int);
static SV *lpg_write0(pTHX_ lpg_scope *, const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, size_t, int);
static void lpg_read1(pTHX_ lpg_scope *, SV *, recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, size_t, int);
static SV *lpg_write1(pTHX_ lpg_scope *, const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, size_t, int);
static void lpg_read2(pTHX_ lpg_scope *, SV *, recursivecheckedrecords_packet_t *, size_t, int);
static SV *lpg_write2(pTHX_ lpg_scope *, const recursivecheckedrecords_packet_t *, size_t, int);
static void lpg_read3(pTHX_ lpg_scope *, SV *, recursivecheckedrecords_scalar_nat_t *, size_t, int);
static SV *lpg_write3(pTHX_ lpg_scope *, const recursivecheckedrecords_scalar_nat_t *, size_t, int);
static void lpg_read0(pTHX_ lpg_scope *scope, SV *value, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *out, size_t depth, int storage) {
  (void)out; SvGETMAGIC(value);
  lpg_enter(aTHX_ scope, SvROK(value) ? SvRV(value) : NULL, 0, depth, storage ? sizeof(*out) : 0, 0);
  size_t length; SV **slots = lpg_sequence(aTHX_ scope, value, &length);
  lpg_charge(aTHX_ &scope->native_bytes, length, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t));
  recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *data = lpg_allocate(aTHX_ scope, length, sizeof(*data)); out->data = data; out->length = length;
  for (size_t i = 0; i < length; ++i) lpg_read1(aTHX_ scope, slots[i], &data[i], depth + 1, 0);
}
static SV *lpg_write0(pTHX_ lpg_scope *scope, const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, size_t depth, int storage) {
  lpg_pointer(aTHX_ scope, value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_graph_bf065e9a21862d87767f_t));
  lpg_enter(aTHX_ scope, value, 0, depth, storage ? sizeof(*value) : 0, 1);
  lpg_charge(aTHX_ &scope->native_bytes, value->length, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t));
  if (value->length > scope->nodes) croak("Perl copied graph node limit exceeded");
  lpg_pointer(aTHX_ scope, value->data, value->length, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t), _Alignof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t));
  AV *result = lpg_array(aTHX_ scope, value->length);
  for (size_t i = 0; i < value->length; ++i) lpg_append(aTHX_ result, i, lpg_write1(aTHX_ scope, &value->data[i], depth + 1, 0));
  return lpg_reference(aTHX_ scope, (SV *)result, NULL);
}

static void lpg_read1(pTHX_ lpg_scope *scope, SV *value, recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *out, size_t depth, int storage) {
  (void)out; SvGETMAGIC(value);
  lpg_enter(aTHX_ scope, SvROK(value) ? SvRV(value) : NULL, 1, depth, storage ? sizeof(*out) : 0, 0);
  if (!SvOK(value)) { out->has_value = 0; return; }
  if (lpg_branch(value, "LeanBridge::RecursiveCheckedRecords::Some")) { out->has_value = 1;
  static const char *const fields[] = {"value"};
  SV **slots = lpg_fields(aTHX_ scope, value, "LeanBridge::RecursiveCheckedRecords::Some", fields, 1); (void)slots;
  { recursivecheckedrecords_packet_t *child = lpg_allocate(aTHX_ scope, 1, sizeof(*child)); out->value = child; lpg_read2(aTHX_ scope, slots[0], child, depth + 1, 1); }
  return;
  }
  croak("Expected undef or Some");
}
static SV *lpg_write1(pTHX_ lpg_scope *scope, const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, size_t depth, int storage) {
  lpg_pointer(aTHX_ scope, value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t));
  lpg_enter(aTHX_ scope, value, 1, depth, storage ? sizeof(*value) : 0, 1);
  if (value->has_value > 1) lpg_invalid(aTHX_ scope, "branch flag");
  if (!value->has_value) return &PL_sv_undef;
  {
  HV *result = lpg_hash(aTHX_ scope);
  lpg_store(aTHX_ scope, result, "value", lpg_write2(aTHX_ scope, value->value, depth + 1, 1));
  return lpg_reference(aTHX_ scope, (SV *)result, "LeanBridge::RecursiveCheckedRecords::Some");
  }
}

static void lpg_read2(pTHX_ lpg_scope *scope, SV *value, recursivecheckedrecords_packet_t *out, size_t depth, int storage) {
  (void)out; SvGETMAGIC(value);
  lpg_enter(aTHX_ scope, SvROK(value) ? SvRV(value) : NULL, 2, depth, storage ? sizeof(*out) : 0, 0);
  static const char *const fields[] = {"value", "digit", "tail"};
  SV **slots = lpg_fields(aTHX_ scope, value, "LeanBridge::RecursiveCheckedRecords::Packet", fields, 3); (void)slots;
  lpg_read3(aTHX_ scope, slots[0], &out->value, depth + 1, 0);
  lpg_read3(aTHX_ scope, slots[1], &out->digit, depth + 1, 0);
  { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *child = lpg_allocate(aTHX_ scope, 1, sizeof(*child)); out->tail = child; lpg_read1(aTHX_ scope, slots[2], child, depth + 1, 1); }
}
static SV *lpg_write2(pTHX_ lpg_scope *scope, const recursivecheckedrecords_packet_t *value, size_t depth, int storage) {
  lpg_pointer(aTHX_ scope, value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_packet_t));
  lpg_enter(aTHX_ scope, value, 2, depth, storage ? sizeof(*value) : 0, 1);
  HV *result = lpg_hash(aTHX_ scope);
  lpg_store(aTHX_ scope, result, "value", lpg_write3(aTHX_ scope, &value->value, depth + 1, 0));
  lpg_store(aTHX_ scope, result, "digit", lpg_write3(aTHX_ scope, &value->digit, depth + 1, 0));
  lpg_store(aTHX_ scope, result, "tail", lpg_write1(aTHX_ scope, value->tail, depth + 1, 1));
  return lpg_reference(aTHX_ scope, (SV *)result, "LeanBridge::RecursiveCheckedRecords::Packet");
}

static void lpg_read3(pTHX_ lpg_scope *scope, SV *value, recursivecheckedrecords_scalar_nat_t *out, size_t depth, int storage) {
  (void)out; SvGETMAGIC(value);
  lpg_enter(aTHX_ scope, SvROK(value) ? SvRV(value) : NULL, 3, depth, storage ? sizeof(*out) : 0, 0);
  int negative; out->data = lpg_limbs(aTHX_ scope, value, 1, &out->length, &negative);
  (void)negative;
}
static SV *lpg_write3(pTHX_ lpg_scope *scope, const recursivecheckedrecords_scalar_nat_t *value, size_t depth, int storage) {
  lpg_pointer(aTHX_ scope, value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_scalar_nat_t));
  lpg_enter(aTHX_ scope, value, 3, depth, storage ? sizeof(*value) : 0, 1);
  lpg_charge(aTHX_ &scope->native_bytes, value->length, sizeof(uint32_t));
  lpg_pointer(aTHX_ scope, value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t));
  uint8_t negative = 0;
  return lpg_bigint(aTHX_ scope, value->data, value->length, negative);
}

static void lpg_check_context(pTHX);
static uint32_t lpg_initialize(void);
static int lpg_ready(void);
static void lpg_retire(void);
static void lpg_status(pTHX_ lpg_scope *scope, uint32_t status) {
  if (!status) return;
  if (status == 4) lpg_invalid(aTHX_ scope, "carrier or result");
  if (status == 1) {
    const char *specific = recursivecheckedrecords_graph_error();
    if (specific) croak("%s\n", specific);
  }

  const char *message = status == 1 ? "invalid argument" : status == 2 ? "conversion limit exceeded" :
    status == 3 ? "native allocation failed" : status == 5 ? "shared runtime unavailable" : "unknown status";
  croak("Lean Bridge graph call failed (status=%u): %s", (unsigned)status, message);
}
static void lpg_clear_recursivecheckedrecords_echo(void *value) { recursivecheckedrecords_packet_t_clear(value); }
static void lpg_clear_recursivecheckedrecords_echo_groups(void *value) { recursivecheckedrecords_graph_bf065e9a21862d87767f_t_clear(value); }
static void lpg_clear_recursivecheckedrecords_first(void *value) { recursivecheckedrecords_scalar_nat_t_clear(value); }
static void lpg_clear_recursivecheckedrecords_groups(void *value) { recursivecheckedrecords_scalar_nat_t_clear(value); }
static void lpg_clear_recursivecheckedrecords_produce(void *value) { recursivecheckedrecords_packet_t_clear(value); }
static void lpg_clear_recursivecheckedrecords_second(void *value) { recursivecheckedrecords_scalar_nat_t_clear(value); }
static void lpg_check_context(pTHX) { lbp_check_interpreter(aTHX); }
static uint32_t lpg_initialize(void) { return lean_bridge_native_component_initialize("recursivecheckedrecords@1.0.0", ng_initialize) ? 0 : 5; }
static int lpg_ready(void) { return ng_ready(); }
static void lpg_retire(void) { lean_bridge_native_runtime_retire(); }

MODULE = LeanBridge::RecursiveCheckedRecords PACKAGE = LeanBridge::RecursiveCheckedRecords
PROTOTYPES: DISABLE

void
echo(...)
  PPCODE:
    if (items != 1) croak("echo expects 1 arguments");
    lpg_check_context(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    SV *argument0 = lpg_pin(aTHX_ ST(0));
    recursivecheckedrecords_packet_t *input0 = lpg_allocate(aTHX_ scope, 1, sizeof(*input0));
    lpg_read2(aTHX_ scope, argument0, input0, 0, 1);
    recursivecheckedrecords_packet_t *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    scope->output = output; scope->clear = lpg_clear_recursivecheckedrecords_echo;
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_initialize());
    lpg_status(aTHX_ scope, recursivecheckedrecords_echo_graph(input0, output));
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    SV *out = lpg_write2(aTHX_ scope, output, 0, 1);
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    lpg_close(scope);
    LEAVE;
    /* call_method can grow the Perl stack while converting Math::BigInt. */
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);

void
echo_groups(...)
  PPCODE:
    if (items != 1) croak("echo_groups expects 1 arguments");
    lpg_check_context(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    SV *argument0 = lpg_pin(aTHX_ ST(0));
    recursivecheckedrecords_graph_bf065e9a21862d87767f_t *input0 = lpg_allocate(aTHX_ scope, 1, sizeof(*input0));
    lpg_read0(aTHX_ scope, argument0, input0, 0, 1);
    recursivecheckedrecords_graph_bf065e9a21862d87767f_t *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    scope->output = output; scope->clear = lpg_clear_recursivecheckedrecords_echo_groups;
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_initialize());
    lpg_status(aTHX_ scope, recursivecheckedrecords_echo_groups_graph(input0, output));
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    SV *out = lpg_write0(aTHX_ scope, output, 0, 1);
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    lpg_close(scope);
    LEAVE;
    /* call_method can grow the Perl stack while converting Math::BigInt. */
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);

void
first(...)
  PPCODE:
    if (items != 1) croak("first expects 1 arguments");
    lpg_check_context(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    SV *argument0 = lpg_pin(aTHX_ ST(0));
    recursivecheckedrecords_packet_t *input0 = lpg_allocate(aTHX_ scope, 1, sizeof(*input0));
    lpg_read2(aTHX_ scope, argument0, input0, 0, 1);
    recursivecheckedrecords_scalar_nat_t *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    scope->output = output; scope->clear = lpg_clear_recursivecheckedrecords_first;
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_initialize());
    lpg_status(aTHX_ scope, recursivecheckedrecords_first_graph(input0, output));
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    SV *out = lpg_write3(aTHX_ scope, output, 0, 1);
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    lpg_close(scope);
    LEAVE;
    /* call_method can grow the Perl stack while converting Math::BigInt. */
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);

void
groups(...)
  PPCODE:
    if (items != 1) croak("groups expects 1 arguments");
    lpg_check_context(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    SV *argument0 = lpg_pin(aTHX_ ST(0));
    recursivecheckedrecords_graph_bf065e9a21862d87767f_t *input0 = lpg_allocate(aTHX_ scope, 1, sizeof(*input0));
    lpg_read0(aTHX_ scope, argument0, input0, 0, 1);
    recursivecheckedrecords_scalar_nat_t *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    scope->output = output; scope->clear = lpg_clear_recursivecheckedrecords_groups;
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_initialize());
    lpg_status(aTHX_ scope, recursivecheckedrecords_groups_graph(input0, output));
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    SV *out = lpg_write3(aTHX_ scope, output, 0, 1);
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    lpg_close(scope);
    LEAVE;
    /* call_method can grow the Perl stack while converting Math::BigInt. */
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);

void
produce(...)
  PPCODE:
    if (items != 1) croak("produce expects 1 arguments");
    lpg_check_context(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    SV *argument0 = lpg_pin(aTHX_ ST(0));
    recursivecheckedrecords_scalar_nat_t *input0 = lpg_allocate(aTHX_ scope, 1, sizeof(*input0));
    lpg_read3(aTHX_ scope, argument0, input0, 0, 1);
    recursivecheckedrecords_packet_t *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    scope->output = output; scope->clear = lpg_clear_recursivecheckedrecords_produce;
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_initialize());
    lpg_status(aTHX_ scope, recursivecheckedrecords_produce_graph(input0, output));
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    SV *out = lpg_write2(aTHX_ scope, output, 0, 1);
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    lpg_close(scope);
    LEAVE;
    /* call_method can grow the Perl stack while converting Math::BigInt. */
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);

void
second(...)
  PPCODE:
    if (items != 1) croak("second expects 1 arguments");
    lpg_check_context(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    SV *argument0 = lpg_pin(aTHX_ ST(0));
    recursivecheckedrecords_packet_t *input0 = lpg_allocate(aTHX_ scope, 1, sizeof(*input0));
    lpg_read2(aTHX_ scope, argument0, input0, 0, 1);
    recursivecheckedrecords_scalar_nat_t *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    scope->output = output; scope->clear = lpg_clear_recursivecheckedrecords_second;
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_initialize());
    lpg_status(aTHX_ scope, recursivecheckedrecords_second_graph(input0, output));
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    SV *out = lpg_write3(aTHX_ scope, output, 0, 1);
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    lpg_close(scope);
    LEAVE;
    /* call_method can grow the Perl stack while converting Math::BigInt. */
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);

BOOT:
  lbp_check_interpreter(aTHX);
