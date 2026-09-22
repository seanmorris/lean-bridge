/* Test-only interposition around copied output allocations. Lean's own heap
   remains real. The ledger checks that generated rollback clears each owned
   copied allocation exactly once, even when a nested encoder fails. */
#include "component_scalar.h"
#include <assert.h>
#include <string.h>

static uint32_t recursive_test_enabled, recursive_test_fail, recursive_test_calls;
static uint32_t recursive_test_decoded;
static uint32_t recursive_test_pointers[4096], recursive_test_count;

static void recursive_test_track(bridge_scalar_slot const *slot) {
  if (!recursive_test_enabled || !(slot->flags & 2u)) return;
  uint32_t pointer = (uint32_t)slot->bits;
  assert(pointer && recursive_test_count < 4096);
  for (uint32_t i = 0; i < recursive_test_count; ++i) assert(recursive_test_pointers[i] != pointer);
  recursive_test_pointers[recursive_test_count++] = pointer;
}

static void recursive_test_forget(bridge_scalar_slot const *slot) {
  if (!recursive_test_enabled || !(slot->flags & 2u)) return;
  uint32_t pointer = (uint32_t)slot->bits, found = UINT32_MAX;
  for (uint32_t i = 0; i < recursive_test_count; ++i) if (recursive_test_pointers[i] == pointer) found = i;
  assert(found != UINT32_MAX);
  if (slot->kind >= 32 && slot->kind <= 37) {
    bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)pointer;
    for (uint32_t i = 0; i < (slot->bits >> 32); ++i) recursive_test_forget(children + i);
  }
  /* Descendants may swap indices while removing their entries. */
  for (uint32_t i = 0; i < recursive_test_count; ++i) if (recursive_test_pointers[i] == pointer) found = i;
  recursive_test_pointers[found] = recursive_test_pointers[--recursive_test_count];
}

static uint32_t recursive_test_children(bridge_scalar_slot *slot, uint32_t kind, uint32_t count, uint32_t branch, uint32_t *budget) {
  if (recursive_test_enabled && ++recursive_test_calls == recursive_test_fail) { memset(slot, 0, sizeof(*slot)); return 5; }
  uint32_t status = bridge_nominal_children_allocate(slot, kind, count, branch, budget);
  recursive_test_track(slot);
  return status;
}

static uint32_t recursive_test_leaf(bridge_scalar_slot *slot, uint32_t kind, lean_object *value, uint32_t *budget) {
  if (recursive_test_enabled && ++recursive_test_calls == recursive_test_fail) { lean_dec(value); memset(slot, 0, sizeof(*slot)); return 5; }
  uint32_t status = bridge_record_encode_leaf(slot, kind, value, budget);
  recursive_test_track(slot);
  return status;
}

static void recursive_test_clear(bridge_scalar_slot *slot) {
  recursive_test_forget(slot);
  bridge_record_slot_clear(slot);
}

static lean_object *recursive_test_decode(bridge_scalar_slot const *slot, uint32_t kind, uint32_t depth) {
  ++recursive_test_decoded;
  return bridge_copied_decode(slot, kind, depth);
}

LEAN_EXPORT uint32_t recursive_test_configure(bridge_scalar_frame *frame) {
  assert(!recursive_test_count);
  recursive_test_enabled = frame->args[0].flags;
  recursive_test_fail = (uint32_t)frame->args[0].bits;
  recursive_test_calls = 0;
  recursive_test_decoded = 0;
  return 0;
}

LEAN_EXPORT uint32_t recursive_test_live(bridge_scalar_frame *frame) { (void)frame; return recursive_test_count; }
LEAN_EXPORT uint32_t recursive_test_attempts(bridge_scalar_frame *frame) { (void)frame; return recursive_test_calls; }
LEAN_EXPORT uint32_t recursive_test_decodes(bridge_scalar_frame *frame) { (void)frame; return recursive_test_decoded; }
LEAN_EXPORT uint32_t recursive_test_release(bridge_scalar_frame *frame) { recursive_test_clear(&frame->result); return 0; }

#define bridge_nominal_children_allocate recursive_test_children
#define bridge_record_encode_leaf recursive_test_leaf
#define bridge_record_slot_clear recursive_test_clear
#define bridge_copied_decode recursive_test_decode
