#include "nestedcheckedrecords_wasmtime.h"
#ifndef NESTED_CHECKED_RECORD_WIT_VALUES_H
#define NESTED_CHECKED_RECORD_WIT_VALUES_H
#include <wasmtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
/* Callers use a subset of these helpers in each API mode. */
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-function"

/* Independent comparison of copied component values; floats compare by bit pattern. */
static bool same_name(const wasm_name_t *a, const wasm_name_t *b) {
  return a->size == b->size && (!a->size || memcmp(a->data, b->data, a->size) == 0);
}
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_BOOL: return a->of.boolean == b->of.boolean;
    case WASMTIME_COMPONENT_S8: return a->of.s8 == b->of.s8;
    case WASMTIME_COMPONENT_U8: return a->of.u8 == b->of.u8;
    case WASMTIME_COMPONENT_S16: return a->of.s16 == b->of.s16;
    case WASMTIME_COMPONENT_U16: return a->of.u16 == b->of.u16;
    case WASMTIME_COMPONENT_S32: return a->of.s32 == b->of.s32;
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_S64: return a->of.s64 == b->of.s64;
    case WASMTIME_COMPONENT_U64: return a->of.u64 == b->of.u64;
    case WASMTIME_COMPONENT_F32: return memcmp(&a->of.f32, &b->of.f32, sizeof(float)) == 0;
    case WASMTIME_COMPONENT_F64: return memcmp(&a->of.f64, &b->of.f64, sizeof(double)) == 0;
    case WASMTIME_COMPONENT_CHAR: return a->of.character == b->of.character;
    case WASMTIME_COMPONENT_STRING: return same_name(&a->of.string, &b->of.string);
    case WASMTIME_COMPONENT_ENUM: return same_name(&a->of.enumeration, &b->of.enumeration);
    case WASMTIME_COMPONENT_LIST:
      if (a->of.list.size != b->of.list.size) return false;
      for (size_t i = 0; i < a->of.list.size; ++i) if (!same(&a->of.list.data[i], &b->of.list.data[i])) return false;
      return true;
    case WASMTIME_COMPONENT_TUPLE:
      if (a->of.tuple.size != b->of.tuple.size) return false;
      for (size_t i = 0; i < a->of.tuple.size; ++i) if (!same(&a->of.tuple.data[i], &b->of.tuple.data[i])) return false;
      return true;
    case WASMTIME_COMPONENT_OPTION:
      if (!a->of.option || !b->of.option) return a->of.option == b->of.option;
      return same(a->of.option, b->of.option);
    case WASMTIME_COMPONENT_RESULT:
      if (a->of.result.is_ok != b->of.result.is_ok) return false;
      if (!a->of.result.val || !b->of.result.val) return a->of.result.val == b->of.result.val;
      return same(a->of.result.val, b->of.result.val);
    case WASMTIME_COMPONENT_RECORD:
      if (a->of.record.size != b->of.record.size) return false;
      for (size_t i = 0; i < a->of.record.size; ++i) {
        const wasmtime_component_valrecord_entry_t *x = &a->of.record.data[i], *y = &b->of.record.data[i];
        if (!same_name(&x->name, &y->name) || !same(&x->val, &y->val)) return false;
      }
      return true;
    case WASMTIME_COMPONENT_VARIANT:
      if (!same_name(&a->of.variant.discriminant, &b->of.variant.discriminant)) return false;
      if (!a->of.variant.val || !b->of.variant.val) return a->of.variant.val == b->of.variant.val;
      return same(a->of.variant.val, b->of.variant.val);
    default: return false;
  }
}
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value clone(const value *v) { value copied = {0}; wasmtime_component_val_clone(v, &copied); return copied; }
static value list(size_t size) {
  value v = {.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&v.of.list, size); return v;
}
static value nat(const uint32_t *limbs, size_t size) {
  value v = list(size);
  for (size_t i = 0; i < size; ++i) v.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return v;
}
static value small(uint32_t n) { return nat(&n, n ? 1 : 0); }
/* 2^100 plus an offset below 2^32, canonical little-endian limbs. */
static value huge(uint32_t offset) { const uint32_t limbs[] = {offset, 0, 0, 16}; return nat(limbs, 4); }
static value u8(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL}; }
static value some(value payload) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&payload)}; }
static value duo(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE}; wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value branch(bool ok, value payload) {
  return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = ok, .val = wasmtime_component_val_new(&payload)}};
}
static value named_fields(size_t count, const char **names, value *fields) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&out.of.record.data[i].name, strlen(names[i]), names[i]);
    out.of.record.data[i].val = fields[i];
  }
  return out;
}
static value one_field(const char *label, value payload) {
  const char *names[] = {label}; return named_fields(1, names, &payload);
}
static value two_fields(const char *first, value left, const char *second, value right) {
  const char *names[] = {first, second}; value fields[] = {left, right}; return named_fields(2, names, fields);
}

/* Accept a complete cause, not a substring of some unrelated Wasmtime failure. */
static bool exact_cause(const char *text_bytes, size_t size, const char *expected) {
  if (memchr(text_bytes, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(text_bytes, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker[] = "\n\nCaused by:\n    ";
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length || memcmp(text_bytes, start, sizeof(start) - 1)) return false;
  /* Wasmtime's formatted error chain terminates in one newline. A bare cause
   * still requires byte-for-byte equality, and extra trailing data rejects. */
  if (text_bytes[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length) return false;
  size_t end = size - length, at = end - (sizeof(marker) - 1);
  if (memcmp(text_bytes + at, marker, sizeof(marker) - 1) || memcmp(text_bytes + end, expected, length)) return false;
  /* A cause marker embedded in the backtrace would make the chain ambiguous. */
  for (size_t i = sizeof(start) - 1; i + sizeof(marker) - 1 <= at; ++i)
    if (memcmp(text_bytes + i, marker, sizeof(marker) - 1) == 0) return false;
  return true;
}

/* Nested checked-record carriers: Fin 10 digits and positive words are Nat limbs. */
static value packet(uint32_t digit, value word) {
  return two_fields("digit", small(digit), "word", word);
}
static value packet_small(uint32_t digit, uint32_t word) { return packet(digit, small(word)); }
static value holder(value wrapped, uint32_t tag) { return two_fields("packet", wrapped, "tag", small(tag)); }
static value choice_empty(void) {
  value out = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&out.of.variant.discriminant, 5, "empty"); return out;
}
static value choice_packet(value wrapped) {
  value payload = one_field("value", wrapped), out = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&out.of.variant.discriminant, 6, "packet");
  out.of.variant.val = wasmtime_component_val_new(&payload); return out;
}
static value packets(size_t count, value *items) {
  value out = list(count);
  for (size_t i = 0; i < count; ++i) out.of.list.data[i] = items[i];
  return out;
}
#pragma GCC diagnostic pop
#endif

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
