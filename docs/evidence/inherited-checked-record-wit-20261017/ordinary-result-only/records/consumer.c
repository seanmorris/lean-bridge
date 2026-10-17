#define INHERITED_CHECKED_RECORD_RESULT_ONLY
#include "inheritedcheckedrecords_wasmtime.h"
#ifndef INHERITED_CHECKED_RECORD_WIT_VALUES_H
#define INHERITED_CHECKED_RECORD_WIT_VALUES_H
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

/* Inheritance stays visible as nested parent subobjects in the public WIT records. */
static value span(value lo, value hi) { return two_fields("lo", lo, "hi", hi); }
static value span_small(uint32_t lo, uint32_t hi) { return span(small(lo), small(hi)); }
static value ticket(value lo, value hi, value word) {
  return two_fields("to-span", span(lo, hi), "word", word);
}
static value ticket_small(uint32_t lo, uint32_t hi, uint32_t word) {
  return ticket(small(lo), small(hi), small(word));
}
static value stamped(value wrapped, value mark) {
  return two_fields("to-ticket", wrapped, "mark", mark);
}
static value stamped_small(uint32_t lo, uint32_t hi, uint32_t word, uint32_t mark) {
  return stamped(ticket_small(lo, hi, word), small(mark));
}
#pragma GCC diagnostic pop
#endif

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
