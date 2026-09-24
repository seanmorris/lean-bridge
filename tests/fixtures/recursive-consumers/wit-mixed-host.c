#define _GNU_SOURCE
#include <assert.h>
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include "recursive_wasmtime.h"

void mixed_native_create(void);
void mixed_native_check(void);
void mixed_native_rejected(void);
void mixed_native_clear(void);

int main(int argc, char **argv) {
  assert(argc == 2); bool native_first = !strcmp(argv[1], "native-first");
  if (native_first) mixed_native_create();
  recursive_wasmtime *session = NULL;
  assert(!recursive_wasmtime_open(&session));
  recursive_spine_t input = {.kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 71}, owned = {0};
  assert(!recursive_wasmtime_value_grow(session, &input, &owned));
  if (!native_first) mixed_native_create();
  mixed_native_check();
  assert(owned.kind == RECURSIVE_SPINE_T_KIND_NEXT && owned.cases.next.value->cases.leaf.value == 71);
  /* Test-only lifecycle injection. Neither public API needs native runtime hooks. */
  void (*retire)(void); void *symbol = dlsym(RTLD_DEFAULT, "lean_bridge_native_runtime_retire"); assert(symbol);
  _Static_assert(sizeof(retire) == sizeof(symbol), "POSIX function pointer");
  memcpy(&retire, &symbol, sizeof(retire)); retire();
  mixed_native_rejected(); mixed_native_check();
  recursive_spine_t unchanged = {.kind = UINT32_MAX};
  wasmtime_error_t *error = recursive_wasmtime_value_grow(session, &input, &unchanged); assert(error);
  wasmtime_error_delete(error); assert(unchanged.kind == UINT32_MAX && !unchanged._bridge_owner);
  recursive_wasmtime_close(session);
  assert(owned.cases.next.value->cases.leaf.value == 71); mixed_native_clear();
  recursive_spine_t_clear(&owned); recursive_spine_t_clear(&owned);
  puts("{\"mixedPublicApis\":true,\"sharedRetirement\":true,\"ownedCleanup\":true}");
}
