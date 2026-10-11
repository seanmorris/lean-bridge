#ifndef STRUCTURAL_SUBTYPE_WIT_VALUES_H
#define STRUCTURAL_SUBTYPE_WIT_VALUES_H
#include <wasmtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;

/* Independent comparison of every active public payload, including NUL suffixes. */
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_U8: return a->of.u8 == b->of.u8;
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_STRING:
      return a->of.string.size == b->of.string.size &&
        (!a->of.string.size || memcmp(a->of.string.data, b->of.string.data, a->of.string.size) == 0);
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
static value huge(bool increment) { const uint32_t limbs[] = {increment ? 1 : 0, 0, 0, 16}; return nat(limbs, 4); }
static value wide(bool below) { const uint32_t limbs[] = {below ? 9 : 10, 0, 10}; return nat(limbs, 3); }
static value text(const char *bytes, size_t size) {
  value v = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&v.of.string, size, bytes); return v;
}
static value word(void) { static const char s[] = "h\xc3\xa9llo\0tail\xf0\x9f\x99\x82"; return text(s, sizeof(s) - 1); }
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL}; }
static value some(value payload) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&payload)}; }
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE}; wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value branch(bool ok, value payload) {
  return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = ok, .val = wasmtime_component_val_new(&payload)}};
}
static value byte(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }

/* Accept a complete cause, not a substring of some unrelated Wasmtime failure. */
static bool exact_cause(const char *bytes, size_t size, const char *expected) {
  if (memchr(bytes, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(bytes, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker[] = "\n\nCaused by:\n    ";
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length || memcmp(bytes, start, sizeof(start) - 1)) return false;
  /* Wasmtime's formatted error chain terminates in one newline. A bare cause
   * still requires byte-for-byte equality, and extra trailing data rejects. */
  if (bytes[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length) return false;
  size_t end = size - length, at = end - (sizeof(marker) - 1);
  if (memcmp(bytes + at, marker, sizeof(marker) - 1) || memcmp(bytes + end, expected, length)) return false;
  /* A cause marker embedded in the backtrace would make the chain ambiguous. */
  for (size_t i = sizeof(start) - 1; i + sizeof(marker) - 1 <= at; ++i)
    if (memcmp(bytes + i, marker, sizeof(marker) - 1) == 0) return false;
  return true;
}

static unsigned snapshot_controls(void) {
  value a = list(3), b = branch(false, word());
  a.of.list.data[0] = some(huge(false)); a.of.list.data[1] = none();
  a.of.list.data[2] = some(pair(byte(255), word()));
  value saved_a = clone(&a), saved_b = clone(&b);
  if (!same(&a, &saved_a) || !same(&b, &saved_b)) abort();
  unsigned controls = 0;
#define CHANGED() do { if (same(&a, &saved_a) && same(&b, &saved_b)) abort(); ++controls; } while (0)
  value *n = a.of.list.data[0].of.option, *tuple = a.of.list.data[2].of.option;
  ++n->of.list.data[3].of.u32; CHANGED(); --n->of.list.data[3].of.u32;
  ++n->of.list.data[0].of.u32; CHANGED(); --n->of.list.data[0].of.u32;
  --n->of.list.size; CHANGED(); ++n->of.list.size;
  n->of.list.data[0].kind = WASMTIME_COMPONENT_S32; CHANGED(); n->of.list.data[0].kind = WASMTIME_COMPONENT_U32;
  tuple->of.tuple.data[1].of.string.data[8] ^= 1; CHANGED(); tuple->of.tuple.data[1].of.string.data[8] ^= 1;
  --b.of.result.val->of.string.size; CHANGED(); ++b.of.result.val->of.string.size;
  --a.of.list.size; CHANGED(); ++a.of.list.size;
  a.of.list.data[0].of.option = NULL; CHANGED(); a.of.list.data[0].of.option = n;
  --tuple->of.tuple.size; CHANGED(); ++tuple->of.tuple.size;
  b.of.result.is_ok = true; CHANGED(); b.of.result.is_ok = false;
  --tuple->of.tuple.data[0].of.u8; CHANGED(); ++tuple->of.tuple.data[0].of.u8;
  tuple->kind = WASMTIME_COMPONENT_LIST; CHANGED(); tuple->kind = WASMTIME_COMPONENT_TUPLE;
#undef CHANGED
  if (!same(&a, &saved_a) || !same(&b, &saved_b)) abort();
  clear(&a); clear(&b); clear(&saved_a); clear(&saved_b);
  return controls;
}
#endif
