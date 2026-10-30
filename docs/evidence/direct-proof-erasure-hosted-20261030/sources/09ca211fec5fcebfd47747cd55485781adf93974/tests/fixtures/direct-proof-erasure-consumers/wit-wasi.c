/**
 * Exercise the installed direct proof-erasure component through its public
 * Wasmtime host without recreating either erased Lean proof argument.
 *
 * @file
 */
#include "directprooferasure_wasmtime.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

typedef wasmtime_component_val_t value;

static unsigned checks;
static directprooferasure_wasmtime *session;

#define CHECK(test) do { \
  if (!(test)) { \
    fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); \
    exit(1); \
  } \
  ++checks; \
} while (0)

static void keep(uint32_t number) {
  value input = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = number};
  value output = {0};
  wasmtime_error_t *error = directprooferasure_wasmtime_call(
      session, "keep", &input, 1, &output);
  if (error) {
    wasm_name_t message = {0};
    wasmtime_error_message(error, &message);
    fprintf(stderr, "keep: %.*s\n", (int)message.size, message.data);
    wasm_name_delete(&message);
    wasmtime_error_delete(error);
    exit(1);
  }
  CHECK(output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == number);
  wasmtime_component_val_delete(&output);
}

int main(void) {
  CHECK(directprooferasure_wasmtime_open(&session) == NULL);
  keep(0);
  keep(1);
  keep(UINT32_MAX);
  keep(UINT32_C(1005));
  for (uint32_t value = 0; value < 1000; ++value) keep(value);
  directprooferasure_wasmtime_close(session);
  printf("direct-proof-wit-wasi:%u\n", checks);
  return 0;
}
