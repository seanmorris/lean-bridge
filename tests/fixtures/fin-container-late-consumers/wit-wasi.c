#include "fincontainers_wasmtime.h"
#include "wit-values.h"
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
