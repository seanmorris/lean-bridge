/* Independent installed WIT/WASI consumer using the packaged Wasmtime API. */
#include "host_null_demo_wasmtime.h"
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef wasmtime_component_val_t value;
typedef host_null_demo_wasmtime_value bridge_value;
typedef host_null_demo_wasmtime_function function;
static host_null_demo_wasmtime *session;
static unsigned checks, callback_calls;
static bool invalid_callback_result;
#define CHECK(condition) do { ++checks; assert(condition); } while (0)

static void ok(wasmtime_error_t *error) {
  if (!error) { ++checks; return; }
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error); assert(false);
}
static void rejected(wasmtime_error_t *error) {
  CHECK(error != NULL);
  if (error) wasmtime_error_delete(error);
}
static value u32(uint32_t input) {
  return (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = input};
}
static value none(void) {
  return (value){.kind = WASMTIME_COMPONENT_OPTION};
}
/* Takes ownership of child. */
static value some(value child) {
  return (value){.kind = WASMTIME_COMPONENT_OPTION,
    .of.option = wasmtime_component_val_new(&child)};
}
static bool equal(const value *left, const value *right) {
  if (left->kind != right->kind) return false;
  if (left->kind == WASMTIME_COMPONENT_U32) return left->of.u32 == right->of.u32;
  if (left->kind == WASMTIME_COMPONENT_OPTION)
    return (!left->of.option && !right->of.option)
      || (left->of.option && right->of.option && equal(left->of.option, right->of.option));
  if (left->kind == WASMTIME_COMPONENT_RECORD) {
    if (left->of.record.size != right->of.record.size) return false;
    for (size_t index = 0; index < left->of.record.size; ++index) {
      const wasmtime_component_valrecord_entry_t *a = &left->of.record.data[index];
      const wasmtime_component_valrecord_entry_t *b = &right->of.record.data[index];
      if (a->name.size != b->name.size || memcmp(a->name.data, b->name.data, a->name.size)
          || !equal(&a->val, &b->val)) return false;
    }
    return true;
  }
  return false;
}
static bridge_value copied(value input) {
  return (bridge_value){.value = input};
}
static bridge_value callable(function input) {
  return (bridge_value){.function = input};
}
static void clear(bridge_value *input) {
  if (input->function) ok(host_null_demo_wasmtime_function_close(session, &input->function));
  else wasmtime_component_val_delete(&input->value);
  *input = (bridge_value){0};
}
static bridge_value invoke(const char *name, const bridge_value *arguments, size_t count) {
  bridge_value output = {0};
  ok(host_null_demo_wasmtime_invoke(session, name, arguments, count, &output));
  return output;
}
static void expect(const char *name, value input, value expected) {
  bridge_value argument = copied(input), output = invoke(name, &argument, 1);
  CHECK(!output.function && equal(&output.value, &expected));
  clear(&argument); CHECK(equal(&output.value, &expected));
  clear(&output); wasmtime_component_val_delete(&expected);
}
static value packet(void) {
  value output = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&output.of.record, 3);
  const char *names[] = {"direct", "nullable-option", "optional-nullable"};
  for (size_t index = 0; index < 3; ++index)
    wasm_name_new(&output.of.record.data[index].name, strlen(names[index]), names[index]);
  output.of.record.data[0].val = none();
  output.of.record.data[1].val = some(none());
  output.of.record.data[2].val = some(none());
  return output;
}
static wasmtime_error_t *callback(void *data, const value *arguments,
    size_t count, value *out) {
  CHECK(data == &callback_calls && count == 1);
  ++callback_calls;
  CHECK(arguments[0].kind == WASMTIME_COMPONENT_OPTION);
  if (invalid_callback_result) *out = u32(991);
  else if (!arguments[0].of.option) *out = some(none());
  else *out = some(some(u32(arguments[0].of.option->of.u32 + 1)));
  return NULL;
}

int main(void) {
  ok(host_null_demo_wasmtime_open(&session));
  expect("echo", none(), none());
  expect("echo", some(u32(42)), some(u32(42)));
  expect("nullable-option", none(), none());
  expect("nullable-option", some(none()), some(none()));
  expect("nullable-option", some(some(u32(42))), some(some(u32(42))));
  expect("optional-nullable", none(), none());
  expect("optional-nullable", some(none()), some(none()));
  expect("optional-nullable", some(some(u32(42))), some(some(u32(42))));
  value input_packet = packet(), expected_packet = packet();
  bridge_value packet_arg = copied(input_packet), packet_out = invoke("echo-packet", &packet_arg, 1);
  CHECK(equal(&packet_out.value, &expected_packet));
  clear(&packet_arg); CHECK(equal(&packet_out.value, &expected_packet));
  clear(&packet_out); wasmtime_component_val_delete(&expected_packet);

  function host = 0;
  ok(host_null_demo_wasmtime_callback_create(session,
    "function-bridge-value-1-to-bridge-value-3", callback, &callback_calls, NULL, &host));
  bridge_value arguments[] = {copied(none()), callable(host)};
  bridge_value output = invoke("call-host", arguments, 2);
  value expected = some(none()); CHECK(equal(&output.value, &expected));
  clear(&output); wasmtime_component_val_delete(&expected); clear(&arguments[0]);
  arguments[0] = copied(some(u32(42)));
  output = invoke("call-host", arguments, 2);
  expected = some(some(u32(43))); CHECK(equal(&output.value, &expected));
  clear(&output); wasmtime_component_val_delete(&expected); clear(&arguments[0]);
  CHECK(callback_calls == 2);

  bridge_value captured = copied(some(some(u32(77))));
  bridge_value closure = invoke("make-closure", &captured, 1);
  clear(&captured); CHECK(closure.function != 0);
  bridge_value closure_args[] = {callable(closure.function), copied(none())};
  output = invoke("invoke-function-bridge-value-1-to-bridge-value-3", closure_args, 2);
  expected = some(some(u32(77))); CHECK(equal(&output.value, &expected));
  clear(&output); clear(&closure_args[1]); wasmtime_component_val_delete(&expected);
  clear(&closure); CHECK(!closure.function);

  bridge_value invalid = copied(u32(991)), unchanged = copied(u32(777));
  rejected(host_null_demo_wasmtime_invoke(session, "echo", &invalid, 1, &unchanged));
  CHECK(unchanged.value.kind == WASMTIME_COMPONENT_U32 && unchanged.value.of.u32 == 777);
  clear(&invalid); clear(&unchanged);
  invalid_callback_result = true;
  arguments[0] = copied(none()); output = copied(u32(777));
  rejected(host_null_demo_wasmtime_invoke(session, "call-host", arguments, 2, &output));
  CHECK(output.value.kind == WASMTIME_COMPONENT_U32 && output.value.of.u32 == 777);
  clear(&output); clear(&arguments[0]); clear(&arguments[1]);

  host_null_demo_wasmtime_close(session); session = NULL;
  printf("host-null-wit-wasi:%u\n", checks);
  return 0;
}
