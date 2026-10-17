#include "component.h"
#include "mutualcheckedrecords-graph.h"

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
const char *mutualcheckedrecords_graph_error(void) {
  const char *result = ng_refinement_length ? ng_refinement_message : NULL;
  ng_refinement_length = 0;
  return result;
}

extern uint8_t lean_bridge_80dc06e94320d76de7e8afc6_graph_refinement_0_dcb8ec285e33c1c5011c(lean_object *);
extern uint8_t lean_bridge_80dc06e94320d76de7e8afc6_graph_refinement_0_ee78e99abfc85cedd28d(lean_object *);
extern uint8_t lean_bridge_84236b8271f83e0e4db02cf4_graph_refinement_0_7214b53bf51ec9b2e7dc(lean_object *);
extern uint8_t lean_bridge_84236b8271f83e0e4db02cf4_graph_refinement_0_f876f341e734dd025087(lean_object *);
extern uint8_t lean_bridge_b93734338d8f12ed96612e52_graph_refinement_0_dcb8ec285e33c1c5011c(lean_object *);
extern uint8_t lean_bridge_b93734338d8f12ed96612e52_graph_refinement_0_ee78e99abfc85cedd28d(lean_object *);
extern uint8_t lean_bridge_c2c1eed7ec1642970f377b9b_graph_refinement_0_7214b53bf51ec9b2e7dc(lean_object *);
extern uint8_t lean_bridge_c2c1eed7ec1642970f377b9b_graph_refinement_0_f876f341e734dd025087(lean_object *);
extern uint8_t lean_bridge_d471b4117ccac362de6872c5_graph_refinement_0_dcb8ec285e33c1c5011c(lean_object *);
extern uint8_t lean_bridge_d471b4117ccac362de6872c5_graph_refinement_0_ee78e99abfc85cedd28d(lean_object *);
static const uint32_t ng_fin_4e07408562bedb8b60ce[1] = {0x3u};
static uint32_t ng_refinement_25228c26dc888db78c39(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_848388c199729b35464b(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_44d01e607fc688c0e5ca(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_d0a1b4171aa2a456c0d6(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_7e8465363e9a82e816e5(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_b8b4a71a6cfe3a09d858(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_cc287693354037c990c3(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_6d84ceb4d6c255e9ef75(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_f05e6b3ab0347841b0e0(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_eaf46c249a08b4f402e4(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_4c0ff5280f4c84265414(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_07bab277a7677e7f9498(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_bb13cacdce3c3ebcebd0(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3a49db1113c376a3f427(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_0ec5c1376a2bd031e0d9(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_1980a530ee287c1c5931(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_a400331a14432f273ef4(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3dc66426c44e7238b330(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_b7c419109d6a43b337d8(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_7636e57f91d4e4c13acc(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_b8ab7f552c92a2889811(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_4da7f1bfc0a819470cdc(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_612a0e4ca267983754ff(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_7f63572197ca6a58fb5a(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_0cfef7b4a59c38eb0f62(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_17fbdd80374b9ec3b619(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_aaac017f3c68ff608b0a(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_d198fe904fe54a45dcd1(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_91342570dc5d36e802d3(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_daaeb566f1b79f4b7404(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_bf989b4133889b4d2201(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_5ea2953e2a4d174cb5b6(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_0c82d3af68301b4a961a(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_3bcb8f7fc3f94cad81d3(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_97db0558076283880dd9(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_6a6fc6d5ba7e33e75161(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_4b2e0a87293d1fc8df3f(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_f714cac87700198dc387(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_8e2a7f0f07fcbd56252a(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_195aa2cd70a1632e3141(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_d7ef611b661559faaa1a(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_494bd8150328914e0a60(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_cb0b369566af4ca55e11(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_4775e59c8caca6b77a87(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_599e40431d9cba03001d(const mutualcheckedrecords_envelope_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_6e91a878acf1cccd64ef(const mutualcheckedrecords_scalar_nat_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_f3e5fee3b47d93bd67e4(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, uint32_t, uint32_t *);
static uint32_t ng_refinement_27a90d3fd4ccb97c7149(const mutualcheckedrecords_step_t *, uint32_t, uint32_t *);
#include "lean_bridge_native_runtime.h"
#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1
#error "native graph calls require the retirement-aware shared runtime"
#endif
extern lean_object *initialize_LeanBridgeNative4ca822048b145659(uint8_t);
static void *ng_initialize(uint8_t builtin) { return initialize_LeanBridgeNative4ca822048b145659(builtin); }
static int ng_ready(void) { return lean_bridge_native_component_ready("mutualcheckedrecords@1.0.0"); }
static inline uint32_t ng_6586a61fcab9df3e21b7_check(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *, size_t, int, ng_budget *);
static inline lean_object *ng_6586a61fcab9df3e21b7_in(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *);
static inline uint32_t ng_6586a61fcab9df3e21b7_out(mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_65957f8f9adac4e8a249_make(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_65957f8f9adac4e8a249_items(lean_object *);
static inline uint32_t ng_c8c78faf2eecb4e21389_check(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *, size_t, int, ng_budget *);
static inline lean_object *ng_c8c78faf2eecb4e21389_in(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *);
static inline uint32_t ng_c8c78faf2eecb4e21389_out(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_branch(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_none(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_make0(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_field0(lean_object *);
static inline uint32_t ng_d2fe45ba488df4ece96d_check(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, size_t, int, ng_budget *);
static inline lean_object *ng_d2fe45ba488df4ece96d_in(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *);
static inline uint32_t ng_d2fe45ba488df4ece96d_out(mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_branch(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_none(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_make0(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_field0(lean_object *);
static inline uint32_t ng_00942ba3f21d5f6f3a2e_check(const mutualcheckedrecords_envelope_t *, size_t, int, ng_budget *);
static inline lean_object *ng_00942ba3f21d5f6f3a2e_in(const mutualcheckedrecords_envelope_t *);
static inline uint32_t ng_00942ba3f21d5f6f3a2e_out(mutualcheckedrecords_envelope_t *, lean_object *, size_t, ng_arena *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_make(lean_object *, lean_object *, lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field0(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field1(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field2(lean_object *);
static inline uint32_t ng_ff9842f01b12b4add025_check(const mutualcheckedrecords_step_t *, size_t, int, ng_budget *);
static inline lean_object *ng_ff9842f01b12b4add025_in(const mutualcheckedrecords_step_t *);
static inline uint32_t ng_ff9842f01b12b4add025_out(mutualcheckedrecords_step_t *, lean_object *, size_t, ng_arena *);
extern uint32_t lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_branch(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_make0(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_make1(lean_object *);
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_case1_field0(lean_object *);
static inline uint32_t ng_5f971a64123919686824_check(const mutualcheckedrecords_scalar_nat_t *, size_t, int, ng_budget *);
static inline lean_object *ng_5f971a64123919686824_in(const mutualcheckedrecords_scalar_nat_t *);
static inline uint32_t ng_5f971a64123919686824_out(mutualcheckedrecords_scalar_nat_t *, lean_object *, size_t, ng_arena *);
static inline uint32_t ng_6586a61fcab9df3e21b7_check(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 0, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->length > budget->nodes) return NG_LIMIT;
  status = ng_span(value->data, value->length, sizeof(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t), _Alignof(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t), budget);
  if (status) return status;
  for (size_t i = 0; i < value->length; ++i) if ((status = ng_c8c78faf2eecb4e21389_check(value->data + i, depth + 1, 0, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_6586a61fcab9df3e21b7_in(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(items, i, ng_c8c78faf2eecb4e21389_in(value->data + i));
  return lean_bridge_b93734338d8f12ed96612e52_recursive_65957f8f9adac4e8a249_make(items);
}
static inline uint32_t ng_6586a61fcab9df3e21b7_out(mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  value = lean_bridge_b93734338d8f12ed96612e52_recursive_65957f8f9adac4e8a249_items(value);
  if (lean_is_scalar(value) || !lean_is_array(value)) { lean_dec(value); return NG_RESULT; }
  size_t count = lean_array_size(value);
  if (count > arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  void *raw;
  uint32_t status = ng_allocate(arena, count, sizeof(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t), &raw);
  out->data = raw; out->length = count; mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *data = raw;
  for (size_t i = 0; !status && i < count; ++i) {
    lean_object *child = lean_array_get_core(value, i); lean_inc(child);
    status = ng_c8c78faf2eecb4e21389_out(data + i, child, depth + 1, arena);
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_c8c78faf2eecb4e21389_check(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 1, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->has_value > 1) return NG_INVALID;
  if (value->has_value) {
  if ((status = ng_00942ba3f21d5f6f3a2e_check(&value->value, depth + 1, 0, budget))) return status;
  }
  return NG_OK;
}
static inline lean_object *ng_c8c78faf2eecb4e21389_in(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value) {
  (void)value; LB_GRAPH_DECODE();
  if (!value->has_value) return lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_none(lean_box(0));
  if (value->has_value) return lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_make0(ng_00942ba3f21d5f6f3a2e_in(&value->value));
  return lean_alloc_array(0, 0);
}
static inline uint32_t ng_c8c78faf2eecb4e21389_out(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_branch(value);
  if (branch > 1) { lean_dec(value); return NG_RESULT; }
  out->has_value = branch;
  uint32_t status = NG_OK;
  if (out->has_value) {
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_00942ba3f21d5f6f3a2e_out(&out->value, lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_field0(value), depth + 1, arena);
    }
  }
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_d2fe45ba488df4ece96d_check(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 2, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if (value->has_value > 1) return NG_INVALID;
  if (value->has_value) {
  if ((status = ng_ff9842f01b12b4add025_check(value->value, depth + 1, 1, budget))) return status;
  }
  return NG_OK;
}
static inline lean_object *ng_d2fe45ba488df4ece96d_in(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value) {
  (void)value; LB_GRAPH_DECODE();
  if (!value->has_value) return lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_none(lean_box(0));
  if (value->has_value) return lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_make0(ng_ff9842f01b12b4add025_in(value->value));
  return lean_alloc_array(0, 0);
}
static inline uint32_t ng_d2fe45ba488df4ece96d_out(mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_branch(value);
  if (branch > 1) { lean_dec(value); return NG_RESULT; }
  out->has_value = branch;
  uint32_t status = NG_OK;
  if (out->has_value) {
  if (!status) {
    void *raw;
    status = ng_allocate(arena, 1, sizeof(mutualcheckedrecords_step_t), &raw);
    out->value = raw;
    if (!status) {
      lean_inc(value);
      status = ng_ff9842f01b12b4add025_out(raw, lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_field0(value), depth + 1, arena);
    }
  }
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *ng_00942ba3f21d5f6f3a2e_make(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_object *a1 = lean_array_get_core(items, 1); lean_inc(a1);
  lean_object *a2 = lean_array_get_core(items, 2); lean_inc(a2);
  lean_dec(items);
  return lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_make(a0, a1, a2);
}
static inline uint32_t ng_00942ba3f21d5f6f3a2e_check(const mutualcheckedrecords_envelope_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(mutualcheckedrecords_envelope_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 3, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  if ((status = ng_5f971a64123919686824_check(&value->value, depth + 1, 0, budget))) return status;
  if ((status = ng_5f971a64123919686824_check(&value->mode, depth + 1, 0, budget))) return status;
  if ((status = ng_d2fe45ba488df4ece96d_check(value->next, depth + 1, 1, budget))) return status;
  return NG_OK;
}
static inline lean_object *ng_00942ba3f21d5f6f3a2e_in(const mutualcheckedrecords_envelope_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *items = lean_alloc_array(3, 3);
  lean_array_set_core(items, 0, ng_5f971a64123919686824_in(&value->value));
  lean_array_set_core(items, 1, ng_5f971a64123919686824_in(&value->mode));
  lean_array_set_core(items, 2, ng_d2fe45ba488df4ece96d_in(value->next));
  return ng_00942ba3f21d5f6f3a2e_make(items);
}
static inline uint32_t ng_00942ba3f21d5f6f3a2e_out(mutualcheckedrecords_envelope_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  uint32_t status = NG_OK;
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->value, lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field0(value), depth + 1, arena);
    }
  }
  if (!status) {
    if (!status) {
      lean_inc(value);
      status = ng_5f971a64123919686824_out(&out->mode, lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field1(value), depth + 1, arena);
    }
  }
  if (!status) {
    void *raw;
    status = ng_allocate(arena, 1, sizeof(mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t), &raw);
    out->next = raw;
    if (!status) {
      lean_inc(value);
      status = ng_d2fe45ba488df4ece96d_out(raw, lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field2(value), depth + 1, arena);
    }
  }
  lean_dec(value); return status;
}
__attribute__((noinline)) static lean_object *ng_ff9842f01b12b4add025_make1(lean_object *items) {
  lean_object *a0 = lean_array_get_core(items, 0); lean_inc(a0);
  lean_dec(items);
  return lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_make1(a0);
}
static inline uint32_t ng_ff9842f01b12b4add025_check(const mutualcheckedrecords_step_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(mutualcheckedrecords_step_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 4, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  switch (value->kind) {
  case 0:
  break;
  case 1:
  if ((status = ng_00942ba3f21d5f6f3a2e_check(value->cases.more.packet, depth + 1, 1, budget))) return status;
  break;
  default: return NG_INVALID;
  }
  return NG_OK;
}
static inline lean_object *ng_ff9842f01b12b4add025_in(const mutualcheckedrecords_step_t *value) {
  (void)value; LB_GRAPH_DECODE();
  switch (value->kind) {
  case 0: {
  return lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_make0(lean_box(0));
  }
  case 1: {
  lean_object *items = lean_alloc_array(1, 1);
  lean_array_set_core(items, 0, ng_00942ba3f21d5f6f3a2e_in(value->cases.more.packet));
  return ng_ff9842f01b12b4add025_make1(items);
  }
  default: return lean_alloc_array(0, 0);
  }
}
static inline uint32_t ng_ff9842f01b12b4add025_out(mutualcheckedrecords_step_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_inc(value);
  uint32_t branch = lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_branch(value), status = NG_OK;
  out->kind = branch;
  switch (branch) {
  case 0: {
  break;
  }
  case 1: {
  if (!status) {
    void *raw;
    status = ng_allocate(arena, 1, sizeof(mutualcheckedrecords_envelope_t), &raw);
    out->cases.more.packet = raw;
    if (!status) {
      lean_inc(value);
      status = ng_00942ba3f21d5f6f3a2e_out(raw, lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_case1_field0(value), depth + 1, arena);
    }
  }
  break;
  }
  default: status = NG_RESULT;
  }
  lean_dec(value); return status;
}
static inline uint32_t ng_5f971a64123919686824_check(const mutualcheckedrecords_scalar_nat_t *value, size_t depth, int storage, ng_budget *budget) {
  if (!ng_pointer(value, sizeof(*value), _Alignof(mutualcheckedrecords_scalar_nat_t))) return NG_INVALID;
  uint32_t status = ng_enter(value, 5, depth, budget);
  if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));
  if (status) return status;
  status = ng_span(value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t), budget);
  if (status) return status;
  return NG_OK;
}
static inline lean_object *ng_5f971a64123919686824_in(const mutualcheckedrecords_scalar_nat_t *value) {
  (void)value; LB_GRAPH_DECODE();
  lean_object *carrier = lean_alloc_array(1, 1);
  lean_array_set_core(carrier, 0, ng_nat_in(value->data, value->length));
  return carrier;
}
static inline uint32_t ng_5f971a64123919686824_out(mutualcheckedrecords_scalar_nat_t *out, lean_object *value, size_t depth, ng_arena *arena) {
  (void)out; value = LB_GRAPH_ENCODE(value);
  if (depth > 128 || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }
  --arena->budget->nodes;
  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }
  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);
  uint32_t status = NG_OK;
  status = ng_nat_out(child, arena, &out->data, &out->length);
  lean_dec(child); return status;
}
static uint32_t ng_refinement_25228c26dc888db78c39(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark0 = ng_refinement_mark();
  if (!ng_refinement_text(".mode", sizeof(".mode") - 1)) return NG_LIMIT;
  uint32_t status0 = ng_refinement_848388c199729b35464b(&value->mode, depth + 1, nodes);
  if (status0) return status0;
  ng_refinement_restore(mark0);
  size_t mark3 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status3 = ng_refinement_44d01e607fc688c0e5ca(value->next, depth + 1, nodes);
  if (status3) return status3;
  ng_refinement_restore(mark3);
  return NG_OK;
}
static uint32_t ng_refinement_848388c199729b35464b(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_44d01e607fc688c0e5ca(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark2 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status2 = ng_refinement_d0a1b4171aa2a456c0d6(value->value, depth + 1, nodes);
    if (status2) return status2;
    ng_refinement_restore(mark2);
  }
  return NG_OK;
}
static uint32_t ng_refinement_d0a1b4171aa2a456c0d6(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark1 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status1 = ng_refinement_25228c26dc888db78c39(value->cases.more.packet, depth + 1, nodes);
    if (status1) return status1;
    ng_refinement_restore(mark1);
  }
  return NG_OK;
}
static uint32_t ng_refinement_7e8465363e9a82e816e5(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark4 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status4 = ng_refinement_b8b4a71a6cfe3a09d858(&value->value, depth + 1, nodes);
  if (status4) return status4;
  ng_refinement_restore(mark4);
  size_t mark7 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status7 = ng_refinement_cc287693354037c990c3(value->next, depth + 1, nodes);
  if (status7) return status7;
  ng_refinement_restore(mark7);
  if (!lean_bridge_b93734338d8f12ed96612e52_graph_refinement_0_ee78e99abfc85cedd28d(ng_00942ba3f21d5f6f3a2e_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.mkEnvelope");
  return NG_OK;
}
static uint32_t ng_refinement_b8b4a71a6cfe3a09d858(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_b93734338d8f12ed96612e52_graph_refinement_0_dcb8ec285e33c1c5011c(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_cc287693354037c990c3(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark6 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status6 = ng_refinement_6d84ceb4d6c255e9ef75(value->value, depth + 1, nodes);
    if (status6) return status6;
    ng_refinement_restore(mark6);
  }
  return NG_OK;
}
static uint32_t ng_refinement_6d84ceb4d6c255e9ef75(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark5 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status5 = ng_refinement_7e8465363e9a82e816e5(value->cases.more.packet, depth + 1, nodes);
    if (status5) return status5;
    ng_refinement_restore(mark5);
  }
  return NG_OK;
}
static uint32_t ng_refinement_f05e6b3ab0347841b0e0(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i13 = 0; i13 < value->length; ++i13) {
    size_t mark14 = ng_refinement_mark();
    if (!ng_refinement_index(i13)) return NG_LIMIT;
    uint32_t status14 = ng_refinement_eaf46c249a08b4f402e4(value->data + i13, depth + 1, nodes);
    if (status14) return status14;
    ng_refinement_restore(mark14);
  }
  return NG_OK;
}
static uint32_t ng_refinement_eaf46c249a08b4f402e4(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark12 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status12 = ng_refinement_4c0ff5280f4c84265414(&value->value, depth + 1, nodes);
    if (status12) return status12;
    ng_refinement_restore(mark12);
  }
  return NG_OK;
}
static uint32_t ng_refinement_4c0ff5280f4c84265414(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark8 = ng_refinement_mark();
  if (!ng_refinement_text(".mode", sizeof(".mode") - 1)) return NG_LIMIT;
  uint32_t status8 = ng_refinement_07bab277a7677e7f9498(&value->mode, depth + 1, nodes);
  if (status8) return status8;
  ng_refinement_restore(mark8);
  size_t mark11 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status11 = ng_refinement_bb13cacdce3c3ebcebd0(value->next, depth + 1, nodes);
  if (status11) return status11;
  ng_refinement_restore(mark11);
  return NG_OK;
}
static uint32_t ng_refinement_07bab277a7677e7f9498(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_bb13cacdce3c3ebcebd0(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark10 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status10 = ng_refinement_3a49db1113c376a3f427(value->value, depth + 1, nodes);
    if (status10) return status10;
    ng_refinement_restore(mark10);
  }
  return NG_OK;
}
static uint32_t ng_refinement_3a49db1113c376a3f427(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark9 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status9 = ng_refinement_4c0ff5280f4c84265414(value->cases.more.packet, depth + 1, nodes);
    if (status9) return status9;
    ng_refinement_restore(mark9);
  }
  return NG_OK;
}
static uint32_t ng_refinement_0ec5c1376a2bd031e0d9(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i20 = 0; i20 < value->length; ++i20) {
    size_t mark21 = ng_refinement_mark();
    if (!ng_refinement_index(i20)) return NG_LIMIT;
    uint32_t status21 = ng_refinement_1980a530ee287c1c5931(value->data + i20, depth + 1, nodes);
    if (status21) return status21;
    ng_refinement_restore(mark21);
  }
  return NG_OK;
}
static uint32_t ng_refinement_1980a530ee287c1c5931(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark19 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status19 = ng_refinement_a400331a14432f273ef4(&value->value, depth + 1, nodes);
    if (status19) return status19;
    ng_refinement_restore(mark19);
  }
  return NG_OK;
}
static uint32_t ng_refinement_a400331a14432f273ef4(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark15 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status15 = ng_refinement_3dc66426c44e7238b330(&value->value, depth + 1, nodes);
  if (status15) return status15;
  ng_refinement_restore(mark15);
  size_t mark18 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status18 = ng_refinement_b7c419109d6a43b337d8(value->next, depth + 1, nodes);
  if (status18) return status18;
  ng_refinement_restore(mark18);
  if (!lean_bridge_c2c1eed7ec1642970f377b9b_graph_refinement_0_f876f341e734dd025087(ng_00942ba3f21d5f6f3a2e_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.normalizeEnvelope");
  return NG_OK;
}
static uint32_t ng_refinement_3dc66426c44e7238b330(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_c2c1eed7ec1642970f377b9b_graph_refinement_0_7214b53bf51ec9b2e7dc(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.plusTwo");
  return NG_OK;
}
static uint32_t ng_refinement_b7c419109d6a43b337d8(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark17 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status17 = ng_refinement_7636e57f91d4e4c13acc(value->value, depth + 1, nodes);
    if (status17) return status17;
    ng_refinement_restore(mark17);
  }
  return NG_OK;
}
static uint32_t ng_refinement_7636e57f91d4e4c13acc(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark16 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status16 = ng_refinement_a400331a14432f273ef4(value->cases.more.packet, depth + 1, nodes);
    if (status16) return status16;
    ng_refinement_restore(mark16);
  }
  return NG_OK;
}
static uint32_t ng_refinement_b8ab7f552c92a2889811(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark22 = ng_refinement_mark();
  if (!ng_refinement_text(".mode", sizeof(".mode") - 1)) return NG_LIMIT;
  uint32_t status22 = ng_refinement_4da7f1bfc0a819470cdc(&value->mode, depth + 1, nodes);
  if (status22) return status22;
  ng_refinement_restore(mark22);
  size_t mark25 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status25 = ng_refinement_612a0e4ca267983754ff(value->next, depth + 1, nodes);
  if (status25) return status25;
  ng_refinement_restore(mark25);
  return NG_OK;
}
static uint32_t ng_refinement_4da7f1bfc0a819470cdc(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_612a0e4ca267983754ff(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark24 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status24 = ng_refinement_7f63572197ca6a58fb5a(value->value, depth + 1, nodes);
    if (status24) return status24;
    ng_refinement_restore(mark24);
  }
  return NG_OK;
}
static uint32_t ng_refinement_7f63572197ca6a58fb5a(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark23 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status23 = ng_refinement_b8ab7f552c92a2889811(value->cases.more.packet, depth + 1, nodes);
    if (status23) return status23;
    ng_refinement_restore(mark23);
  }
  return NG_OK;
}
static uint32_t ng_refinement_0cfef7b4a59c38eb0f62(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark26 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status26 = ng_refinement_17fbdd80374b9ec3b619(&value->value, depth + 1, nodes);
  if (status26) return status26;
  ng_refinement_restore(mark26);
  size_t mark29 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status29 = ng_refinement_aaac017f3c68ff608b0a(value->next, depth + 1, nodes);
  if (status29) return status29;
  ng_refinement_restore(mark29);
  if (!lean_bridge_d471b4117ccac362de6872c5_graph_refinement_0_ee78e99abfc85cedd28d(ng_00942ba3f21d5f6f3a2e_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.mkEnvelope");
  return NG_OK;
}
static uint32_t ng_refinement_17fbdd80374b9ec3b619(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_d471b4117ccac362de6872c5_graph_refinement_0_dcb8ec285e33c1c5011c(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_aaac017f3c68ff608b0a(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark28 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status28 = ng_refinement_d198fe904fe54a45dcd1(value->value, depth + 1, nodes);
    if (status28) return status28;
    ng_refinement_restore(mark28);
  }
  return NG_OK;
}
static uint32_t ng_refinement_d198fe904fe54a45dcd1(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark27 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status27 = ng_refinement_0cfef7b4a59c38eb0f62(value->cases.more.packet, depth + 1, nodes);
    if (status27) return status27;
    ng_refinement_restore(mark27);
  }
  return NG_OK;
}
static uint32_t ng_refinement_91342570dc5d36e802d3(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i35 = 0; i35 < value->length; ++i35) {
    size_t mark36 = ng_refinement_mark();
    if (!ng_refinement_index(i35)) return NG_LIMIT;
    uint32_t status36 = ng_refinement_daaeb566f1b79f4b7404(value->data + i35, depth + 1, nodes);
    if (status36) return status36;
    ng_refinement_restore(mark36);
  }
  return NG_OK;
}
static uint32_t ng_refinement_daaeb566f1b79f4b7404(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark34 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status34 = ng_refinement_bf989b4133889b4d2201(&value->value, depth + 1, nodes);
    if (status34) return status34;
    ng_refinement_restore(mark34);
  }
  return NG_OK;
}
static uint32_t ng_refinement_bf989b4133889b4d2201(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark30 = ng_refinement_mark();
  if (!ng_refinement_text(".mode", sizeof(".mode") - 1)) return NG_LIMIT;
  uint32_t status30 = ng_refinement_5ea2953e2a4d174cb5b6(&value->mode, depth + 1, nodes);
  if (status30) return status30;
  ng_refinement_restore(mark30);
  size_t mark33 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status33 = ng_refinement_0c82d3af68301b4a961a(value->next, depth + 1, nodes);
  if (status33) return status33;
  ng_refinement_restore(mark33);
  return NG_OK;
}
static uint32_t ng_refinement_5ea2953e2a4d174cb5b6(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_0c82d3af68301b4a961a(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark32 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status32 = ng_refinement_3bcb8f7fc3f94cad81d3(value->value, depth + 1, nodes);
    if (status32) return status32;
    ng_refinement_restore(mark32);
  }
  return NG_OK;
}
static uint32_t ng_refinement_3bcb8f7fc3f94cad81d3(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark31 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status31 = ng_refinement_bf989b4133889b4d2201(value->cases.more.packet, depth + 1, nodes);
    if (status31) return status31;
    ng_refinement_restore(mark31);
  }
  return NG_OK;
}
static uint32_t ng_refinement_97db0558076283880dd9(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  for (size_t i42 = 0; i42 < value->length; ++i42) {
    size_t mark43 = ng_refinement_mark();
    if (!ng_refinement_index(i42)) return NG_LIMIT;
    uint32_t status43 = ng_refinement_6a6fc6d5ba7e33e75161(value->data + i42, depth + 1, nodes);
    if (status43) return status43;
    ng_refinement_restore(mark43);
  }
  return NG_OK;
}
static uint32_t ng_refinement_6a6fc6d5ba7e33e75161(const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark41 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status41 = ng_refinement_4b2e0a87293d1fc8df3f(&value->value, depth + 1, nodes);
    if (status41) return status41;
    ng_refinement_restore(mark41);
  }
  return NG_OK;
}
static uint32_t ng_refinement_4b2e0a87293d1fc8df3f(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark37 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status37 = ng_refinement_f714cac87700198dc387(&value->value, depth + 1, nodes);
  if (status37) return status37;
  ng_refinement_restore(mark37);
  size_t mark40 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status40 = ng_refinement_8e2a7f0f07fcbd56252a(value->next, depth + 1, nodes);
  if (status40) return status40;
  ng_refinement_restore(mark40);
  if (!lean_bridge_80dc06e94320d76de7e8afc6_graph_refinement_0_ee78e99abfc85cedd28d(ng_00942ba3f21d5f6f3a2e_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.mkEnvelope");
  return NG_OK;
}
static uint32_t ng_refinement_f714cac87700198dc387(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_80dc06e94320d76de7e8afc6_graph_refinement_0_dcb8ec285e33c1c5011c(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.plusOne");
  return NG_OK;
}
static uint32_t ng_refinement_8e2a7f0f07fcbd56252a(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark39 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status39 = ng_refinement_195aa2cd70a1632e3141(value->value, depth + 1, nodes);
    if (status39) return status39;
    ng_refinement_restore(mark39);
  }
  return NG_OK;
}
static uint32_t ng_refinement_195aa2cd70a1632e3141(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark38 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status38 = ng_refinement_4b2e0a87293d1fc8df3f(value->cases.more.packet, depth + 1, nodes);
    if (status38) return status38;
    ng_refinement_restore(mark38);
  }
  return NG_OK;
}
static uint32_t ng_refinement_d7ef611b661559faaa1a(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark44 = ng_refinement_mark();
  if (!ng_refinement_text(".mode", sizeof(".mode") - 1)) return NG_LIMIT;
  uint32_t status44 = ng_refinement_494bd8150328914e0a60(&value->mode, depth + 1, nodes);
  if (status44) return status44;
  ng_refinement_restore(mark44);
  size_t mark47 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status47 = ng_refinement_cb0b369566af4ca55e11(value->next, depth + 1, nodes);
  if (status47) return status47;
  ng_refinement_restore(mark47);
  return NG_OK;
}
static uint32_t ng_refinement_494bd8150328914e0a60(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!ng_fin_below(value->data, value->length, ng_fin_4e07408562bedb8b60ce, 1))
    return ng_refinement_reject(" is not below its Fin 3 bound");
  return NG_OK;
}
static uint32_t ng_refinement_cb0b369566af4ca55e11(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark46 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status46 = ng_refinement_4775e59c8caca6b77a87(value->value, depth + 1, nodes);
    if (status46) return status46;
    ng_refinement_restore(mark46);
  }
  return NG_OK;
}
static uint32_t ng_refinement_4775e59c8caca6b77a87(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark45 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status45 = ng_refinement_d7ef611b661559faaa1a(value->cases.more.packet, depth + 1, nodes);
    if (status45) return status45;
    ng_refinement_restore(mark45);
  }
  return NG_OK;
}
static uint32_t ng_refinement_599e40431d9cba03001d(const mutualcheckedrecords_envelope_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  size_t mark48 = ng_refinement_mark();
  if (!ng_refinement_text(".value", sizeof(".value") - 1)) return NG_LIMIT;
  uint32_t status48 = ng_refinement_6e91a878acf1cccd64ef(&value->value, depth + 1, nodes);
  if (status48) return status48;
  ng_refinement_restore(mark48);
  size_t mark51 = ng_refinement_mark();
  if (!ng_refinement_text(".next", sizeof(".next") - 1)) return NG_LIMIT;
  uint32_t status51 = ng_refinement_f3e5fee3b47d93bd67e4(value->next, depth + 1, nodes);
  if (status51) return status51;
  ng_refinement_restore(mark51);
  if (!lean_bridge_84236b8271f83e0e4db02cf4_graph_refinement_0_f876f341e734dd025087(ng_00942ba3f21d5f6f3a2e_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.normalizeEnvelope");
  return NG_OK;
}
static uint32_t ng_refinement_6e91a878acf1cccd64ef(const mutualcheckedrecords_scalar_nat_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (!lean_bridge_84236b8271f83e0e4db02cf4_graph_refinement_0_7214b53bf51ec9b2e7dc(ng_5f971a64123919686824_in(value)))
    return ng_refinement_reject(" was rejected by MutualCheckedRecords.plusTwo");
  return NG_OK;
}
static uint32_t ng_refinement_f3e5fee3b47d93bd67e4(const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->has_value) {
    size_t mark50 = ng_refinement_mark();
    if (!ng_refinement_text("?", sizeof("?") - 1)) return NG_LIMIT;
    uint32_t status50 = ng_refinement_27a90d3fd4ccb97c7149(value->value, depth + 1, nodes);
    if (status50) return status50;
    ng_refinement_restore(mark50);
  }
  return NG_OK;
}
static uint32_t ng_refinement_27a90d3fd4ccb97c7149(const mutualcheckedrecords_step_t *value, uint32_t depth, uint32_t *nodes) {
  if (depth > 128 || !*nodes) return NG_LIMIT;
  --*nodes;
  if (value->kind == 1u) {
    size_t mark49 = ng_refinement_mark();
    if (!ng_refinement_text(".more.packet", sizeof(".more.packet") - 1)) return NG_LIMIT;
    uint32_t status49 = ng_refinement_599e40431d9cba03001d(value->cases.more.packet, depth + 1, nodes);
    if (status49) return status49;
    ng_refinement_restore(mark49);
  }
  return NG_OK;
}
extern lean_object *lean_bridge_b93734338d8f12ed96612e52_lean(lean_object *);
uint32_t mutualcheckedrecords_echo_graph(const mutualcheckedrecords_envelope_t *a0, mutualcheckedrecords_envelope_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(mutualcheckedrecords_envelope_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_00942ba3f21d5f6f3a2e_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_25228c26dc888db78c39(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_7e8465363e9a82e816e5(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("mutualcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_00942ba3f21d5f6f3a2e_in(a0);
  lean_object *value = lean_bridge_b93734338d8f12ed96612e52_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  mutualcheckedrecords_envelope_t result = {0};
  status = ng_00942ba3f21d5f6f3a2e_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_c2c1eed7ec1642970f377b9b_lean(lean_object *);
uint32_t mutualcheckedrecords_echo_groups_graph(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *a0, mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_6586a61fcab9df3e21b7_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_f05e6b3ab0347841b0e0(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_0ec5c1376a2bd031e0d9(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("mutualcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_6586a61fcab9df3e21b7_in(a0);
  lean_object *value = lean_bridge_c2c1eed7ec1642970f377b9b_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t result = {0};
  status = ng_6586a61fcab9df3e21b7_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_d471b4117ccac362de6872c5_lean(lean_object *);
uint32_t mutualcheckedrecords_first_graph(const mutualcheckedrecords_envelope_t *a0, mutualcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(mutualcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_00942ba3f21d5f6f3a2e_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_b8ab7f552c92a2889811(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_0cfef7b4a59c38eb0f62(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("mutualcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_00942ba3f21d5f6f3a2e_in(a0);
  lean_object *value = lean_bridge_d471b4117ccac362de6872c5_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  mutualcheckedrecords_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_80dc06e94320d76de7e8afc6_lean(lean_object *);
uint32_t mutualcheckedrecords_groups_graph(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *a0, mutualcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(mutualcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_6586a61fcab9df3e21b7_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_91342570dc5d36e802d3(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_97db0558076283880dd9(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("mutualcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_6586a61fcab9df3e21b7_in(a0);
  lean_object *value = lean_bridge_80dc06e94320d76de7e8afc6_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  mutualcheckedrecords_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_f1dd7ff5b67060930f091dae_lean(lean_object *);
uint32_t mutualcheckedrecords_produce_graph(const mutualcheckedrecords_scalar_nat_t *a0, mutualcheckedrecords_envelope_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(mutualcheckedrecords_envelope_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_5f971a64123919686824_check(a0, 0, 1, &budget))) return status;
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("mutualcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_5f971a64123919686824_in(a0);
  lean_object *value = lean_bridge_f1dd7ff5b67060930f091dae_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  mutualcheckedrecords_envelope_t result = {0};
  status = ng_00942ba3f21d5f6f3a2e_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
extern lean_object *lean_bridge_84236b8271f83e0e4db02cf4_lean(lean_object *);
uint32_t mutualcheckedrecords_second_graph(const mutualcheckedrecords_envelope_t *a0, mutualcheckedrecords_scalar_nat_t *out) {
  ng_refinement_reset();
  if (!ng_pointer(out, sizeof(*out), _Alignof(mutualcheckedrecords_scalar_nat_t))) return NG_INVALID;
  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;
  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144, .path = {{0}} };
  uint32_t status;
  if ((status = ng_00942ba3f21d5f6f3a2e_check(a0, 0, 1, &budget))) return status;
  uint32_t refinement_nodes = 262144;
  size_t refinement_mark_0_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_d7ef611b661559faaa1a(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_0_0);
  refinement_nodes = 262144;
  size_t refinement_mark_1_0 = ng_refinement_mark();
  if (!ng_refinement_text("arg0", sizeof("arg0") - 1)) return NG_LIMIT;
  if ((status = ng_refinement_599e40431d9cba03001d(a0, 0, &refinement_nodes))) return status;
  ng_refinement_restore(refinement_mark_1_0);
  ng_refinement_reset();
  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;
  if (!budget.nodes) return NG_LIMIT;
  if (!lean_bridge_native_component_initialize("mutualcheckedrecords@1.0.0", ng_initialize)) return NG_RUNTIME;
  ng_arena arena = { .head = NULL, .budget = &budget };
  lean_object *v0 = ng_00942ba3f21d5f6f3a2e_in(a0);
  lean_object *value = lean_bridge_84236b8271f83e0e4db02cf4_lean(v0);
  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }
  mutualcheckedrecords_scalar_nat_t result = {0};
  status = ng_5f971a64123919686824_out(&result, value, 0, &arena);
  if (status == NG_RESULT) lean_bridge_native_runtime_retire();
  if (status) { ng_release(arena.head); return status; }
  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }
  result._bridge_owner = arena.head;
  result._bridge_release = arena.head ? ng_release : NULL;
  *out = result; return NG_OK;
}
uint32_t mutualcheckedrecords_graph_initialize(void) { return lean_bridge_native_component_initialize("mutualcheckedrecords@1.0.0", ng_initialize) ? 0 : 5; }
int mutualcheckedrecords_graph_ready(void) { return ng_ready(); }
void mutualcheckedrecords_graph_retire(void) { lean_bridge_native_runtime_retire(); }
__attribute__((destructor)) static void lb_graph_detach(void) { lean_bridge_native_component_detach("mutualcheckedrecords@1.0.0"); }
