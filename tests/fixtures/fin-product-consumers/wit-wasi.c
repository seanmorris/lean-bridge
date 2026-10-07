#define _GNU_SOURCE
#include "finproducts_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static finproducts_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Nat crosses as little-endian u32 limbs without trailing zeros; zero is the empty list. */
static value limbs(const uint32_t *items, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = items[i]};
  return result;
}
static value nat(uint32_t number) { return number ? limbs(&number, 1) : limbs(NULL, 0); }
static bool is_nat(const value *v, uint32_t number) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  if (!number) return v->of.list.size == 0;
  return v->of.list.size == 1 && v->of.list.data[0].kind == WASMTIME_COMPONENT_U32 && v->of.list.data[0].of.u32 == number;
}
static value text(const char *bytes) { value v = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&v.of.string, strlen(bytes), bytes); return v; }
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION}; }
static value some(value child) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&child)}; }
static value branch(bool ok, value child) { return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {ok, wasmtime_component_val_new(&child)}}; }
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE};
  wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value call(const char *name, value *args) {
  value result = {0};
  wasmtime_error_t *error = finproducts_wasmtime_call(session, name, args, 1, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  clear(args);
  return result;
}
/* A rejected call names the parameter and the leaf's bound and leaves the result slot unchanged. */
static bool rejected(const char *name, value *input, const char *expected) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = finproducts_wasmtime_call(session, name, input, 1, &output);
  clear(input);
  if (!error) return false;
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool named = message.size >= strlen(expected) && memmem(message.data, message.size, expected, strlen(expected)) != NULL;
  wasm_byte_vec_delete(&message); wasmtime_error_delete(error);
  return named && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}

int main(void) {
  CHECK(finproducts_wasmtime_open(&session) == NULL);
  value arg, out;
  /* Fin 10 × Nat: only the first component is bounded. */
  for (uint32_t d = 0; d < 10; ++d) {
    arg = pair(nat(d), nat(1000)); out = call("first", &arg);
    CHECK(out.kind == WASMTIME_COMPONENT_TUPLE && is_nat(&out.of.tuple.data[0], 9 - d) && is_nat(&out.of.tuple.data[1], 1001)); clear(&out);
  }
  arg = pair(nat(10), nat(0)); CHECK(rejected("first", &arg, "arg0 is not below its Fin 10 bound"));
  const uint32_t beyond[3] = {0, 0, 64}; /* 2^70 */
  arg = pair(limbs(beyond, 3), nat(0)); CHECK(rejected("first", &arg, "arg0 is not below its Fin 10 bound"));
  /* Nat × Fin 1, and a bound wider than 64 bits (10 * 2^64 + 10) beside Fin 10. */
  arg = pair(nat(41), nat(0)); out = call("second", &arg); CHECK(is_nat(&out, 41)); clear(&out);
  arg = pair(nat(41), nat(1)); CHECK(rejected("second", &arg, "arg0 is not below its Fin 1 bound"));
  const uint32_t below_wide[3] = {9, 0, 10}, at_wide[3] = {10, 0, 10};
  arg = pair(limbs(below_wide, 3), nat(9)); out = call("wide", &arg); CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 3); clear(&out);
  arg = pair(limbs(at_wide, 3), nat(9)); CHECK(rejected("wide", &arg, "arg0 is not below its Fin 184467440737095516170 bound"));
  arg = pair(limbs(below_wide, 3), nat(10)); CHECK(rejected("wide", &arg, "arg0 is not below its Fin 10 bound"));
  /* Option (Fin 0 × Nat): only none is valid. */
  arg = none(); out = call("never", &arg); CHECK(is_nat(&out, 7)); clear(&out);
  arg = some(pair(nat(0), nat(0))); CHECK(rejected("never", &arg, "arg0 is not below its Fin 0 bound"));
  /* Except String (Fin 10): the ok branch is bounded; an inactive branch is never read. */
  arg = branch(true, nat(9)); out = call("ok-only", &arg); CHECK(is_nat(&out, 9)); clear(&out);
  arg = branch(true, nat(10)); CHECK(rejected("ok-only", &arg, "arg0 is not below its Fin 10 bound"));
  arg = branch(false, text("four")); out = call("ok-only", &arg); CHECK(is_nat(&out, 104)); clear(&out);
  /* Except (Fin 5) Nat and Except (Fin 3) (Fin 7): only the active branch is checked. */
  arg = branch(false, nat(4)); out = call("error-only", &arg); CHECK(is_nat(&out, 104)); clear(&out);
  arg = branch(false, nat(5)); CHECK(rejected("error-only", &arg, "arg0 is not below its Fin 5 bound"));
  arg = branch(true, nat(6)); out = call("both", &arg); CHECK(is_nat(&out, 6)); clear(&out);
  arg = branch(true, nat(7)); CHECK(rejected("both", &arg, "arg0 is not below its Fin 7 bound"));
  arg = branch(false, nat(2)); out = call("both", &arg); CHECK(is_nat(&out, 102)); clear(&out);
  arg = branch(false, nat(3)); CHECK(rejected("both", &arg, "arg0 is not below its Fin 3 bound"));
  /* List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels. */
  for (int round = 0; round < 4; ++round) {
    uint32_t component = round == 2 ? 3 : 2, error = round == 1 ? 2 : 1;
    value rows = {.kind = WASMTIME_COMPONENT_LIST};
    wasmtime_component_vallist_new_uninit(&rows.of.list, 3);
    rows.of.list.data[0] = none();
    rows.of.list.data[1] = some(pair(nat(component), branch(true, nat(50))));
    rows.of.list.data[2] = some(pair(nat(1), branch(false, nat(error))));
    if (round == 1) { CHECK(rejected("nested", &rows, "arg0 is not below its Fin 2 bound")); continue; }
    if (round == 2) { CHECK(rejected("nested", &rows, "arg0 is not below its Fin 3 bound")); continue; }
    out = call("nested", &rows); CHECK(is_nat(&out, 54)); clear(&out); /* Valid before and after the rejections. */
  }
  /* DigitPair := Digit × Digit through the alias. */
  arg = pair(nat(1), nat(9)); out = call("aliased", &arg);
  CHECK(out.kind == WASMTIME_COMPONENT_TUPLE && is_nat(&out.of.tuple.data[0], 9) && is_nat(&out.of.tuple.data[1], 1)); clear(&out);
  arg = pair(nat(1), nat(10)); CHECK(rejected("aliased", &arg, "arg0 is not below its Fin 10 bound"));
  /* Results carrying bounds are produced by Lean and arrive below them. */
  arg = nat(4); out = call("produce", &arg); CHECK(out.kind == WASMTIME_COMPONENT_RESULT && !out.of.result.is_ok && is_nat(out.of.result.val, 4)); clear(&out);
  arg = nat(23); out = call("pair-up", &arg); CHECK(is_nat(&out.of.tuple.data[0], 3) && is_nat(&out.of.tuple.data[1], 23)); clear(&out);
  for (uint32_t i = 0; i < 1000; ++i) {
    arg = pair(nat(i % 10), nat(i)); out = call("first", &arg);
    if (!is_nat(&out.of.tuple.data[0], 9 - i % 10)) { fprintf(stderr, "round %u failed\n", i); return 1; }
    clear(&out);
    arg = pair(nat(10 + i), nat(i));
    if (!rejected("first", &arg, "arg0 is not below its Fin 10 bound")) { fprintf(stderr, "rejection round %u failed\n", i); return 1; }
  }
  checks += 2000;
  finproducts_wasmtime_close(session);
  printf("fin-product-ok:%u\n", checks);
  return 0;
}
