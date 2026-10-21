#include "zeropayloadcheckedrecords_wasmtime.h"
#include "wit-values.h"
#include <stdio.h>

/* Independent Wasmtime C caller for zero-payload checked records: a proof-only
 * Witness and a plain empty Marker cross as the single-case enum `empty`, a
 * Unit-bearing Token keeps its `tag: unit` field, Option, lists and both Mark
 * branches keep their shape, and the refusing nullary constructor refuses. */
#ifndef ZERO_PAYLOAD_PARAMETER_PREFIX
#define ZERO_PAYLOAD_PARAMETER_PREFIX "arg"
#endif
#define REJECTED_BY " was rejected by ZeroPayloadCheckedRecords."
#define HOST_REFUSAL "Unknown export, invalid WIT input or 16 MiB conversion limit"

static zeropayloadcheckedrecords_wasmtime *session;
static unsigned checks, rejections, host_rejections, recoveries, snapshots;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "zero-payload WIT check failed at %d: %s (checks %u rejections %u host %u recoveries %u snapshots %u)\n", __LINE__, #condition, checks, rejections, host_rejections, recoveries, snapshots); exit(1); } ++checks; } while (0)
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
  wasmtime_error_t *error = zeropayloadcheckedrecords_wasmtime_call(session, label, inputs, count, &out);
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
  wasmtime_error_t *error = zeropayloadcheckedrecords_wasmtime_call(session, label, &input, 1, &out);
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
#ifndef ZERO_PAYLOAD_RESULT_ONLY
static void recover(void) {
  expect("witness-count", witness(), small(1)); ++recoveries;
}
#endif

static void results(void) {
  expect_zero("produce-witness", witness());
  expect_zero("produce-token", token());
  expect("witnesses", small(3), witnesses(3));
  expect("witnesses", small(0), witnesses(0));
  expect("maybe-witness", boolean(false), none());
  expect("maybe-witness", boolean(true), some(witness()));
  expect_zero("produce-marker", marker());
  expect("produce-mark", boolean(false), blank());
  expect("produce-mark", boolean(true), marked());
}

#ifndef ZERO_PAYLOAD_RESULT_ONLY
static void inputs(void) {
  expect("witness-count", witness(), small(1));
  refused("absent-count", witness(),
    ZERO_PAYLOAD_PARAMETER_PREFIX "0" REJECTED_BY "mkAbsent", false); recover();
  expect("token-tag", token(), unit_value());
  expect("marker-count", marker(), small(0));
  expect("mark-count", blank(), small(0));
  expect("mark-count", marked(), small(1));

  host_refused("witness-count", u8(0)); recover();
  host_refused("witness-count", enum_case("full")); recover();
  host_refused("token-tag", one_field("tag", u8(0))); recover();
  host_refused("token-tag", one_field("label", unit_value())); recover();
  host_refused("mark-count", variant("other", NULL)); recover();
  host_refused("mark-count", variant("marked", NULL)); recover();
  host_refused("witnesses", u8(3)); recover();
  host_refused("missing-export", small(1)); recover();
}
#endif

int main(void) {
  wasmtime_error_t *error = zeropayloadcheckedrecords_wasmtime_open(&session);
  if (error) { show_error("open", error); return 1; }
  CHECK(session != NULL); results();
#ifdef ZERO_PAYLOAD_RESULT_ONLY
  host_refused("witness-count", witness());
  CHECK(checks == 29 && rejections == 0 && host_rejections == 1
    && recoveries == 0 && snapshots == 7);
#else
  inputs();
  CHECK(checks == 103 && rejections == 1 && host_rejections == 8
    && recoveries == 9 && snapshots == 29);
#endif
  zeropayloadcheckedrecords_wasmtime_close(session); session = NULL;
  printf("{\"checks\":%u,\"rejections\":%u,\"hostRejections\":%u,\"recoveries\":%u,\"snapshots\":%u}\n",
    checks, rejections, host_rejections, recoveries, snapshots);
  return 0;
}
