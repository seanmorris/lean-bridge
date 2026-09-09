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
lean_object *bridge_scalar_decode_object(bridge_scalar_slot const *);
uint32_t bridge_scalar_encode_object(bridge_scalar_slot *, uint32_t, lean_object *);
uint32_t bridge_scalar_call(char const *, bridge_scalar_frame *);
void bridge_scalar_frame_clear(bridge_scalar_frame *);
#ifdef __cplusplus
}
#endif
#endif
