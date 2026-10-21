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
