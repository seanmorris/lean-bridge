#define _GNU_SOURCE
#include <assert.h>
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include "recursive_wasmtime.h"

int main(int argc, char **argv) {
  assert(argc == 2);
  assert(!dlopen(argv[1], RTLD_NOW | RTLD_NOLOAD));
  void *library = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL); assert(library);
  wasmtime_error_t *(*open_session)(recursive_wasmtime **) = NULL;
  wasmtime_error_t *(*grow)(recursive_wasmtime *, const recursive_spine_t *, recursive_spine_t *) = NULL;
  void (*close_session)(recursive_wasmtime *) = NULL;
  void *symbol = dlsym(library, "recursive_wasmtime_open"); assert(symbol); memcpy(&open_session, &symbol, sizeof(open_session));
  symbol = dlsym(library, "recursive_wasmtime_value_grow"); assert(symbol); memcpy(&grow, &symbol, sizeof(grow));
  symbol = dlsym(library, "recursive_wasmtime_close"); assert(symbol); memcpy(&close_session, &symbol, sizeof(close_session));
  recursive_wasmtime *session = NULL; assert(!open_session(&session));
  recursive_spine_t leaf = {.kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 91}, output = {0};
  assert(!grow(session, &leaf, &output)); assert(output._bridge_owner && output._bridge_release);
  close_session(session); assert(dlclose(library) == 0);
  void *resident = dlopen(argv[1], RTLD_NOW | RTLD_NOLOAD); assert(resident); assert(dlclose(resident) == 0);
  assert(output.kind == RECURSIVE_SPINE_T_KIND_NEXT && output.cases.next.value->cases.leaf.value == 91);
  recursive_spine_t_clear(&output); recursive_spine_t_clear(&output);
  puts("{\"notPreloaded\":true,\"resultAfterClose\":true,\"cleanupAfterDlclose\":true}");
}
