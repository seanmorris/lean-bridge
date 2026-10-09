#include "fincontainers_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static fincontainers_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Nat and Fin cross as little-endian u32 limbs. */
static value nat(const uint32_t *limbs, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return result;
}
static value small(uint32_t number) { return nat(&number, number ? 1 : 0); }
static value list(size_t count, const value *items) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  if (count) memcpy(result.of.list.data, items, count * sizeof(*items));
  return result;
}
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION}; }
static value some(value child) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&child)}; }
static value text(const char *bytes) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, strlen(bytes), bytes);
  return result;
}
static bool is_nat(const value *v, const uint32_t *limbs, size_t count) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size != count) return false;
  for (size_t i = 0; i < count; ++i) if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32 || v->of.list.data[i].of.u32 != limbs[i]) return false;
  return true;
}
static bool is_small(const value *v, uint32_t number) { return is_nat(v, &number, number ? 1 : 0); }
static value call(const char *name, value *args, size_t count) {
  value result = {0};
  wasmtime_error_t *error = fincontainers_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  for (size_t i = 0; i < count; ++i) clear(&args[i]);
  return result;
}
/* A rejected call names the parameter and the failed leaf's bound and leaves the result slot unchanged. */
static bool rejected(const char *name, value *args, size_t count, const char *needle) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = fincontainers_wasmtime_call(session, name, args, count, &output);
  for (size_t i = 0; i < count; ++i) clear(&args[i]);
  if (!error) return false;
  wasm_name_t message; wasmtime_error_message(error, &message);
  char *copy = calloc(message.size + 1, 1);
  if (!copy) exit(1);
  memcpy(copy, message.data, message.size);
  bool found = strstr(copy, needle) != NULL;
  if (!found) fprintf(stderr, "Expected '%s' in '%s'\n", needle, copy);
  free(copy); wasm_name_delete(&message); wasmtime_error_delete(error);
  return found && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}
