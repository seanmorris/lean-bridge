#include "glyphs_wasmtime.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
static glyphs_wasmtime *session;
#define CHECK(test) do { assert(test); ++checks; } while (0)
static wasmtime_component_val_t scalar(uint32_t value) {
  return (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_CHAR, .of.character = value};
}
static wasmtime_component_val_t list(size_t n, const wasmtime_component_val_t *items) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&value.of.list, n);
  if (n) memcpy(value.of.list.data, items, n * sizeof(*items));
  return value;
}
static wasmtime_component_val_t label(uint32_t marker, uint32_t point) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&value.of.record, 2);
  wasm_name_new(&value.of.record.data[0].name, 6, "marker");
  value.of.record.data[0].val = scalar(marker);
  wasm_name_new(&value.of.record.data[1].name, 4, "line");
  wasmtime_component_val_t item = scalar(point);
  value.of.record.data[1].val = list(1, &item);
  return value;
}
static wasmtime_component_val_t call(const char *name, wasmtime_component_val_t *args, size_t n) {
  wasmtime_component_val_t out = {0};
  wasmtime_error_t *error = glyphs_wasmtime_call(session, name, args, n, &out);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\n", (int)message.size, message.data);
  }
  CHECK(error == NULL);
  for (size_t i = 0; i < n; ++i) wasmtime_component_val_delete(&args[i]);
  return out;
}
int main(void) {
  CHECK(glyphs_wasmtime_open(&session) == NULL);
  const uint32_t points[] = {__POINTS__};
  for (size_t i = 0; i < sizeof(points) / sizeof(points[0]); ++i) {
    uint32_t point = points[i];
    wasmtime_component_val_t input = scalar(point), out = call("keep", &input, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_CHAR && out.of.character == point);
    wasmtime_component_val_delete(&out);
    input = scalar(point); out = call("point", &input, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == point); wasmtime_component_val_delete(&out);
    input = scalar(point); out = call("text", &input, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_STRING && out.of.string.size >= 1 && out.of.string.size <= 4);
    if (point == 0) CHECK(out.of.string.size == 1 && out.of.string.data[0] == 0);
    if (point == 0x1f331) CHECK(out.of.string.size == 4 && !memcmp(out.of.string.data, "\xf0\x9f\x8c\xb1", 4));
    wasmtime_component_val_delete(&out);
    for (int condition = 0; condition < 2; ++condition) {
      wasmtime_component_val_t args[] = {{.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = condition}, scalar(point), scalar(65)};
      out = call("choose", args, 3); CHECK(out.of.character == (condition ? point : 65)); wasmtime_component_val_delete(&out);
    }
    input = scalar(point); input = list(1, &input); out = call("keep-array", &input, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 1 && out.of.list.data[0].of.character == point); wasmtime_component_val_delete(&out);
    input = label(point, point); out = call("keep-label", &input, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_RECORD && out.of.record.data[0].val.of.character == point);
    CHECK(out.of.record.data[1].val.of.list.data[0].of.character == point); wasmtime_component_val_delete(&out);
  }
  wasmtime_component_val_t out = call("sprout", NULL, 0);
  CHECK(out.kind == WASMTIME_COMPONENT_CHAR && out.of.character == 0x1f331); wasmtime_component_val_delete(&out);
  const uint32_t bad[] = {0xd800, 0xdfff, 0x110000, 0xffffffff};
  for (size_t i = 0; i < sizeof(bad) / sizeof(bad[0]); ++i) {
    for (int shape = 0; shape < 6; ++shape) {
      wasmtime_component_val_t input = scalar(bad[i]); const char *name = "keep";
      if (shape == 1) { input = list(1, &input); name = "keep-array"; }
      if (shape == 2) { input = list(1, &input); input = list(1, &input); name = "keep-rows"; }
      if (shape == 3) { input = label(bad[i], 65); name = "keep-label"; }
      if (shape == 4) { input = label(65, bad[i]); name = "keep-label"; }
      if (shape == 5) { input.kind = WASMTIME_COMPONENT_U32; input.of.u32 = 65; }
      out = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 123};
      wasmtime_error_t *error = glyphs_wasmtime_call(session, name, &input, 1, &out);
      CHECK(error != NULL && out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 123);
      wasmtime_error_delete(error); wasmtime_component_val_delete(&input);
      input = scalar(65); out = call("keep", &input, 1); CHECK(out.of.character == 65); wasmtime_component_val_delete(&out);
    }
  }
  for (int i = 0; i < 1000; ++i) {
    wasmtime_component_val_t value = scalar(0x1f331), rows[] = {list(1, &value), list(0, NULL)};
    value = list(2, rows); out = call("keep-rows", &value, 1);
    CHECK(out.of.list.size == 2 && out.of.list.data[0].of.list.data[0].of.character == 0x1f331 && out.of.list.data[1].of.list.size == 0);
    wasmtime_component_val_delete(&out);
  }
  glyphs_wasmtime_close(session);
  printf("char-ok:%u\n", checks);
}
