#include "checkedrecordvalueindices_wasmtime.h"
#ifndef CHECKED_RECORD_VALUE_INDEX_WIT_VALUES_H
#define CHECKED_RECORD_VALUE_INDEX_WIT_VALUES_H
#include <wasmtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-function"

static bool same_name(const wasm_name_t *a, const wasm_name_t *b) {
  return a->size == b->size && (!a->size || memcmp(a->data, b->data, a->size) == 0);
}
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_U8: return a->of.u8 == b->of.u8;
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_LIST:
      if (a->of.list.size != b->of.list.size) return false;
      for (size_t i = 0; i < a->of.list.size; ++i)
        if (!same(&a->of.list.data[i], &b->of.list.data[i])) return false;
      return true;
    case WASMTIME_COMPONENT_RECORD:
      if (a->of.record.size != b->of.record.size) return false;
      for (size_t i = 0; i < a->of.record.size; ++i) {
        const wasmtime_component_valrecord_entry_t *x = &a->of.record.data[i];
        const wasmtime_component_valrecord_entry_t *y = &b->of.record.data[i];
        if (!same_name(&x->name, &y->name) || !same(&x->val, &y->val)) return false;
      }
      return true;
    default: return false;
  }
}
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value clone(const value *v) {
  value copied = {0}; wasmtime_component_val_clone(v, &copied); return copied;
}
static value list(size_t size) {
  value v = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&v.of.list, size); return v;
}
static value nat(const uint32_t *limbs, size_t size) {
  value v = list(size);
  for (size_t i = 0; i < size; ++i)
    v.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return v;
}
static value small(uint32_t n) { return nat(&n, n ? 1 : 0); }
static value huge(uint32_t offset) {
  const uint32_t limbs[] = {offset, 0, 0, 16}; return nat(limbs, 4);
}
static value wide_index(void) {
  const uint32_t limbs[] = {1, 0, 0, 0, 1}; return nat(limbs, 5);
}
static value u8(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }
static value one_field(const char *label, value payload) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, 1);
  wasm_name_new(&out.of.record.data[0].name, strlen(label), label);
  out.of.record.data[0].val = payload; return out;
}
static value counted(const char *label, uint32_t n) { return one_field(label, small(n)); }
static value counted_value(const char *label, value n) { return one_field(label, n); }
static value empty_sized(void) { return one_field("data", list(0)); }
static value one_sized(uint32_t n) {
  value data = list(1); data.of.list.data[0] = small(n); return one_field("data", data);
}

