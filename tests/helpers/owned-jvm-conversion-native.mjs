/**
 * Reconstruct complete C and TLS inputs for JVM conversion evidence.
 *
 * @file
 */
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { ownedJvmThreadExit } from "../../src/backends/jvm/owned-thread-exit.mjs";

/**
 * Preserve allocator fault injection around the authenticated C projection.
 *
 * @param input - Fresh compiler metadata and explicit callback capability.
 */
export const ownedJvmConversionNative = input => {
	const c = generateOwnedCPackage(input), cleanup = ownedJvmThreadExit(c.values.prefix);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
#include <stdatomic.h>
static _Atomic size_t live;
static _Thread_local ptrdiff_t remaining = -1;
static void *probe_alloc(size_t size) {
  if (remaining == 0) return NULL;
  if (remaining > 0) --remaining;
  void *value = malloc(size); if (value) atomic_fetch_add(&live, 1); return value;
}
static void probe_free(void *value) { if (value) { atomic_fetch_sub(&live, 1); free(value); } }
#define LB_OWNED_ALLOC probe_alloc
#define LB_OWNED_FREE probe_free
${c.source}
${cleanup.source}
size_t probe_live(void) { return atomic_load(&live); }
size_t probe_identities(void) { lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s); return s.live_identities; }
void probe_fail(ptrdiff_t value) { remaining = value; }
`;
	return { c, cleanup, implementation };
};
