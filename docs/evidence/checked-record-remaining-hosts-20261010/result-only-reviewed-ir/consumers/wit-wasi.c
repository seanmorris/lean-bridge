#include "checkedrecords_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static checkedrecords_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value copy(const value *v) { value out = {0}; wasmtime_component_val_clone(v, &out); return out; }
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  if (a->kind == WASMTIME_COMPONENT_U32) return a->of.u32 == b->of.u32;
  if (a->kind == WASMTIME_COMPONENT_LIST) {
    if (a->of.list.size != b->of.list.size) return false;
    for (size_t i = 0; i < a->of.list.size; ++i) if (!same(&a->of.list.data[i], &b->of.list.data[i])) return false;
    return true;
  }
  if (a->kind == WASMTIME_COMPONENT_RECORD) {
    if (a->of.record.size != b->of.record.size) return false;
    for (size_t i = 0; i < a->of.record.size; ++i) {
      const wasmtime_component_valrecord_entry_t *x = &a->of.record.data[i], *y = &b->of.record.data[i];
      if (x->name.size != y->name.size || memcmp(x->name.data, y->name.data, x->name.size) || !same(&x->val, &y->val)) return false;
    }
    return true;
  }
  return false;
}
static value nat(const uint32_t *limbs, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return result;
}
static value small(uint32_t n) { return nat(&n, n ? 1 : 0); }
static void fail_error(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data); exit(1);
}
static value call(const char *name, value *args, size_t count) {
  value out = {0}, before[2] = {{0}};
  if (count > 2) exit(1);
  for (size_t i = 0; i < count; ++i) before[i] = copy(&args[i]);
  fail_error(checkedrecords_wasmtime_call(session, name, args, count, &out));
  for (size_t i = 0; i < count; ++i) {
    if (!same(&before[i], &args[i])) { fprintf(stderr, "caller input changed\n"); exit(1); }
    clear(&before[i]); clear(&args[i]);
  }
  return out;
}
static bool is_repeated(const value *v, const value *n) {
  if (v->kind != WASMTIME_COMPONENT_RECORD || v->of.record.size != 1) return false;
  const wasmtime_component_valrecord_entry_t *field = &v->of.record.data[0];
  if (field->name.size != 4 || memcmp(field->name.data, "data", 4)) return false;
  const value *list = &field->val;
  return list->kind == WASMTIME_COMPONENT_LIST && list->of.list.size == 3 &&
    same(&list->of.list.data[0], n) && same(&list->of.list.data[1], n) && same(&list->of.list.data[2], n);
}
int main(void) {
  fail_error(checkedrecords_wasmtime_open(&session));
  const uint32_t limbs[] = {0, 0, 0, 16};
  value big = nat(limbs, 4), args[2], out;
  args[0] = copy(&big); out = call("repeated", args, 1); CHECK(is_repeated(&out, &big)); clear(&out);
  args[0] = small(7); value first = call("repeated", args, 1);
  args[0] = small(7); value second = call("repeated", args, 1), seven = small(7);
  value *changed = &first.of.record.data[0].val.of.list.data[0]; clear(changed); *changed = small(99);
  CHECK(is_repeated(&second, &seven)); clear(&first); clear(&second); clear(&seven);
  for (uint32_t i = 0; i < 1000; ++i) {
    value expected = small(i); args[0] = copy(&expected); out = call("repeated", args, 1);
    CHECK(is_repeated(&out, &expected)); clear(&out); clear(&expected);
  }
  clear(&big); checkedrecords_wasmtime_close(session);
  printf("checked-record-ok:%u\n", checks);
  return 0;
}
