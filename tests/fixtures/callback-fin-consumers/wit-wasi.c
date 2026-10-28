#define _GNU_SOURCE
/* Installed WIT/WASI acceptance for checked Fin callbacks and Lean closures. */
#include "reviewedcallbacks_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef wasmtime_component_val_t component_value;
typedef reviewedcallbacks_wasmtime_value value;
typedef reviewedcallbacks_wasmtime_function function;

static unsigned checks;
static reviewedcallbacks_wasmtime *session;
static void check(bool condition, const char *label) {
  if (!condition) { fprintf(stderr, "%s\n", label); assert(condition); }
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
static component_value natural(uint32_t number) {
  component_value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, number ? 1 : 0);
  if (number) result.of.list.data[0] = (component_value){
    .kind = WASMTIME_COMPONENT_U32, .of.u32 = number
  };
  return result;
}
static value copied(component_value item) { return (value){.value = item}; }
static value callable(function item) { return (value){.function = item}; }
static bool equal_nat(const component_value *item, uint32_t expected) {
  return item->kind == WASMTIME_COMPONENT_LIST
    && item->of.list.size == (expected ? 1u : 0u)
    && (!expected || (item->of.list.data[0].kind == WASMTIME_COMPONENT_U32
      && item->of.list.data[0].of.u32 == expected));
}
static void clear(value *item) {
  if (item->function) ok(reviewedcallbacks_wasmtime_function_close(
    session, &item->function));
  else wasmtime_component_val_delete(&item->value);
  *item = (value){0};
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
} state_t;
static void release(void *data) { ++((state_t *)data)->releases; }
static wasmtime_error_t *visit_callback(void *data, const component_value *args,
    size_t count, component_value *out) {
  state_t *state = data; ++state->calls;
  if (count != 1 || args[0].kind != WASMTIME_COMPONENT_LIST
      || args[0].of.list.size > 1
      || (args[0].of.list.size
        && (args[0].of.list.data[0].kind != WASMTIME_COMPONENT_U32
          || args[0].of.list.data[0].of.u32 >= 5)))
    return wasmtime_error_new("Lean supplied an invalid Fin");
  if (state->fail) return wasmtime_error_new("callback Fin sentinel");
  *out = natural(args[0].of.list.size ? args[0].of.list.data[0].of.u32 : 0);
  return NULL;
}
static wasmtime_error_t *apply_callback(void *data, const component_value *args,
    size_t count, component_value *out) {
  state_t *state = data; ++state->calls;
  if (count != 1 || args[0].kind != WASMTIME_COMPONENT_LIST
      || args[0].of.list.size > 1
      || (args[0].of.list.size
        && args[0].of.list.data[0].kind != WASMTIME_COMPONENT_U32))
    return wasmtime_error_new("invalid Nat callback input");
  uint32_t number = args[0].of.list.size ? args[0].of.list.data[0].of.u32 : 0;
  *out = natural(number + 1); return NULL;
}

int main(void) {
  ok(reviewedcallbacks_wasmtime_open(&session));
  check(session != NULL, "session opens");

  state_t host_state = {0}; function host = 0;
  ok(reviewedcallbacks_wasmtime_callback_create(session,
    "function-590d6ac46e02e46365788a64", visit_callback, &host_state,
    release, &host));
  check(host != 0, "host callback created");
  value argument = callable(host), output = {0};
  ok(reviewedcallbacks_wasmtime_invoke(session, "visit", &argument, 1, &output));
  check(equal_nat(&output.value, 10), "checked host callback arguments");
  clear(&output);
  check(host_state.calls == 5, "host receives every Fin 5 value");
  host_state.fail = true;
  output = copied((component_value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991});
  rejected(reviewedcallbacks_wasmtime_invoke(session, "visit", &argument, 1,
    &output), "callback Fin sentinel");
  clear(&output); host_state.fail = false;
  ok(reviewedcallbacks_wasmtime_invoke(session, "visit", &argument, 1, &output));
  check(equal_nat(&output.value, 10), "host callback recovers"); clear(&output);
  ok(reviewedcallbacks_wasmtime_function_close(session, &host));
  check(host == 0 && host_state.releases == 1, "host callback closes once");

  value three = copied(natural(3));
  ok(reviewedcallbacks_wasmtime_invoke(session, "scaler", &three, 1, &output));
  value scaler = output; output = (value){0};
  check(scaler.function != 0, "scaler closure created");
  value scaler_args[] = {scaler, copied(natural(4))};
  ok(reviewedcallbacks_wasmtime_invoke(session,
    "invoke-function-1a4ceb80e43c4de091fadb1b", scaler_args, 2, &output));
  check(equal_nat(&output.value, 12), "bounded closure argument"); clear(&output);
  clear(&scaler_args[1]); scaler_args[1] = copied(natural(10));
  rejected(reviewedcallbacks_wasmtime_invoke(session,
    "invoke-function-1a4ceb80e43c4de091fadb1b", scaler_args, 2, &output),
    "arg0 is not below its Fin 10 bound");
  clear(&scaler_args[1]); scaler_args[1] = copied(natural(9));
  ok(reviewedcallbacks_wasmtime_invoke(session,
    "invoke-function-1a4ceb80e43c4de091fadb1b", scaler_args, 2, &output));
  check(equal_nat(&output.value, 27), "closure remains usable"); clear(&output);
  clear(&scaler_args[1]); clear(&scaler);
  check(scaler.function == 0, "scaler closes"); clear(&three);

  value eight = copied(natural(8));
  ok(reviewedcallbacks_wasmtime_invoke(session, "counter", &eight, 1, &output));
  value counter = output; output = (value){0};
  check(counter.function != 0, "counter closure created");
  value counter_args[] = {counter, copied(natural(4))};
  ok(reviewedcallbacks_wasmtime_invoke(session,
    "invoke-function-ffd65d943ca6f04f54c59370", counter_args, 2, &output));
  check(equal_nat(&output.value, 2), "Lean-produced Fin result"); clear(&output);
  clear(&counter_args[1]); clear(&counter);
  check(counter.function == 0, "counter closes"); clear(&eight);

  state_t apply_state = {0}; function apply = 0;
  ok(reviewedcallbacks_wasmtime_callback_create(session,
    "function-3dd0024a008567674c9bb4aa", apply_callback, &apply_state,
    release, &apply));
  check(apply != 0, "ordinary callback created");
  value apply_args[] = {callable(apply), copied(natural(2))};
  ok(reviewedcallbacks_wasmtime_invoke(session, "apply", apply_args, 2, &output));
  check(equal_nat(&output.value, 3), "unrefined callback stays direct");
  clear(&output); clear(&apply_args[1]);
  ok(reviewedcallbacks_wasmtime_function_close(session, &apply));
  check(apply == 0 && apply_state.releases == 1,
    "ordinary callback closes once");

  reviewedcallbacks_wasmtime_close(session); session = NULL;
  printf("{\"checks\":%u,\"loadedLibraries\":[", checks);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
  return 0;
}
