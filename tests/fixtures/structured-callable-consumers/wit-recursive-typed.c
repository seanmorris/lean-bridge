#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "structured_wasmtime.h"

/* GENERATED_BINDINGS */

typedef struct {
  structured_wasmtime *session;
  structured_wasmtime_function function;
  unsigned calls, releases;
  bool close_active;
} fixture_state;
static void success(wasmtime_error_t *error) {
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\n", (int)message.size, message.data);
    wasm_name_delete(&message); wasmtime_error_delete(error); assert(false);
  }
}
static void released(void *data) { ++((fixture_state *)data)->releases; }
static wasmtime_error_t *grow(void *data, const structured_tree_t *value, structured_tree_t *out) {
  fixture_state *state = data; ++state->calls;
  if (state->close_active && state->function) {
    success(structured_wasmtime_function_close(state->session, &state->function));
    assert(!state->releases);
  }
  structured_tree_t wrapped = {.kind = STRUCTURED_TREE_T_KIND_BRANCH};
  wrapped.cases.branch.children.data = value; wrapped.cases.branch.children.length = 1;
  return structured_tree_t_wasmtime_copy(&wrapped, out);
}
static void check_tree(const structured_tree_t *node, unsigned wrappers) {
  while (wrappers--) {
    assert(node->kind == STRUCTURED_TREE_T_KIND_BRANCH && node->cases.branch.children.length == 1);
    node = &node->cases.branch.children.data[0];
  }
  assert(node->kind == STRUCTURED_TREE_T_KIND_LEAF);
  assert(node->cases.leaf.value.length == 1 && node->cases.leaf.value.data[0] == 42);
}
int main(void) {
  structured_wasmtime *session = NULL; success(structured_wasmtime_open(&session));
  if (getenv("LEAN_BRIDGE_WIT_PROBE_COLD_ONLY")) {
    structured_wasmtime_close(session); puts("{\"cold\":true}"); return 0;
  }
  fixture_state state = {.session = session};
  success(fixture_callback_create(session, grow, &state, released, &state.function));
  uint32_t forty_two = 42;
  structured_tree_t tree = {.kind = STRUCTURED_TREE_T_KIND_LEAF}, result = {0};
  tree.cases.leaf.value.data = &forty_two; tree.cases.leaf.value.length = 1;
  success(structured_wasmtime_value_twice_recursive(session, &tree, state.function, &result));
  assert(result._bridge_owner && result._bridge_release); check_tree(&result, 2);
  assert(state.calls == 2 && !state.releases && forty_two == 42);
  structured_tree_t_clear(&result);
  structured_wasmtime_function closure = 0;
  success(structured_wasmtime_value_make_recursive(session, &tree, &closure)); assert(closure);
  bool selected = true;
  structured_tree_t other = {.kind = STRUCTURED_TREE_T_KIND_BRANCH};
  success(fixture_owned_call(session, closure, &selected, &other, &result)); check_tree(&result, 0);
  success(structured_wasmtime_function_close(session, &closure)); assert(!closure);
  state.close_active = true;
  structured_tree_t grown = {0};
  success(structured_wasmtime_value_twice_recursive(session, &tree, state.function, &grown));
  check_tree(&grown, 2); assert(state.calls == 4 && state.releases == 1 && !state.function);
  structured_tree_t_clear(&grown);
  structured_wasmtime_close(session);
  check_tree(&result, 0); structured_tree_t_clear(&result); structured_tree_t_clear(&result);
  puts("{\"typed\":true,\"callbacks\":4,\"releases\":1,\"owned\":true,\"activeClose\":true,\"independentResult\":true}");
}
