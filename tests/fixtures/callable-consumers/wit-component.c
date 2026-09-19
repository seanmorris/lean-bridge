/* Tests the generated canonical ABI with synthetic imports. No Lean execution. */
#include <wasmtime.h>
#include <wasmtime/component.h>
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* INTERFACES */
enum operation { CALL, TWICE, MAKE, INVOKE, BITS, WIDE, MAKE_WIDE, MIXED };
static const struct { const char *name; size_t arity; } resources[] = {
/* RESOURCES */
};
static const struct function { const char *name; enum operation op; uint32_t tag; size_t arity; } functions[] = {
/* FUNCTIONS */
};
enum behavior { ECHO, CHOOSE, LAST, CAPTURE, REENTER, FAIL };
static struct entry {
  bool live; uint32_t tag; enum behavior behavior; size_t calls;
  wasmtime_component_val_t captured;
} entries[2048];
static size_t allocated, released, destructors, calls, reentries;
static unsigned nested_word_calls;
static wasmtime_component_instance_t instance;
static wasmtime_context_t *context;

static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data); abort();
}
static void rejects(wasmtime_error_t *error, const char *needle) {
  if (!error) fprintf(stderr, "Expected failure: %s\n", needle);
  assert(error);
  wasm_name_t message; wasmtime_error_message(error, &message);
  /* Messages are length-delimited, not guaranteed to be NUL terminated. */
  char *text = calloc(message.size + 1, 1); assert(text);
  memcpy(text, message.data, message.size);
  if (!strstr(text, needle)) { fprintf(stderr, "Expected '%s' in '%s'\n", needle, text); abort(); }
  free(text); wasm_name_delete(&message); wasmtime_error_delete(error);
}
static wasmtime_component_val_t clone(const wasmtime_component_val_t *value) {
  wasmtime_component_val_t result; wasmtime_component_val_clone(value, &result); return result;
}
static wasmtime_component_val_t u32(uint32_t value) {
  return (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = value};
}
static wasmtime_component_val_t list(size_t length, int kind) {
  wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, length);
  for (size_t i = 0; i < length; ++i) {
    result.of.list.data[i] = (wasmtime_component_val_t){.kind = kind};
    if (kind == WASMTIME_COMPONENT_U8) result.of.list.data[i].of.u8 = (uint8_t)(i * 127);
    else result.of.list.data[i].of.u32 = i == length - 1 ? 1 : UINT32_MAX;
  }
  return result;
}
static const char *labels[] = {"unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float", "string", "bytes", "char", "usize", "isize"};
static const char *type_labels[] = {"unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char", "usize", "isize"};
static wasmtime_component_val_t sample(size_t index, unsigned variant) {
  wasmtime_component_val_t result = {0};
  switch(index) {
  case 0: result.kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&result.of.enumeration, 4, "unit"); break;
  case 1: result.kind = WASMTIME_COMPONENT_BOOL; result.of.boolean = variant % 2; break;
  case 2: result.kind = WASMTIME_COMPONENT_U8; result.of.u8 = variant % 2 ? UINT8_MAX : 0; break;
  case 3: result.kind = WASMTIME_COMPONENT_U16; result.of.u16 = variant % 2 ? UINT16_MAX : 0; break;
  case 4: return u32(variant % 2 ? UINT32_MAX : 0);
  case 5: case 17: result.kind = WASMTIME_COMPONENT_U64; result.of.u64 = variant % 2 ? UINT64_MAX : 0; break;
  case 6: result.kind = WASMTIME_COMPONENT_S8; result.of.s8 = variant % 2 ? INT8_MIN : INT8_MAX; break;
  case 7: result.kind = WASMTIME_COMPONENT_S16; result.of.s16 = variant % 2 ? INT16_MIN : INT16_MAX; break;
  case 8: result.kind = WASMTIME_COMPONENT_S32; result.of.s32 = variant % 2 ? INT32_MIN : INT32_MAX; break;
  case 9: case 18: result.kind = WASMTIME_COMPONENT_S64; result.of.s64 = variant % 2 ? INT64_MIN : INT64_MAX; break;
  case 10: return list(variant % 2 ? 129 : 0, WASMTIME_COMPONENT_U32);
  case 11:
    result.kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&result.of.record, 2);
    wasm_name_new(&result.of.record.data[0].name, 8, "negative");
    result.of.record.data[0].val = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = variant % 2};
    wasm_name_new(&result.of.record.data[1].name, 5, "limbs");
    result.of.record.data[1].val = list(129, WASMTIME_COMPONENT_U32); break;
  case 12: result.kind = WASMTIME_COMPONENT_F32; result.of.f32 = (float[]){0.0f, -0.0f, INFINITY, -INFINITY, NAN, 1.25f}[variant % 6]; break;
  case 13: result.kind = WASMTIME_COMPONENT_F64; result.of.f64 = (double[]){0.0, -0.0, INFINITY, -INFINITY, NAN, 1.25}[variant % 6]; break;
  case 14: result.kind = WASMTIME_COMPONENT_STRING; wasm_name_new(&result.of.string, variant % 2 ? 8 : 0, "x\0\xce\xbb\xf0\x9f\x8c\xb2"); break;
  case 15: return list(variant % 2 ? 257 : 0, WASMTIME_COMPONENT_U8);
  case 16: result.kind = WASMTIME_COMPONENT_CHAR; result.of.character = (uint32_t[]){0, 0xd7ff, 0xe000, 0x10ffff, 0x1f332, 0x3bb}[variant % 6]; break;
  default: abort();
  }
  return result;
}
static void equal(const wasmtime_component_val_t *a, const wasmtime_component_val_t *b) {
  assert(a->kind == b->kind);
  switch(a->kind) {
  case WASMTIME_COMPONENT_BOOL: assert(a->of.boolean == b->of.boolean); break;
  case WASMTIME_COMPONENT_U8: assert(a->of.u8 == b->of.u8); break;
  case WASMTIME_COMPONENT_U16: assert(a->of.u16 == b->of.u16); break;
  case WASMTIME_COMPONENT_U32: assert(a->of.u32 == b->of.u32); break;
  case WASMTIME_COMPONENT_U64: assert(a->of.u64 == b->of.u64); break;
  case WASMTIME_COMPONENT_S8: assert(a->of.s8 == b->of.s8); break;
  case WASMTIME_COMPONENT_S16: assert(a->of.s16 == b->of.s16); break;
  case WASMTIME_COMPONENT_S32: assert(a->of.s32 == b->of.s32); break;
  case WASMTIME_COMPONENT_S64: assert(a->of.s64 == b->of.s64); break;
  case WASMTIME_COMPONENT_F32: assert((isnan(a->of.f32) && isnan(b->of.f32)) || memcmp(&a->of.f32, &b->of.f32, sizeof(float)) == 0); break;
  case WASMTIME_COMPONENT_F64: assert((isnan(a->of.f64) && isnan(b->of.f64)) || memcmp(&a->of.f64, &b->of.f64, sizeof(double)) == 0); break;
  case WASMTIME_COMPONENT_CHAR: assert(a->of.character == b->of.character); break;
  case WASMTIME_COMPONENT_ENUM: assert(a->of.enumeration.size == b->of.enumeration.size && memcmp(a->of.enumeration.data, b->of.enumeration.data, a->of.enumeration.size) == 0); break;
  case WASMTIME_COMPONENT_STRING: assert(a->of.string.size == b->of.string.size && (!a->of.string.size || memcmp(a->of.string.data, b->of.string.data, a->of.string.size) == 0)); break;
  case WASMTIME_COMPONENT_LIST:
    assert(a->of.list.size == b->of.list.size);
    for (size_t i = 0; i < a->of.list.size; ++i) equal(&a->of.list.data[i], &b->of.list.data[i]);
    break;
  case WASMTIME_COMPONENT_RECORD:
    assert(a->of.record.size == b->of.record.size);
    for (size_t i = 0; i < a->of.record.size; ++i) {
      assert(a->of.record.data[i].name.size == b->of.record.data[i].name.size);
      assert(memcmp(a->of.record.data[i].name.data, b->of.record.data[i].name.data, a->of.record.data[i].name.size) == 0);
      equal(&a->of.record.data[i].val, &b->of.record.data[i].val);
    }
    break;
  default: abort();
  }
}
static wasmtime_error_t *call(const char *name, const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *result) {
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&instance, context, NULL, EXPORT_NAME, strlen(EXPORT_NAME));
  assert(api);
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&instance, context, api, name, strlen(name));
  assert(index); wasmtime_component_func_t function;
  assert(wasmtime_component_instance_get_func(&instance, context, index, &function));
  wasmtime_component_export_index_delete(index); wasmtime_component_export_index_delete(api);
  *result = (wasmtime_component_val_t){0};
  calls++; return wasmtime_component_func_call(&function, context, args, count, result, 1);
}
static uint32_t resource_tag(const char *name) {
  for (size_t i = 0; i < sizeof(resources) / sizeof(*resources); ++i) if (!strcmp(resources[i].name, name)) return (uint32_t)i + 1;
  fprintf(stderr, "Missing resource %s\n", name); abort();
}
static wasmtime_component_val_t resource(uint32_t tag, enum behavior behavior, const wasmtime_component_val_t *captured) {
  assert(allocated + 1 < sizeof(entries) / sizeof(*entries));
  uint32_t rep = (uint32_t)++allocated;
  entries[rep] = (struct entry){.live = true, .tag = tag, .behavior = behavior, .captured = clone(captured)};
  wasmtime_component_resource_host_t *host = wasmtime_component_resource_host_new(true, rep, tag);
  wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_RESOURCE};
  ok(wasmtime_component_resource_host_to_any(context, host, &result.of.resource));
  wasmtime_component_resource_host_delete(host); return result;
}
static void release(uint32_t rep) {
  assert(rep && rep <= allocated && entries[rep].live);
  entries[rep].live = false; released++; wasmtime_component_val_delete(&entries[rep].captured);
}
static wasmtime_error_t *destructor(void *data, wasmtime_context_t *ctx, uint32_t rep) {
  (void)data; assert(ctx == context); destructors++; release(rep); return NULL;
}
static struct entry *borrow(const wasmtime_component_val_t *value, uint32_t tag) {
  assert(value->kind == WASMTIME_COMPONENT_RESOURCE);
  assert(!wasmtime_component_resource_any_owned(value->of.resource));
  wasmtime_component_resource_host_t *host = NULL;
  ok(wasmtime_component_resource_any_to_host(context, value->of.resource, &host));
  assert(!wasmtime_component_resource_host_owned(host));
  assert(wasmtime_component_resource_host_type(host) == tag);
  uint32_t rep = wasmtime_component_resource_host_rep(host);
  wasmtime_component_resource_host_delete(host);
  assert(rep && rep <= allocated && entries[rep].live && entries[rep].tag == tag);
  return &entries[rep];
}
static wasmtime_error_t *invoke(struct entry *entry, const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  assert(count == resources[entry->tag - 1].arity); entry->calls++;
  if (entry->behavior == FAIL) return wasmtime_error_new("synthetic callback failure");
  if (entry->behavior == REENTER) {
    wasmtime_component_val_t nested = {0};
    ok(call("word-bits", NULL, 0, &nested)); assert(nested.kind == WASMTIME_COMPONENT_U32 && nested.of.u32 == 64);
    wasmtime_component_val_delete(&nested); reentries++;
  }
  const wasmtime_component_val_t *value = entry->behavior == CHOOSE ? args[0].of.boolean ? &entry->captured : &args[1] : entry->behavior == CAPTURE || entry->behavior == REENTER ? &entry->captured : &args[count - 1];
  *out = clone(value); return NULL;
}
static wasmtime_error_t *native(void *data, wasmtime_context_t *ctx, const wasmtime_component_func_type_t *type,
    wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out, size_t result_count) {
  const struct function *fn = data; (void)type;
  assert(ctx == context && count == fn->arity && result_count == 1);
  switch(fn->op) {
  case BITS:
    if (nested_word_calls) { nested_word_calls--; return call("word-bits", NULL, 0, out); }
    *out = u32(64); return NULL;
  case MAKE: case MAKE_WIDE: *out = resource(fn->tag, fn->op == MAKE ? CHOOSE : CAPTURE, &args[0]); return NULL;
  case CALL: case TWICE: {
    struct entry *entry = borrow(&args[1], fn->tag);
    wasmtime_component_val_t first = {0}; wasmtime_error_t *error = invoke(entry, args, 1, &first);
    if (error) return error;
    if (fn->op == CALL) { *out = first; return NULL; }
    error = invoke(entry, &first, 1, out); wasmtime_component_val_delete(&first); return error;
  }
  case INVOKE: return invoke(borrow(&args[0], fn->tag), &args[1], count - 1, out);
  case MIXED: {
    struct entry *first = borrow(&args[10], fn->tag), *second = borrow(&args[11], fn->tag);
    wasmtime_component_val_t intermediate = {0};
    ok(invoke(first, &args[8], 1, &intermediate));
    wasmtime_error_t *error = invoke(second, &intermediate, 1, out);
    wasmtime_component_val_delete(&intermediate); return error;
  }
  case WIDE: {
    wasmtime_component_val_t wide[16];
    for (size_t i = 0; i < 16; ++i) wide[i] = u32(args[0].of.u32 + (uint32_t)i);
    return invoke(borrow(&args[1], fn->tag), wide, 16, out);
  }
  default: abort();
  }
}
/* A host-created owner has no Wasmtime destructor until ownership passes through
 * the component. Reclaim it explicitly; dropping only the C wrapper leaks it. */
