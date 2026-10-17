#include "inheritedcheckedrecords_wasmtime.h"
#include "wit-values.h"
#include <stdio.h>

/* Public inherited checked-record WIT caller. The result-only define selects the
 * standalone constructor-free API; expected values never depend on generated code. */
#ifndef INHERITED_PARAMETER_PREFIX
#define INHERITED_PARAMETER_PREFIX "arg"
#endif
#define REJECTED_BY " was rejected by InheritedCheckedRecords."
#define HOST_REFUSAL "Unknown export, invalid WIT input or 16 MiB conversion limit"

static inheritedcheckedrecords_wasmtime *session;
static unsigned checks, rejections, host_rejections, recoveries, snapshots;
static const unsigned rounds = 256;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "inherited WIT check failed at %d: %s\n", __LINE__, #condition); exit(1); } ++checks; } while (0)
#define SNAPSHOT(condition) do { ++snapshots; CHECK(condition); } while (0)

static void show_error(const char *label, wasmtime_error_t *error) {
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%s: %.*s\n", label, (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static void expect_many(const char *label, value *inputs, size_t count, value expected) {
  value before[2] = {{0}, {0}}, out = {0};
  if (count > 2) abort();
  for (size_t i = 0; i < count; ++i) before[i] = clone(&inputs[i]);
  wasmtime_error_t *error = inheritedcheckedrecords_wasmtime_call(session, label, inputs, count, &out);
  if (error) show_error(label, error);
  CHECK(error == NULL);
  if (!same(&out, &expected)) fprintf(stderr, "%s: unexpected result\n", label);
  CHECK(same(&out, &expected));
  for (size_t i = 0; i < count; ++i) {
    SNAPSHOT(same(&inputs[i], &before[i])); clear(&inputs[i]); clear(&before[i]);
  }
  clear(&out); clear(&expected);
}
static void expect(const char *label, value input, value expected) {
  expect_many(label, &input, 1, expected);
}
static void refused_many(const char *label, value *inputs, size_t count,
    const char *cause, bool host) {
  value before[2] = {{0}, {0}}, out = small(99), sentinel = clone(&out);
  if (count > 2) abort();
  for (size_t i = 0; i < count; ++i) before[i] = clone(&inputs[i]);
  wasmtime_error_t *error = inheritedcheckedrecords_wasmtime_call(session, label, inputs, count, &out);
  CHECK(error != NULL);
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool exact = exact_cause(message.data, message.size, cause);
  if (!exact) fprintf(stderr, "%s: expected '%s', got '%.*s'\n",
    label, cause, (int)message.size, message.data);
  CHECK(exact); CHECK(same(&out, &sentinel));
  for (size_t i = 0; i < count; ++i) {
    SNAPSHOT(same(&inputs[i], &before[i])); clear(&inputs[i]); clear(&before[i]);
  }
  if (host) ++host_rejections; else ++rejections;
  wasm_name_delete(&message); wasmtime_error_delete(error);
  clear(&out); clear(&sentinel);
}
static void host_refused(const char *label, value input) {
  refused_many(label, &input, 1, HOST_REFUSAL, true);
}

