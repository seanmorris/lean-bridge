#define _GNU_SOURCE
#include <assert.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>
#include "recursive_wasmtime.h"
#include "peer_wasmtime.h"

#define SYMBOL(handle, target, name) do { \
  void *address = dlsym(handle, name); assert(address); \
  _Static_assert(sizeof(target) == sizeof(address), "POSIX function pointer"); \
  memcpy(&(target), &address, sizeof(target)); \
} while (0)

typedef struct {
  void *library;
  recursive_wasmtime *recursive;
  peer_wasmtime *peer;
  wasmtime_error_t *(*open_recursive)(recursive_wasmtime **);
  wasmtime_error_t *(*open_peer)(peer_wasmtime **);
  wasmtime_error_t *(*grow)(recursive_wasmtime *, const recursive_spine_t *, recursive_spine_t *);
  wasmtime_error_t *(*empty)(recursive_wasmtime *, recursive_tree_t *);
  wasmtime_error_t *(*tree)(recursive_wasmtime *, const recursive_tree_t *, recursive_tree_t *);
  wasmtime_error_t *(*call)(peer_wasmtime *, const char *, const wasmtime_component_val_t *, size_t, wasmtime_component_val_t *);
  void (*close_recursive)(recursive_wasmtime *);
  void (*close_peer)(peer_wasmtime *);
  void (*error_delete)(wasmtime_error_t *);
  void (*error_message)(const wasmtime_error_t *, wasm_name_t *);
  void (*name_delete)(wasm_name_t *);
  void (*value_delete)(wasmtime_component_val_t *);
} api;

static api load(const char *path, bool recursive, int visibility) {
  api value = {0}; value.library = dlopen(path, RTLD_NOW | visibility);
  if (!value.library) fprintf(stderr, "%s\n", dlerror());
  assert(value.library);
  SYMBOL(value.library, value.error_delete, "wasmtime_error_delete");
  SYMBOL(value.library, value.error_message, "wasmtime_error_message");
  SYMBOL(value.library, value.name_delete, "wasm_byte_vec_delete");
  SYMBOL(value.library, value.value_delete, "wasmtime_component_val_delete");
  if (recursive) {
    SYMBOL(value.library, value.open_recursive, "recursive_wasmtime_open");
    SYMBOL(value.library, value.close_recursive, "recursive_wasmtime_close");
    SYMBOL(value.library, value.grow, "recursive_wasmtime_value_grow");
    SYMBOL(value.library, value.empty, "recursive_wasmtime_value_empty");
    SYMBOL(value.library, value.tree, "recursive_wasmtime_value_tree");
  } else {
    SYMBOL(value.library, value.open_peer, "peer_wasmtime_open");
    SYMBOL(value.library, value.close_peer, "peer_wasmtime_close");
    SYMBOL(value.library, value.call, "peer_wasmtime_call");
  }
  return value;
}
static void ok(api *value, wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; value->error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data); abort();
}
static void reject(api *value, wasmtime_error_t *error, const char *reason) {
  assert(error);
  wasm_name_t message; value->error_message(error, &message);
  if (!message.size || !memmem(message.data, message.size, reason, strlen(reason)))
    fprintf(stderr, "Expected '%s' in error: %.*s\n", reason, (int)message.size, message.data);
  assert(message.size && memmem(message.data, message.size, reason, strlen(reason)));
  value->name_delete(&message); value->error_delete(error);
}
static void open_api(api *value) {
  ok(value, value->open_recursive ? value->open_recursive(&value->recursive) : value->open_peer(&value->peer));
}
static void close_api(api *value) {
  if (value->recursive) value->close_recursive(value->recursive);
  if (value->peer) value->close_peer(value->peer);
  assert(dlclose(value->library) == 0);
}
static void answer(api *value) {
  wasmtime_component_val_t result = {0};
  ok(value, value->call(value->peer, "answer", NULL, 0, &result));
  assert(result.kind == WASMTIME_COMPONENT_U32 && result.of.u32 == 42);
  value->value_delete(&result);
}
static void retained(const recursive_spine_t *value, uint32_t expected) {
  assert(value->_bridge_owner && value->_bridge_release);
  assert(value->kind == RECURSIVE_SPINE_T_KIND_NEXT);
  assert(value->cases.next.value->kind == RECURSIVE_SPINE_T_KIND_LEAF);
  assert(value->cases.next.value->cases.leaf.value == expected);
}
static void check_api(api *value) {
  if (value->peer) answer(value);
  else {
    recursive_spine_t input = {.kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 71}, result = {0};
    ok(value, value->grow(value->recursive, &input, &result)); retained(&result, 71);
    recursive_spine_t_clear(&result);
  }
}

