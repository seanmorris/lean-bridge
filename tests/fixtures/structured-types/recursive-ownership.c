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

static void recursive_test_forget(uint32_t pointer) {
  if (!recursive_test_enabled) return;
  uint32_t found = UINT32_MAX;
  for (uint32_t i = 0; i < recursive_test_count; ++i) if (recursive_test_pointers[i] == pointer) found = i;
  assert(found != UINT32_MAX);
  recursive_test_pointers[found] = recursive_test_pointers[--recursive_test_count];
}

static uint32_t recursive_test_children(bridge_recursive_arena *owner, bridge_scalar_slot *slot, uint32_t kind, uint32_t count, uint32_t branch, uint32_t *budget) {
  if (recursive_test_enabled && ++recursive_test_calls == recursive_test_fail) { memset(slot, 0, sizeof(*slot)); return 5; }
  uint32_t status = bridge_recursive_children_allocate(owner, slot, kind, count, branch, budget);
  recursive_test_track(slot);
  return status;
}

static uint32_t recursive_test_leaf(bridge_recursive_arena *owner, bridge_scalar_slot *slot, uint32_t kind, lean_object *value, uint32_t *budget) {
  if (recursive_test_enabled && ++recursive_test_calls == recursive_test_fail) { lean_dec(value); memset(slot, 0, sizeof(*slot)); return 5; }
  uint32_t status = bridge_recursive_encode_leaf(owner, slot, kind, value, budget);
  recursive_test_track(slot);
  return status;
}

static void recursive_test_clear(bridge_scalar_frame *frame) {
  uint32_t count = bridge_recursive_receipt_count(frame);
  uint32_t const *receipt = (uint32_t const *)(uintptr_t)bridge_recursive_receipt_data(frame);
  if (count != UINT32_MAX) for (uint32_t i = 0; i < count; ++i) recursive_test_forget(receipt[i * 2]);
  bridge_recursive_frame_clear(frame);
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
LEAN_EXPORT uint32_t recursive_test_release(bridge_scalar_frame *frame) { recursive_test_clear(frame); return 0; }

#define bridge_recursive_children_allocate recursive_test_children
#define bridge_recursive_encode_leaf recursive_test_leaf
#define bridge_recursive_frame_clear recursive_test_clear
#define bridge_copied_decode recursive_test_decode
