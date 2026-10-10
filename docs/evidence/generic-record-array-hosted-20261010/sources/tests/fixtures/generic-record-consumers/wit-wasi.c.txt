#include "genericrecords_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static genericrecords_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Nat crosses as little-endian u32 limbs without trailing zeros; zero is the empty list. */
static value nat(uint64_t number) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  size_t limbs = number > UINT32_MAX ? 2 : number ? 1 : 0;
  wasmtime_component_vallist_new_uninit(&result.of.list, limbs);
  for (size_t i = 0; i < limbs; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = (uint32_t)(number >> (32 * i))};
  return result;
}
static bool is_nat(const value *v, uint64_t number) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  uint64_t seen = 0;
  if (v->of.list.size > 2) return false;
  for (size_t i = 0; i < v->of.list.size; ++i) {
    if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
    seen |= (uint64_t)v->of.list.data[i].of.u32 << (32 * i);
  }
  return seen == number;
}
/* One set bit at the given position, as the limb list. */
static value power(unsigned bit) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, bit / 32 + 1);
  for (size_t i = 0; i <= bit / 32; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = i == bit / 32 ? UINT32_C(1) << (bit % 32) : 0};
  return result;
}
static bool is_power_plus(const value *v, unsigned bit, uint32_t low) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size != bit / 32 + 1) return false;
  for (size_t i = 0; i <= bit / 32; ++i) {
    uint32_t expected = (i == bit / 32 ? UINT32_C(1) << (bit % 32) : 0) + (i == 0 ? low : 0);
    if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32 || v->of.list.data[i].of.u32 != expected) return false;
  }
  return true;
}
static value text(const char *bytes) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, strlen(bytes), bytes);
  return result;
}
static bool is_text(const value *v, const char *bytes) {
  return v->kind == WASMTIME_COMPONENT_STRING && v->of.string.size == strlen(bytes) && memcmp(v->of.string.data, bytes, strlen(bytes)) == 0;
}
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION}; }
static value some(value child) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&child)}; }
/* Each alias is its own WIT record with the structure's fields instantiated; builders take ownership of the fields. */
static value record2(const char *a, value first, const char *b, value second) {
  value v = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&v.of.record, 2);
  wasm_name_new(&v.of.record.data[0].name, strlen(a), a); v.of.record.data[0].val = first;
  wasm_name_new(&v.of.record.data[1].name, strlen(b), b); v.of.record.data[1].val = second;
  return v;
}
static value record1(const char *a, value first) {
  value v = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&v.of.record, 1);
  wasm_name_new(&v.of.record.data[0].name, strlen(a), a); v.of.record.data[0].val = first;
  return v;
}
static const value *field(const value *v, const char *name) {
  if (v->kind != WASMTIME_COMPONENT_RECORD) return NULL;
  for (size_t i = 0; i < v->of.record.size; ++i)
    if (v->of.record.data[i].name.size == strlen(name) && memcmp(v->of.record.data[i].name.data, name, strlen(name)) == 0) return &v->of.record.data[i].val;
  return NULL;
}
static value box(uint64_t count_value, uint64_t count) { return record2("value", nat(count_value), "count", nat(count)); }
/* Call an export, release the arguments and return the owned result. */
static value call(const char *name, value *args, size_t count) {
  value result = {0};
  wasmtime_error_t *error = genericrecords_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  for (size_t i = 0; i < count; ++i) clear(&args[i]);
  return result;
}
/* A rejected call leaves the output untouched and the session usable. */
static bool rejected(const char *name, value *input) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = genericrecords_wasmtime_call(session, name, input, 1, &output);
  clear(input);
  if (!error) return false;
  wasmtime_error_delete(error);
  return output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}
