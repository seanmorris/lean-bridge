#include "fincontainers_wasmtime.h"
#ifndef FIN_LATE_WIT_VALUES_H
#define FIN_LATE_WIT_VALUES_H
#include <wasmtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t late_value;

/* Compare the complete public value trees, never Lean's private object layout. */
static bool late_equal(const late_value *left, const late_value *right) {
  if (left->kind != right->kind) return false;
  switch (left->kind) {
    case WASMTIME_COMPONENT_U32: return left->of.u32 == right->of.u32;
    case WASMTIME_COMPONENT_STRING:
      return left->of.string.size == right->of.string.size &&
        (!left->of.string.size || memcmp(left->of.string.data, right->of.string.data, left->of.string.size) == 0);
    case WASMTIME_COMPONENT_LIST:
      if (left->of.list.size != right->of.list.size) return false;
      for (size_t i = 0; i < left->of.list.size; ++i)
        if (!late_equal(&left->of.list.data[i], &right->of.list.data[i])) return false;
      return true;
    default: return false;
  }
}

static void late_delete(late_value *value) {
  wasmtime_component_val_delete(value);
  *value = (late_value){0};
}

static late_value late_list(size_t size) {
  late_value value = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&value.of.list, size);
  return value;
}

static late_value late_text(const char *bytes, size_t size) {
  late_value value = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&value.of.string, size, bytes);
  return value;
}

