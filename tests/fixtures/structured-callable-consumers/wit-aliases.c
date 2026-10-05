#include "structured_wasmtime.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
typedef structured_wasmtime_value argument;
static size_t checks, callbacks, finalized;
#define CHECK(test) do { checks++; assert(test); } while (0)
/* COPIED_ORACLES */
static const struct { const char *signature, *invoke, *call, *make; } bindings[] = {
/* CALLBACK_NAMES */
};
static bool invalid;
static value seed(unsigned round) {
  const char *names[] = {"text", "rows", "count", "nested"};
  value fields[] = {text_n("left\0right", 10), SEQ(none(), some(text(""))), sample(10, round), none()};
  value result = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&result.of.record, 4);
  for (unsigned i = 0; i < 4; ++i) {
    wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]);
    result.of.record.data[i].val = fields[i];
  }
  return result;
}
static wasmtime_error_t *callback(void *data, const value *args, size_t count, value *out) {
  CHECK(data == &callbacks && count == 1); callbacks++;
  CHECK(args[0].kind == WASMTIME_COMPONENT_LIST && args[0].of.list.size == 3);
  CHECK(args[0].of.list.data[0].of.option && !args[0].of.list.data[1].of.option && args[0].of.list.data[2].of.option);
  *out = clone(&args[0]);
  if (invalid) {
    value *field = &out->of.list.data[0].of.option->of.record.data[0].val;
    clear(field); *field = u32(17);
  }
  return NULL;
}
static void release(void *data) { CHECK(data == &callbacks); finalized++; }
int main(void) {
  (void)labels; (void)type_labels;
  structured_wasmtime *session = NULL; ok(structured_wasmtime_open(&session));
  for (unsigned binding = 0; binding < 2; ++binding) for (unsigned round = 0; round < 96; ++round) {
    structured_wasmtime_function host = 0;
    ok(structured_wasmtime_callback_create(session, bindings[binding].signature, callback, &callbacks, release, &host));
    argument input = {.value = seed(round)}, args[] = {input, {.function = host}}, output = {0};
    ok(structured_wasmtime_invoke(session, bindings[binding].call, args, 2, &output));
    value expected = text_n("left\0right<none>left\0right", 26);
    equal(&output.value, &expected); clear(&output.value); clear(&expected);
    invalid = true; output.value = u32(991);
    rejects(structured_wasmtime_invoke(session, bindings[binding].call, args, 2, &output), "Invalid WIT callback result");
    CHECK(output.value.kind == WASMTIME_COMPONENT_U32 && output.value.of.u32 == 991);
    clear(&output.value); invalid = false;
    ok(structured_wasmtime_invoke(session, bindings[binding].call, args, 2, &output)); clear(&output.value);
    ok(structured_wasmtime_function_close(session, &host)); CHECK(!host);
    argument closure = {0};
    ok(structured_wasmtime_invoke(session, bindings[binding].make, &input, 1, &closure));
    expected = SEQ(some(clone(&input.value)), none(), some(clone(&input.value))); clear(&input.value);
    argument invoke[] = {closure, {.value = empty()}};
    ok(structured_wasmtime_invoke(session, bindings[binding].invoke, invoke, 2, &output));
    ok(structured_wasmtime_function_close(session, &closure.function));
    equal(&output.value, &expected); clear(&output.value); clear(&expected); clear(&invoke[1].value);
  }
  structured_wasmtime_close(session); CHECK(callbacks == 576 && finalized == 192);
  printf("{\"checks\":%zu,\"callbacks\":%zu,\"finalized\":%zu,\"rejected\":192}\n", checks, callbacks, finalized);
  return 0;
}
