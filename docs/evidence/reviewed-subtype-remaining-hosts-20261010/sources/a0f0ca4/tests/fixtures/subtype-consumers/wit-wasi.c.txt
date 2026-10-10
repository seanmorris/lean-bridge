#include "subtypes_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static subtypes_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Nat crosses as little-endian u32 limbs; Int adds a sign flag. */
static value nat(const uint32_t *limbs, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return result;
}
static value small(uint32_t number) { return nat(&number, number ? 1 : 0); }
static value integer(bool negative, uint32_t magnitude) {
  value result = {.kind = WASMTIME_COMPONENT_RECORD};
  const char *names[] = {"negative", "limbs"};
  wasmtime_component_valrecord_new_uninit(&result.of.record, 2);
  for (int i = 0; i < 2; ++i) wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]);
  result.of.record.data[0].val = (value){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = negative};
  result.of.record.data[1].val = small(magnitude);
  return result;
}
static value text(const char *bytes, size_t length) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, length, bytes);
  return result;
}
static value bytes(const uint8_t *data, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = data[i]};
  return result;
}
static bool is_small(const value *v, uint32_t number) {
  return v->kind == WASMTIME_COMPONENT_LIST && v->of.list.size == (number ? 1 : 0) && (!number || (v->of.list.data[0].kind == WASMTIME_COMPONENT_U32 && v->of.list.data[0].of.u32 == number));
}
static bool is_integer(const value *v, bool negative, uint32_t magnitude) {
  return v->kind == WASMTIME_COMPONENT_RECORD && v->of.record.size == 2 && v->of.record.data[0].val.of.boolean == negative && is_small(&v->of.record.data[1].val, magnitude);
}
static bool is_text(const value *v, const char *bytes, size_t length) {
  return v->kind == WASMTIME_COMPONENT_STRING && v->of.string.size == length && memcmp(v->of.string.data, bytes, length) == 0;
}
static value call(const char *name, value *args, size_t count) {
  value result = {0};
  wasmtime_error_t *error = subtypes_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  for (size_t i = 0; i < count; ++i) clear(&args[i]);
  return result;
}
/* A rejected call names the parameter and its checked constructor and leaves the result slot unchanged. */
static bool rejected(const char *name, value *args, size_t count, const char *needle) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = subtypes_wasmtime_call(session, name, args, count, &output);
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
int main(void) {
  CHECK(subtypes_wasmtime_open(&session) == NULL);
  const char hello[] = "h\xc3\xa9llo \xf0\x9f\x99\x82";
  const uint32_t big[] = {0, 0, 0, 16}, half_big[] = {0, 0, 0, 8}; /* 2^100 and 2^99 */
  value args[2], out;
  /* Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected. */
  args[0] = text(hello, 11); out = call("shout", args, 1); CHECK(is_text(&out, "h\xc3\xa9llo \xf0\x9f\x99\x82!", 12)); clear(&out);
  args[0] = text("a\0b", 3); out = call("shout", args, 1); CHECK(is_text(&out, "a\0b!", 4)); clear(&out);
  args[0] = text("", 0); CHECK(rejected("shout", args, 1, "arg0 was rejected by Subtypes.checkedWord"));
  /* Even Nat beyond 64 bits. */
  args[0] = small(42); out = call("half", args, 1); CHECK(is_small(&out, 21)); clear(&out);
  args[0] = nat(big, 4); out = call("half", args, 1); CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 4 && out.of.list.data[3].of.u32 == half_big[3]); clear(&out);
  args[0] = small(7); CHECK(rejected("half", args, 1, "arg0 was rejected by Subtypes.checkedEven"));
  /* Small Int after an unchecked argument. */
  args[0] = integer(true, 3); args[1] = integer(true, 128); out = call("scale", args, 2); CHECK(is_integer(&out, false, 384)); clear(&out);
  args[0] = integer(true, 3); args[1] = integer(false, 127); out = call("scale", args, 2); CHECK(is_integer(&out, true, 381)); clear(&out);
  args[0] = integer(true, 3); args[1] = integer(false, 128); CHECK(rejected("scale", args, 2, "arg1 was rejected by Subtypes.checkedSmall"));
  args[0] = integer(true, 3); args[1] = integer(true, 129); CHECK(rejected("scale", args, 2, "arg1 was rejected by Subtypes.checkedSmall"));
  /* Nonempty ByteArray. */
  { const uint8_t payload[] = {0, 255}; args[0] = bytes(payload, 2); out = call("head", args, 1); CHECK(out.kind == WASMTIME_COMPONENT_U8 && out.of.u8 == 0); clear(&out); }
  args[0] = bytes(NULL, 0); CHECK(rejected("head", args, 1, "arg0 was rejected by Subtypes.checkedPayload"));
  /* A result-only subtype and two checked arguments. */
  args[0] = small(21); out = call("pad", args, 1); CHECK(is_small(&out, 42)); clear(&out);
  args[0] = text("ab", 2); args[1] = text("cd", 2); out = call("join", args, 2); CHECK(is_text(&out, "abcd", 4)); clear(&out);
  args[0] = text("ab", 2); args[1] = text("", 0); CHECK(rejected("join", args, 2, "arg1 was rejected by Subtypes.checkedWord"));
  args[0] = text("", 0); args[1] = text("cd", 2); CHECK(rejected("join", args, 2, "arg0 was rejected by Subtypes.checkedWord"));
  /* A normalizing constructor: the export sees the constructed value. */
  args[0] = small(250); out = call("clamp", args, 1); CHECK(is_small(&out, 100)); clear(&out);
  args[0] = small(7); out = call("clamp", args, 1); CHECK(is_small(&out, 7)); clear(&out);
  /* A checked constructor beside a Fin bound: the Fin precheck runs first. */
  args[0] = small(4); args[1] = small(3); out = call("mix", args, 2); CHECK(is_small(&out, 7)); clear(&out);
  args[0] = small(4); args[1] = small(10); CHECK(rejected("mix", args, 2, "arg1 is not below its Fin 10 bound"));
  args[0] = small(5); args[1] = small(10); CHECK(rejected("mix", args, 2, "arg1 is not below its Fin 10 bound"));
  args[0] = small(5); args[1] = small(3); CHECK(rejected("mix", args, 2, "arg0 was rejected by Subtypes.checkedEven"));
  /* Repeated invalid and valid calls recover; each rejection refreshes the store. */
  for (uint32_t i = 0; i < 1000; ++i) {
    args[0] = small(2 * i + 1);
    if (!rejected("half", args, 1, "arg0 was rejected by Subtypes.checkedEven")) { fprintf(stderr, "invalid call %u accepted\n", i); return 1; }
    args[0] = small(2 * i); out = call("half", args, 1);
    if (!is_small(&out, i)) { fprintf(stderr, "valid call %u failed\n", i); return 1; }
    clear(&out);
  }
  checks += 2000;
  subtypes_wasmtime_close(session);
  printf("subtype-ok:%u\n", checks);
  return 0;
}
