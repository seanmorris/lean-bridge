#define _GNU_SOURCE
/* Installed WIT/WASI acceptance for directional callback Subtypes. */
#include "callbacksubtypes_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef callbacksubtypes_scalar_nat_t nat_t;
typedef callbacksubtypes_wasmtime_function function_t;

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
static bool equal(const nat_t *value, uint32_t expected) {
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

typedef enum { INCREMENT, ZERO, FAIL } behavior_t;
typedef struct { behavior_t behavior; uint32_t reply; unsigned calls, releases; } state_t;
static void release(void *data) { ++((state_t *)data)->releases; }
static wasmtime_error_t *scalar_callback(void *data, const nat_t *value, nat_t *out) {
  state_t *state = data; ++state->calls;
  if (state->behavior == FAIL) return wasmtime_error_new("callback subtype sentinel");
  state->reply = state->behavior == ZERO ? 0 : value->data[0] + 1;
  *out = natural(state->reply ? &state->reply : NULL); return NULL;
}
static wasmtime_error_t *mixed_callback(void *data, const nat_t *marker, const nat_t *value, nat_t *out) {
  state_t *state = data; ++state->calls;
  check(equal(marker, 7), "mixed marker");
  state->reply = value->data[0] + 2;
  *out = natural(&state->reply); return NULL;
}

int main(void) {
  callbacksubtypes_wasmtime *session = NULL;
  ok(callbacksubtypes_wasmtime_open(&session)); check(session != NULL, "session opens");
  uint32_t one_value = 1, two_value = 2, three_value = 3, nine_value = 9;
  nat_t one = natural(&one_value), two = natural(&two_value), three = natural(&three_value);
  nat_t zero = natural(NULL), nine = natural(&nine_value), output = {0};

  state_t scalar = {0}; function_t host = 0;
  ok(callbacksubtypes_wasmtime_call_host_callback0_create(
    session, scalar_callback, &scalar, release, &one, &host));
  check(host != 0, "host callback created");
  ok(callbacksubtypes_wasmtime_value_call_host(session, host, &output));
  check(equal(&output, 2), "valid host result"); callbacksubtypes_scalar_nat_t_clear(&output);
  check(scalar.calls == 1, "host callback called once");
  scalar.behavior = ZERO;
  rejected(callbacksubtypes_wasmtime_value_call_host(session, host, &output), "constructor");
  check(scalar.calls == 2 && !output._bridge_owner, "invalid host result rejected");
  scalar.behavior = INCREMENT;
  ok(callbacksubtypes_wasmtime_value_call_host(session, host, &output));
  check(equal(&output, 2), "host recovery reuse"); callbacksubtypes_scalar_nat_t_clear(&output);
  scalar.behavior = FAIL;
  rejected(callbacksubtypes_wasmtime_value_call_host(session, host, &output), "callback subtype sentinel");
  check(scalar.calls == 4, "host error called once");
  ok(callbacksubtypes_wasmtime_function_close(session, &host));
  check(host == 0 && scalar.releases == 1, "host callback closes once");

  state_t mixed_state = {0}; function_t mixed_host = 0;
  ok(callbacksubtypes_wasmtime_call_host_mixed_callback0_create(
    session, mixed_callback, &mixed_state, release, &one, &mixed_host));
  check(mixed_host != 0, "mixed host created");
  ok(callbacksubtypes_wasmtime_value_call_host_mixed(session, mixed_host, &output));
  check(equal(&output, 3), "mixed host result"); callbacksubtypes_scalar_nat_t_clear(&output);
  ok(callbacksubtypes_wasmtime_function_close(session, &mixed_host));
  check(mixed_host == 0 && mixed_state.releases == 1, "mixed host closes once");

  function_t closure = 0;
  ok(callbacksubtypes_wasmtime_value_make_closure(session, &nine, &closure));
  check(closure != 0, "closure created");
  ok(callbacksubtypes_wasmtime_make_closure_call(session, closure, &two, &output));
  check(equal(&output, 2), "closure result"); callbacksubtypes_scalar_nat_t_clear(&output);
  rejected(callbacksubtypes_wasmtime_make_closure_call(session, closure, &zero, &output), "checkedPositive");
  check(!output._bridge_owner, "closure rejects zero cleanly");
  ok(callbacksubtypes_wasmtime_make_closure_call(session, closure, &three, &output));
  check(equal(&output, 3), "closure recovers"); callbacksubtypes_scalar_nat_t_clear(&output);
  ok(callbacksubtypes_wasmtime_function_close(session, &closure));
  check(closure == 0, "closure closes");

  function_t mixed = 0;
  ok(callbacksubtypes_wasmtime_value_make_mixed_closure(session, &zero, &mixed));
  check(mixed != 0, "mixed closure created");
  ok(callbacksubtypes_wasmtime_make_mixed_closure_call(session, mixed, &nine, &two, &output));
  check(equal(&output, 2), "mixed closure result"); callbacksubtypes_scalar_nat_t_clear(&output);
  rejected(callbacksubtypes_wasmtime_make_mixed_closure_call(session, mixed, &nine, &zero, &output), "checkedPositive");
  check(!output._bridge_owner, "mixed closure rejects zero cleanly");
  ok(callbacksubtypes_wasmtime_make_mixed_closure_call(session, mixed, &nine, &three, &output));
  check(equal(&output, 3), "mixed closure recovers"); callbacksubtypes_scalar_nat_t_clear(&output);
  ok(callbacksubtypes_wasmtime_function_close(session, &mixed));
  check(mixed == 0, "mixed closure closes");

  callbacksubtypes_wasmtime_close(session);
  printf("{\"checks\":%u,\"loadedLibraries\":[", checks);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
  return 0;
}
