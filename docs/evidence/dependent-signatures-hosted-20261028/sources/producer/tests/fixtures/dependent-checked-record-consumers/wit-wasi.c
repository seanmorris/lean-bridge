#include "dependentrecords_wasmtime.h"
#include "wit-values.h"
#include <stdio.h>

/* Independent Wasmtime C caller for dependent checked records: the retained
 * `bound` and `below` naturals cross as canonical u32 limb lists inside the
 * `dependent` record, every `below >= bound` payload is refused by the reviewed
 * Lean constructor with its exact diagnostic, the caller recovers, and 2^130
 * sized naturals survive both directions. */
#ifndef DEPENDENT_PARAMETER_PREFIX
#define DEPENDENT_PARAMETER_PREFIX "arg"
#endif
#define REJECTED_BY " was rejected by DependentRecords."
#define HOST_REFUSAL "Unknown export, invalid WIT input or 16 MiB conversion limit"

static dependentrecords_wasmtime *session;
static unsigned checks, rejections, host_rejections, recoveries, snapshots;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "dependent WIT check failed at %d: %s (checks %u rejections %u host %u recoveries %u snapshots %u)\n", __LINE__, #condition, checks, rejections, host_rejections, recoveries, snapshots); exit(1); } ++checks; } while (0)
#define SNAPSHOT(condition) do { ++snapshots; CHECK(condition); } while (0)

static void show_error(const char *label, wasmtime_error_t *error) {
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%s: %.*s\n", label, (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static void expect(const char *label, value input, value expected) {
  value before = clone(&input), out = {0};
  wasmtime_error_t *error = dependentrecords_wasmtime_call(session, label, &input, 1, &out);
  if (error) show_error(label, error);
  CHECK(error == NULL); CHECK(same(&out, &expected));
  SNAPSHOT(same(&input, &before));
  clear(&input); clear(&before); clear(&out); clear(&expected);
}
static void refused(const char *label, value input, const char *cause, bool host) {
  value before = clone(&input), out = small(99), sentinel = clone(&out);
  wasmtime_error_t *error = dependentrecords_wasmtime_call(session, label, &input, 1, &out);
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
#ifndef DEPENDENT_RESULT_ONLY
static void refuse(value input) {
  refused("dependent-total", input, DEPENDENT_PARAMETER_PREFIX "0" REJECTED_BY "mkDependent", false);
}
static void recover(void) {
  expect("dependent-total", dependent(small(2), small(1)), small(3)); ++recoveries;
}
#endif

static void results(void) {
  for (uint32_t i = 0; i < 512; ++i)
    expect("dependent-result", small(i), dependent(small(i + 1), small(i)));
  expect("dependent-result", huge(), dependent(huge_plus_one(), huge()));
}

#ifndef DEPENDENT_RESULT_ONLY
static void inputs(void) {
  expect("dependent-total", dependent(small(3), small(2)), small(5));
  refuse(dependent(small(2), small(2))); recover();
  refuse(dependent(small(0), small(0))); recover();
  expect("dependent-roundtrip", dependent(small(3), small(2)), dependent(small(3), small(2)));
  expect("dependent-total", dependent(huge(), huge_minus_one()), huge_total());
  expect("dependent-roundtrip", dependent(huge(), huge_minus_one()), dependent(huge(), huge_minus_one()));
  for (uint32_t i = 0; i < 256; ++i) {
    expect("dependent-total", dependent(small(i + 1), small(i)), small(2 * i + 1));
    refuse(dependent(small(i + 1), small(i + 1))); recover();
  }

  host_refused("dependent-total", u8(0)); recover();
  host_refused("dependent-total", one_field("bound", small(1))); recover();
  host_refused("dependent-total", dependent(zero_limb(), small(0))); recover();
  host_refused("dependent-total", dependent(small(1), u8(0))); recover();
  host_refused("dependent-result", u8(1)); recover();
  host_refused("missing-export", small(1)); recover();
}
#endif

int main(void) {
  wasmtime_error_t *error = dependentrecords_wasmtime_open(&session);
  if (error) { show_error("open", error); return 1; }
  CHECK(session != NULL); results();
#ifdef DEPENDENT_RESULT_ONLY
  host_refused("dependent-total", dependent(small(3), small(2)));
  host_refused("dependent-roundtrip", dependent(small(3), small(2)));
  CHECK(checks == 1548 && rejections == 0 && host_rejections == 2
    && recoveries == 0 && snapshots == 515);
#else
  inputs();
  CHECK(checks == 4168 && rejections == 258 && host_rejections == 6
    && recoveries == 264 && snapshots == 1301);
#endif
  dependentrecords_wasmtime_close(session); session = NULL;
  printf("{\"checks\":%u,\"rejections\":%u,\"hostRejections\":%u,\"recoveries\":%u,\"snapshots\":%u}\n",
    checks, rejections, host_rejections, recoveries, snapshots);
  return 0;
}