int main(int argc, char **argv) {
  assert(argc == 6);
  const char *mode = argv[1]; bool recursive_first = !strcmp(argv[2], "recursive-first");
  int visibility = !strcmp(argv[3], "global") ? RTLD_GLOBAL : RTLD_LOCAL;
  api first = load(recursive_first ? argv[4] : argv[5], recursive_first, visibility);
  open_api(&first);
  if (!strcmp(mode, "unopened-peer-fork")) {
    check_api(&first);
    pid_t child = fork(); assert(child >= 0);
    if (!child) {
      alarm(10);
      api second = load(recursive_first ? argv[5] : argv[4], !recursive_first, visibility);
      wasmtime_error_t *error = second.open_recursive ? second.open_recursive(&second.recursive) : second.open_peer(&second.peer);
      if (!error) _exit(9);
      reject(&second, error, "after fork");
      assert(!second.recursive && !second.peer); _exit(0);
    }
    int status; assert(waitpid(child, &status, 0) == child);
    check_api(&first);
    close_api(&first);
    printf("{\"unopenedPeerRejected\":%s,\"childStatus\":%d}\n", WIFEXITED(status) && WEXITSTATUS(status) == 0 ? "true" : "false", status);
    return 0;
  }
  api second = load(recursive_first ? argv[5] : argv[4], !recursive_first, visibility);
  open_api(&second);
  api *graph = recursive_first ? &first : &second, *peer = recursive_first ? &second : &first;
  for (unsigned i = 0; i < 2; ++i) {
    const char *symbol = i ? "lean_bridge_native_snapshot_read" : "lean_alloc_object";
    void *a = dlsym(first.library, symbol), *b = dlsym(second.library, symbol);
    assert(a && a == b);
  }
  recursive_spine_t input = {.kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 71}, owned = {0};
  ok(graph, graph->grow(graph->recursive, &input, &owned)); retained(&owned, 71);
  input.cases.leaf.value = 19; retained(&owned, 71); answer(peer);
  bool fault = !strcmp(mode, "malformed") || !strcmp(mode, "limit");
  if (fault) {
    recursive_tree_t tree = {0}, unchanged = {.kind = UINT32_MAX};
    ok(graph, graph->empty(graph->recursive, &tree));
    reject(graph, graph->tree(graph->recursive, &tree, &unchanged), !strcmp(mode, "limit") ? "conversion limit" : "runtime retired");
    assert(unchanged.kind == UINT32_MAX && !unchanged._bridge_owner);
    recursive_tree_t_clear(&tree);
    recursive_spine_t result = {.kind = UINT32_MAX};
    if (!strcmp(mode, "malformed")) {
      reject(graph, graph->grow(graph->recursive, &input, &result), "Native Lean graph call failed");
      assert(result.kind == UINT32_MAX && !result._bridge_owner);
      wasmtime_component_val_t out = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 12345};
      reject(peer, peer->call(peer->peer, "answer", NULL, 0, &out), "runtime");
      assert(out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 12345);
    } else {
      ok(graph, graph->grow(graph->recursive, &input, &result)); retained(&result, 19);
      recursive_spine_t_clear(&result); answer(peer);
    }
  }
  retained(&owned, 71);
  close_api(&first); retained(&owned, 71);
  close_api(&second); retained(&owned, 71);
  recursive_spine_t_clear(&owned); recursive_spine_t_clear(&owned);
  printf("{\"sharedRuntime\":true,\"independentResult\":true,\"cleanupAfterBothClosed\":true,\"mode\":\"%s\"}\n", mode);
}