static late_value late_nat(const uint32_t *limbs, size_t size) {
  late_value value = late_list(size);
  for (size_t i = 0; i < size; ++i)
    value.of.list.data[i] = (late_value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return value;
}

static late_value late_names(void) {
  late_value names = late_list(3);
  names.of.list.data[0] = late_text("alpha", 5);
  names.of.list.data[1] = late_text("mid\0dle", 7);
  names.of.list.data[2] = late_text("omega", 5);
  return names;
}

static late_value late_offsets(void) {
  late_value offsets = late_list(3);
  for (uint32_t i = 0; i < 3; ++i) {
    const uint32_t limb = i + 1;
    offsets.of.list.data[i] = late_nat(&limb, 1);
  }
  return offsets;
}

/* Every comparison has an independent clone. Mutations include bytes after NUL,
 * each array position, limb contents, length and kind. Restore before deletion. */
static unsigned late_snapshot_controls(void) {
  late_value names = late_names(), offsets = late_offsets(), saved_names = {0}, saved_offsets = {0};
  wasmtime_component_val_clone(&names, &saved_names);
  wasmtime_component_val_clone(&offsets, &saved_offsets);
  unsigned controls = 0;
  if (!late_equal(&names, &saved_names) || !late_equal(&offsets, &saved_offsets)) abort();
  for (size_t i = 0; i < 3; ++i) {
    size_t at = i == 1 ? 5 : 0;
    char *byte = &names.of.list.data[i].of.string.data[at];
    char original = *byte;
    *byte ^= 1;
    if (late_equal(&names, &saved_names) || saved_names.of.list.data[i].of.string.data[at] != original) abort();
    *byte = original; ++controls;
    uint32_t *limb = &offsets.of.list.data[i].of.list.data[0].of.u32;
    ++*limb;
    if (late_equal(&offsets, &saved_offsets) || saved_offsets.of.list.data[i].of.list.data[0].of.u32 != i + 1) abort();
    --*limb; ++controls;
  }
  --names.of.list.size;
  if (late_equal(&names, &saved_names)) abort();
  ++names.of.list.size; ++controls;
  --offsets.of.list.size;
  if (late_equal(&offsets, &saved_offsets)) abort();
  ++offsets.of.list.size; ++controls;
  --names.of.list.data[1].of.string.size;
  if (late_equal(&names, &saved_names)) abort();
  ++names.of.list.data[1].of.string.size; ++controls;
  --offsets.of.list.data[1].of.list.size;
  if (late_equal(&offsets, &saved_offsets)) abort();
  ++offsets.of.list.data[1].of.list.size; ++controls;
  offsets.of.list.data[1].of.list.data[0].kind = WASMTIME_COMPONENT_S32;
  if (late_equal(&offsets, &saved_offsets)) abort();
  offsets.of.list.data[1].of.list.data[0].kind = WASMTIME_COMPONENT_U32; ++controls;
  if (!late_equal(&names, &saved_names) || !late_equal(&offsets, &saved_offsets)) abort();
  late_delete(&names); late_delete(&offsets); late_delete(&saved_names); late_delete(&saved_offsets);
  return controls;
}
#endif

#include <stdio.h>

static unsigned checks;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "late input check failed at line %d: %s\n", __LINE__, #condition); exit(1); } ++checks; } while (0)

static void late_pair(fincontainers_wasmtime *session, size_t position, unsigned representation) {
  late_value arguments[2] = {late_names(), late_offsets()}, snapshots[2] = {{0}, {0}};
  const uint32_t invalid[][3] = {{4, 0, 0}, {0, 0, 64}, {4, 0, 0}};
  const size_t lengths[] = {1, 3, 3};
  late_delete(&arguments[1].of.list.data[position]);
  arguments[1].of.list.data[position] = late_nat(invalid[representation], lengths[representation]);
  for (size_t i = 0; i < 2; ++i) wasmtime_component_val_clone(&arguments[i], &snapshots[i]);
  late_value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = fincontainers_wasmtime_call(session, "label", arguments, 2, &output);
  /* Keep both inputs alive until all comparisons finish. */
  CHECK(late_equal(&arguments[0], &snapshots[0]));
  CHECK(late_equal(&arguments[1], &snapshots[1]));
  CHECK(output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  char expected[128];
  /* Padded limbs are not canonical Nat input. Require that structural error,
   * not a Fin error, while preserving the same complete snapshots and output. */
  if (representation == 2)
    snprintf(expected, sizeof(expected), "Unknown export, invalid WIT input or 16 MiB conversion limit");
  else
    snprintf(expected, sizeof(expected), "arg1[%zu] is not below its Fin 4 bound", position);
  bool diagnosed = false;
  if (error) {
    wasm_name_t message;
    wasmtime_error_message(error, &message);
    char *copy = calloc(message.size + 1, 1);
    if (!copy) abort();
    memcpy(copy, message.data, message.size);
    diagnosed = representation == 2 ? strcmp(copy, expected) == 0 : strstr(copy, expected) != NULL;
    if (!diagnosed) fprintf(stderr, "position %zu representation %u: unexpected error: %s\n", position, representation, copy);
    free(copy); wasm_name_delete(&message); wasmtime_error_delete(error);
  }
  CHECK(diagnosed);
  for (size_t i = 0; i < 2; ++i) { late_delete(&arguments[i]); late_delete(&snapshots[i]); }

  /* Recover in the same session with independent inputs and proof-backed output. */
  arguments[0] = late_names(); arguments[1] = late_offsets();
  for (size_t i = 0; i < 2; ++i) wasmtime_component_val_clone(&arguments[i], &snapshots[i]);
  output = (late_value){0};
  error = fincontainers_wasmtime_call(session, "label", arguments, 2, &output);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "recovery: %.*s\n", (int)message.size, message.data);
    wasm_name_delete(&message); wasmtime_error_delete(error); exit(1);
  }
  static const char result[] = "alpha:1,mid\0dle:2,omega:3";
  CHECK(output.kind == WASMTIME_COMPONENT_STRING && output.of.string.size == sizeof(result) - 1 && memcmp(output.of.string.data, result, sizeof(result) - 1) == 0);
  CHECK(late_equal(&arguments[0], &snapshots[0]));
  CHECK(late_equal(&arguments[1], &snapshots[1]));
  for (size_t i = 0; i < 2; ++i) { late_delete(&arguments[i]); late_delete(&snapshots[i]); }
  late_delete(&output);
}

int main(void) {
  CHECK(late_snapshot_controls() == 11);
  fincontainers_wasmtime *session = NULL;
  CHECK(fincontainers_wasmtime_open(&session) == NULL);
  for (size_t position = 0; position < 3; ++position)
    for (unsigned representation = 0; representation < 3; ++representation)
      late_pair(session, position, representation);
  for (unsigned cycle = 0; cycle < 1000; ++cycle)
    late_pair(session, cycle % 3, cycle % 3);
  fincontainers_wasmtime_close(session);
  if (checks != 7065) return 1;
  printf("fin-late-ok:%u\n", checks);
  return 0;
}
