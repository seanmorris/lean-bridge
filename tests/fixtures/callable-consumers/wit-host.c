#define _GNU_SOURCE
#include "callables_wasmtime.h"
#include <assert.h>
#include <dlfcn.h>
#include <math.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define clone copied_clone

/* COPIED_ORACLES */

typedef callables_wasmtime_value value;
typedef callables_wasmtime_function function;
static size_t calls, callbacks, finalized;
static callables_wasmtime *session;
static function current;
static unsigned nesting, nested_target;
static enum { ECHO, FAIL, INVALID, REENTER, CLOSE, CLOSE_SESSION, NEST, LAST, WEIGHTED } behavior;
static size_t identities(void) {
  struct snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; } snapshot;
  void *runtime = dlopen("liblean_bridge_native.so", RTLD_NOW | RTLD_NOLOAD); assert(runtime);
  void (*read_snapshot)(struct snapshot *) = dlsym(runtime, "lean_bridge_native_snapshot_read"); assert(read_snapshot);
  read_snapshot(&snapshot); dlclose(runtime); return snapshot.identities;
}
static void release(void *data) { assert(data == &finalized); finalized++; }
static value copied(wasmtime_component_val_t v) { return (value){.value = v}; }
static value callable(function f) { return (value){.function = f}; }
static void clear(value *v) {
  if (v->function) ok(callables_wasmtime_function_close(session, &v->function));
  else wasmtime_component_val_delete(&v->value);
  *v = (value){0};
}
static wasmtime_error_t *call(const char *name, const value *args, size_t count, value *out) {
  calls++; return callables_wasmtime_invoke(session, name, args, count, out);
}
static wasmtime_error_t *callback(void *data, const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  assert(data == &finalized && count); callbacks++;
  if (behavior == FAIL) { *out = clone(&args[0]); return wasmtime_error_new("host callback failure survives store replacement"); }
  if (behavior == INVALID) { *out = u32(123); return NULL; }
  if (behavior == CLOSE) {
    size_t before = finalized;
    if (current) ok(callables_wasmtime_function_close(session, &current));
    assert(finalized == before);
  }
  if (behavior == CLOSE_SESSION) { callables_wasmtime_close(session); assert(current); }
  if (behavior == NEST && ++nesting < nested_target) {
    value nested_args[] = {copied(args[0]), callable(current)}, result = {0};
    wasmtime_error_t *error = call("call-uint32", nested_args, 2, &result);
    nesting--;
    if (error) return error;
    *out = result.value; return NULL;
  }
  if (behavior == NEST) nesting--;
  if (behavior == REENTER) {
    value result = {0}; ok(call("word-bits", NULL, 0, &result)); assert(result.value.of.u32 == 64); clear(&result);
  }
  if (behavior == WEIGHTED) {
    assert(count == 16); uint32_t result = 0;
    for (size_t i = 0; i < count; ++i) result += args[i].of.u32 * (uint32_t)(i + 1);
    *out = u32(result); return NULL;
  }
  *out = clone(&args[behavior == LAST ? count - 1 : 0]); return NULL;
}
static function create(const char *signature) {
  function result = 0;
  ok(callables_wasmtime_callback_create(session, signature, callback, &finalized, release, &result));
  assert(result); return result;
}
static void *wrong_thread(void *data) {
  value *args = data, out = copied(u32(991));
  rejects(callables_wasmtime_invoke(session, "call-uint32", args, 2, &out), "wrong-thread");
  assert(out.value.of.u32 == 991);
  function token = args[1].function;
  rejects(callables_wasmtime_function_close(session, &token), "wrong-thread"); assert(token == args[1].function);
  callables_wasmtime_close(session); /* Wrong-thread close must not dispose it. */
  return NULL;
}
int main(void) {
  ok(callables_wasmtime_open(&session)); size_t baseline = identities();
  value result = {0};
  for (size_t i = 0; i < 19; ++i) for (unsigned variant = 0; variant < 6; ++variant) {
    char name[220], signature[200];
    snprintf(signature, sizeof(signature), "function-%s-to-%s", type_labels[i], type_labels[i]);
    function host = create(signature);
    value input = copied(sample(i, variant)), alternative = copied(sample(i, variant + 1));
    value args[] = {input, callable(host), copied(u32(0))};
    size_t before = callbacks;
    snprintf(name, sizeof(name), "call-%s", labels[i]); ok(call(name, args, 2, &result)); equal(&input.value, &result.value); clear(&result);
    snprintf(name, sizeof(name), "twice-%s", labels[i]); ok(call(name, args, 2, &result)); equal(&input.value, &result.value); clear(&result);
    assert(callbacks == before + 3);
    args[0] = callable(host); args[1] = input;
    snprintf(name, sizeof(name), "invoke-%s", signature); ok(call(name, args, 2, &result)); equal(&input.value, &result.value); clear(&result);
    ok(callables_wasmtime_function_close(session, &host)); assert(!host);
    ok(callables_wasmtime_function_close(session, &host));
    snprintf(name, sizeof(name), "make-%s", labels[i]); ok(call(name, &input, 1, &result)); assert(result.function);
    value closure = result; result = (value){0};
    args[0] = closure; args[1] = copied((wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = true}); args[2] = alternative;
    snprintf(name, sizeof(name), "invoke-function-bool-%s-to-%s", type_labels[i], type_labels[i]);
    ok(call(name, args, 3, &result)); equal(&input.value, &result.value); clear(&result);
    args[1].value.of.boolean = false;
    ok(call(name, args, 3, &result)); equal(&alternative.value, &result.value); clear(&result);
    clear(&closure); clear(&input); clear(&alternative); assert(identities() == baseline);
  }
  char signature[200] = "function", name[220];
  for (unsigned i = 0; i < 16; ++i) strcat(signature, "-uint32");
  strcat(signature, "-to-uint32");
  function wide = create(signature); behavior = WEIGHTED;
  value seed = copied(u32(100)), args[17] = {seed, callable(wide)};
  ok(call("wide", args, 2, &result)); assert(result.value.of.u32 == 1460); clear(&result);
  args[0] = callable(wide); for (unsigned i = 1; i < 17; ++i) args[i] = copied(u32(i));
  snprintf(name, sizeof(name), "invoke-%s", signature);
  ok(call(name, args, 17, &result)); assert(result.value.of.u32 == 1496); clear(&result);
  ok(call("make-wide", &seed, 1, &result)); value owned = result; result = (value){0}; args[0] = owned;
  ok(call(name, args, 17, &result)); assert(result.value.of.u32 == 100 * 65536 + 1496); clear(&result); clear(&owned);
  ok(callables_wasmtime_function_close(session, &wide)); behavior = ECHO;

  /* Late borrowed arguments after mixed, aligned values in an indirect record. */
  function first = create("function-uint32-to-uint32"), second = create("function-uint32-to-uint32");
  value mixed[] = {copied(sample(2, 1)), copied(sample(14, 1)), copied(sample(5, 1)), copied(sample(13, 5)), copied(sample(11, 1)), copied(sample(10, 1)), copied(sample(15, 1)), copied(sample(17, 1)), seed, copied(sample(14, 1)), callable(first), callable(second)};
  ok(call("mixed", mixed, 12, &result)); equal(&seed.value, &result.value); clear(&result);
  mixed[11] = mixed[10];
  ok(call("mixed", mixed, 12, &result)); equal(&seed.value, &result.value); clear(&result);
  mixed[11] = callable(second);
  for (size_t i = 0; i < 12; ++i) clear(&mixed[i]);

  /* A returned Lean function also works as a borrowed callback argument. */
  ok(call("make-adder", &seed, 1, &result)); value survivor = result; result = (value){0};
  args[0] = seed; args[1] = survivor;
  ok(call("twice-uint32", args, 2, &result)); assert(result.value.of.u32 == 300); clear(&result);
  current = create("function-uint32-to-uint32"); args[1] = callable(current);
  pthread_t thread; assert(!pthread_create(&thread, NULL, wrong_thread, args)); assert(!pthread_join(thread, NULL));
  callables_wasmtime *other = NULL; ok(callables_wasmtime_open(&other));
  rejects(callables_wasmtime_invoke(other, "call-uint32", args, 2, &result), "wrong-session");
  callables_wasmtime_close(other);
  function bool_host = create("function-bool-to-bool"); args[1] = callable(bool_host);
  rejects(call("call-uint32", args, 2, &result), "signature mismatch");
  ok(callables_wasmtime_function_close(session, &bool_host)); args[1] = callable(current);
  behavior = REENTER; ok(call("call-uint32", args, 2, &result)); clear(&result);
  behavior = NEST; nested_target = 32; ok(call("call-uint32", args, 2, &result)); clear(&result); assert(!nesting);
  nested_target = 65; rejects(call("call-uint32", args, 2, &result), "reentry limit"); assert(!nesting);
  behavior = FAIL; result = copied(u32(991));
  size_t callback_count = callbacks;
  rejects(call("twice-uint32", args, 2, &result), "host callback failure survives store replacement"); assert(result.value.of.u32 == 991); clear(&result);
  assert(callbacks == callback_count + 1);
  args[0] = survivor; args[1] = seed; behavior = ECHO;
  ok(call("invoke-function-uint32-to-uint32", args, 2, &result)); assert(result.value.of.u32 == 200); clear(&result);
  args[0] = seed; args[1] = callable(current);
  ok(call("call-uint32", args, 2, &result)); equal(&seed.value, &result.value); clear(&result);
  value retained_arg = callable(current);
  ok(call("retain-callback", &retained_arg, 1, &result)); value expired = result; result = (value){0};
  args[0] = expired; args[1] = seed;
  rejects(call("invoke-function-uint32-to-uint32", args, 2, &result), "Expired"); clear(&expired);
  args[0] = seed; args[1] = callable(current); behavior = CLOSE;
  size_t before = finalized; function stale = current;
  ok(call("twice-uint32", args, 2, &result)); assert(!current && finalized == before + 1); clear(&result);
  rejects(call("call-uint32", args, 2, &result), "closed/wrong-session");
  current = create("function-uint32-to-uint32"); assert(current != stale);
  rejects(call("call-uint32", args, 2, &result), "closed/wrong-session");
  behavior = ECHO; ok(callables_wasmtime_function_close(session, &current)); clear(&survivor);

  /* An invalid aggregate result traps, cleans its buffers and permits reuse. */
  current = create("function-string-to-string"); args[0] = copied(sample(14, 1)); args[1] = callable(current); behavior = INVALID;
  rejects(call("call-string", args, 2, &result), "Invalid WIT callback result");
  behavior = REENTER; ok(call("call-string", args, 2, &result)); equal(&args[0].value, &result.value); clear(&result); clear(&args[0]);
  ok(callables_wasmtime_function_close(session, &current)); assert(identities() == baseline);
  /* Persistent Nat/Int callback results survive nested canonical scratch use. */
  for (size_t i = 10; i < 12; ++i) {
    snprintf(signature, sizeof(signature), "function-%s-to-%s", type_labels[i], type_labels[i]);
    current = create(signature); args[0] = copied(sample(i, 1)); args[1] = callable(current); behavior = REENTER;
    snprintf(name, sizeof(name), "call-%s", labels[i]);
    ok(call(name, args, 2, &result)); equal(&args[0].value, &result.value); clear(&result); clear(&args[0]);
    ok(callables_wasmtime_function_close(session, &current));
  }
  behavior = ECHO; current = create("function-uint32-to-uint32"); args[0] = seed; args[1] = callable(current);
  for (size_t i = 0; i < 4096; ++i) { ok(call("call-uint32", args, 2, &result)); equal(&seed.value, &result.value); clear(&result); }
  ok(callables_wasmtime_function_close(session, &current)); assert(identities() == baseline);
  /* Reuse thousands of slots and reject stale identities after generation changes. */
  for (size_t i = 0; i < 2050; ++i) { current = create("function-uint32-to-uint32"); assert(current != stale); ok(callables_wasmtime_function_close(session, &current)); }
  function many[1024];
  for (size_t i = 0; i < 1024; ++i) many[i] = create("function-uint32-to-uint32");
  function unchanged = 991;
  rejects(callables_wasmtime_callback_create(session, "function-uint32-to-uint32", callback, &finalized, release, &unchanged), "capacity"); assert(unchanged == 991);
  size_t full = identities(); result = copied(u32(991));
  rejects(call("make-adder", &seed, 1, &result), "capacity"); assert(result.value.of.u32 == 991 && identities() == full); clear(&result);
  for (size_t i = 0; i < 1024; ++i) ok(callables_wasmtime_function_close(session, &many[i]));
  assert(identities() == baseline);
  current = create("function-uint32-to-uint32"); args[0] = seed; args[1] = callable(current); behavior = CLOSE_SESSION;
  before = finalized;
  rejects(call("call-uint32", args, 2, &result), "session closed"); session = NULL;
  assert(finalized == before + 1 && identities() == baseline);
  printf("callable-wit-ok:%zu\n", calls);
  return 0;
}
