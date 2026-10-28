#include "dependentfin_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static dependentfin_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Nat and a dependent Fin cross as little-endian u32 limbs. */
static value nat(const uint32_t *limbs, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return result;
}
static value small(uint32_t number) { return nat(&number, number ? 1 : 0); }
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
static bool is_text(const value *v, const char *bytes) {
  return v->kind == WASMTIME_COMPONENT_STRING && v->of.string.size == strlen(bytes) && memcmp(v->of.string.data, bytes, v->of.string.size) == 0;
}
static value call(const char *name, value *args, size_t count) {
  value result = {0};
  wasmtime_error_t *error = dependentfin_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  for (size_t i = 0; i < count; ++i) clear(&args[i]);
  return result;
}
/* A rejected call names the value and its live bound parameter and leaves the result slot unchanged. */
static bool rejected(const char *name, value *args, size_t count, const char *needle) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = dependentfin_wasmtime_call(session, name, args, count, &output);
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
static const char mirror_bound[] = "arg1 is not below its dependent Fin bound arg0";
static const char label_bound[] = "arg2 is not below its dependent Fin bound arg1";
static bool mirror_rejects(value bound, value item) { value args[2] = {bound, item}; return rejected("mirror", args, 2, mirror_bound); }
static value mirror(value bound, value item) { value args[2] = {bound, item}; return call("mirror", args, 2); }
int main(void) {
  CHECK(dependentfin_wasmtime_open(&session) == NULL);
  const uint32_t word[] = {0, 1}, word_next[] = {1, 1}, below_word[] = {UINT32_MAX};
  const uint32_t huge[] = {0, 0, 64}, huge_next[] = {1, 0, 64}, last[] = {UINT32_MAX, UINT32_MAX, 63}, wide[] = {0, 0, 0, 0, 1};
  value out;
  /* Fin 0: the live bound zero has no values. */
  CHECK(mirror_rejects(small(0), small(0)));
  CHECK(mirror_rejects(small(0), small(1)));
  /* Fin 1: only zero. */
  out = mirror(small(1), small(0)); CHECK(is_small(&out, 0)); clear(&out);
  CHECK(mirror_rejects(small(1), small(1)));
  /* The exact endpoints of a small live bound. */
  out = mirror(small(10), small(0)); CHECK(is_small(&out, 9)); clear(&out);
  out = mirror(small(10), small(9)); CHECK(is_small(&out, 0)); clear(&out);
  CHECK(mirror_rejects(small(10), small(10)));
  CHECK(mirror_rejects(small(10), small(11)));
  CHECK(mirror_rejects(small(10), nat(word, 2)));
  CHECK(mirror_rejects(small(10), nat(huge, 3)));
  /* Live bounds wider than a machine word are compared limb by limb. */
  out = mirror(nat(word, 2), nat(below_word, 1)); CHECK(is_small(&out, 0)); clear(&out);
  out = mirror(nat(word_next, 2), nat(word, 2)); CHECK(is_small(&out, 0)); clear(&out);
  CHECK(mirror_rejects(nat(word, 2), nat(word, 2)));
  out = mirror(nat(huge, 3), nat(last, 3)); CHECK(is_small(&out, 0)); clear(&out);
  out = mirror(nat(huge, 3), small(0)); CHECK(is_nat(&out, last, 3)); clear(&out);
  out = mirror(nat(huge_next, 3), nat(huge, 3)); CHECK(is_small(&out, 0)); clear(&out);
  CHECK(mirror_rejects(nat(huge, 3), nat(huge, 3)));
  CHECK(mirror_rejects(nat(huge, 3), nat(huge_next, 3)));
  CHECK(mirror_rejects(nat(huge, 3), nat(wide, 5)));
  /* The bound is the argument of this call, never a frozen constant. */
  for (uint32_t bound = 0; bound < 12; ++bound) {
    if (bound > 5) { out = mirror(small(bound), small(5)); CHECK(is_small(&out, bound - 6)); clear(&out); }
    else CHECK(mirror_rejects(small(bound), small(5)));
  }
  /* Only the named earlier parameter bounds the value, not an unrelated earlier Nat. */
  { value args[4] = {small(100), small(3), small(2), text("slot")}; out = call("label", args, 4); CHECK(is_text(&out, "slot:102")); clear(&out); }
  { value args[4] = {small(100), small(3), small(3), text("slot")}; CHECK(rejected("label", args, 4, label_bound)); }
  { value args[4] = {small(100), small(0), small(0), text("slot")}; CHECK(rejected("label", args, 4, label_bound)); }
  { value args[4] = {small(7), small(4), small(3), text("slot")}; out = call("label", args, 4); CHECK(is_text(&out, "slot:10")); clear(&out); }
  /* Repeated invalid and valid calls recover; each rejection refreshes the store and the bound changes every call. */
  for (uint32_t i = 0; i < 1000; ++i) {
    if (!mirror_rejects(small(10), small(10 + i % 5))) { fprintf(stderr, "invalid call %u accepted\n", i); return 1; }
    out = mirror(small(i % 7 + 1), small(i % 7));
    if (!is_small(&out, 0)) { fprintf(stderr, "valid call %u failed\n", i); return 1; }
    clear(&out);
    out = mirror(small(10), small(i % 10));
    if (!is_small(&out, 9 - i % 10)) { fprintf(stderr, "valid call %u failed\n", i); return 1; }
    clear(&out);
  }
  checks += 2000;
  dependentfin_wasmtime_close(session);
  printf("dependent-fin-ok:%u\n", checks);
  return 0;
}
