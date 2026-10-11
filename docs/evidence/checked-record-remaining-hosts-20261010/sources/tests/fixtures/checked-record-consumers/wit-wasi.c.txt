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
// BEGIN CHECKED INPUT HELPERS
static value record(const char **names, value *fields, size_t count) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&out.of.record.data[i].name, strlen(names[i]), names[i]);
    out.of.record.data[i].val = fields[i];
  }
  return out;
}
static value interval(uint32_t lo, uint32_t hi) {
  const char *names[] = {"lo", "hi"}; value fields[] = {small(lo), small(hi)};
  return record(names, fields, 2);
}
static value triple(const uint32_t *numbers, size_t count) {
  value list = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&list.of.list, count);
  for (size_t i = 0; i < count; ++i) list.of.list.data[i] = small(numbers[i]);
  const char *names[] = {"data"}; return record(names, &list, 1);
}
static value percent(value number) { const char *names[] = {"value"}; return record(names, &number, 1); }
static bool small_call(const char *name, value *args, size_t count, uint32_t expected) {
  value out = call(name, args, count), wanted = small(expected);
  bool ok = same(&out, &wanted); clear(&out); clear(&wanted); return ok;
}
static bool triple_call(const char *name, value *args, size_t count, const uint32_t *expected) {
  value out = call(name, args, count), wanted = triple(expected, 3);
  bool ok = same(&out, &wanted); clear(&out); clear(&wanted); return ok;
}
static bool rejected(const char *name, value *args, size_t count, const char *needle) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991}, before[2] = {{0}};
  if (count > 2) exit(1);
  for (size_t i = 0; i < count; ++i) before[i] = copy(&args[i]);
  wasmtime_error_t *error = checkedrecords_wasmtime_call(session, name, args, count, &output);
  bool unchanged = true;
  for (size_t i = 0; i < count; ++i) {
    unchanged = unchanged && same(&args[i], &before[i]); clear(&before[i]); clear(&args[i]);
  }
  if (!error) { clear(&output); return false; }
  wasm_name_t message; wasmtime_error_message(error, &message);
  char *text = calloc(message.size + 1, 1);
  if (!text) exit(1);
  memcpy(text, message.data, message.size);
  bool found = strstr(text, needle) != NULL;
  free(text); wasm_name_delete(&message); wasmtime_error_delete(error);
  return found && unchanged && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}
// END CHECKED INPUT HELPERS
int main(void) {
  fail_error(checkedrecords_wasmtime_open(&session));
  const uint32_t limbs[] = {0, 0, 0, 16};
  value big = nat(limbs, 4), args[2], out;
  // BEGIN CHECKED INPUT CASES
  const uint32_t numbers[] = {9, 2, 4}, short_numbers[] = {1, 2}, long_numbers[] = {4, 3, 2, 1}, scaled[] = {27, 6, 12};
  value good = interval(3, 10), bad = interval(9, 3), input = triple(numbers, 3), snapshot = copy(&input);
  args[0] = copy(&good); CHECK(small_call("width", args, 1, 7));
  args[0] = interval(1, 1); CHECK(small_call("width", args, 1, 0));
  { const uint32_t hi[] = {9, 0, 0, 16}; const char *names[] = {"lo", "hi"}; value fields[] = {copy(&big), nat(hi, 4)}; args[0] = record(names, fields, 2); }
  CHECK(small_call("width", args, 1, 9));
  args[0] = copy(&good); args[1] = interval(5, 20); CHECK(small_call("span", args, 2, 17));
  args[0] = copy(&bad); CHECK(rejected("width", args, 1, "arg0 was rejected by CheckedRecords.mkInterval"));
  args[0] = copy(&bad); args[1] = copy(&good); CHECK(rejected("span", args, 2, "arg0 was rejected by CheckedRecords.mkInterval"));
  args[0] = copy(&good); args[1] = copy(&bad); CHECK(rejected("span", args, 2, "arg1 was rejected by CheckedRecords.mkInterval"));
  args[0] = copy(&input); CHECK(small_call("total", args, 1, 15));
  args[0] = copy(&input); CHECK(small_call("first-of", args, 1, 9));
  args[0] = copy(&input); CHECK(small_call("smallest", args, 1, 2));
  CHECK(same(&input, &snapshot));
  args[0] = small(3); args[1] = copy(&input); CHECK(triple_call("scale", args, 2, scaled));
  CHECK(same(&input, &snapshot));
  args[0] = triple(NULL, 0); CHECK(rejected("total", args, 1, "arg0 was rejected by CheckedRecords.mkTriple"));
  args[0] = triple(short_numbers, 2); CHECK(rejected("first-of", args, 1, "arg0 was rejected by CheckedRecords.mkTriple"));
  args[0] = triple(long_numbers, 4); CHECK(rejected("smallest", args, 1, "arg0 was rejected by CheckedRecords.sortedTriple"));
  args[0] = small(3); args[1] = triple(short_numbers, 2); CHECK(rejected("scale", args, 2, "arg1 was rejected by CheckedRecords.mkTriple"));
  args[0] = percent(small(0)); CHECK(small_call("complement", args, 1, 100));
  args[0] = percent(small(100)); CHECK(small_call("complement", args, 1, 0));
  args[0] = percent(small(101)); CHECK(rejected("complement", args, 1, "arg0 was rejected by CheckedRecords.mkPercent"));
  args[0] = percent(copy(&big)); CHECK(rejected("complement", args, 1, "arg0 was rejected by CheckedRecords.mkPercent"));
  for (uint32_t i = 0; i < 1000; ++i) {
    args[0] = interval(i + 1, i); CHECK(rejected("width", args, 1, "arg0 was rejected by CheckedRecords.mkInterval"));
    args[0] = interval(i, i + 7); CHECK(small_call("width", args, 1, 7));
    args[0] = triple(short_numbers, 2); CHECK(rejected("total", args, 1, "arg0 was rejected by CheckedRecords.mkTriple"));
    args[0] = copy(&input); CHECK(small_call("total", args, 1, 15));
    args[0] = triple(long_numbers, 4); CHECK(rejected("smallest", args, 1, "arg0 was rejected by CheckedRecords.sortedTriple"));
    args[0] = copy(&input); CHECK(small_call("smallest", args, 1, 2));
    args[0] = percent(small(101)); CHECK(rejected("complement", args, 1, "arg0 was rejected by CheckedRecords.mkPercent"));
    args[0] = percent(small(100)); CHECK(small_call("complement", args, 1, 0));
  }
  CHECK(same(&input, &snapshot));
  clear(&input); clear(&snapshot); clear(&good); clear(&bad);
  // END CHECKED INPUT CASES
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
