#define _GNU_SOURCE
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "recursive_wasmtime.h"

#ifdef INJECT_RESULT
/* Deliberately interpose only this boundary. The installed package is unchanged. */
uint32_t recursive_tree_graph(const recursive_tree_t *input, recursive_tree_t *out) {
  (void)input;
  const char *mode = getenv("WIT_GRAPH_FAULT"); assert(mode);
  *out = (recursive_tree_t){0};
  if (strcmp(mode, "limit") == 0) {
    out->kind = RECURSIVE_TREE_T_KIND_BRANCH;
    out->cases.branch.children.length = 262145;
  } else out->kind = UINT32_MAX;
  return 0;
}
#else
static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data); abort();
}
int main(void) {
  const char *mode = getenv("WIT_GRAPH_FAULT"); assert(mode);
  bool limit = strcmp(mode, "limit") == 0;
  recursive_wasmtime *first = NULL, *second = NULL;
  ok(recursive_wasmtime_open(&first)); ok(recursive_wasmtime_open(&second));
  recursive_tree_t input = {0}, unchanged = {.kind = UINT32_MAX};
  ok(recursive_wasmtime_value_empty(first, &input));
  wasmtime_error_t *error = recursive_wasmtime_value_tree(first, &input, &unchanged); assert(error);
  wasm_name_t message; wasmtime_error_message(error, &message);
  const char *expected = limit ? "conversion limit" : "runtime retired";
  assert(message.size && memmem(message.data, message.size, expected, strlen(expected)));
  wasm_name_delete(&message); wasmtime_error_delete(error);
  assert(unchanged.kind == UINT32_MAX && !unchanged._bridge_owner);
  recursive_spine_t leaf = {.kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 7};
  for (unsigned i = 0; i < 2; ++i) {
    recursive_spine_t out = {.kind = UINT32_MAX};
    error = recursive_wasmtime_value_grow(i ? second : first, &leaf, &out);
    if (limit) { ok(error); assert(out.kind == RECURSIVE_SPINE_T_KIND_NEXT); recursive_spine_t_clear(&out); }
    else { assert(error && out.kind == UINT32_MAX && !out._bridge_owner); wasmtime_error_delete(error); }
  }
  recursive_tree_t_clear(&input);
  recursive_wasmtime_close(first); recursive_wasmtime_close(second);
  puts(limit ? "{\"limitRecoverable\":true,\"twoSessionsUsable\":true}" : "{\"runtimeRetired\":true,\"twoSessionsRejected\":true}");
}
#endif
