/**
 * Execute production closure registries with explicit reference-count probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { generateNativeCallables } from "../../src/backends/c/native-callables.mjs";

/**
 * Extract the complete generated registry without replacing its operations.
 *
 * @param pointerBits - Selected native or wasm32 token representation.
 */
export const closureThreadRegistry = pointerBits => {
	assert.ok([32, 64].includes(pointerBits));
	const { source } = generateNativeCallables({ pointerBits, types: [] }, {
		prefix: "sample", callbacks: new Map([["present", {}]]), functions: []
	});
	const start = source.indexOf("typedef struct { uintptr_t token;");
	assert.ok(start > 0);
	return source.slice(start);
};

/**
 * Recover predecessor output by reversing only the five thread-lifetime edits.
 * Callers must authenticate the complete returned source against its old hash.
 *
 * @param source - Complete generated C source, including non-callable fixtures.
 */
export const beforeClosureThreadRegistry = source => {
	if(!source.includes("typedef struct { uintptr_t token;")) return source;
	const edits = [
		["const char *kind; uint64_t thread; pid_t process; } lb_lease;", "const char *kind; pthread_t thread; pid_t process; } lb_lease;"]
		, ["/* OS thread IDs can be reused after exit. Lease thread serials never repeat. */\nstatic uint64_t lb_lease_thread_serial;\nstatic _Thread_local uint64_t lb_lease_thread;\n", ""]
		, ["  if (!lb_lease_thread) {\n    if (lb_lease_thread_serial == UINT64_MAX) { pthread_mutex_unlock(&lb_lease_mutex); return 0; }\n    lb_lease_thread = ++lb_lease_thread_serial;\n  }\n", ""]
		, ["value, kind, lb_lease_thread, getpid()", "value, kind, pthread_self(), getpid()"]
		, ["slot->thread == lb_lease_thread", "pthread_equal(slot->thread, pthread_self())"]
	];
	let previous = source;
	for(const [current, old] of edits)
	{
		assert.equal(previous.split(current).length, 2, "Exactly one recorded closure lifetime change");
		previous = previous.replace(current, old);
	}
	return previous;
};

/**
 * Supply only Lean/reference stand-ins; exercise the unedited registry itself.
 * 32-bit tokens execute on the native test host, not in a WebAssembly engine.
 *
 * @param pointerBits - Width of the generated public closure tokens.
 * @param registry - Complete generated registry, or an explicit negative mutant.
 */
export const closureThreadRegistryProbe = (pointerBits, registry = closureThreadRegistry(pointerBits)) => {
	const source = `#include <assert.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
typedef struct { unsigned refs; } lean_object;
static unsigned objects, identities, releases, marked;
static uint64_t next_identity = UINT64_C(1) << 32;
static void lean_mark_mt(lean_object *value) { assert(value && value->refs); ++marked; }
static void lean_inc(lean_object *value) { assert(value && value->refs); ++value->refs; }
static void lean_dec(lean_object *value) { assert(value && value->refs); if (!--value->refs) { --objects; free(value); } }
static uint64_t lean_bridge_native_identity_acquire(const char *kind, void *slot) { assert(kind && slot); ++identities; return ++next_identity; }
static int lean_bridge_native_identity_release(uint64_t token, const char *kind, void *slot) { assert(token > UINT32_MAX && kind && slot && identities); --identities; ++releases; return 1; }
${registry}
static uintptr_t abandoned, final_thread;
static unsigned checks, replacements;
#define CHECK(value) do { ++checks; assert(value); } while (0)
static uintptr_t create(const char *kind) {
  lean_object *value = calloc(1, sizeof(*value)); CHECK(value); ++objects; value->refs = 1;
  uintptr_t token = lb_lease_store(value, kind); if (!token) lean_dec(value); return token;
}
static void invoke(uintptr_t token, const char *kind) {
  lean_object *value = lb_lease_borrow(token, kind); CHECK(value && value->refs == 2); lean_dec(value);
}
static void *creator(void *unused) {
  (void)unused; abandoned = create("closure"); CHECK(abandoned); invoke(abandoned, "closure"); return NULL;
}
static void *replacement(void *unused) {
  (void)unused; CHECK(lb_lease_thread == 0);
  CHECK(lb_lease_borrow(abandoned, "closure") == NULL);
  uintptr_t own = create("closure"); CHECK(own && lb_lease_thread); invoke(own, "closure");
  CHECK(lb_lease_borrow(abandoned, "closure") == NULL);
  lb_lease_drop(own, "wrong-kind"); invoke(own, "closure");
  lb_lease_drop(own, "closure"); CHECK(lb_lease_borrow(own, "closure") == NULL);
  ++replacements; return NULL;
}
static void *last_creator(void *unused) {
  (void)unused; CHECK(lb_lease_thread == 0);
  final_thread = create("last"); CHECK(final_thread && lb_lease_thread == UINT64_MAX);
  invoke(final_thread, "last"); return NULL;
}
static void *exhausted_creator(void *unused) {
  (void)unused; unsigned before_objects = objects, before_identities = identities, before_marked = marked;
  CHECK(lb_lease_thread == 0 && create("exhausted") == 0 && lb_lease_thread == 0);
  CHECK(objects == before_objects && identities == before_identities && marked == before_marked);
  CHECK(lb_lease_borrow(final_thread, "last") == NULL); return NULL;
}
static void thread(void *(*function)(void *)) {
  pthread_t handle; assert(!pthread_create(&handle, NULL, function, NULL)); assert(!pthread_join(handle, NULL));
}
int main(void) {
  uintptr_t main_token = create("main"); CHECK(main_token); invoke(main_token, "main");
  CHECK(lb_lease_borrow(main_token, "wrong") == NULL && lb_lease_borrow(0, "main") == NULL);
  thread(creator);
  for (unsigned index = 0; index < 32; ++index) thread(replacement);
  CHECK(replacements == 32 && identities == 2 && objects == 2);
  uintptr_t slots[4094];
  for (unsigned index = 0; index < 4094; ++index) { slots[index] = create("full"); CHECK(slots[index]); }
  CHECK(identities == 4096 && create("full") == 0 && objects == 4096);
  invoke(main_token, "main");
  for (unsigned index = 0; index < 4094; ++index) lb_lease_drop(slots[index], "full");
  CHECK(identities == 2 && objects == 2);
  lb_lease_thread_serial = UINT64_MAX - 1;
  thread(last_creator); CHECK(lb_lease_thread_serial == UINT64_MAX);
  thread(exhausted_creator);
  uintptr_t existing = create("existing"); CHECK(existing); invoke(existing, "existing");
  lb_lease_drop(existing, "existing"); lb_lease_drop(final_thread, "last");
  lb_lease_drop(abandoned, "closure"); lb_lease_drop(main_token, "main");
  CHECK(!objects && !identities && releases == marked);
  printf("{\\"checks\\":%u,\\"replacements\\":%u,\\"released\\":%u,\\"objects\\":%u,\\"identities\\":%u}\\n", checks, replacements, releases, objects, identities);
}
`;
	return pointerBits === 32 ? source.replaceAll("uintptr_t", "uint32_t").replaceAll("UINTPTR_MAX", "UINT32_MAX") : source;
};
