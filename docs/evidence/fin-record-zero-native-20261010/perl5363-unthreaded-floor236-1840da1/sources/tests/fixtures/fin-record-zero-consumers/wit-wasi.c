#define _GNU_SOURCE
#include "finrecordzero_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static finrecordzero_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at %d\n", __LINE__); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value list(size_t count) {
  value v = {.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&v.of.list, count); return v;
}
static value nat(uint32_t number, bool huge) {
  value v = list(huge ? 4 : number ? 1 : 0);
  for (size_t i = 0; i < v.of.list.size; ++i) v.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = huge ? (i == 3 ? 16 : 0) : number};
  return v;
}
static value record(const char **names, value *fields, size_t count) {
  value v = {.kind = WASMTIME_COMPONENT_RECORD}; wasmtime_component_valrecord_new_uninit(&v.of.record, count);
  for (size_t k = 0; k < count; ++k) { wasm_name_new(&v.of.record.data[k].name, strlen(names[k]), names[k]); v.of.record.data[k].val = fields[k]; }
  return v;
}
static value zeros(uint32_t digit, bool huge) {
  value v = list(1); v.of.list.data[0] = record((const char *[]){"digit"}, (value[]){nat(digit, huge)}, 1); return v;
}
static value fields(int member, uint32_t digit, bool huge) {
  value text = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&text.of.string, 4, "kept");
  value payload = list(2), array = list(member == 0 ? 1 : 0), items = list(member == 1 ? 1 : 0);
  payload.of.list.data[0] = nat(7, false); payload.of.list.data[1] = nat(0, true);
  if (member == 0) array.of.list.data[0] = nat(digit, huge);
  if (member == 1) items.of.list.data[0] = nat(digit, huge);
  return record((const char *[]){"label", "payload", "array", "list"}, (value[]){text, payload, array, items}, 4);
}
static value rows(int index, int member) {
  value v = list(3);
  for (int k = 0; k < 3; ++k) v.of.list.data[k] = fields(k == index ? member : -1, 0, false);
  return v;
}
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  if (a->kind == WASMTIME_COMPONENT_U32) return a->of.u32 == b->of.u32;
  if (a->kind == WASMTIME_COMPONENT_STRING) return a->of.string.size == b->of.string.size && (!a->of.string.size || !memcmp(a->of.string.data, b->of.string.data, a->of.string.size));
  if (a->kind == WASMTIME_COMPONENT_LIST) {
    if (a->of.list.size != b->of.list.size) return false;
    for (size_t k = 0; k < a->of.list.size; ++k) if (!same(&a->of.list.data[k], &b->of.list.data[k])) return false;
    return true;
  }
  if (a->kind == WASMTIME_COMPONENT_RECORD) {
    if (a->of.record.size != b->of.record.size) return false;
    for (size_t k = 0; k < a->of.record.size; ++k) {
      const wasm_name_t *x = &a->of.record.data[k].name, *y = &b->of.record.data[k].name;
      if (x->size != y->size || (x->size && memcmp(x->data, y->data, x->size)) || !same(&a->of.record.data[k].val, &b->of.record.data[k].val)) return false;
    }
    return true;
  }
  return false;
}
static void call(const char *name, value input, value before, const char *path) {
  value out = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = finrecordzero_wasmtime_call(session, name, &input, 1, &out);
  if (path) {
    bool valid = error != NULL && same(&input, &before) && out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 991;
    if (error) {
      wasm_name_t message; wasmtime_error_message(error, &message);
      char expected[160]; snprintf(expected, sizeof(expected), "%s is not below its Fin 0 bound", path);
      valid = valid && message.size >= strlen(expected) && memmem(message.data, message.size, expected, strlen(expected)) != NULL;
      wasm_byte_vec_delete(&message); wasmtime_error_delete(error);
    }
    CHECK(valid);
  } else {
    if (error) { wasm_name_t message; wasmtime_error_message(error, &message); fprintf(stderr, "%.*s\n", (int)message.size, message.data); exit(1); }
    CHECK(same(&input, &before) && same(&out, &before)); clear(&out);
  }
  clear(&input); clear(&before);
}
int main(void) {
  if (finrecordzero_wasmtime_open(&session)) return 1;
  for (unsigned kind = 0; kind < 2; ++kind) {
    const char *name = kind ? "list-records" : "array-records";
    call(name, list(0), list(0), NULL);
    for (unsigned digit = 0; digit < 3; ++digit) call(name, zeros(digit == 1 ? 1 : 0, digit == 2), zeros(digit == 1 ? 1 : 0, digit == 2), "arg0[0].digit");
    call(name, list(0), list(0), NULL);
  }
  call("field-collections", fields(-1, 0, false), fields(-1, 0, false), NULL);
  for (int member = 0; member < 2; ++member) for (unsigned digit = 0; digit < 3; ++digit)
    call("field-collections", fields(member, digit == 1 ? 1 : 0, digit == 2), fields(member, digit == 1 ? 1 : 0, digit == 2), member ? "arg0.list[0]" : "arg0.array[0]");
  call("field-collections", fields(-1, 0, false), fields(-1, 0, false), NULL);
  for (unsigned kind = 0; kind < 2; ++kind) {
    const char *name = kind ? "list-fields" : "array-fields";
    call(name, list(0), list(0), NULL); call(name, rows(-1, -1), rows(-1, -1), NULL);
    for (int index = 0; index < 3; ++index) for (int member = 0; member < 2; ++member) {
      char path[80]; snprintf(path, sizeof(path), "arg0[%d].%s[0]", index, member ? "list" : "array");
      call(name, rows(index, member), rows(index, member), path);
      call(name, rows(-1, -1), rows(-1, -1), NULL);
    }
  }
  for (unsigned index = 0; index < 1000; ++index) {
    call("field-collections", fields(-1, 0, false), fields(-1, 0, false), NULL);
    call("field-collections", fields(index % 2, index, false), fields(index % 2, index, false), index % 2 ? "arg0.list[0]" : "arg0.array[0]");
  }
  finrecordzero_wasmtime_close(session);
  printf("fin-record-zero-ok:%u\n", checks);
  return 0;
}
