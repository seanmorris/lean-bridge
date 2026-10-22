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
