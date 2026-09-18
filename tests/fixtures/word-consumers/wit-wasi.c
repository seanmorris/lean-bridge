#include "words_wasmtime.h"
#include <assert.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
static unsigned checks;
static words_wasmtime *session;
#define CHECK(test) do { assert(test); ++checks; } while (0)
static wasmtime_component_val_t scalar(int sign, uint64_t bits) {
  wasmtime_component_val_t value = {.kind = sign ? WASMTIME_COMPONENT_S64 : WASMTIME_COMPONENT_U64};
  if (sign) memcpy(&value.of.s64, &bits, sizeof(bits)); else value.of.u64 = bits;
  return value;
}
static wasmtime_component_val_t list(size_t n, const wasmtime_component_val_t *items) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&value.of.list, n);
  if (n) memcpy(value.of.list.data, items, n * sizeof(*items));
  return value;
}
static wasmtime_component_val_t sample(uint64_t u, int64_t s) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_RECORD};
  const char *names[] = {"natural", "integer", "unsigned-values", "signed-values"};
  wasmtime_component_valrecord_new_uninit(&value.of.record, 4);
  for (int i = 0; i < 4; ++i) {
    wasm_name_new(&value.of.record.data[i].name, strlen(names[i]), names[i]);
    wasmtime_component_val_t v = scalar(i % 2, i % 2 ? (uint64_t)s : u);
    value.of.record.data[i].val = i < 2 ? v : list(1, &v);
  }
  return value;
}
static wasmtime_component_val_t call(const char *name, wasmtime_component_val_t *args, size_t n) {
  wasmtime_component_val_t out = {0};
  wasmtime_error_t *error = words_wasmtime_call(session, name, args, n, &out);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\n", (int)message.size, message.data);
  }
  CHECK(error == NULL);
  for (size_t i = 0; i < n; ++i) wasmtime_component_val_delete(&args[i]);
  return out;
}
int main(void) {
  CHECK(words_wasmtime_open(&session) == NULL);
  wasmtime_component_val_t out = call("word-bits", NULL, 0);
  CHECK(out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 64); wasmtime_component_val_delete(&out);
  const uint64_t us[] = {0, 1, UINT32_MAX, UINT64_C(9007199254740993), UINT64_MAX};
  const int64_t ss[] = {INT64_MIN, INT64_C(-9007199254740993), -1, 0, INT64_MAX};
  for (int i = 0; i < 5; ++i) {
    for (int sign = 0; sign < 2; ++sign) {
      uint64_t bits = sign ? (uint64_t)ss[i] : us[i];
      wasmtime_component_val_t input = scalar(sign, bits);
      out = call(sign ? "keep-signed" : "keep-unsigned", &input, 1);
      CHECK(out.kind == input.kind && (sign ? out.of.s64 == ss[i] : out.of.u64 == us[i])); wasmtime_component_val_delete(&out);
      input = scalar(sign, bits); out = call(sign ? "advance-signed" : "advance-unsigned", &input, 1);
      CHECK(sign ? out.of.s64 == (ss[i] == INT64_MAX ? INT64_MIN : ss[i] + 1) : out.of.u64 == us[i] + 1); wasmtime_component_val_delete(&out);
      char expected[32]; int n = sign ? snprintf(expected, sizeof(expected), "%" PRId64, ss[i]) : snprintf(expected, sizeof(expected), "%" PRIu64, us[i]);
      input = scalar(sign, bits); out = call(sign ? "signed-text" : "unsigned-text", &input, 1);
      CHECK(out.kind == WASMTIME_COMPONENT_STRING && out.of.string.size == (size_t)n && !memcmp(out.of.string.data, expected, (size_t)n)); wasmtime_component_val_delete(&out);
      input = scalar(sign, bits); input = list(1, &input); out = call(sign ? "keep-signed-values" : "keep-unsigned-values", &input, 1);
      CHECK(out.of.list.size == 1 && (sign ? out.of.list.data[0].of.s64 == ss[i] : out.of.list.data[0].of.u64 == us[i])); wasmtime_component_val_delete(&out);
    }
    wasmtime_component_val_t input = sample(us[i], ss[i]); out = call("keep-sample", &input, 1);
    CHECK(out.of.record.data[0].val.of.u64 == us[i] && out.of.record.data[1].val.of.s64 == ss[i]);
    CHECK(out.of.record.data[2].val.of.list.data[0].of.u64 == us[i] && out.of.record.data[3].val.of.list.data[0].of.s64 == ss[i]); wasmtime_component_val_delete(&out);
  }
  for (int sign = 0; sign < 2; ++sign) {
    for (int shape = 0; shape < 3; ++shape) {
      wasmtime_component_val_t input = scalar(!sign, 1), output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 123};
      const char *name = sign ? "keep-signed" : "keep-unsigned";
      if (shape > 0) { input = list(1, &input); name = sign ? "keep-signed-values" : "keep-unsigned-values"; }
      if (shape > 1) { input = list(1, &input); name = sign ? "keep-signed-rows" : "keep-unsigned-rows"; }
      wasmtime_error_t *error = words_wasmtime_call(session, name, &input, 1, &output);
      CHECK(error != NULL && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 123);
      wasmtime_error_delete(error); wasmtime_component_val_delete(&input);
    }
  }
  for (int i = 0; i < 1000; ++i) for (int sign = 0; sign < 2; ++sign) {
    wasmtime_component_val_t value = scalar(sign, sign ? (uint64_t)INT64_MIN : UINT64_MAX);
    wasmtime_component_val_t rows[] = {list(1, &value), list(0, NULL)};
    value = list(2, rows); out = call(sign ? "keep-signed-rows" : "keep-unsigned-rows", &value, 1);
    CHECK(out.of.list.size == 2 && out.of.list.data[1].of.list.size == 0);
    CHECK(sign ? out.of.list.data[0].of.list.data[0].of.s64 == INT64_MIN : out.of.list.data[0].of.list.data[0].of.u64 == UINT64_MAX);
    wasmtime_component_val_delete(&out);
  }
  words_wasmtime_close(session);
  printf("word-ok:%u\n", checks);
}
