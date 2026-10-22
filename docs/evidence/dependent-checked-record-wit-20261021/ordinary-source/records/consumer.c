#include "dependentrecords_wasmtime.h"
#ifndef DEPENDENT_CHECKED_RECORD_WIT_VALUES_H
#define DEPENDENT_CHECKED_RECORD_WIT_VALUES_H
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
/* Structural equality over the exact kinds this caller exchanges: a natural is
 * its canonical little-endian u32 limb list, a record is its named fields in
 * declaration order. */
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_BOOL: return a->of.boolean == b->of.boolean;
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
/* A Lean Nat crosses WIT as `list<u32>` limbs, least significant first, with
 * no zero limb at the top; zero is the empty list. */
static value nat(const uint32_t *limbs, size_t size) {
  value v = list(size);
  for (size_t i = 0; i < size; ++i)
    v.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return v;
}
static value small(uint32_t n) { return nat(&n, n ? 1 : 0); }
/* 2^130 and its neighbours exceed every machine word: five limbs. */
static value huge(void) { static const uint32_t limbs[5] = {0, 0, 0, 0, 4}; return nat(limbs, 5); }
static value huge_plus_one(void) { static const uint32_t limbs[5] = {1, 0, 0, 0, 4}; return nat(limbs, 5); }
static value huge_minus_one(void) {
  static const uint32_t limbs[5] = {0xffffffffu, 0xffffffffu, 0xffffffffu, 0xffffffffu, 3}; return nat(limbs, 5);
}
/* 2^130 + (2^130 - 1) = 2^131 - 1. */
static value huge_total(void) {
  static const uint32_t limbs[5] = {0xffffffffu, 0xffffffffu, 0xffffffffu, 0xffffffffu, 7}; return nat(limbs, 5);
}
/* A non-canonical natural: an explicit zero limb must be refused by the host. */
static value zero_limb(void) { static const uint32_t limbs[1] = {0}; return nat(limbs, 1); }
static value u8(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }
static value record2(const char *first, value a, const char *second, value b) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, 2);
  wasm_name_new(&out.of.record.data[0].name, strlen(first), first);
  out.of.record.data[0].val = a;
  wasm_name_new(&out.of.record.data[1].name, strlen(second), second);
  out.of.record.data[1].val = b; return out;
}
/* The proof-free host mirror of `DependentRecords.Dependent`: both retained
 * naturals, nothing for the erased `valid` proof. */
static value dependent(value bound, value below) { return record2("bound", bound, "below", below); }
static value one_field(const char *label, value payload) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, 1);
  wasm_name_new(&out.of.record.data[0].name, strlen(label), label);
  out.of.record.data[0].val = payload; return out;
}

static bool exact_cause(const char *text, size_t size, const char *expected) {
  if (memchr(text, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(text, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker_text[] = "\n\nCaused by:\n    ";
  if (size < sizeof(start) - 1 + sizeof(marker_text) - 1 + length
    || memcmp(text, start, sizeof(start) - 1)) return false;
  if (text[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker_text) - 1 + length) return false;
  size_t end = size - length, at = end - (sizeof(marker_text) - 1);
  if (memcmp(text + at, marker_text, sizeof(marker_text) - 1)
    || memcmp(text + end, expected, length)) return false;
  for (size_t i = sizeof(start) - 1; i + sizeof(marker_text) - 1 <= at; ++i)
    if (memcmp(text + i, marker_text, sizeof(marker_text) - 1) == 0) return false;
  return true;
}
#pragma GCC diagnostic pop
#endif

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
