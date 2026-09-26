#include <assert.h>
#include <stdio.h>
#include "host.c"

/* GENERATED_BINDINGS */

typedef struct {
  structured_wasmtime *session;
  structured_wasmtime_function function;
  unsigned calls, releases;
  bool fail, close_active;
} fixture_state;

static void success(wasmtime_error_t *error) {
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\n", (int)message.size, message.data);
    wasm_name_delete(&message); wasmtime_error_delete(error); assert(false);
  }
}
static void failure(wasmtime_error_t *error, const char *text) {
  assert(error);
  wasm_name_t message; wasmtime_error_message(error, &message);
  char *copy = calloc(message.size + 1, 1); assert(copy);
  memcpy(copy, message.data, message.size); assert(strstr(copy, text)); free(copy);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static void release_fixture(void *data) { ++((fixture_state *)data)->releases; }
static wasmtime_error_t *grow(void *data, const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  fixture_state *state = data; ++state->calls; assert(count == 1);
  if (state->fail) return wasmtime_error_new("original-recursive-callback-failure");
  if (state->close_active && state->function) {
    success(structured_wasmtime_function_close(state->session, &state->function));
    assert(state->releases == 0);
  }
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  structured_tree_t value = {0}; assert(fixture_decode(&args[0], &input, &value));
  structured_tree_t wrapped = {.kind = STRUCTURED_TREE_T_KIND_BRANCH};
  wrapped.cases.branch.children.data = &value; wrapped.cases.branch.children.length = 1;
  assert(fixture_encode(&wrapped, &output, out));
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return NULL;
}
static void check_tree(const wasmtime_component_val_t *value, unsigned wrappers) {
  lb_graph_scope scope = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  structured_tree_t tree = {0}; assert(fixture_decode(value, &scope, &tree));
  const structured_tree_t *node = &tree;
  while (wrappers--) {
    assert(node->kind == STRUCTURED_TREE_T_KIND_BRANCH && node->cases.branch.children.length == 1);
    node = &node->cases.branch.children.data[0];
  }
  assert(node->kind == STRUCTURED_TREE_T_KIND_BRANCH && node->cases.branch.children.length == 2);
  for (size_t i = 0; i < 2; ++i) {
    const structured_tree_t *leaf = &node->cases.branch.children.data[i];
    assert(leaf->kind == STRUCTURED_TREE_T_KIND_LEAF);
    assert(leaf->cases.leaf.value.length == 1 && leaf->cases.leaf.value.data[0] == (i ? 11u : 7u));
  }
  lb_scope_close(&scope.memory);
}
typedef struct { structured_wasmtime *session; structured_wasmtime_value *args; } foreign_state;
static void *wrong_thread(void *data) {
  foreign_state *state = data;
  structured_wasmtime_value out = {.function = UINT64_MAX};
  failure(structured_wasmtime_invoke(state->session, "call-recursive", state->args, 2, &out), "wrong-thread");
  assert(out.function == UINT64_MAX); return NULL;
}
int main(void) {
  uint32_t values[] = {7, 11};
  structured_tree_t leaves[2] = {{.kind = STRUCTURED_TREE_T_KIND_LEAF}, {.kind = STRUCTURED_TREE_T_KIND_LEAF}};
  for (size_t i = 0; i < 2; ++i) { leaves[i].cases.leaf.value.data = &values[i]; leaves[i].cases.leaf.value.length = 1; }
  structured_tree_t tree = {.kind = STRUCTURED_TREE_T_KIND_BRANCH};
  tree.cases.branch.children.data = leaves; tree.cases.branch.children.length = 2;
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_component_val_t wire = {0}; assert(fixture_encode(&tree, &input, &wire));
  lb_scope_close(&input.memory);
  structured_wasmtime *session = NULL; success(structured_wasmtime_open(&session));
  if (getenv("LEAN_BRIDGE_WIT_PROBE_COLD_ONLY")) {
    structured_wasmtime_close(session); wasmtime_component_val_delete(&wire);
    puts("{\"cold\":true}"); return 0;
  }
  fixture_state state = {.session = session};
  success(structured_wasmtime_callback_create(session, fixture_callback_name, grow, &state, release_fixture, &state.function));
  structured_wasmtime_value args[2] = {{.value = wire}, {.function = state.function}}, out = {0};
  success(structured_wasmtime_invoke(session, "twice-recursive", args, 2, &out));
  check_tree(&out.value, 2); wasmtime_component_val_delete(&out.value); assert(state.calls == 2);
  assert(values[0] == 7 && values[1] == 11);
  state.fail = true; out = (structured_wasmtime_value){.function = UINT64_MAX};
  failure(structured_wasmtime_invoke(session, "call-recursive", args, 2, &out), "original-recursive-callback-failure");
  assert(out.function == UINT64_MAX && state.calls == 3);
  state.fail = false; out = (structured_wasmtime_value){0};
  success(structured_wasmtime_invoke(session, "call-recursive", args, 2, &out));
  check_tree(&out.value, 1); wasmtime_component_val_delete(&out.value); assert(state.calls == 4);
  foreign_state foreign = {session, args}; pthread_t thread;
  assert(!pthread_create(&thread, NULL, wrong_thread, &foreign)); assert(!pthread_join(thread, NULL));
  structured_wasmtime_value captured = {.value = wire}, owned = {0};
  success(structured_wasmtime_invoke(session, "make-recursive", &captured, 1, &owned));
  assert(owned.function);
  structured_wasmtime_value closure_args[3] = {{.function = owned.function}, {.value = {.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = true}}, {.value = wire}};
  structured_wasmtime_value retained = {0};
  success(structured_wasmtime_invoke(session, fixture_owned_invoke, closure_args, 3, &retained));
  check_tree(&retained.value, 0);
  args[1].function = owned.function; out = (structured_wasmtime_value){.function = UINT64_MAX};
  failure(structured_wasmtime_invoke(session, "call-recursive", args, 2, &out), "signature mismatch");
  assert(out.function == UINT64_MAX && state.calls == 4);
  success(structured_wasmtime_function_close(session, &owned.function)); assert(!owned.function);
  structured_wasmtime_function expired = state.function;
  void *expired_context = lb_entry_find(session, expired); assert(expired_context);
  args[1].function = state.function; state.close_active = true; out = (structured_wasmtime_value){0};
  success(structured_wasmtime_invoke(session, "twice-recursive", args, 2, &out));
  check_tree(&out.value, 2); wasmtime_component_val_delete(&out.value);
  assert(state.calls == 6 && state.releases == 1 && !state.function);
  out = (structured_wasmtime_value){.function = UINT64_MAX}; args[1].function = expired;
  failure(structured_wasmtime_invoke(session, "call-recursive", args, 2, &out), "closed/wrong-session");
  assert(out.function == UINT64_MAX);
  assert(fixture_direct_callback(expired_context, (const structured_tree_t *)1, (structured_tree_t *)1) == 1);
  assert(fixture_direct_callback((void *)1, (const structured_tree_t *)1, (structured_tree_t *)1) == 1);
  assert(!lb_active_frame);
  for (size_t i = 0; i < LB_CAPACITY; ++i) assert(!session->entries[i].token);
  lean_bridge_native_snapshot snapshot = {0}; lean_bridge_native_snapshot_read(&snapshot);
  assert(snapshot.live_identities == 0);
  structured_wasmtime_close(session);
  check_tree(&retained.value, 0); wasmtime_component_val_delete(&retained.value); wasmtime_component_val_delete(&wire);
  puts("{\"callbacks\":6,\"releases\":1,\"nativeIdentities\":0,\"recursive\":true,\"owned\":true,\"recovery\":true,\"activeClose\":true,\"wrongThread\":true,\"expiredContexts\":true,\"independentResult\":true}");
}
