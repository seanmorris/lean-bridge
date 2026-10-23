#define _GNU_SOURCE
/* Installed WIT/WASI acceptance for directional callback checked records. */
#include "callbackcheckedrecords_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef callbackcheckedrecords_scalar_nat_t nat_t;
typedef callbackcheckedrecords_interval_t interval_t;
typedef callbackcheckedrecords_weighted_t weighted_t;
typedef callbackcheckedrecords_graph_38a8689c2f20ead532ea_t option_interval_t;
typedef callbackcheckedrecords_graph_7ee21eb6b8ea120b53f0_t interval_array_t;
typedef callbackcheckedrecords_graph_29468227bdfd05da1480_t result_option_interval_t;
typedef callbackcheckedrecords_wasmtime_function function_t;

static unsigned checks;
static unsigned rejections;
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
  ++rejections;
  if (!error) fprintf(stderr, "missing rejection %u\n", rejections);
  assert(error);
  wasm_name_t message; wasmtime_error_message(error, &message);
  size_t length = strlen(pattern); bool found = false;
  for (size_t index = 0; index + length <= message.size; ++index)
    if (!memcmp(message.data + index, pattern, length)) { found = true; break; }
  if (!found) fprintf(stderr, "unexpected error at rejection %u: %.*s\n",
    rejections, (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
  check(found, "expected error text");
}
static nat_t natural(const uint32_t *data) {
  return (nat_t){.data = data, .length = data ? 1 : 0};
}
static interval_t interval(const uint32_t *lo, const uint32_t *hi) {
  return (interval_t){.lo = natural(lo), .hi = natural(hi)};
}
static weighted_t weighted(const uint32_t *weight, const uint32_t *limit) {
  return (weighted_t){.weight = natural(weight), .limit = natural(limit)};
}
static bool equal_nat(const nat_t *value, uint32_t expected) {
  return value->length == (expected ? 1u : 0u)
    && (!expected || value->data[0] == expected);
}
static bool equal_interval(const interval_t *value, uint32_t lo, uint32_t hi) {
  return equal_nat(&value->lo, lo) && equal_nat(&value->hi, hi);
}
static int loaded(struct dl_phdr_info *info, size_t size, void *raw) {
  (void)size;
  bool *comma = raw;
  if (!info->dlpi_name[0]) return 0;
  printf("%s\"%s\"", *comma ? "," : "", info->dlpi_name);
  *comma = true; return 0;
}

typedef enum { VALID, INVALID_INTERVAL, INVALID_WEIGHT, ABOVE_LIMIT, FAIL } behavior_t;
typedef struct {
  behavior_t behavior;
  uint32_t lo, hi, weight, limit;
  unsigned calls, releases;
} state_t;
static void release(void *data) { ++((state_t *)data)->releases; }

static wasmtime_error_t *interval_callback(void *data, const interval_t *value, interval_t *out) {
  state_t *state = data; ++state->calls;
  check(equal_interval(value, 1, 3), "proof-free host interval");
  if (state->behavior == FAIL) return wasmtime_error_new("checked-record callback sentinel");
  state->lo = state->behavior == INVALID_INTERVAL ? 5 : 1;
  state->hi = state->behavior == INVALID_INTERVAL ? 2 : 4;
  *out = interval(&state->lo, &state->hi); return NULL;
}
static wasmtime_error_t *mixed_callback(void *data, const nat_t *marker,
    const interval_t *value, interval_t *out) {
  state_t *state = data; ++state->calls;
  check(equal_nat(marker, 7) && equal_interval(value, 1, 3), "mixed host arguments");
  state->lo = 1; state->hi = 5;
  *out = interval(&state->lo, &state->hi); return NULL;
}
static wasmtime_error_t *container_callback(void *data, const option_interval_t *value,
    result_option_interval_t *out) {
  state_t *state = data; ++state->calls;
  check(!value->has_value, "container host argument");
  state->lo = state->behavior == INVALID_INTERVAL ? 4 : 1;
  state->hi = state->behavior == INVALID_INTERVAL ? 1 : 4;
  *out = (result_option_interval_t){.is_ok = 1,
    .ok = {.has_value = 1, .value = interval(&state->lo, &state->hi)}};
  return NULL;
}
static wasmtime_error_t *weighted_callback(void *data, const weighted_t *value,
    weighted_t *out) {
  state_t *state = data; ++state->calls;
  check(equal_nat(&value->weight, 1) && equal_nat(&value->limit, 2),
    "proof-free host weighted value");
  state->weight = state->behavior == INVALID_WEIGHT ? 0
    : state->behavior == ABOVE_LIMIT ? 6 : 2;
  state->limit = 5;
  *out = weighted(&state->weight, &state->limit); return NULL;
}

int main(void) {
  callbackcheckedrecords_wasmtime *session = NULL;
  ok(callbackcheckedrecords_wasmtime_open(&session));
  check(session != NULL, "session opens");
  uint32_t zero_value = 0, one_value = 1, two_value = 2, three_value = 3;
  uint32_t four_value = 4, five_value = 5, six_value = 6, seven_value = 7, nine_value = 9;
  nat_t zero = natural(NULL), nine = natural(&nine_value), output = {0};
  interval_t valid = interval(&one_value, &three_value);
  interval_t invalid = interval(&three_value, &one_value);

  state_t host_state = {0}; function_t host = 0;
  ok(callbackcheckedrecords_wasmtime_call_host_callback0_create(
    session, interval_callback, &host_state, release, &valid, &host));
  check(host != 0, "host callback created");
  ok(callbackcheckedrecords_wasmtime_value_call_host(session, host, &output));
  check(equal_nat(&output, 3), "valid host result");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  check(host_state.calls == 1, "host callback called once");
  host_state.behavior = INVALID_INTERVAL;
  rejected(callbackcheckedrecords_wasmtime_value_call_host(session, host, &output), "constructor");
  check(!output._bridge_owner, "invalid host reply leaves output empty");
  host_state.behavior = VALID;
  ok(callbackcheckedrecords_wasmtime_value_call_host(session, host, &output));
  check(equal_nat(&output, 3), "host callback recovers");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  host_state.behavior = FAIL;
  rejected(callbackcheckedrecords_wasmtime_value_call_host(session, host, &output), "callback sentinel");
  ok(callbackcheckedrecords_wasmtime_function_close(session, &host));
  check(host == 0 && host_state.releases == 1, "host callback closes once");

  function_t refused_host = 0;
  ok(callbackcheckedrecords_wasmtime_call_host_callback0_create(
    session, interval_callback, &host_state, NULL, &invalid, &refused_host));
  check(refused_host != 0, "invalid recovery is copied into a callback token");
  unsigned before = host_state.calls;
  rejected(callbackcheckedrecords_wasmtime_value_call_host(
    session, refused_host, &output), "Native Lean graph call failed");
  check(host_state.calls == before, "invalid recovery stops callback entry");
  ok(callbackcheckedrecords_wasmtime_function_close(session, &refused_host));
  check(refused_host == 0, "invalid-recovery callback closes");

  state_t mixed_state = {0}; function_t mixed_host = 0;
  ok(callbackcheckedrecords_wasmtime_call_host_mixed_callback0_create(
    session, mixed_callback, &mixed_state, release, &valid, &mixed_host));
  check(mixed_host != 0, "mixed host created");
  ok(callbackcheckedrecords_wasmtime_value_call_host_mixed(session, mixed_host, &output));
  check(equal_nat(&output, 4), "mixed host result");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  ok(callbackcheckedrecords_wasmtime_function_close(session, &mixed_host));
  check(mixed_host == 0 && mixed_state.releases == 1, "mixed host closes once");

  function_t closure = 0;
  ok(callbackcheckedrecords_wasmtime_value_make_closure(session, &nine, &closure));
  check(closure != 0, "closure created");
  interval_t two_five = interval(&two_value, &five_value);
  ok(callbackcheckedrecords_wasmtime_make_closure_call(session, closure, &two_five, &output));
  check(equal_nat(&output, 3), "closure result");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  interval_t five_two = interval(&five_value, &two_value);
  rejected(callbackcheckedrecords_wasmtime_make_closure_call(
    session, closure, &five_two, &output),
    "arg0 was rejected by CallbackCheckedRecords.mkInterval");
  check(!output._bridge_owner, "closure rejects invalid interval cleanly");
  interval_t three_three = interval(&three_value, &three_value);
  ok(callbackcheckedrecords_wasmtime_make_closure_call(session, closure, &three_three, &output));
  check(equal_nat(&output, 0), "closure recovers");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  ok(callbackcheckedrecords_wasmtime_function_close(session, &closure));
  check(closure == 0, "closure closes");

  function_t mixed = 0;
  ok(callbackcheckedrecords_wasmtime_value_make_mixed_closure(session, &zero, &mixed));
  check(mixed != 0, "mixed closure created");
  interval_t interval_output = {0};
  ok(callbackcheckedrecords_wasmtime_make_mixed_closure_call(
    session, mixed, &nine, &two_five, &interval_output));
  check(equal_interval(&interval_output, 2, 5), "mixed closure result");
  callbackcheckedrecords_interval_t_clear(&interval_output);
  rejected(callbackcheckedrecords_wasmtime_make_mixed_closure_call(
    session, mixed, &nine, &five_two, &interval_output),
    "arg1 was rejected by CallbackCheckedRecords.mkInterval");
  check(!interval_output._bridge_owner, "mixed closure rejects invalid interval cleanly");
  ok(callbackcheckedrecords_wasmtime_make_mixed_closure_call(
    session, mixed, &nine, &valid, &interval_output));
  check(equal_interval(&interval_output, 1, 3), "mixed closure recovers");
  callbackcheckedrecords_interval_t_clear(&interval_output);
  ok(callbackcheckedrecords_wasmtime_function_close(session, &mixed));
  check(mixed == 0, "mixed closure closes");

  state_t container_state = {0}; function_t container_host = 0;
  result_option_interval_t container_recovery = {.is_ok = 1, .ok = {.has_value = 0}};
  ok(callbackcheckedrecords_wasmtime_call_host_container_callback0_create(
    session, container_callback, &container_state, release, &container_recovery, &container_host));
  check(container_host != 0, "container host created");
  ok(callbackcheckedrecords_wasmtime_value_call_host_container(session, container_host, &output));
  check(equal_nat(&output, 3), "container host result");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  container_state.behavior = INVALID_INTERVAL;
  rejected(callbackcheckedrecords_wasmtime_value_call_host_container(session, container_host, &output), "constructor");
  ok(callbackcheckedrecords_wasmtime_function_close(session, &container_host));
  check(container_host == 0 && container_state.releases == 1, "container host closes once");

  function_t container = 0;
  ok(callbackcheckedrecords_wasmtime_value_make_container_closure(session, &zero, &container));
  check(container != 0, "container closure created");
  option_interval_t options[2] = {{0}, {.has_value = 1, .value = two_five}};
  interval_array_t array = {.data = options, .length = 2};
  option_interval_t option_output = {0};
  ok(callbackcheckedrecords_wasmtime_make_container_closure_call(session, container, &array, &option_output));
  check(!option_output.has_value, "container closure result");
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t_clear(&option_output);
  option_interval_t bad_option = {.has_value = 1, .value = five_two};
  interval_array_t bad_array = {.data = &bad_option, .length = 1};
  rejected(callbackcheckedrecords_wasmtime_make_container_closure_call(
    session, container, &bad_array, &option_output),
    "arg0[0]? was rejected by CallbackCheckedRecords.mkInterval");
  interval_array_t empty = {0};
  ok(callbackcheckedrecords_wasmtime_make_container_closure_call(session, container, &empty, &option_output));
  check(!option_output.has_value, "container closure recovers");
  callbackcheckedrecords_graph_38a8689c2f20ead532ea_t_clear(&option_output);
  ok(callbackcheckedrecords_wasmtime_function_close(session, &container));
  check(container == 0, "container closure closes");

  state_t weighted_state = {0}; function_t weighted_host = 0;
  weighted_t weighted_recovery = weighted(&one_value, &two_value);
  ok(callbackcheckedrecords_wasmtime_call_host_nested_callback0_create(
    session, weighted_callback, &weighted_state, release, &weighted_recovery, &weighted_host));
  check(weighted_host != 0, "weighted host created");
  ok(callbackcheckedrecords_wasmtime_value_call_host_nested(session, weighted_host, &output));
  check(equal_nat(&output, 3), "weighted host result");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  weighted_state.behavior = INVALID_WEIGHT;
  rejected(callbackcheckedrecords_wasmtime_value_call_host_nested(
    session, weighted_host, &output), "Invalid typed WIT callback result");
  weighted_state.behavior = ABOVE_LIMIT;
  rejected(callbackcheckedrecords_wasmtime_value_call_host_nested(
    session, weighted_host, &output), "Host callback result failed its Lean constructor");
  before = weighted_state.calls;
  weighted_t invalid_weighted = weighted(NULL, &two_value);
  function_t refused_weighted = 0;
  ok(callbackcheckedrecords_wasmtime_call_host_nested_callback0_create(
    session, weighted_callback, &weighted_state, NULL, &invalid_weighted, &refused_weighted));
  check(refused_weighted != 0, "invalid weighted recovery is copied into a callback token");
  rejected(callbackcheckedrecords_wasmtime_value_call_host_nested(
    session, refused_weighted, &output), "Native Lean graph call failed");
  check(weighted_state.calls == before,
    "invalid weighted recovery stops callback");
  ok(callbackcheckedrecords_wasmtime_function_close(session, &refused_weighted));
  check(refused_weighted == 0, "invalid weighted callback closes");
  weighted_state.behavior = VALID;
  ok(callbackcheckedrecords_wasmtime_value_call_host_nested(session, weighted_host, &output));
  check(equal_nat(&output, 3), "weighted host recovers");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  ok(callbackcheckedrecords_wasmtime_function_close(session, &weighted_host));
  check(weighted_host == 0 && weighted_state.releases == 1, "weighted host closes once");

  function_t nested = 0;
  ok(callbackcheckedrecords_wasmtime_value_make_nested_closure(session, &zero, &nested));
  check(nested != 0, "nested closure created");
  weighted_t two_five_weighted = weighted(&two_value, &five_value);
  ok(callbackcheckedrecords_wasmtime_make_nested_closure_call(
    session, nested, &two_five_weighted, &output));
  check(equal_nat(&output, 3), "nested closure result");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  weighted_t zero_five = weighted(NULL, &five_value);
  rejected(callbackcheckedrecords_wasmtime_make_nested_closure_call(
    session, nested, &zero_five, &output),
    "arg0.weight was rejected by CallbackCheckedRecords.checkedPositive");
  weighted_t six_five = weighted(&six_value, &five_value);
  rejected(callbackcheckedrecords_wasmtime_make_nested_closure_call(
    session, nested, &six_five, &output),
    "arg0 was rejected by CallbackCheckedRecords.mkWeighted");
  weighted_t five_five = weighted(&five_value, &five_value);
  ok(callbackcheckedrecords_wasmtime_make_nested_closure_call(
    session, nested, &five_five, &output));
  check(equal_nat(&output, 0), "nested closure recovers");
  callbackcheckedrecords_scalar_nat_t_clear(&output);
  ok(callbackcheckedrecords_wasmtime_function_close(session, &nested));
  check(nested == 0, "nested closure closes");

  callbackcheckedrecords_wasmtime_close(session);
  printf("{\"checks\":%u,\"loadedLibraries\":[", checks);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
  (void)zero_value; (void)four_value; (void)seven_value;
  return 0;
}