static void results(void) {
  for (uint32_t round = 0; round < rounds; ++round) {
    expect("produce", huge(round), ticket(huge(round), huge(round), huge(round + 1)));
    expect("produce-stamped", huge(round),
      stamped(ticket(huge(round), huge(round), huge(round + 1)), small(0)));
  }
  host_refused("produce", u8(1));
  const uint32_t noncanonical[] = {3, 0};
  host_refused("produce", nat(noncanonical, 2));
  host_refused("missing-export", small(1));
}

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
static void refused(const char *label, value input, const char *cause) {
  refused_many(label, &input, 1, cause, false);
}
static void inputs(void) {
  expect("first", ticket_small(2, 3, 4), small(9));
  expect("normalized", ticket_small(4, 1, 0), small(11));
  value pair_args[] = {ticket_small(2, 3, 4), ticket_small(4, 1, 999)};
  expect_many("pair", pair_args, 2, small(10));
  expect("aliased", ticket_small(4, 1, 4), small(5));
  expect("nested", stamped_small(1, 2, 4, 3), small(7));
  expect("echo", ticket_small(1, 2, 0), ticket_small(1, 2, 3));

  refused("first", ticket_small(4, 1, 5),
    INHERITED_PARAMETER_PREFIX "0.toSpan" REJECTED_BY "mkSpan");
  refused("first", ticket_small(1, 2, 0),
    INHERITED_PARAMETER_PREFIX "0.word" REJECTED_BY "mkWord");
  refused("first", ticket_small(1, 5, 3),
    INHERITED_PARAMETER_PREFIX "0" REJECTED_BY "mkTicket");
  refused("nested", stamped_small(1, 2, 9, 8),
    INHERITED_PARAMETER_PREFIX "0.mark is not below its Fin 8 bound");
  refused("nested", stamped_small(1, 2, 4, 5),
    INHERITED_PARAMETER_PREFIX "0" REJECTED_BY "mkStamped");
  refused("aliased", ticket_small(1, 5, 3),
    INHERITED_PARAMETER_PREFIX "0" REJECTED_BY "mkTicket");

  value wrong = ticket_small(2, 3, 4);
  wrong.of.record.data[0].name.data[0] = 'T'; host_refused("first", wrong);
  wrong = ticket_small(2, 3, 4); --wrong.of.record.size; host_refused("first", wrong);
  const uint32_t noncanonical[] = {3, 0};
  host_refused("first", ticket(small(2), small(3), nat(noncanonical, 2)));
  host_refused("nested", stamped(ticket_small(1, 2, 4), u8(3)));

  for (uint32_t round = 0; round < rounds; ++round) {
    const uint32_t n = round + 10;
    expect("first", ticket_small(n, n + 1, n + 2), small(3 * n + 3));
    expect("normalized", ticket_small(n + 2, n, 0), small(4 * n + 5));
    value repeated[] = {ticket_small(n, n + 1, n + 2), ticket_small(n + 2, n, 0)};
    expect_many("pair", repeated, 2, small(3 * n + 5));
    expect("aliased", ticket_small(n + 2, n, 2 * n + 1), small(2 * n + 2));
    const uint32_t mark = round % 8;
    expect("nested", stamped_small(mark, mark, mark + 1, mark), small(2 * mark + 1));

    refused("first", ticket_small(n + 1, n, n + 2),
      INHERITED_PARAMETER_PREFIX "0.toSpan" REJECTED_BY "mkSpan");
    refused("first", ticket_small(0, 1, 0),
      INHERITED_PARAMETER_PREFIX "0.word" REJECTED_BY "mkWord");
    refused("first", ticket_small(0, n + 2, n + 1),
      INHERITED_PARAMETER_PREFIX "0" REJECTED_BY "mkTicket");
    refused("nested", stamped_small(0, 9, 9, 8),
      INHERITED_PARAMETER_PREFIX "0.mark is not below its Fin 8 bound");
    refused("nested", stamped_small(0, 6, 6, 7),
      INHERITED_PARAMETER_PREFIX "0" REJECTED_BY "mkStamped");
    expect("first", ticket_small(n, n + 1, n + 2), small(3 * n + 3));
    ++recoveries;
  }
}
#endif

int main(void) {
  wasmtime_error_t *error = inheritedcheckedrecords_wasmtime_open(&session);
  if (error) { show_error("open", error); return 1; }
  CHECK(session != NULL);
  results();
#ifdef INHERITED_CHECKED_RECORD_RESULT_ONLY
  host_refused("first", ticket_small(2, 3, 4));
#else
  inputs();
#endif
  inheritedcheckedrecords_wasmtime_close(session); session = NULL;
  printf("{\"checks\":%u,\"rejections\":%u,\"hostRejections\":%u,\"recoveries\":%u,\"snapshots\":%u,\"rounds\":%u}\n",
    checks, rejections, host_rejections, recoveries, snapshots, rounds);
  return 0;
}
