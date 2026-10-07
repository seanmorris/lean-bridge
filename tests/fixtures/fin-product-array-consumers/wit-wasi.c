#define _GNU_SOURCE
#include "finproductarrays_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static finproductarrays_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Nat crosses as little-endian u32 limbs without trailing zeros; zero is the empty list. */
static value limbs(const uint32_t *items, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = items[i]};
  return result;
}
static const uint32_t huge[4] = {0, 0, 0, 16}; /* 2^100 */
static value nat(uint32_t number) { return number ? limbs(&number, 1) : limbs(NULL, 0); }
static bool same_limbs(const value *v, const uint32_t *items, size_t count) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size != count) return false;
  for (size_t i = 0; i < count; ++i) if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32 || v->of.list.data[i].of.u32 != items[i]) return false;
  return true;
}
static bool is_nat(const value *v, uint32_t number) { return number ? same_limbs(v, &number, 1) : same_limbs(v, NULL, 0); }
static value branch(bool ok, value child) { return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {ok, wasmtime_component_val_new(&child)}}; }
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE};
  wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
/* (c0, ok 2^100), (c1, error e), (c2, ok 6); valid rows use components 0, 2, 3 and error 5. */
static value rows(const uint32_t *components, uint32_t error, size_t count) {
  value v = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&v.of.list, count);
  value items[3] = {pair(nat(components[0]), branch(true, limbs(huge, 4))), pair(nat(components[1]), branch(false, nat(error))), pair(nat(components[2]), branch(true, nat(6)))};
  for (size_t i = 0; i < count; ++i) v.of.list.data[i] = items[i];
  for (size_t i = count; i < 3; ++i) clear(&items[i]);
  return v;
}
/* Row i of the valid input, at position `at` of a list. */
static bool valid_row(const value *list, size_t at, size_t i) {
  const value *row = &list->of.list.data[at];
  if (row->kind != WASMTIME_COMPONENT_TUPLE || row->of.tuple.size != 2) return false;
  const value *component = &row->of.tuple.data[0], *b = &row->of.tuple.data[1];
  if (b->kind != WASMTIME_COMPONENT_RESULT || b->of.result.is_ok != (i != 1)) return false;
  if (i == 0) return is_nat(component, 0) && same_limbs(b->of.result.val, huge, 4);
  if (i == 1) return is_nat(component, 2) && is_nat(b->of.result.val, 5);
  return is_nat(component, 3) && is_nat(b->of.result.val, 6);
}
static value call(const char *name, value *args) {
  value result = {0};
  wasmtime_error_t *error = finproductarrays_wasmtime_call(session, name, args, 1, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  return result;
}
/* A rejected call names the parameter and the leaf's bound and leaves the result slot unchanged. */
static bool rejected(const char *name, value *input, const char *expected) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = finproductarrays_wasmtime_call(session, name, input, 1, &output);
  if (!error) return false;
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool named = message.size >= strlen(expected) && memmem(message.data, message.size, expected, strlen(expected)) != NULL;
  wasm_byte_vec_delete(&message); wasmtime_error_delete(error);
  return named && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}
/* 2^100 + 1016 as limbs. */
static const uint32_t expected[4] = {1016, 0, 0, 16};

int main(void) {
  CHECK(finproductarrays_wasmtime_open(&session) == NULL);
  const uint32_t valid[3] = {0, 2, 3};
  value arg, out;
  /* An empty array is valid, in and out. */
  arg = rows(valid, 5, 0); out = call("rows", &arg); clear(&arg); CHECK(is_nat(&out, 0)); clear(&out);
  arg = rows(valid, 5, 0); out = call("reversed", &arg); clear(&arg); CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 0); clear(&out);
  /* Endpoints 3 and 5, and an ok Nat wider than any bound. */
  arg = rows(valid, 5, 3); out = call("rows", &arg); clear(&arg); CHECK(same_limbs(&out, expected, 4)); clear(&out);
  /* A component at its bound is rejected in the first, middle and last element; the input is unchanged. */
  for (int k = 0; k < 3; ++k) {
    uint32_t components[3] = {0, 2, 3}; components[k] = 4;
    arg = rows(components, 5, 3);
    CHECK(rejected("rows", &arg, "arg0 is not below its Fin 4 bound"));
    for (int i = 0; i < 3; ++i) if (i != k) CHECK(valid_row(&arg, i, i));
    CHECK(is_nat(&arg.of.list.data[k].of.tuple.data[0], 4));
    clear(&arg);
  }
  /* The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above. */
  arg = rows(valid, 6, 3);
  CHECK(rejected("rows", &arg, "arg0 is not below its Fin 6 bound"));
  CHECK(valid_row(&arg, 0, 0) && valid_row(&arg, 2, 2) && is_nat(arg.of.list.data[1].of.tuple.data[1].of.result.val, 6));
  clear(&arg);
  /* A valid call recovers, and Lean returns the rows reversed below their bounds. */
  arg = rows(valid, 5, 3); out = call("rows", &arg); CHECK(same_limbs(&out, expected, 4)); clear(&out);
  out = call("reversed", &arg);
  CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 3 && valid_row(&out, 0, 2) && valid_row(&out, 1, 1) && valid_row(&out, 2, 0));
  CHECK(valid_row(&arg, 0, 0) && valid_row(&arg, 1, 1) && valid_row(&arg, 2, 2));
  clear(&out); clear(&arg);
  for (uint32_t i = 0; i < 1000; ++i) {
    arg = rows(valid, 5, 3); out = call("rows", &arg); clear(&arg);
    if (!same_limbs(&out, expected, 4)) { fprintf(stderr, "round %u failed\n", i); return 1; }
    clear(&out);
    const uint32_t bad[3] = {0, 2, 4 + i};
    arg = rows(bad, 5, 3);
    if (!rejected("rows", &arg, "arg0 is not below its Fin 4 bound")) { fprintf(stderr, "rejection round %u failed\n", i); return 1; }
    clear(&arg);
  }
  checks += 2000;
  finproductarrays_wasmtime_close(session);
  printf("fin-product-array-ok:%u\n", checks);
  return 0;
}
