/**
 * Count native allocations and consuming handoffs around the Ruby boundary.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Keep the generated ABI intact while exposing allocation-failure controls.
 *
 * @param native - Compiler-authenticated C adapter.
 * @param combined - Include consuming receiver methods.
 */
export const ownedRubyCallbackNativeSource = (native, combined) => {
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	assert.equal(native.source.split(handoff).length, combined ? 2 : 1);
	return `#include <stddef.h>
#include <stdlib.h>
static size_t live, handoffs; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${combined ? native.source.replace(handoff, handoff + "\n  ++handoffs;") : native.source}
size_t owned_test_live(void) { return live; }
size_t owned_test_handoffs(void) { return handoffs; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
void owned_test_sanitizer_fault(size_t index) { volatile char *value = malloc(1); value[index] = 1; free((void *)value); }
int owned_test_undefined_fault(int shift) { volatile int value = 1; return value << shift; }
void owned_test_sanitizer_leak(void) { volatile char *value = malloc(73); if (value) *value = 1; }
static __thread struct { char padding[4096]; void * volatile value; } owned_test_tls;
void owned_test_sanitizer_tls_touch(void) { owned_test_tls.padding[0] = 1; owned_test_tls.value = NULL; }
void owned_test_sanitizer_tls_hold(void) { owned_test_tls.value = malloc(89); if (owned_test_tls.value) *(volatile char *)owned_test_tls.value = 1; }
void owned_test_sanitizer_tls_clear(void) { owned_test_tls.value = NULL; }
`;
};
