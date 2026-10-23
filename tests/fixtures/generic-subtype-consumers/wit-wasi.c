#include "nominalsubtypes_wasmtime.h"
/* The shared value helpers serve the nominal caller too; only their unused
   definitions are exempt, so warnings in this caller still fail. */
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-function"
#include "../nominal-subtype-consumers/wit-values.h"
#pragma GCC diagnostic pop
#include <stdio.h>

static nominalsubtypes_wasmtime *session;
static unsigned checks, rejections;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

static value generic(uint32_t member, uint32_t marker) {
  return two_fields("value", small(member), "marker", small(marker));
}
static value *field(value *record, const char *name) {
  if (record->kind != WASMTIME_COMPONENT_RECORD) return NULL;
  for (size_t i = 0; i < record->of.record.size; ++i)
    if (record->of.record.data[i].name.size == strlen(name) &&
        memcmp(record->of.record.data[i].name.data, name, strlen(name)) == 0)
      return &record->of.record.data[i].val;
  return NULL;
}
static bool same_generic(value *record, uint32_t member, uint32_t marker) {
  value *a = field(record, "value"), *b = field(record, "marker");
  return a && b && a->kind == WASMTIME_COMPONENT_LIST && b->kind == WASMTIME_COMPONENT_LIST
    && a->of.list.size == (member ? 1u : 0u) && b->of.list.size == (marker ? 1u : 0u)
    && (!member || (a->of.list.data[0].kind == WASMTIME_COMPONENT_U32 && a->of.list.data[0].of.u32 == member))
    && (!marker || (b->of.list.data[0].kind == WASMTIME_COMPONENT_U32 && b->of.list.data[0].of.u32 == marker));
}
static int call_record(const char *name, value input, uint32_t member, uint32_t marker) {
  value before = clone(&input), output = {0};
  wasmtime_error_t *error = nominalsubtypes_wasmtime_call(session, name, &input, 1, &output);
  if (error) { wasmtime_error_delete(error); clear(&input); clear(&before); return 0; }
  CHECK(same_generic(&output, member, marker)); CHECK(same(&input, &before));
  clear(&input); clear(&before); clear(&output); return 1;
}
static int call_scalar(value input, uint32_t expected) {
  value before = clone(&input), output = {0}, wanted = small(expected);
  wasmtime_error_t *error = nominalsubtypes_wasmtime_call(session, "generic-use", &input, 1, &output);
  if (error) { wasmtime_error_delete(error); clear(&input); clear(&before); clear(&wanted); return 0; }
  CHECK(same(&output, &wanted)); CHECK(same(&input, &before));
  clear(&input); clear(&before); clear(&output); clear(&wanted); return 1;
}
static int refused(const char *name, value input, const char *constructor) {
  value before = clone(&input), output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  char expected[128]; snprintf(expected, sizeof(expected), "arg0.value was rejected by NominalSubtypes.%s", constructor);
  wasmtime_error_t *error = nominalsubtypes_wasmtime_call(session, name, &input, 1, &output);
  if (!error) { clear(&input); clear(&before); clear(&output); return 0; }
  wasm_name_t message; wasmtime_error_message(error, &message);
  CHECK(exact_cause(message.data, message.size, expected));
  CHECK(same(&input, &before) && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  ++rejections; wasm_name_delete(&message); wasmtime_error_delete(error);
  clear(&input); clear(&before); clear(&output); return 1;
}
int main(void) {
  CHECK(nominalsubtypes_wasmtime_open(&session) == NULL); --checks;
  if (!call_scalar(generic(40, 2), 43)) return 1;
  if (!call_record("echo-generic-first", generic(40, 2), 41, 2)) return 1;
  if (!call_record("echo-generic-second", generic(40, 2), 42, 2)) return 1;
  if (!call_scalar(generic(99, 7), 107)) return 1;
  if (!call_record("echo-generic-first", generic(99, 7), 100, 7)) return 1;
  if (!refused("generic-use", generic(100, 2), "plusOne")) return 1;
  if (!refused("echo-generic-first", generic(100, 2), "plusOne")) return 1;
  if (!refused("echo-generic-second", generic(90, 2), "plusTwo")) return 1;
  if (!call_record("echo-generic-second", generic(40, 2), 42, 2)) return 1;
  nominalsubtypes_wasmtime_close(session);
  printf("{\"checks\":%u,\"rejections\":%u}\n", checks, rejections);
  return 0;
}