static value digits(const uint32_t *numbers, size_t count) {
  value items[8];
  for (size_t i = 0; i < count; ++i) items[i] = small(numbers[i]);
  return list(count, items);
}
int main(void) {
  CHECK(fincontainers_wasmtime_open(&session) == NULL);
  const uint32_t word[] = {0, 1}, huge[] = {0, 0, 64}, last[] = {UINT32_MAX, UINT32_MAX, 63}, sum[] = {UINT32_MAX, 0, 64};
  const uint32_t all[] = {0, 1, 2, 3, 4, 5, 6, 7}, ten_first[] = {10, 2, 3}, ten_middle[] = {1, 10, 3}, ten_last[] = {1, 2, 10};
  value args[2], out;
  /* Array (Fin 10): every element is checked; results stay below the bound. */
  args[0] = digits(all, 8); out = call("mirror-all", args, 1);
  CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 8);
  for (uint32_t i = 0; i < 8; ++i) CHECK(is_small(&out.of.list.data[i], 9 - i));
  clear(&out);
  args[0] = list(0, NULL); out = call("mirror-all", args, 1); CHECK(out.of.list.size == 0); clear(&out);
  args[0] = digits(ten_first, 3); CHECK(rejected("mirror-all", args, 1, "arg0 is not below its Fin 10 bound"));
  args[0] = digits(ten_middle, 3); CHECK(rejected("mirror-all", args, 1, "arg0 is not below its Fin 10 bound"));
  args[0] = digits(ten_last, 3); CHECK(rejected("mirror-all", args, 1, "arg0 is not below its Fin 10 bound"));
  { value items[2] = {nat(word, 2), small(1)}; args[0] = list(2, items); CHECK(rejected("mirror-all", args, 1, "arg0 is not below its Fin 10 bound")); }
  /* Array (Fin 0): only the empty array has values. */
  args[0] = list(0, NULL); out = call("count-none", args, 1); CHECK(is_small(&out, 0)); clear(&out);
  { value items[1] = {small(0)}; args[0] = list(1, items); CHECK(rejected("count-none", args, 1, "arg0 is not below its Fin 0 bound")); }
  /* List Huge: a 2^70 bound compared limb by limb. */
  { value items[2] = {nat(word, 2), nat(last, 3)}; args[0] = list(2, items); out = call("sum-huge", args, 1); CHECK(is_nat(&out, sum, 3)); clear(&out); }
  args[0] = list(0, NULL); out = call("sum-huge", args, 1); CHECK(is_small(&out, 0)); clear(&out);
  { value items[2] = {nat(word, 2), nat(huge, 3)}; args[0] = list(2, items); CHECK(rejected("sum-huge", args, 1, "arg0 is not below its Fin 1180591620717411303424 bound")); }
  /* Option (Fin 1): none is valid; a present value is checked. */
  args[0] = none(); out = call("or-default", args, 1); CHECK(is_small(&out, 7)); clear(&out);
  args[0] = some(small(0)); out = call("or-default", args, 1); CHECK(is_small(&out, 0)); clear(&out);
  args[0] = some(small(1)); CHECK(rejected("or-default", args, 1, "arg0 is not below its Fin 1 bound"));
  /* Array (Option Digit): only present elements are checked. */
  { value items[3] = {some(small(1)), none(), some(small(9))}; args[0] = list(3, items); out = call("present", args, 1);
    CHECK(out.of.list.size == 2 && is_small(&out.of.list.data[0], 1) && is_small(&out.of.list.data[1], 9)); clear(&out); }
  { value items[3] = {some(small(1)), none(), some(small(10))}; args[0] = list(3, items); CHECK(rejected("present", args, 1, "arg0 is not below its Fin 10 bound")); }
  { value items[3] = {some(small(1)), none(), none()}; args[0] = list(3, items); out = call("present", args, 1); CHECK(out.of.list.size == 1); clear(&out); }
  /* List (Array Digit) -> Option (List Digit): nested rows. */
  { const uint32_t r0[] = {1, 2}, r1[] = {3}; value rows[2] = {digits(r0, 2), digits(r1, 1)}; args[0] = list(2, rows); out = call("flatten", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_OPTION && out.of.option && out.of.option->of.list.size == 3 && is_small(&out.of.option->of.list.data[2], 3)); clear(&out); }
  args[0] = list(0, NULL); out = call("flatten", args, 1); CHECK(out.kind == WASMTIME_COMPONENT_OPTION && !out.of.option); clear(&out);
  { const uint32_t r0[] = {1, 2}, r1[] = {10}; value rows[2] = {digits(r0, 2), digits(r1, 1)}; args[0] = list(2, rows); CHECK(rejected("flatten", args, 1, "arg0 is not below its Fin 10 bound")); }
  /* A late refined argument after an unrefined one. */
  { value names[2] = {text("a"), text("b")}; const uint32_t offsets[] = {1, 3}; args[0] = list(2, names); args[1] = digits(offsets, 2); out = call("label", args, 2);
    CHECK(out.kind == WASMTIME_COMPONENT_STRING && out.of.string.size == 7 && memcmp(out.of.string.data, "a:1,b:3", 7) == 0); clear(&out); }
  { value names[2] = {text("a"), text("b")}; const uint32_t offsets[] = {1, 4}; args[0] = list(2, names); args[1] = digits(offsets, 2); CHECK(rejected("label", args, 2, "arg1 is not below its Fin 4 bound")); }
  /* A result-only container refinement projects each element after Lean returns. */
  { value items[2] = {small(100), nat(huge, 3)}; args[0] = list(2, items); out = call("wrap-all", args, 1); CHECK(out.of.list.size == 2 && is_small(&out.of.list.data[0], 2) && is_small(&out.of.list.data[1], 2)); clear(&out); }
  args[0] = list(0, NULL); out = call("wrap-all", args, 1); CHECK(out.of.list.size == 0); clear(&out);
  /* Repeated invalid and valid calls recover; each rejection refreshes the store. */
  for (uint32_t i = 0; i < 1000; ++i) {
    uint32_t beyond = 10 + i % 5, within = i % 10;
    args[0] = digits(&beyond, 1);
    if (!rejected("mirror-all", args, 1, "arg0 is not below its Fin 10 bound")) { fprintf(stderr, "invalid call %u accepted\n", i); return 1; }
    args[0] = digits(&within, 1); out = call("mirror-all", args, 1);
    if (out.of.list.size != 1 || !is_small(&out.of.list.data[0], 9 - within)) { fprintf(stderr, "valid call %u failed\n", i); return 1; }
    clear(&out);
  }
  checks += 2000;
  fincontainers_wasmtime_close(session);
  printf("fin-container-ok:%u\n", checks);
  return 0;
}