static bool exact_cause(const char *text, size_t size, const char *expected) {
  if (memchr(text, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(text, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker[] = "\n\nCaused by:\n    ";
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length
    || memcmp(text, start, sizeof(start) - 1)) return false;
  if (text[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length) return false;
  size_t end = size - length, at = end - (sizeof(marker) - 1);
  if (memcmp(text + at, marker, sizeof(marker) - 1)
    || memcmp(text + end, expected, length)) return false;
  for (size_t i = sizeof(start) - 1; i + sizeof(marker) - 1 <= at; ++i)
    if (memcmp(text + i, marker, sizeof(marker) - 1) == 0) return false;
  return true;
}
#pragma GCC diagnostic pop
#endif

#include <stdio.h>

#ifndef VALUE_INDEX_PARAMETER_PREFIX
#define VALUE_INDEX_PARAMETER_PREFIX "arg"
#endif
#define REJECTED_BY " was rejected by CheckedRecordValueIndices."
#define HOST_REFUSAL "Unknown export, invalid WIT input or 16 MiB conversion limit"

static checkedrecordvalueindices_wasmtime *session;
static unsigned checks, rejections, host_rejections, recoveries, snapshots;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "value-index WIT check failed at %d: %s\n", __LINE__, #condition); exit(1); } ++checks; } while (0)
#define SNAPSHOT(condition) do { ++snapshots; CHECK(condition); } while (0)

static void show_error(const char *label, wasmtime_error_t *error) {
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%s: %.*s\n", label, (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static void expect_many(const char *label, value *inputs, size_t count, value expected) {
  value before[1] = {{0}}, out = {0};
  if (count > 1) abort();
  for (size_t i = 0; i < count; ++i) before[i] = clone(&inputs[i]);
  wasmtime_error_t *error = checkedrecordvalueindices_wasmtime_call(session, label, inputs, count, &out);
  if (error) show_error(label, error);
  CHECK(error == NULL); CHECK(same(&out, &expected));
  for (size_t i = 0; i < count; ++i) {
    SNAPSHOT(same(&inputs[i], &before[i])); clear(&inputs[i]); clear(&before[i]);
  }
  clear(&out); clear(&expected);
}
static void expect(const char *label, value input, value expected) {
  expect_many(label, &input, 1, expected);
}
static void expect_zero(const char *label, value expected) {
  expect_many(label, NULL, 0, expected);
}
static void refused(const char *label, value input, const char *cause, bool host) {
  value before = clone(&input), out = small(99), sentinel = clone(&out);
  wasmtime_error_t *error = checkedrecordvalueindices_wasmtime_call(session, label, &input, 1, &out);
  CHECK(error != NULL);
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool exact = exact_cause(message.data, message.size, cause);
  if (!exact) fprintf(stderr, "%s: expected '%s', got '%.*s'\n",
    label, cause, (int)message.size, message.data);
  CHECK(exact); CHECK(same(&out, &sentinel)); SNAPSHOT(same(&input, &before));
  if (host) ++host_rejections; else ++rejections;
  wasm_name_delete(&message); wasmtime_error_delete(error);
  clear(&input); clear(&before); clear(&out); clear(&sentinel);
}
static void host_refused(const char *label, value input) {
  refused(label, input, HOST_REFUSAL, true);
}
#ifndef VALUE_INDEX_RESULT_ONLY
static void recover(void) {
  expect("zero-nat-index", counted("count", 99), small(99)); ++recoveries;
}
#endif

static void results(void) {
  expect_zero("produce-true-bool", counted("count", 0));
  expect_zero("produce-false-bool", counted("count", 1));
  expect_zero("produce-ab", counted("size", 2));
  expect("produce-empty-string", small(23), counted("count", 23));
  expect("produce-unicode-string", small(24), counted("count", 24));
  expect_zero("produce-empty-sized", empty_sized());
  expect("produce-zero-nat", small(25), counted("count", 25));
  expect("produce-wide-nat", huge(17), counted_value("count", huge(17)));
}

#ifndef VALUE_INDEX_RESULT_ONLY
static void inputs(void) {
  expect("true-bool-index", counted("count", 0), small(0));
  expect("false-bool-index", counted("count", 1), small(1));
  expect("ab-string-index", counted("size", 2), small(2));
  expect("empty-string-index", counted("count", 9), small(9));
  expect("unicode-string-index", counted("count", 10), small(10));
  expect("empty-sized-index", empty_sized(), small(0));
  expect("zero-nat-index", counted("count", 11), small(11));
  expect("wide-nat-index", counted_value("count", wide_index()), wide_index());

  refused("ab-string-index", counted("size", 1),
    VALUE_INDEX_PARAMETER_PREFIX "0" REJECTED_BY "mkAb", false); recover();
  refused("empty-sized-index", one_sized(1),
    VALUE_INDEX_PARAMETER_PREFIX "0" REJECTED_BY "mkEmptySized", false); recover();
  refused("true-bool-index", counted("count", 1),
    VALUE_INDEX_PARAMETER_PREFIX "0" REJECTED_BY "mkOn", false); recover();
  refused("false-bool-index", counted("count", 0),
    VALUE_INDEX_PARAMETER_PREFIX "0" REJECTED_BY "mkOff", false); recover();

  host_refused("true-bool-index", u8(1));
  const uint32_t noncanonical[] = {0};
  host_refused("true-bool-index", counted_value("count", nat(noncanonical, 1)));
  value wrong = counted("count", 0); wrong.of.record.data[0].name.data[0] = 'C';
  host_refused("true-bool-index", wrong);
  host_refused("missing-export", small(1));
}
#endif

int main(void) {
  wasmtime_error_t *error = checkedrecordvalueindices_wasmtime_open(&session);
  if (error) { show_error("open", error); return 1; }
  CHECK(session != NULL); results();
#ifdef VALUE_INDEX_RESULT_ONLY
  host_refused("true-bool-index", counted("count", 0));
  CHECK(checks == 25 && rejections == 0 && host_rejections == 1
    && recoveries == 0 && snapshots == 5);
#else
  inputs();
  CHECK(checks == 89 && rejections == 4 && host_rejections == 4
    && recoveries == 4 && snapshots == 24);
#endif
  checkedrecordvalueindices_wasmtime_close(session); session = NULL;
  printf("{\"checks\":%u,\"rejections\":%u,\"hostRejections\":%u,\"recoveries\":%u,\"snapshots\":%u}\n",
    checks, rejections, host_rejections, recoveries, snapshots);
  return 0;
}
