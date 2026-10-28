#define _GNU_SOURCE
/* Installed WIT/WASI acceptance for checked Fin callbacks and Lean closures. */
#include "reviewedcallbacks_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef reviewedcallbacks_scalar_nat_t nat_t;
typedef reviewedcallbacks_wasmtime_function function_t;

static unsigned checks;
static void check(bool value, const char *label) {
  if (!value) { fprintf(stderr, "%s\n", label); assert(value); }
  ++checks;
}
static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error); assert(false);
}
static void rejected(wasmtime_error_t *error, const char *pattern) {
  assert(error);
  wasm_name_t message; wasmtime_error_message(error, &message);
  size_t length = strlen(pattern); bool found = false;
  for (size_t index = 0; index + length <= message.size; ++index)
    if (!memcmp(message.data + index, pattern, length)) { found = true; break; }
  if (!found) fprintf(stderr, "unexpected error: %.*s\n", (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
  check(found, "expected error text");
}
static nat_t natural(const uint32_t *data) {
  return (nat_t){.data = data, .length = data ? 1 : 0};
}
static bool equal_nat(const nat_t *value, uint32_t expected) {
  return value->length == (expected ? 1u : 0u)
    && (!expected || value->data[0] == expected);
}
static int loaded(struct dl_phdr_info *info, size_t size, void *raw) {
  (void)size;
  bool *comma = raw;
  if (!info->dlpi_name[0]) return 0;
  printf("%s\"%s\"", *comma ? "," : "", info->dlpi_name);
  *comma = true; return 0;
}

typedef struct {
  unsigned calls, releases;
  bool fail;
  uint32_t reply;
} state_t;
static void release(void *data) { ++((state_t *)data)->releases; }
static wasmtime_error_t *visit_callback(void *data, const nat_t *value, nat_t *out) {
  state_t *state = data; ++state->calls;
  if (value->length > 1 || (value->length == 1 && value->data[0] >= 5))
    return wasmtime_error_new("Lean supplied an invalid Fin");
  if (state->fail) return wasmtime_error_new("callback Fin sentinel");
  *out = *value; return NULL;
}
static wasmtime_error_t *apply_callback(void *data, const nat_t *value, nat_t *out) {
  state_t *state = data; ++state->calls;
  state->reply = (value->length ? value->data[0] : 0) + 1;
  *out = natural(&state->reply); return NULL;
}

int main(void) {
  reviewedcallbacks_wasmtime *session = NULL;
  ok(reviewedcallbacks_wasmtime_open(&session));
  check(session != NULL, "session opens");
  uint32_t two_value = 2, three_value = 3, four_value = 4;
  uint32_t eight_value = 8, nine_value = 9, ten_value = 10;
  nat_t zero = natural(NULL), two = natural(&two_value), three = natural(&three_value);
  nat_t four = natural(&four_value), eight = natural(&eight_value);
  nat_t nine = natural(&nine_value), ten = natural(&ten_value), output = {0};

  state_t host_state = {0}; function_t host = 0;
  ok(reviewedcallbacks_wasmtime_visit_callback0_create(
    session, visit_callback, &host_state, release, &zero, &host));
  check(host != 0, "host callback created");
  ok(reviewedcallbacks_wasmtime_value_visit(session, host, &output));
  check(equal_nat(&output, 10), "checked host callback arguments");
  reviewedcallbacks_scalar_nat_t_clear(&output);
  check(host_state.calls == 5, "host receives every Fin 5 value");
  host_state.fail = true;
  rejected(reviewedcallbacks_wasmtime_value_visit(session, host, &output),
    "callback Fin sentinel");
  host_state.fail = false;
  ok(reviewedcallbacks_wasmtime_value_visit(session, host, &output));
  check(equal_nat(&output, 10), "host callback recovers");
  reviewedcallbacks_scalar_nat_t_clear(&output);
  ok(reviewedcallbacks_wasmtime_function_close(session, &host));
  check(host == 0 && host_state.releases == 1, "host callback closes once");

  function_t scaler = 0;
  ok(reviewedcallbacks_wasmtime_value_scaler(session, &three, &scaler));
  check(scaler != 0, "scaler closure created");
  ok(reviewedcallbacks_wasmtime_scaler_call(session, scaler, &four, &output));
  check(equal_nat(&output, 12), "bounded closure argument");
  reviewedcallbacks_scalar_nat_t_clear(&output);
  rejected(reviewedcallbacks_wasmtime_scaler_call(session, scaler, &ten, &output),
    "arg0 is not below its Fin 10 bound");
  ok(reviewedcallbacks_wasmtime_scaler_call(session, scaler, &nine, &output));
  check(equal_nat(&output, 27), "closure remains usable");
  reviewedcallbacks_scalar_nat_t_clear(&output);
  ok(reviewedcallbacks_wasmtime_function_close(session, &scaler));
  check(scaler == 0, "scaler closes");

  function_t counter = 0;
  ok(reviewedcallbacks_wasmtime_value_counter(session, &eight, &counter));
  check(counter != 0, "counter closure created");
  ok(reviewedcallbacks_wasmtime_counter_call(session, counter, &four, &output));
  check(equal_nat(&output, 2), "Lean-produced Fin result");
  reviewedcallbacks_scalar_nat_t_clear(&output);
  ok(reviewedcallbacks_wasmtime_function_close(session, &counter));
  check(counter == 0, "counter closes");

  state_t apply_state = {0}; function_t apply = 0;
  ok(reviewedcallbacks_wasmtime_apply_callback0_create(
    session, apply_callback, &apply_state, release, &apply));
  check(apply != 0, "ordinary callback created");
  ok(reviewedcallbacks_wasmtime_value_apply(session, apply, &two, &output));
  check(equal_nat(&output, 3), "unrefined callback stays direct");
  reviewedcallbacks_scalar_nat_t_clear(&output);
  ok(reviewedcallbacks_wasmtime_function_close(session, &apply));
  check(apply == 0 && apply_state.releases == 1, "ordinary callback closes once");

  reviewedcallbacks_wasmtime_close(session);
  printf("{\"checks\":%u,\"loadedLibraries\":[", checks);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
  return 0;
}
