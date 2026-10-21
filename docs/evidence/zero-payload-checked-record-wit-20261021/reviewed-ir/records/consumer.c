#define ZERO_PAYLOAD_PARAMETER_PREFIX "value"
#include "zeropayloadcheckedrecords_wasmtime.h"
#ifndef ZERO_PAYLOAD_CHECKED_RECORD_WIT_VALUES_H
#define ZERO_PAYLOAD_CHECKED_RECORD_WIT_VALUES_H
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
/* Structural equality over the exact kinds this caller exchanges; an enum is
 * its case name, an option is absence or its payload, a variant is its
 * discriminant plus payload. */
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_BOOL: return a->of.boolean == b->of.boolean;
    case WASMTIME_COMPONENT_U8: return a->of.u8 == b->of.u8;
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_ENUM: return same_name(&a->of.enumeration, &b->of.enumeration);
    case WASMTIME_COMPONENT_OPTION:
      if (!a->of.option || !b->of.option) return a->of.option == b->of.option;
      return same(a->of.option, b->of.option);
    case WASMTIME_COMPONENT_VARIANT:
      if (!same_name(&a->of.variant.discriminant, &b->of.variant.discriminant)) return false;
      if (!a->of.variant.val || !b->of.variant.val) return a->of.variant.val == b->of.variant.val;
      return same(a->of.variant.val, b->of.variant.val);
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
static value u8(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }
static value boolean(bool b) { return (value){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = b}; }
static value enum_case(const char *name) {
  value v = {.kind = WASMTIME_COMPONENT_ENUM};
  wasm_name_new(&v.of.enumeration, strlen(name), name); return v;
}
/* The documented empty-carrier convention: a proof-only or plain empty record
 * crosses as the single-case enum `empty`; Unit crosses as the enum `unit`. */
static value witness(void) { return enum_case("empty"); }
static value marker(void) { return enum_case("empty"); }
static value unit_value(void) { return enum_case("unit"); }
static value one_field(const char *label, value payload) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, 1);
  wasm_name_new(&out.of.record.data[0].name, strlen(label), label);
  out.of.record.data[0].val = payload; return out;
}
static value token(void) { return one_field("tag", unit_value()); }
static value witnesses(size_t count) {
  value v = list(count);
  for (size_t i = 0; i < count; ++i) v.of.list.data[i] = witness();
  return v;
}
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL}; }
static value some(value payload) {
  value v = {.kind = WASMTIME_COMPONENT_OPTION};
  v.of.option = wasmtime_component_val_new(&payload); return v;
}
static value variant(const char *discriminant, const value *payload) {
  value v = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&v.of.variant.discriminant, strlen(discriminant), discriminant);
  if (payload) { value taken = *payload; v.of.variant.val = wasmtime_component_val_new(&taken); }
  else v.of.variant.val = NULL;
  return v;
}
static value blank(void) { return variant("blank", NULL); }
static value marked(void) {
  value fields = one_field("witness", witness()); return variant("marked", &fields);
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
