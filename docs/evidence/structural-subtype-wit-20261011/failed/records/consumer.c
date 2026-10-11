#include "structuralsubtypes_wasmtime.h"
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

#include <stdio.h>

static unsigned checks, rejections;
static structuralsubtypes_wasmtime *session;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "structural WIT check failed at %d: %s\n", __LINE__, #condition); exit(1); } ++checks; } while (0)

static void successful(const char *name, value *args, size_t count, value expected) {
  value saved[2] = {{0}, {0}}, out = {0};
  for (size_t i = 0; i < count; ++i) saved[i] = clone(&args[i]);
  wasmtime_error_t *error = structuralsubtypes_wasmtime_call(session, name, args, count, &out);
  if (error) { wasm_name_t m; wasmtime_error_message(error, &m); fprintf(stderr, "%s: %.*s\n", name, (int)m.size, m.data); }
  CHECK(error == NULL); CHECK(same(&out, &expected));
  for (size_t i = 0; i < count; ++i) { CHECK(same(&args[i], &saved[i])); clear(&args[i]); clear(&saved[i]); }
  clear(&out); clear(&expected);
}
static void refused(const char *name, value *args, size_t count, const char *expected) {
  value saved[2] = {{0}, {0}}, out = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  for (size_t i = 0; i < count; ++i) saved[i] = clone(&args[i]);
  wasmtime_error_t *error = structuralsubtypes_wasmtime_call(session, name, args, count, &out);
  CHECK(error != NULL);
  wasm_name_t m; wasmtime_error_message(error, &m);
  bool exact = exact_cause(m.data, m.size, expected);
  if (!exact) fprintf(stderr, "%s: expected '%s', got '%.*s'\n", name, expected, (int)m.size, m.data);
  CHECK(exact); CHECK(out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 991);
  for (size_t i = 0; i < count; ++i) { CHECK(same(&args[i], &saved[i])); clear(&args[i]); clear(&saved[i]); }
  wasm_name_delete(&m); wasmtime_error_delete(error); ++rejections;
}
static value numbers(int bad) {
  value v = list(3); v.of.list.data[0] = small(1); v.of.list.data[1] = huge(false); v.of.list.data[2] = small(3);
  if (bad >= 0) { clear(&v.of.list.data[bad]); v.of.list.data[bad] = small(0); } return v;
}
static value group(bool second, bool normalized, int bad) {
  value v = list(3);
  v.of.list.data[0] = some(second ? huge(normalized) : small(1));
  v.of.list.data[1] = second ? some(small(normalized ? 4 : 3)) : none();
  v.of.list.data[2] = second ? none() : some(huge(false));
  if (bad >= 0) { clear(&v.of.list.data[bad]); v.of.list.data[bad] = some(small(0)); } return v;
}
static value joined(void) {
  value first = group(false, false, -1), second = group(true, true, -1), out = list(6);
  for (size_t i = 0; i < 3; ++i) { out.of.list.data[i] = clone(&first.of.list.data[i]); out.of.list.data[i + 3] = clone(&second.of.list.data[i]); }
  clear(&first); clear(&second); return out;
}
static value nested(int row, int column, unsigned mode) {
  value v = list(3);
  for (int i = 0; i < 3; ++i) {
    v.of.list.data[i] = list(3);
    for (int j = 0; j < 3; ++j) {
      bool selected = i == row && j == column;
      v.of.list.data[i].of.list.data[j] = some(pair(selected && mode < 2 ? small(0) : huge(false), wide(!(selected && mode == 0))));
    }
  }
  return v;
}

