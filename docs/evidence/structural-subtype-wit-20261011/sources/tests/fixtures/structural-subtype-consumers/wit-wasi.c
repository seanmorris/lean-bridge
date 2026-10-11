#include "structuralsubtypes_wasmtime.h"
#include "wit-values.h"
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
