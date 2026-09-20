#ifndef LEAN_BRIDGE_COMPONENT_SCALAR_H
#define LEAN_BRIDGE_COMPONENT_SCALAR_H
#include <stdint.h>
#include <lean/lean.h>

/* Private scalar ABI 2: little-endian slots; copied payloads are never public pointers. */
typedef struct {
  uint32_t kind;
  uint32_t flags; /* bit 0: negative magnitude; bit 1: owned output buffer */
  uint64_t bits;  /* fixed value, or low u32 pointer / high u32 element count */
} bridge_scalar_slot;
typedef struct {
  uint32_t version, bytes, status, argc;
  bridge_scalar_slot result;
  bridge_scalar_slot args[];
} bridge_scalar_frame;

#ifdef __cplusplus
extern "C" {
#endif
uint32_t bridge_scalar_frame_validate(bridge_scalar_frame *, uint32_t);
uint32_t bridge_scalar_slot_validate(bridge_scalar_slot const *, uint32_t);
uint32_t bridge_scalar_word_bits(void);
lean_object *bridge_scalar_decode_object(bridge_scalar_slot const *);
uint32_t bridge_scalar_encode_object(bridge_scalar_slot *, uint32_t, lean_object *);
uint32_t bridge_scalar_call(char const *, bridge_scalar_frame *);
void bridge_scalar_frame_clear(bridge_scalar_frame *);
/* Copied ABI 1 uses frame version 4. A shape is an array depth plus a primitive
   leaf tag. Validation charges every slot and payload to one call budget.
   Decode requires validated input; encode consumes its owned Lean reference. */
uint32_t bridge_copied_abi(void);
uint32_t bridge_copied_frame_validate(bridge_scalar_frame *, uint32_t);
uint32_t bridge_copied_validate(bridge_scalar_slot const *, uint32_t, uint32_t, uint32_t *);
lean_object *bridge_copied_decode(bridge_scalar_slot const *, uint32_t, uint32_t);
uint32_t bridge_copied_encode(bridge_scalar_slot *, uint32_t, uint32_t, lean_object *, uint32_t *);
void bridge_copied_frame_clear(bridge_scalar_frame *);
uint32_t bridge_record_abi(void);
uint32_t bridge_compound_abi(void);
uint32_t bridge_compound_frame_validate(bridge_scalar_frame *, uint32_t);
uint32_t bridge_compound_children_validate(bridge_scalar_slot const *, uint32_t, uint32_t, uint32_t *);
uint32_t bridge_compound_children_allocate(bridge_scalar_slot *, uint32_t, uint32_t, uint32_t, uint32_t *);
uint32_t bridge_record_frame_validate(bridge_scalar_frame *, uint32_t);
uint32_t bridge_record_children_validate(bridge_scalar_slot const *, uint32_t, uint32_t, uint32_t *);
uint32_t bridge_record_children_allocate(bridge_scalar_slot *, uint32_t, uint32_t, uint32_t *);
uint32_t bridge_record_encode_leaf(bridge_scalar_slot *, uint32_t, lean_object *, uint32_t *);
void bridge_record_slot_clear(bridge_scalar_slot *);
/* Callable ABI 1 shares scalar slots. Store consumes one owned Lean reference;
   invoke transfers a separately retained reference to its typed trampoline. */
typedef uint32_t (*bridge_callable_apply)(lean_object *, bridge_scalar_frame *);
uint32_t bridge_callable_abi(void);
uint32_t bridge_callable_store(lean_object *, char const *, bridge_callable_apply);
uint32_t bridge_callable_invoke(uint32_t, char const *, bridge_scalar_frame *);
uint32_t bridge_callable_release(uint32_t, char const *);
uint32_t bridge_callable_dispatch(uint32_t, char const *, bridge_scalar_frame *);
void bridge_callable_frame_clear(bridge_scalar_frame *);
#ifdef __cplusplus
}
#endif
#endif