static void reclaim_host(wasmtime_component_val_t *owner) {
  wasmtime_component_resource_host_t *host = NULL;
  ok(wasmtime_component_resource_any_to_host(context, owner->of.resource, &host));
  assert(wasmtime_component_resource_host_owned(host));
  release(wasmtime_component_resource_host_rep(host));
  wasmtime_component_resource_host_delete(host); wasmtime_component_val_delete(owner);
}
static void drop_returned(wasmtime_component_val_t *owner) {
  size_t previous = destructors;
  ok(wasmtime_component_resource_any_drop(context, owner->of.resource));
  assert(destructors == previous + 1);
  /* Aliased metadata cannot dispose the logical owner twice. */
  rejects(wasmtime_component_resource_any_drop(context, owner->of.resource), "unknown handle");
  wasmtime_component_val_delete(owner);
}
int main(int argc, char **argv) {
  assert(argc == 2);
  FILE *file = fopen(argv[1], "rb"); assert(file); assert(fseek(file, 0, SEEK_END) == 0);
  long length = ftell(file); assert(length > 0); rewind(file);
  unsigned char *bytes = malloc((size_t)length); assert(bytes);
  assert(fread(bytes, 1, (size_t)length, file) == (size_t)length); fclose(file);
  wasm_config_t *config = wasm_config_new(); wasmtime_config_wasm_component_model_set(config, true);
  wasm_engine_t *engine = wasm_engine_new_with_config(config);
  wasmtime_component_t *component = NULL; ok(wasmtime_component_new(engine, bytes, (size_t)length, &component)); free(bytes);
  wasmtime_store_t *store = wasmtime_store_new(engine, NULL, NULL); context = wasmtime_store_context(store);
  wasmtime_component_linker_t *linker = wasmtime_component_linker_new(engine);
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *host = NULL;
  ok(wasmtime_component_linker_instance_add_instance(root, IMPORT_NAME, strlen(IMPORT_NAME), &host));
  for (size_t i = 0; i < sizeof(resources) / sizeof(*resources); ++i) {
    wasmtime_component_resource_type_t *type = wasmtime_component_resource_type_new_host((uint32_t)i + 1);
    ok(wasmtime_component_linker_instance_add_resource(host, resources[i].name, strlen(resources[i].name), type, destructor, NULL, NULL));
    wasmtime_component_resource_type_delete(type);
  }
  for (size_t i = 0; i < sizeof(functions) / sizeof(*functions); ++i)
    ok(wasmtime_component_linker_instance_add_func(host, functions[i].name, strlen(functions[i].name), native, (void *)&functions[i], NULL));
  wasmtime_component_linker_instance_delete(host); wasmtime_component_linker_instance_delete(root);
  ok(wasmtime_component_linker_instantiate(linker, context, component, &instance));
  for (size_t i = 0; i < sizeof(labels) / sizeof(*labels); ++i) for (unsigned variant = 0; variant < 6; ++variant) {
    char name[180], type_name[160];
    snprintf(type_name, sizeof(type_name), "function-%s-to-%s", type_labels[i], type_labels[i]);
    wasmtime_component_val_t input = sample(i, variant), alternative = sample(i, variant + 1);
    wasmtime_component_val_t callback = resource(resource_tag(type_name), ECHO, &input), result = {0};
    size_t rep = allocated;
    wasmtime_component_val_t args[3] = {input, callback};
    snprintf(name, sizeof(name), "call-%s", labels[i]); ok(call(name, args, 2, &result)); equal(&input, &result); wasmtime_component_val_delete(&result);
    snprintf(name, sizeof(name), "twice-%s", labels[i]); ok(call(name, args, 2, &result)); equal(&input, &result); wasmtime_component_val_delete(&result);
    assert(entries[rep].live && entries[rep].calls == 3 && wasmtime_component_resource_any_owned(callback.of.resource));
    /* Calling through the exported typed invocation also borrows the owner. */
    args[0] = callback; args[1] = input;
    snprintf(name, sizeof(name), "invoke-%s", type_name); ok(call(name, args, 2, &result)); equal(&input, &result); wasmtime_component_val_delete(&result);
    assert(entries[rep].calls == 4); reclaim_host(&callback);
    snprintf(name, sizeof(name), "make-%s", labels[i]); ok(call(name, &input, 1, &result));
    assert(result.kind == WASMTIME_COMPONENT_RESOURCE && wasmtime_component_resource_any_owned(result.of.resource));
    wasmtime_component_val_t closure = result, alias = clone(&closure); wasmtime_component_val_delete(&alias);
    args[0] = closure; args[1] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = true}; args[2] = alternative;
    snprintf(name, sizeof(name), "invoke-function-bool-%s-to-%s", type_labels[i], type_labels[i]);
    ok(call(name, args, 3, &result)); equal(&input, &result); wasmtime_component_val_delete(&result);
    args[1].of.boolean = false; ok(call(name, args, 3, &result)); equal(&alternative, &result); wasmtime_component_val_delete(&result);
    drop_returned(&closure); wasmtime_component_val_delete(&input); wasmtime_component_val_delete(&alternative);
  }
  char wide_type[200] = "function";
  for (size_t i = 0; i < 16; ++i) strcat(wide_type, "-uint32");
  strcat(wide_type, "-to-uint32");
  wasmtime_component_val_t seed = u32(100), callback = resource(resource_tag(wide_type), LAST, &seed), result = {0};
  wasmtime_component_val_t args[17] = {seed, callback};
  ok(call("wide", args, 2, &result)); assert(result.of.u32 == 115); wasmtime_component_val_delete(&result);
  args[0] = callback; for (size_t i = 1; i < 17; ++i) args[i] = u32((uint32_t)i);
  char invoke_name[220]; snprintf(invoke_name, sizeof(invoke_name), "invoke-%s", wide_type);
  ok(call(invoke_name, args, 17, &result)); assert(result.of.u32 == 16); wasmtime_component_val_delete(&result); reclaim_host(&callback);
  ok(call("make-wide", &seed, 1, &result)); wasmtime_component_val_t wide_closure = result; args[0] = wide_closure;
  ok(call(invoke_name, args, 17, &result)); assert(result.of.u32 == 100); wasmtime_component_val_delete(&result); drop_returned(&wide_closure);
  /* Two borrowed handles occur late in an indirect record, after differently
   * aligned numbers, lists and strings. Drop must load the right byte offsets. */
  wasmtime_component_val_t mixed[] = {sample(2, 1), sample(14, 1), sample(5, 1), sample(13, 5), sample(11, 1), sample(10, 1), sample(15, 1), sample(17, 1), sample(4, 1), sample(14, 1),
    resource(resource_tag("function-uint32-to-uint32"), ECHO, &seed), resource(resource_tag("function-uint32-to-uint32"), ECHO, &seed)};
  ok(call("mixed", mixed, 12, &result)); equal(&mixed[8], &result); wasmtime_component_val_delete(&result);
  reclaim_host(&mixed[10]); reclaim_host(&mixed[11]);
  for (size_t i = 0; i < 10; ++i) wasmtime_component_val_delete(&mixed[i]);
  /* Type checking rejects a different signature before the native import runs. */
  callback = resource(resource_tag("function-bool-to-bool"), ECHO, &seed); args[0] = seed; args[1] = callback;
  size_t rep = allocated; rejects(call("call-uint32", args, 2, &result), "mismatched resource types");
  assert(entries[rep].calls == 0); reclaim_host(&callback);
  callback = resource(resource_tag("function-uint32-to-uint32"), REENTER, &seed); args[1] = callback;
  ok(call("call-uint32", args, 2, &result)); assert(result.of.u32 == 100); wasmtime_component_val_delete(&result); reclaim_host(&callback);
  wasmtime_component_val_t big = sample(10, 1);
  wasmtime_component_val_t zero = sample(10, 0);
  callback = resource(resource_tag("function-nat-to-nat"), REENTER, &big); args[0] = zero; args[1] = callback;
  ok(call("call-nat", args, 2, &result)); equal(&big, &result); wasmtime_component_val_delete(&result);
  reclaim_host(&callback); wasmtime_component_val_delete(&big); wasmtime_component_val_delete(&zero);
  assert(reentries == 2); args[0] = seed;
  nested_word_calls = 63; ok(call("word-bits", NULL, 0, &result)); assert(result.of.u32 == 64); wasmtime_component_val_delete(&result);
  nested_word_calls = 64; rejects(call("word-bits", NULL, 0, &result), "unreachable"); assert(!nested_word_calls);
  wasmtime_store_delete(store); store = wasmtime_store_new(engine, NULL, NULL); context = wasmtime_store_context(store);
  ok(wasmtime_component_linker_instantiate(linker, context, component, &instance));
  callback = resource(resource_tag("function-uint32-to-uint32"), FAIL, &seed); args[1] = callback;
  rejects(call("call-uint32", args, 2, &result), "synthetic callback failure");
  /* A trap bypasses guest borrow cleanup. The native bridge must discard the
   * store and reclaim its registry; resource_any_delete alone is insufficient. */
  wasmtime_component_resource_host_t *blocked = NULL;
  rejects(wasmtime_component_resource_any_to_host(context, callback.of.resource, &blocked), "cannot remove owned resource while borrowed");
  assert(!blocked && allocated == released + 1);
  wasmtime_component_val_delete(&callback); wasmtime_store_delete(store); release((uint32_t)allocated);
  store = wasmtime_store_new(engine, NULL, NULL); context = wasmtime_store_context(store);
  ok(wasmtime_component_linker_instantiate(linker, context, component, &instance));
  ok(call("word-bits", NULL, 0, &result)); assert(result.of.u32 == 64); wasmtime_component_val_delete(&result);
  assert(allocated == released);
  wasmtime_component_linker_delete(linker); wasmtime_store_delete(store); wasmtime_component_delete(component); wasm_engine_delete(engine);
  printf("{\"primitiveCases\":114,\"componentCalls\":%zu,\"resourcesCreated\":%zu,\"resourcesReleased\":%zu,\"returnedDestructors\":%zu,\"reentries\":%zu}\n", calls, allocated, released, destructors, reentries);
  return 0;
}
