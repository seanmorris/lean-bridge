/* Installed public Wasmtime calls. No generated conversion helpers. */
#define _GNU_SOURCE
#include "structured_wasmtime.h"
#include <assert.h>
#include <dlfcn.h>
#include <link.h>
#include <math.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define clone copied_clone
typedef wasmtime_component_val_t value;
typedef structured_wasmtime_value argument;
typedef structured_wasmtime_function function;
static size_t checks, calls, callbacks, rejections, finalized;
static structured_wasmtime *session;
#define CHECK(test) do { checks++; assert(test); } while (0)
/* COPIED_ORACLES */
static const struct { const char *shape, *callback, *invoke, *closure; } bindings[] = {
/* CALLABLE_NAMES */
};
static value record(const char **names, value *fields, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&result.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]);
    result.of.record.data[i].val = fields[i];
  }
  return result;
}
static value tagged(const char *name, value *payload) {
  value result = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&result.of.variant.discriminant, strlen(name), name);
  result.of.variant.val = payload ? wasmtime_component_val_new(payload) : NULL;
  return result;
}
static value rows(unsigned seed) {
  if (!(seed % 4)) return empty();
  return SEQ(none(), some(text_n("a\0\xf0\x9f\x8c\xb1", 6)), some(text(seed % 2 ? "odd" : "even")), some(text("")));
}
static value payload(unsigned seed) {
  value nested = seed % 3 == 0 ? none() : some(seed % 3 == 1
    ? branch(true, pair(sample(5, seed), sample(0, 0))) : branch(false, text_n("error\0!", 7)));
  return record((const char *[]){"text", "rows", "count", "nested"},
    (value[]){text(seed % 2 ? "one" : "two"), rows(seed), sample(10, seed), nested}, 4);
}
static value shape_value(unsigned shape, unsigned seed) {
  switch (shape) {
  case 0: return rows(seed);
  case 1: return seed % 4 ? SEQ(branch(false, text_n("err\0", 4)), branch(true, pair(u32(seed), text("ok")))) : empty();
  case 2: return seed % 3 == 0 ? none() : seed % 3 == 1 ? some(none()) : some(some(sample(0, 0)));
  case 3: return seed % 2 ? branch(true, seed % 3 ? some(u32(seed)) : none())
    : branch(false, seed % 4 ? SEQ(text_n("bad\0", 4), text("")) : empty());
  case 4: return pair(text_n("tuple\0!", 7), pair(sample(15, seed), sample(10, seed)));
  case 5: case 7: return payload(seed);
  case 6: {
    if (seed % 3 == 0) return tagged("empty", NULL);
    value fields = seed % 3 == 1 ? record((const char *[]){"label", "rows"}, (value[]){text("tag"), rows(seed)}, 2)
      : record((const char *[]){"positive", "negative"}, (value[]){sample(10, seed), sample(11, seed)}, 2);
    return tagged(seed % 3 == 1 ? "payload" : "counts", &fields);
  }
  default: abort();
  }
}
static size_t identities(void) {
  struct snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; } snapshot;
  void *runtime = dlopen("liblean_bridge_native.so", RTLD_NOW | RTLD_NOLOAD); CHECK(runtime);
  void (*read_snapshot)(struct snapshot *) = dlsym(runtime, "lean_bridge_native_snapshot_read"); CHECK(read_snapshot);
  read_snapshot(&snapshot); dlclose(runtime); return snapshot.identities;
}
static argument copied(value item) { return (argument){.value = item}; }
static argument callable(function item) { return (argument){.function = item}; }
static void drop(argument *item) {
  if (item->function) ok(structured_wasmtime_function_close(session, &item->function));
  else clear(&item->value);
  *item = (argument){0};
}
static wasmtime_error_t *call(const char *name, const argument *args, size_t count, argument *out) {
  calls++; return structured_wasmtime_invoke(session, name, args, count, out);
}
static enum { ECHO, REPLACE, FAIL, INVALID, INVALID_DEEP, OVER_BUDGET, REENTER, CLOSE, CLOSE_SESSION, NEST } behavior;
static unsigned active_shape, active_seed, nesting, nested_target;
static function current;
static void release(void *data) { CHECK(data == &finalized); finalized++; }
static wasmtime_error_t *callback(void *data, const value *args, size_t count, value *out) {
  CHECK(data == &finalized && count == 1); callbacks++;
  if (behavior == FAIL) { *out = clone(&args[0]); return wasmtime_error_new("structured callback failure survives cleanup"); }
  if (behavior == INVALID) { *out = u32(123); return NULL; }
  if (behavior == INVALID_DEEP) {
    *out = shape_value(active_shape, 2); value *field = NULL;
    switch (active_shape) {
    case 0: field = out->of.list.data[1].of.option; break;
    case 1: field = &out->of.list.data[1].of.result.val->of.tuple.data[1]; break;
    case 2: field = out->of.option->of.option; break;
    case 3: field = &out->of.result.val->of.list.data[0]; break;
    case 4: field = &out->of.tuple.data[1].of.tuple.data[1]; break;
    case 5: field = &out->of.record.data[0].val; break;
    case 6: field = &out->of.variant.val->of.record.data[0].val; break;
    case 7: field = out->of.record.data[3].val.of.option->of.result.val; break;
    default: abort();
    }
    CHECK(field); clear(field); *field = u32(123); return NULL;
  }
  if (behavior == OVER_BUDGET) {
    *out = payload(2);
    value *field = &out->of.record.data[0].val; clear(field);
    field->kind = WASMTIME_COMPONENT_STRING;
    wasm_byte_vec_new_uninitialized(&field->of.string, 16 * 1024 * 1024);
    memset(field->of.string.data, 'x', field->of.string.size); return NULL;
  }
  if (behavior == CLOSE) {
    size_t before = finalized;
    ok(structured_wasmtime_function_close(session, &current)); CHECK(finalized == before);
  }
  if (behavior == CLOSE_SESSION) structured_wasmtime_close(session);
  if (behavior == NEST && ++nesting < nested_target) {
    argument input[] = {copied(args[0]), callable(current)}, result = {0};
    char name[40]; snprintf(name, sizeof(name), "call-%s", bindings[active_shape].shape);
    wasmtime_error_t *error = call(name, input, 2, &result); nesting--;
    if (error) return error;
    *out = result.value; return NULL;
  }
  if (behavior == NEST) nesting--;
  if (behavior == REENTER) {
    value inner = shape_value(4, 2), expected = shape_value(4, 2);
    argument input = copied(inner), closure = {0}, result = {0};
    ok(call("make-tuple", &input, 1, &closure)); clear(&inner);
    argument invoke[] = {closure, copied((value){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = true}), copied(shape_value(4, 0))};
    ok(call(bindings[4].closure, invoke, 3, &result)); equal(&expected, &result.value);
    clear(&expected); clear(&invoke[2].value); drop(&result); drop(&closure);
  }
  *out = behavior == REPLACE ? shape_value(active_shape, active_seed) : clone(&args[0]); return NULL;
}
static function create(unsigned shape) {
  function result = 0;
  ok(structured_wasmtime_callback_create(session, bindings[shape].callback, callback, &finalized, release, &result));
  CHECK(result); return result;
}
static void rejected(const char *name, const argument *args, size_t count, const char *message) {
  argument output = copied(u32(991)); rejections++;
  rejects(call(name, args, count, &output), message);
  CHECK(!output.function && output.value.kind == WASMTIME_COMPONENT_U32 && output.value.of.u32 == 991); drop(&output);
}
static void *wrong_thread(void *data) {
  argument *args = data, output = copied(u32(991));
  rejects(structured_wasmtime_invoke(session, "call-record", args, 2, &output), "wrong-thread");
  CHECK(output.value.of.u32 == 991);
  function token = args[1].function;
  rejects(structured_wasmtime_function_close(session, &token), "wrong-thread"); CHECK(token == args[1].function);
  structured_wasmtime_close(session); return NULL;
}
static int loaded(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size; bool *comma = data;
  if (!info->dlpi_name[0]) return 0;
  CHECK(!strchr(info->dlpi_name, '"') && !strchr(info->dlpi_name, '\\'));
  if (*comma) fputc(',', stdout);
  printf("\"%s\"", info->dlpi_name); *comma = true; return 0;
}
int main(void) {
  (void)labels; (void)type_labels; ok(structured_wasmtime_open(&session));
  const size_t baseline = identities();
  for (unsigned shape = 0; shape < 8; ++shape) for (unsigned round = 0; round < 48; ++round) {
    function host = create(shape); char name[40];
    argument input = copied(shape_value(shape, round)), alternative = copied(shape_value(shape, round + 1)), output = {0};
    argument args[] = {input, callable(host), copied(u32(0))};
    size_t before = callbacks;
    snprintf(name, sizeof(name), "call-%s", bindings[shape].shape);
    ok(call(name, args, 2, &output)); equal(&input.value, &output.value); drop(&output);
    snprintf(name, sizeof(name), "twice-%s", bindings[shape].shape);
    ok(call(name, args, 2, &output)); equal(&input.value, &output.value); drop(&output); CHECK(callbacks == before + 3);
    behavior = REPLACE; active_shape = shape; active_seed = round + 7;
    ok(call(name, args, 2, &output)); value expected = shape_value(shape, active_seed);
    equal(&expected, &output.value); clear(&expected); drop(&output); behavior = ECHO;
    args[0] = callable(host); args[1] = input;
    ok(call(bindings[shape].invoke, args, 2, &output)); equal(&input.value, &output.value); drop(&output);
    ok(structured_wasmtime_function_close(session, &host)); CHECK(!host);
    snprintf(name, sizeof(name), "make-%s", bindings[shape].shape);
    ok(call(name, &input, 1, &output)); CHECK(output.function); argument closure = output; output = (argument){0};
    expected = clone(&input.value); drop(&input);
    args[0] = closure; args[1] = copied((value){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = true}); args[2] = alternative;
    ok(call(bindings[shape].closure, args, 3, &output)); equal(&expected, &output.value); drop(&output); clear(&expected);
    args[1].value.of.boolean = false;
    ok(call(bindings[shape].closure, args, 3, &output)); equal(&alternative.value, &output.value); drop(&output);
    drop(&closure); drop(&alternative); CHECK(identities() == baseline);
  }
  for (unsigned shape = 0; shape < 8; ++shape) {
    current = create(shape); active_shape = shape; char name[40];
    snprintf(name, sizeof(name), "call-%s", bindings[shape].shape);
    argument args[] = {copied(shape_value(shape, 2)), callable(current)}, output = {0};
    behavior = REENTER; ok(call(name, args, 2, &output)); equal(&args[0].value, &output.value); drop(&output);
    behavior = FAIL; rejected(name, args, 2, "structured callback failure survives cleanup");
    behavior = INVALID; rejected(name, args, 2, "Invalid WIT callback result");
    behavior = INVALID_DEEP; rejected(name, args, 2, "Invalid WIT callback result");
    behavior = ECHO; ok(call(name, args, 2, &output)); equal(&args[0].value, &output.value); drop(&output);
    behavior = NEST; nested_target = 12; ok(call(name, args, 2, &output)); equal(&args[0].value, &output.value); drop(&output); CHECK(!nesting);
    nested_target = 65; rejected(name, args, 2, "reentry limit"); CHECK(!nesting);
    behavior = ECHO; ok(call(name, args, 2, &output)); equal(&args[0].value, &output.value); drop(&output);
    behavior = CLOSE; function stale = current; size_t before = finalized;
    snprintf(name, sizeof(name), "twice-%s", bindings[shape].shape);
    ok(call(name, args, 2, &output)); CHECK(!current && finalized == before + 1); drop(&output);
    rejected(name, args, 2, "closed/wrong-session");
    current = create(shape); CHECK(current != stale); rejected(name, args, 2, "closed/wrong-session");
    ok(structured_wasmtime_function_close(session, &current)); drop(&args[0]); behavior = ECHO;
    CHECK(identities() == baseline);
  }
  current = create(5); active_shape = 5;
  argument args[] = {copied(payload(2)), callable(current)}, output = {0};
  pthread_t thread; CHECK(!pthread_create(&thread, NULL, wrong_thread, args)); CHECK(!pthread_join(thread, NULL));
  structured_wasmtime *other = NULL; ok(structured_wasmtime_open(&other));
  rejects(structured_wasmtime_invoke(other, "call-record", args, 2, &output), "wrong-session"); structured_wasmtime_close(other);
  ok(call("retain-record", &args[1], 1, &output)); argument expired = output; output = (argument){0};
  argument invoke[] = {expired, args[0]}; rejected(bindings[5].invoke, invoke, 2, "Expired"); drop(&expired);
  behavior = FAIL; size_t before = callbacks;
  rejected("after-failure", args, 2, "structured callback failure survives cleanup"); CHECK(callbacks == before + 1);
  behavior = ECHO; ok(call("after-failure", args, 2, &output)); value expected = text("two"); equal(&expected, &output.value); clear(&expected); drop(&output);
  behavior = OVER_BUDGET; rejected("call-record", args, 2, "conversion limit");
  behavior = ECHO; ok(call("call-record", args, 2, &output)); equal(&args[0].value, &output.value); drop(&output);
  for (unsigned round = 0; round < 512; ++round) { ok(call("call-record", args, 2, &output)); equal(&args[0].value, &output.value); drop(&output); }
  behavior = CLOSE_SESSION; before = finalized;
  rejected("call-record", args, 2, "session closed"); CHECK(finalized == before + 1); clear(&args[0].value); session = NULL;
  printf("{\"checks\":%zu,\"calls\":%zu,\"callbacks\":%zu,\"rejected\":%zu,\"finalized\":%zu,\"shapes\":8,\"libraries\":[", checks, calls, callbacks, rejections, finalized);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}"); return 0;
}
