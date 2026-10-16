#include "nestedcheckedrecords_wasmtime.h"
#include "wit-values.h"
#include <stdio.h>

/* Public nested checked-record WIT caller; NESTED_CHECKED_RECORD_RESULT_ONLY selects
 * the standalone output API. Expected values are written independently of generated code. */
#ifndef NESTED_PARAMETER_PREFIX
#define NESTED_PARAMETER_PREFIX "arg"
#endif
#define REJECTED_BY " was rejected by NestedCheckedRecords."
#define HOST_REFUSAL "Unknown export, invalid WIT input or 16 MiB conversion limit"

static nestedcheckedrecords_wasmtime *session;
static unsigned checks, rejections, host_rejections, recoveries, snapshots;
static const unsigned rounds = 256;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "nested WIT check failed at %d: %s\n", __LINE__, #condition); exit(1); } ++checks; } while (0)
#define SNAPSHOT(condition) do { ++snapshots; CHECK(condition); } while (0)

static void show_error(const char *label, wasmtime_error_t *error) {
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%s: %.*s\n", label, (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
/* Call once, require the exact result and an unchanged caller tree, then release both. */
static void expect_many(const char *label, value *inputs, size_t count, value expected) {
  value before[2] = {{0}, {0}}, out = {0};
  if (count > 2) abort();
  for (size_t i = 0; i < count; ++i) before[i] = clone(&inputs[i]);
  wasmtime_error_t *error = nestedcheckedrecords_wasmtime_call(session, label, inputs, count, &out);
  if (error) show_error(label, error);
  CHECK(error == NULL);
  if (!same(&out, &expected)) fprintf(stderr, "%s: unexpected result\n", label);
  CHECK(same(&out, &expected));
  for (size_t i = 0; i < count; ++i) { SNAPSHOT(same(&inputs[i], &before[i])); clear(&inputs[i]); clear(&before[i]); }
  clear(&out); clear(&expected);
}
static void expect(const char *label, value input, value expected) { expect_many(label, &input, 1, expected); }
/* A refusal must leave the result sentinel and every caller tree untouched. */
static void refused_many(const char *label, value *inputs, size_t count, const char *cause, bool host) {
  value before[2] = {{0}, {0}}, out = small(99), sentinel = clone(&out);
  if (count > 2) abort();
  for (size_t i = 0; i < count; ++i) before[i] = clone(&inputs[i]);
  wasmtime_error_t *error = nestedcheckedrecords_wasmtime_call(session, label, inputs, count, &out);
  CHECK(error != NULL);
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool exact = exact_cause(message.data, message.size, cause);
  if (!exact) fprintf(stderr, "%s: expected '%s', got '%.*s'\n", label, cause, (int)message.size, message.data);
  CHECK(exact); CHECK(same(&out, &sentinel));
  for (size_t i = 0; i < count; ++i) { SNAPSHOT(same(&inputs[i], &before[i])); clear(&inputs[i]); clear(&before[i]); }
  if (host) ++host_rejections; else ++rejections;
  wasm_name_delete(&message); wasmtime_error_delete(error);
  clear(&out); clear(&sentinel);
}
static void host_refused(const char *label, value input) { refused_many(label, &input, 1, HOST_REFUSAL, true); }
static value two(value first, value second) { value items[] = {first, second}; return packets(2, items); }

static void results(void) {
  for (uint32_t round = 0; round < rounds; ++round) {
    /* 2^100 + round, with words one and two above it. */
    expect("produce-option", huge(round), some(packet(0, huge(round + 1))));
    expect("produce-array", huge(round), two(packet(0, huge(round + 1)), packet(0, huge(round + 2))));
  }
  /* Wrong shapes and non-canonical limbs never reach Lean. */
  host_refused("produce-option", u8(1));
  const uint32_t noncanonical[] = {3, 0};
  host_refused("produce-option", nat(noncanonical, 2));
  host_refused("missing-export", small(1));
}

#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
static void refused(const char *label, value input, const char *cause) { refused_many(label, &input, 1, cause, false); }
static void inputs(void) {
  expect("first", packet_small(2, 3), small(3));
  expect("second", packet_small(7, 0), small(8));
  value args[] = {packet_small(2, 3), packet_small(7, 0)};
  expect_many("pair", args, 2, small(11));
  expect("in-array", two(packet_small(1, 2), packet_small(3, 5)), small(7));
  expect("in-list", two(packet_small(1, 0), packet_small(3, 100)), small(6));
  expect("in-option", none(), small(0));
  expect("in-option", some(packet_small(1, 2)), small(3));
  expect("in-product", duo(packet_small(1, 2), packet_small(3, 0)), small(6));
  expect("in-except", branch(true, packet_small(2, 9)), small(3));
  expect("in-except", branch(false, packet_small(1, 2)), small(3));
  expect("in-holder", holder(packet_small(3, 1), 9), small(13));
  expect("in-choice", choice_empty(), small(0));
  expect("in-choice", choice_packet(packet_small(2, 4)), small(5));
  expect("echo-array", two(packet_small(2, 3), packet(1, huge(0))), two(packet_small(2, 3), packet(1, huge(0))));

  /* Exact late-field and constructor paths through every carrier. */
  refused("first", packet_small(0, 0), NESTED_PARAMETER_PREFIX "0.word" REJECTED_BY "mkWord");
  refused("first", packet_small(4, 2), NESTED_PARAMETER_PREFIX "0" REJECTED_BY "mkPacket");
  refused("first", packet_small(10, 12), NESTED_PARAMETER_PREFIX "0.digit is not below its Fin 10 bound");
  refused("in-array", two(packet_small(2, 3), packet_small(1, 0)), NESTED_PARAMETER_PREFIX "0[1].word" REJECTED_BY "mkWord");
  refused("in-array", two(packet_small(2, 3), packet_small(5, 2)), NESTED_PARAMETER_PREFIX "0[1]" REJECTED_BY "mkPacket");
  refused("in-array", two(packet_small(2, 3), packet_small(10, 12)), NESTED_PARAMETER_PREFIX "0[1].digit is not below its Fin 10 bound");
  refused("in-option", some(packet_small(5, 2)), NESTED_PARAMETER_PREFIX "0?" REJECTED_BY "mkPacket");
  refused("in-product", duo(packet_small(1, 2), packet_small(10, 0)), NESTED_PARAMETER_PREFIX "0.1.digit is not below its Fin 10 bound");
  refused("in-except", branch(true, packet_small(10, 0)), NESTED_PARAMETER_PREFIX "0.ok.digit is not below its Fin 10 bound");
  refused("in-except", branch(false, packet_small(3, 1)), NESTED_PARAMETER_PREFIX "0.error" REJECTED_BY "mkPacket");
  refused("in-holder", holder(packet_small(10, 0), 9), NESTED_PARAMETER_PREFIX "0.packet.digit is not below its Fin 10 bound");
  refused("in-choice", choice_packet(packet_small(3, 1)), NESTED_PARAMETER_PREFIX "0.packet.value" REJECTED_BY "mkPacket");

  /* Malformed records are host refusals, distinct from Lean rejections. */
  value wrong = packet_small(2, 3); wrong.of.record.data[0].name.data[0] = 'D'; host_refused("first", wrong);
  wrong = packet_small(2, 3); --wrong.of.record.size; host_refused("first", wrong);
  const uint32_t noncanonical[] = {3, 0};
  host_refused("first", packet(2, nat(noncanonical, 2)));
  value tagged = choice_packet(packet_small(2, 4)); tagged.of.variant.discriminant.data[0] = 'P'; host_refused("in-choice", tagged);

  /* Rejection never poisons the session: each refusal is followed by a success. */
  for (uint32_t round = 0; round < rounds; ++round) {
    expect("first", packet_small(round % 10, round + 10), small(round + 10));
    refused("first", packet_small(2, 1), NESTED_PARAMETER_PREFIX "0" REJECTED_BY "mkPacket");
    expect("second", packet_small(round % 10, 0), small(round % 10 + 1));
    refused("in-array", two(packet_small(round % 10, round + 10), packet_small(1, 0)), NESTED_PARAMETER_PREFIX "0[1].word" REJECTED_BY "mkWord");
    expect("in-array", two(packet_small(round % 10, round + 10), packet_small(2, 3)), small(round + 13));
    ++recoveries;
  }
}
#endif

int main(void) {
  wasmtime_error_t *error = nestedcheckedrecords_wasmtime_open(&session);
  if (error) { show_error("open", error); return 1; }
  CHECK(session != NULL);
  results();
#ifdef NESTED_CHECKED_RECORD_RESULT_ONLY
  host_refused("first", packet_small(2, 3));
#else
  inputs();
#endif
  nestedcheckedrecords_wasmtime_close(session); session = NULL;
  printf("{\"checks\":%u,\"rejections\":%u,\"hostRejections\":%u,\"recoveries\":%u,\"snapshots\":%u,\"rounds\":%u}\n",
    checks, rejections, host_rejections, recoveries, snapshots, rounds);
  return 0;
}
