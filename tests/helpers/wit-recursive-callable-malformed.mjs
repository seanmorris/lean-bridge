/**
 * Inject native result faults without altering installed archive bytes.
 * Recoverable value limits must not retire the shared runtime.
 *
 * @file
 */

export const witRecursiveResultFaultModes = ["kind", "missing-buffer", "noncanonical-nat", "cycle", "limit-nodes", "limit-depth"];

/**
 * Render a loaded-boundary fault library and a public typed consumer.
 *
 * @param model - Authenticated package symbols and callback identities.
 */
export const witRecursiveCallableMalformed = model => {
	const p = model.prefix, call = model.functions.find(fn => fn.declaration.name === "callRecursive");
	const make = model.functions.find(fn => fn.declaration.name === "makeRecursive");
	const tree = call.parameters[0].name, callback = call.parameters[1];
	const host = model.manifest.cHost.callbacks.find(item => item.id === callback.id);
	const owned = model.manifest.cHost.callbacks.find(item => item.id === make.result.id);
	return `#define _GNU_SOURCE
#include "${p}_wasmtime.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef INJECT_RESULT
uint32_t ${call.native}(const ${tree} *input, const ${callback.name} *callback, ${tree} *out) {
  (void)input; (void)callback;
  const char *mode = getenv("LEAN_BRIDGE_WIT_RESULT_FAULT"); assert(mode);
  *out = (${tree}){0};
  if (!strcmp(mode, "kind")) out->kind = UINT32_MAX;
  else if (!strcmp(mode, "noncanonical-nat")) {
    static const uint32_t zero;
    out->kind = STRUCTURED_TREE_T_KIND_LEAF;
    out->cases.leaf.value.data = &zero; out->cases.leaf.value.length = 1;
  } else {
    out->kind = STRUCTURED_TREE_T_KIND_BRANCH;
    if (!strcmp(mode, "missing-buffer")) out->cases.branch.children.length = 1;
    else if (!strcmp(mode, "cycle")) { out->cases.branch.children.data = out; out->cases.branch.children.length = 1; }
    else if (!strcmp(mode, "limit-nodes")) out->cases.branch.children.length = 262145;
    else {
      assert(!strcmp(mode, "limit-depth")); static ${tree} spine[140];
      memset(spine, 0, sizeof(spine));
      for (size_t i = 0; i < 139; ++i) {
        spine[i].kind = STRUCTURED_TREE_T_KIND_BRANCH;
        spine[i].cases.branch.children.data = &spine[i + 1]; spine[i].cases.branch.children.length = 1;
      }
      *out = spine[0];
    }
  }
  return 0;
}
#else
static unsigned callbacks;
static void success(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\\n", (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error); abort();
}
static wasmtime_error_t *echo(void *data, const ${tree} *value, ${tree} *out) {
  (void)data; ++callbacks; return ${tree}_wasmtime_copy(value, out);
}
int main(void) {
  const char *mode = getenv("LEAN_BRIDGE_WIT_RESULT_FAULT"); assert(mode);
  bool limit = !strncmp(mode, "limit-", 6);
  ${p}_wasmtime *sessions[2] = {0};
  success(${p}_wasmtime_open(&sessions[0])); success(${p}_wasmtime_open(&sessions[1]));
  ${p}_wasmtime_function callback = 0;
  success(${host.create}(sessions[0], echo, NULL, NULL, &callback));
  uint32_t forty_two = 42;
  ${tree} input = {.kind = STRUCTURED_TREE_T_KIND_LEAF}, output = {.kind = UINT32_MAX};
  input.cases.leaf.value.data = &forty_two; input.cases.leaf.value.length = 1;
  unsigned char unchanged[sizeof(output)]; memcpy(unchanged, &output, sizeof(output));
  wasmtime_error_t *error = ${p}_wasmtime_value_${call.field}(sessions[0], &input, callback, &output); assert(error);
  wasm_name_t message; wasmtime_error_message(error, &message);
  const char *expected = limit ? "conversion limit" : "runtime retired";
  assert(memmem(message.data, message.size, expected, strlen(expected)));
  wasm_name_delete(&message); wasmtime_error_delete(error);
  assert(!memcmp(unchanged, &output, sizeof(output)) && !callbacks);
  for (unsigned i = 0; i < 2; ++i) {
    ${p}_wasmtime_function closure = 0;
    error = ${p}_wasmtime_value_${make.field}(sessions[i], &input, &closure);
    if (limit) {
      success(error); assert(closure); bool selected = true;
      success(${owned.invoke}(sessions[i], closure, &selected, &input, &output));
      assert(output.kind == STRUCTURED_TREE_T_KIND_LEAF && output.cases.leaf.value.length == 1 && output.cases.leaf.value.data[0] == 42);
      ${tree}_clear(&output); success(${p}_wasmtime_function_close(sessions[i], &closure));
    } else { assert(error && !closure); wasmtime_error_delete(error); }
  }
  success(${p}_wasmtime_function_close(sessions[0], &callback));
  ${p}_wasmtime_close(sessions[1]); ${p}_wasmtime_close(sessions[0]);
  printf("{\\"mode\\":\\"%s\\",\\"runtimeRetired\\":%s,\\"twoSessionsChecked\\":true,\\"outputUnchanged\\":true}\\n", mode, limit ? "false" : "true");
}
#endif
`;
};