int main(void) {
  unsigned snapshots = snapshot_controls();
  CHECK(snapshots == 12);
  CHECK(structuralsubtypes_wasmtime_open(&session) == NULL);
  value args[2]; char message[256];
  args[0] = huge(false); successful("scalar", args, 1, huge(false));
  args[0] = small(0); refused("scalar", args, 1, "arg0 was rejected by StructuralSubtypes.checkedPositive");
  const char *sequences[] = {"arrays", "lists", "specialized"};
  for (unsigned k = 0; k < 3; ++k) {
    args[0] = list(0); successful(sequences[k], args, 1, list(0));
    args[0] = numbers(-1); successful(sequences[k], args, 1, numbers(-1));
    for (int i = 0; i < 3; ++i) {
      args[0] = numbers(i); snprintf(message, sizeof(message), "arg0[%d] was rejected by StructuralSubtypes.checkedPositive", i);
      refused(sequences[k], args, 1, message);
    }
    args[0] = numbers(-1); successful(sequences[k], args, 1, numbers(-1));
  }
  args[0] = none(); successful("options", args, 1, none());
  args[0] = some(huge(false)); successful("options", args, 1, some(huge(false)));
  args[0] = some(small(0)); refused("options", args, 1, "arg0? was rejected by StructuralSubtypes.checkedPositive");
  args[0] = pair(huge(false), word()); successful("product", args, 1, pair(huge(false), word()));
  args[0] = pair(small(0), word()); refused("product", args, 1, "arg0.0 was rejected by StructuralSubtypes.checkedPositive");
  args[0] = pair(huge(false), text("", 0)); refused("product", args, 1, "arg0.1 was rejected by StructuralSubtypes.checkedWord");
  args[0] = branch(true, huge(false)); successful("branch", args, 1, branch(true, huge(false)));
  args[0] = branch(false, word()); successful("branch", args, 1, branch(false, word()));
  args[0] = branch(true, small(0)); refused("branch", args, 1, "arg0.ok was rejected by StructuralSubtypes.checkedPositive");
  args[0] = branch(false, text("", 0)); refused("branch", args, 1, "arg0.error was rejected by StructuralSubtypes.checkedWord");
  for (unsigned mode = 0; mode < 3; ++mode) {
    args[0] = list(2); args[0].of.list.data[0] = none();
    args[0].of.list.data[1] = some(pair(byte(mode == 1 ? 0 : 255), mode == 2 ? small(0) : huge(false)));
    if (mode == 0) successful("byte-branches", args, 1, clone(&args[0]));
    else refused("byte-branches", args, 1, mode == 1 ? "arg0[1]?.0 was rejected by StructuralSubtypes.checkedByte" : "arg0[1]?.1 was rejected by StructuralSubtypes.checkedPositive");
  }
  args[0] = list(3); args[0].of.list.data[0] = list(2);
  args[0].of.list.data[0].of.list.data[0] = none(); args[0].of.list.data[0].of.list.data[1] = some(pair(huge(false), wide(true)));
  args[0].of.list.data[1] = list(0); args[0].of.list.data[2] = list(1);
  args[0].of.list.data[2].of.list.data[0] = some(pair(small(2), small(3)));
  successful("nested", args, 1, small(3));
  for (int i = 0; i < 3; ++i) for (int j = 0; j < 3; ++j) {
    args[0] = nested(i, j, 0);
    snprintf(message, sizeof(message), "arg0[%d][%d]?.1 is not below its Fin 184467440737095516170 bound", i, j); refused("nested", args, 1, message);
    args[0] = nested(i, j, 1);
    snprintf(message, sizeof(message), "arg0[%d][%d]?.0 was rejected by StructuralSubtypes.checkedPositive", i, j); refused("nested", args, 1, message);
    args[0] = nested(i, j, 2); successful("nested", args, 1, small(3));
  }
  args[0] = pair(group(false, false, -1), group(true, false, -1));
  successful("alias-pair", args, 1, pair(group(false, false, -1), group(true, true, -1)));
  args[0] = group(false, false, -1); args[1] = group(true, false, -1); successful("alias-arguments", args, 2, joined());
  args[0] = list(3); args[0].of.list.data[0] = none(); args[0].of.list.data[1] = some(small(0)); args[0].of.list.data[2] = some(small(9));
  successful("plain-fin", args, 1, small(3));
  args[0] = list(1); args[0].of.list.data[0] = some(small(10)); refused("plain-fin", args, 1, "arg0[0]? is not below its Fin 10 bound");
  for (int i = 0; i < 3; ++i) {
    args[0] = pair(group(false, false, i), group(true, false, -1));
    snprintf(message, sizeof(message), "arg0.0[%d]? was rejected by StructuralSubtypes.checkedPositive", i); refused("alias-pair", args, 1, message);
    args[0] = pair(group(false, false, -1), group(true, false, i));
    snprintf(message, sizeof(message), "arg0.1[%d]? was rejected by StructuralSubtypes.normalizePositive", i); refused("alias-pair", args, 1, message);
  }
  for (unsigned round = 0; round < 1000; ++round) {
    args[0] = group(false, false, -1); args[1] = group(true, false, round % 3);
    snprintf(message, sizeof(message), "arg1[%u]? was rejected by StructuralSubtypes.normalizePositive", round % 3); refused("alias-arguments", args, 2, message);
    args[0] = group(false, false, -1); args[1] = group(true, false, -1); successful("alias-arguments", args, 2, joined());
  }
  /* A copied result owns storage independently of both its input and the session. */
  value out = {0}, expected = huge(false); args[0] = huge(false);
  CHECK(structuralsubtypes_wasmtime_call(session, "scalar", args, 1, &out) == NULL);
  CHECK(same(&out, &expected)); ++args[0].of.list.data[0].of.u32;
  CHECK(same(&out, &expected)); structuralsubtypes_wasmtime_close(session);
  CHECK(same(&out, &expected)); clear(&out); clear(&expected); clear(&args[0]);
  printf("{\"checks\":%u,\"rejections\":%u,\"snapshotControls\":%u}\n", checks, rejections, snapshots);
  return 0;
}
