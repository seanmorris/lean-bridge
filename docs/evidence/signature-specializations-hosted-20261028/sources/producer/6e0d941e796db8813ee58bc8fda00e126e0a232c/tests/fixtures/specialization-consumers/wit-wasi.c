#include "specialized_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static specialized_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value word(uint32_t number) { return (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = number}; }
static value flag(bool chosen) { return (value){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = chosen}; }
static value text(const char *bytes) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, strlen(bytes), bytes);
  return result;
}
/* Nat crosses as little-endian u32 limbs: one set bit at the given position. */
static value power(unsigned bit) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, bit / 32 + 1);
  for (size_t i = 0; i <= bit / 32; ++i) result.of.list.data[i] = word(i == bit / 32 ? UINT32_C(1) << (bit % 32) : 0);
  return result;
}
static bool is_power(const value *v, unsigned bit) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size != bit / 32 + 1) return false;
  for (size_t i = 0; i <= bit / 32; ++i)
    if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32 || v->of.list.data[i].of.u32 != (i == bit / 32 ? UINT32_C(1) << (bit % 32) : 0)) return false;
  return true;
}
static bool is_word(const value *v, uint32_t number) { return v->kind == WASMTIME_COMPONENT_U32 && v->of.u32 == number; }
static value words(const uint32_t *items, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = word(items[i]);
  return result;
}
static bool is_words(const value *v, const uint32_t *items, size_t count) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size != count) return false;
  for (size_t i = 0; i < count; ++i) if (!is_word(&v->of.list.data[i], items[i])) return false;
  return true;
}
static bool is_text(const value *v, const char *bytes) {
  return v->kind == WASMTIME_COMPONENT_STRING && v->of.string.size == strlen(bytes) && memcmp(v->of.string.data, bytes, strlen(bytes)) == 0;
}
/* Call an export, release the arguments and return the owned result. */
static value call(const char *name, value *args, size_t count) {
  value result = {0};
  wasmtime_error_t *error = specialized_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  for (size_t i = 0; i < count; ++i) clear(&args[i]);
  return result;
}
static bool absent(const char *name) {
  value input = word(1), output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = specialized_wasmtime_call(session, name, &input, 1, &output);
  if (!error) return false;
  wasmtime_error_delete(error);
  return is_word(&output, 991);
}
int main(void) {
  const char *greeting = "h\xc3\xa9llo \xf0\x9f\x99\x82";
  CHECK(specialized_wasmtime_open(&session) == NULL);
  value args[2], out;
  /* One generic declaration, three concrete exports; the open declaration is absent. */
  args[0] = word(0); out = call("echo-word", args, 1); CHECK(is_word(&out, 0)); clear(&out);
  args[0] = word(UINT32_MAX); out = call("echo-word", args, 1); CHECK(is_word(&out, UINT32_MAX)); clear(&out);
  args[0] = text(greeting); out = call("echo-text", args, 1); CHECK(is_text(&out, greeting)); clear(&out);
  args[0] = text(""); out = call("echo-text", args, 1); CHECK(is_text(&out, "")); clear(&out);
  args[0] = power(200); out = call("echo-nat", args, 1); CHECK(is_power(&out, 200)); clear(&out);
  const uint32_t items[] = {0, 42, UINT32_MAX};
  args[0] = words(items, 3); out = call("echo-words", args, 1); CHECK(is_words(&out, items, 3)); clear(&out);
  CHECK(absent("echo")); CHECK(absent("choose")); CHECK(absent("first")); CHECK(absent("duplicate"));
  /* Lean resolved each instance dictionary at build time. */
  args[0] = flag(true); args[1] = word(5); out = call("choose-word", args, 2); CHECK(is_word(&out, 5)); clear(&out);
  args[0] = flag(false); args[1] = word(5); out = call("choose-word", args, 2); CHECK(is_word(&out, 37)); clear(&out);
  args[0] = flag(true); args[1] = text(greeting); out = call("choose-text", args, 2); CHECK(is_text(&out, greeting)); clear(&out);
  args[0] = flag(false); args[1] = text(greeting); out = call("choose-text", args, 2); CHECK(is_text(&out, "")); clear(&out);
  args[0] = flag(true); args[1] = words(items, 3); out = call("choose-words", args, 2); CHECK(is_words(&out, items, 3)); clear(&out);
  args[0] = flag(false); args[1] = words(items, 3); out = call("choose-words", args, 2); CHECK(is_words(&out, NULL, 0)); clear(&out);
  args[0] = word(UINT32_C(2147483649)); out = call("double-word", args, 1); CHECK(is_word(&out, 2)); clear(&out);
  args[0] = power(100); out = call("double-nat", args, 1); CHECK(is_power(&out, 101)); clear(&out);
  args[0] = text(greeting); args[1] = word(9); out = call("first-text-word", args, 2); CHECK(is_text(&out, greeting)); clear(&out);
  args[0] = word(1); out = call("plain", args, 1); CHECK(is_word(&out, 4)); clear(&out);
  for (uint32_t i = 0; i < 1000; ++i) {
    args[0] = flag(i % 2 == 0); args[1] = word(i); out = call("choose-word", args, 2); CHECK(is_word(&out, i % 2 == 0 ? i : 37)); clear(&out);
    args[0] = word(i); out = call("double-word", args, 1); CHECK(is_word(&out, 2 * i)); clear(&out);
  }
  specialized_wasmtime_close(session);
  printf("specialization-ok:%u\n", checks);
  return 0;
}
