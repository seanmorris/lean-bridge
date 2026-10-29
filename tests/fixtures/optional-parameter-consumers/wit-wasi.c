/** Exercise named WIT omission exports and the full-arity API independently. */
#include "defaults_wasmtime.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef wasmtime_component_val_t value;

static unsigned checks;
static unsigned refusals;
static defaults_wasmtime *session;

#define CHECK(test) do { \
  if (!(test)) { \
    fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); \
    exit(1); \
  } \
  ++checks; \
} while (0)

static value scalar(uint32_t number) {
  return (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = number};
}

static value character(uint32_t point) {
  return (value){.kind = WASMTIME_COMPONENT_CHAR, .of.character = point};
}

static value text(const char *data) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, strlen(data), data);
  return result;
}

static value natural(const uint32_t *limbs, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i)
    result.of.list.data[i] = scalar(limbs[i]);
  return result;
}

static value none(void) {
  return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL};
}

static value some(value payload) {
  value result = {.kind = WASMTIME_COMPONENT_OPTION};
  result.of.option = wasmtime_component_val_new(&payload);
  return result;
}

static value unit(void) {
  value result = {.kind = WASMTIME_COMPONENT_ENUM};
  wasm_name_new(&result.of.enumeration, 4, "unit");
  return result;
}

static int same(const value *left, const value *right) {
  if (left->kind != right->kind) return 0;
  switch (left->kind) {
  case WASMTIME_COMPONENT_U32:
    return left->of.u32 == right->of.u32;
  case WASMTIME_COMPONENT_CHAR:
    return left->of.character == right->of.character;
  case WASMTIME_COMPONENT_STRING:
    return left->of.string.size == right->of.string.size
      && (!left->of.string.size || memcmp(left->of.string.data,
          right->of.string.data, left->of.string.size) == 0);
  case WASMTIME_COMPONENT_ENUM:
    return left->of.enumeration.size == right->of.enumeration.size
      && (!left->of.enumeration.size || memcmp(left->of.enumeration.data,
          right->of.enumeration.data, left->of.enumeration.size) == 0);
  case WASMTIME_COMPONENT_LIST:
    if (left->of.list.size != right->of.list.size) return 0;
    for (size_t i = 0; i < left->of.list.size; ++i)
      if (!same(&left->of.list.data[i], &right->of.list.data[i])) return 0;
    return 1;
  case WASMTIME_COMPONENT_OPTION:
    if (!left->of.option || !right->of.option)
      return left->of.option == right->of.option;
    return same(left->of.option, right->of.option);
  default:
    return 0;
  }
}

static value call(const char *name, const value *args, size_t count) {
  value output = {0};
  wasmtime_error_t *error = defaults_wasmtime_call(
      session, name, args, count, &output);
  if (error) {
    wasm_name_t message = {0};
    wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data);
    wasm_name_delete(&message);
    wasmtime_error_delete(error);
    exit(1);
  }
  return output;
}

static void expect(const char *name, value *input, size_t count,
    value expected) {
  value output = call(name, input, count);
  CHECK(same(&output, &expected));
  wasmtime_component_val_delete(&output);
  wasmtime_component_val_delete(&expected);
  if (input) wasmtime_component_val_delete(input);
}

static void refused(const char *name, const value *input, size_t count,
    const char *diagnostic) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = UINT32_C(991)};
  wasmtime_error_t *error = defaults_wasmtime_call(
      session, name, input, count, &output);
  if (!error || output.kind != WASMTIME_COMPONENT_U32 || output.of.u32 != 991)
    exit(2);
  wasm_name_t message = {0};
  wasmtime_error_message(error, &message);
  if (message.size != strlen(diagnostic)
      || memcmp(message.data, diagnostic, message.size) != 0) exit(3);
  wasm_name_delete(&message);
  wasmtime_error_delete(error);
  ++refusals;
}

int main(void) {
  wasmtime_error_t *opened = defaults_wasmtime_open(&session);
  if (opened) return 1;

  expect("word-default", NULL, 0, scalar(7));
  value input = scalar(7); expect("word", &input, 1, scalar(7));
  input = scalar(11); expect("word", &input, 1, scalar(11));

  const uint32_t large[] = {0, 0, 10};
  const uint32_t eleven[] = {11};
  expect("natural-default", NULL, 0, natural(large, 3));
  input = natural(large, 3); expect("natural", &input, 1, natural(large, 3));
  input = natural(eleven, 1); expect("natural", &input, 1, natural(eleven, 1));

  expect("text-default", NULL, 0, text("Lean\nBridge"));
  input = text("Lean\nBridge"); expect("text", &input, 1, text("Lean\nBridge"));
  input = text("other"); expect("text", &input, 1, text("other"));

  expect("character-default", NULL, 0, character(0x3bb));
  input = character(0x3bb); expect("character", &input, 1, character(0x3bb));
  input = character(0x732b); expect("character", &input, 1, character(0x732b));

  expect("maybe-default", NULL, 0, none());
  input = none(); expect("maybe", &input, 1, none());
  input = some(scalar(11)); expect("maybe", &input, 1, some(scalar(11)));

  expect("present-default", NULL, 0, some(scalar(9)));
  input = some(scalar(9)); expect("present", &input, 1, some(scalar(9)));
  input = none(); expect("present", &input, 1, none());
  input = some(scalar(11)); expect("present", &input, 1, some(scalar(11)));

  expect("unit-value-default", NULL, 0, unit());
  input = unit(); expect("unit-value", &input, 1, unit());

  refused("word", NULL, 1,
      "Invalid WIT call arguments or unavailable session");
  input = text("wrong");
  refused("word", &input, 1,
      "Unknown export, invalid WIT input or 16 MiB conversion limit");
  wasmtime_component_val_delete(&input);
  if (refusals != 2) return 4;

  defaults_wasmtime_close(session);
  printf("optional-parameter-wit-wasi:%u\n", checks);
  return 0;
}
