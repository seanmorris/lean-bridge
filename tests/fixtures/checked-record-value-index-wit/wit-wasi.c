#include "checkedrecordvalueindices_wasmtime.h"
#include "wit-values.h"
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