int main(void) {
  const char *greeting = "h\xc3\xa9llo \xf0\x9f\x99\x82";
  CHECK(genericrecords_wasmtime_open(&session) == NULL);
  value args[1], out;
  args[0] = box(4, 1); out = call("bump", args, 1);
  CHECK(out.kind == WASMTIME_COMPONENT_RECORD && out.of.record.size == 2 && is_nat(field(&out, "value"), 5) && is_nat(field(&out, "count"), 2)); clear(&out);
  args[0] = box(4, 1); out = call("again", args, 1);
  CHECK(is_nat(field(&out, "value"), 8) && is_nat(field(&out, "count"), 1)); clear(&out);
  args[0] = record2("value", text(greeting), "count", nat(3)); out = call("shout", args, 1);
  CHECK(is_text(field(&out, "value"), "h\xc3\xa9llo \xf0\x9f\x99\x82!") && is_nat(field(&out, "count"), 3)); clear(&out);
  args[0] = record2("first", text("a"), "second", nat(1)); out = call("swap-named", args, 1);
  CHECK(is_text(field(&out, "first"), "a!") && is_nat(field(&out, "second"), 2)); clear(&out);
  /* A parameter instantiated with Option Nat and a List of a named instantiation. */
  args[0] = record2("value", some(nat(5)), "count", nat(2)); out = call("or-zero", args, 1); CHECK(is_nat(&out, 7)); clear(&out);
  args[0] = record2("value", none(), "count", nat(2)); out = call("or-zero", args, 1); CHECK(is_nat(&out, 2)); clear(&out);
  value boxes = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&boxes.of.list, 3);
  boxes.of.list.data[0] = box(1, 0); boxes.of.list.data[1] = box(2, 0); boxes.of.list.data[2] = record2("value", power(70), "count", nat(0));
  args[0] = boxes; out = call("total", args, 1); CHECK(is_power_plus(&out, 70, 3)); clear(&out);
  args[0] = (value){.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&args[0].of.list, 0);
  out = call("total", args, 1); CHECK(is_nat(&out, 0)); clear(&out);
  args[0] = nat(2); out = call("first-boxes", args, 1);
  CHECK(out.kind == WASMTIME_COMPONENT_OPTION && out.of.option && out.of.option->kind == WASMTIME_COMPONENT_LIST && out.of.option->of.list.size == 2);
  CHECK(is_nat(field(&out.of.option->of.list.data[1], "value"), 1) && is_nat(field(&out.of.option->of.list.data[1], "count"), 2)); clear(&out);
  args[0] = nat(0); out = call("first-boxes", args, 1); CHECK(out.kind == WASMTIME_COMPONENT_OPTION && !out.of.option); clear(&out);
  /* A pair of two named instantiations. */
  args[0] = record2("first", box(3, 0), "second", record2("value", text("abcd"), "count", nat(0)));
  out = call("unpair", args, 1); CHECK(is_nat(&out, 7)); clear(&out);
  /* A universe-polymorphic structure instantiated at Type. */
  args[0] = record2("tag", text("t"), "payload", nat(1)); out = call("retag", args, 1);
  CHECK(is_text(field(&out, "tag"), "t#") && is_nat(field(&out, "payload"), 2)); clear(&out);
  /* A phantom argument: the instantiation names Marker, which no field carries. */
  args[0] = record1("label", text("m")); out = call("relabel", args, 1); CHECK(is_text(field(&out, "label"), "m?")); clear(&out);
  /* Shape checks stay exact: a wrong field type, a missing field and a trailing zero limb are refused. */
  args[0] = record2("value", text("four"), "count", nat(1)); CHECK(rejected("bump", &args[0]));
  args[0] = record1("value", nat(4)); CHECK(rejected("bump", &args[0]));
  value zeros = {.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&zeros.of.list, 1);
  zeros.of.list.data[0] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 0};
  args[0] = record2("value", zeros, "count", nat(1)); CHECK(rejected("bump", &args[0]));
  args[0] = box(1, 1); out = call("bump", args, 1); CHECK(is_nat(field(&out, "value"), 2)); clear(&out);
  for (uint64_t i = 0; i < 1000; ++i) {
    args[0] = box(i, i); out = call("bump", args, 1);
    if (!is_nat(field(&out, "value"), i + 1) || !is_nat(field(&out, "count"), i + 1)) { fprintf(stderr, "round %llu failed\n", (unsigned long long)i); return 1; }
    clear(&out);
  }
  checks += 1000;
  genericrecords_wasmtime_close(session);
  printf("generic-records-ok:%u\n", checks);
  return 0;
}
