/* Synthetic canonical-ABI ownership probe. This does not execute Lean. */
#include <wasmtime.h>
#include <wasmtime/component.h>
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static unsigned calls, dropped, expected_borrows, expected_moved, transferred;
static wasmtime_component_resource_host_t *moved_input;
static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message;
  wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error); exit(2);
}
static wasmtime_component_val_t resource(wasmtime_context_t *context, uint32_t rep) {
  wasmtime_component_resource_host_t *host = wasmtime_component_resource_host_new(true, rep, 1);
  wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_RESOURCE};
  ok(wasmtime_component_resource_host_to_any(context, host, &result.of.resource));
  wasmtime_component_resource_host_delete(host); return result;
}
static wasmtime_component_val_t record(wasmtime_component_val_t ticket, uint32_t value) {
  wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&result.of.record, 2);
  wasm_name_new(&result.of.record.data[0].name, 6, "ticket");
  result.of.record.data[0].val = ticket;
  wasm_name_new(&result.of.record.data[1].name, 5, "value");
  result.of.record.data[1].val = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = value};
  return result;
}
static wasmtime_error_t *drop(void *data, wasmtime_context_t *context, uint32_t rep) {
  (void)data; (void)context;
  assert(rep >= 2 && rep <= calls + 1); dropped++; return NULL;
}
static unsigned visit(wasmtime_context_t *context, const wasmtime_component_val_t *value) {
  unsigned count = 0;
  switch (value->kind) {
  case WASMTIME_COMPONENT_RESOURCE: {
    bool owned = wasmtime_component_resource_any_owned(value->of.resource);
    wasmtime_component_resource_host_t *host = NULL;
    ok(wasmtime_component_resource_any_to_host(context, value->of.resource, &host));
    assert(wasmtime_component_resource_host_owned(host) == owned);
    assert(wasmtime_component_resource_host_type(host) == 1);
    if (owned) {
      assert(expected_moved == 1 && !moved_input);
      assert(wasmtime_component_resource_host_rep(host) == calls + 2);
      moved_input = host; transferred++; return 0;
    }
    assert(wasmtime_component_resource_host_rep(host) == 1);
    wasmtime_component_resource_host_delete(host); return 1;
  }
  case WASMTIME_COMPONENT_RECORD:
    for (size_t i = 0; i < value->of.record.size; ++i) count += visit(context, &value->of.record.data[i].val);
    return count;
  case WASMTIME_COMPONENT_LIST:
    for (size_t i = 0; i < value->of.list.size; ++i) count += visit(context, &value->of.list.data[i]);
    return count;
  case WASMTIME_COMPONENT_TUPLE:
    for (size_t i = 0; i < value->of.tuple.size; ++i) count += visit(context, &value->of.tuple.data[i]);
    return count;
  case WASMTIME_COMPONENT_OPTION: return value->of.option ? visit(context, value->of.option) : 0;
  case WASMTIME_COMPONENT_RESULT: return value->of.result.val ? visit(context, value->of.result.val) : 0;
  case WASMTIME_COMPONENT_VARIANT: return value->of.variant.val ? visit(context, value->of.variant.val) : 0;
  case WASMTIME_COMPONENT_U32: case WASMTIME_COMPONENT_U64: case WASMTIME_COMPONENT_F64: return 0;
  default: abort();
  }
}
static wasmtime_error_t *inspect(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args,
    size_t count, wasmtime_component_val_t *out, size_t result_count) {
  (void)data; (void)type; assert(result_count == 1);
  unsigned found = 0; assert(!moved_input);
  for (size_t i = 0; i < count; ++i) found += visit(context, &args[i]);
  assert(found == expected_borrows && (moved_input != NULL) == (expected_moved != 0));
  calls++;
  wasmtime_component_val_t ticket = {.kind = WASMTIME_COMPONENT_RESOURCE};
  if (moved_input) {
    ok(wasmtime_component_resource_host_to_any(context, moved_input, &ticket.of.resource));
    wasmtime_component_resource_host_delete(moved_input); moved_input = NULL;
  } else ticket = resource(context, calls + 1);
  *out = record(ticket, 43); return NULL;
}
static wasmtime_component_val_t clone(const wasmtime_component_val_t *value) {
  wasmtime_component_val_t copy;
  wasmtime_component_val_clone(value, &copy); return copy;
}
static wasmtime_component_val_t fields(size_t count) {
  wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&result.of.record, count); return result;
}
static void field(wasmtime_component_val_t *record, size_t index, const char *name, wasmtime_component_val_t value) {
  wasm_name_new(&record->of.record.data[index].name, strlen(name), name);
  record->of.record.data[index].val = value;
}
static wasmtime_component_val_t input(wasmtime_context_t *context, const char *mode, unsigned iteration, const wasmtime_component_val_t *owner) {
  expected_moved = 0;
  if (!strcmp(mode, "record") || !strcmp(mode, "alias")) {
    expected_borrows = 1; return record(clone(owner), 42);
  }
  if (!strcmp(mode, "list")) {
    expected_borrows = iteration % 2 ? 3 : 0;
    wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_LIST};
    wasmtime_component_vallist_new_uninit(&result.of.list, expected_borrows);
    for (unsigned i = 0; i < expected_borrows; ++i) result.of.list.data[i] = record(clone(owner), i);
    return result;
  }
  if (!strcmp(mode, "option-list") || !strcmp(mode, "indirect-option-list")) {
    wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_OPTION};
    expected_borrows = iteration % 3 == 2 ? 3 : 0;
    if (iteration % 3) {
      wasmtime_component_val_t list = {.kind = WASMTIME_COMPONENT_LIST};
      wasmtime_component_vallist_new_uninit(&list.of.list, expected_borrows);
      for (unsigned i = 0; i < expected_borrows; ++i) list.of.list.data[i] = clone(owner);
      result.of.option = wasmtime_component_val_new(&list); wasmtime_component_val_delete(&list);
    }
    return result;
  }
  if (!strcmp(mode, "variant") || !strcmp(mode, "indirect-variant") || !strcmp(mode, "wide-variant")) {
    bool wide_tag = !strcmp(mode, "wide-variant");
    unsigned tag = iteration % (wide_tag ? 2 : 3);
    const char *name = tag == 0 ? (wide_tag ? "empty0" : "empty") : tag == 1 ? "pair" : "wide";
    wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_VARIANT};
    wasm_name_new(&result.of.variant.discriminant, strlen(name), name);
    expected_borrows = tag == 1 ? 2 : 0;
    if (tag) {
      wasmtime_component_val_t payload = fields(2);
      if (tag == 1) {
        field(&payload, 0, "left", clone(owner)); field(&payload, 1, "right", clone(owner));
      } else {
        field(&payload, 0, "a", (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U64, .of.u64 = UINT64_MAX});
        field(&payload, 1, "b", (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_F64, .of.f64 = -1.25});
      }
      result.of.variant.val = wasmtime_component_val_new(&payload); wasmtime_component_val_delete(&payload);
    }
    return result;
  }
  if (!strcmp(mode, "result") || !strcmp(mode, "indirect-result")) {
    expected_borrows = iteration % 2;
    wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_RESULT};
    result.of.result.is_ok = expected_borrows != 0;
    wasmtime_component_val_t payload = expected_borrows ? record(clone(owner), 42)
        : (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U64, .of.u64 = UINT64_MAX};
    result.of.result.val = wasmtime_component_val_new(&payload); wasmtime_component_val_delete(&payload);
    return result;
  }
  if (!strcmp(mode, "tuple")) {
    expected_borrows = 2;
    wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_TUPLE};
    wasmtime_component_valtuple_new_uninit(&result.of.tuple, 2);
    result.of.tuple.data[0] = clone(owner); result.of.tuple.data[1] = record(clone(owner), 42);
    return result;
  }
  if (!strcmp(mode, "mixed") || !strcmp(mode, "indirect-mixed") || !strcmp(mode, "list-mixed")) {
    bool list = !strcmp(mode, "list-mixed");
    expected_moved = expected_borrows = !list || iteration % 2;
    wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_LIST}, value = {0};
    if (expected_moved) {
      value = fields(2); field(&value, 0, "borrowed", clone(owner));
      field(&value, 1, "moved", resource(context, iteration + 2));
    }
    if (!list) return value;
    wasmtime_component_vallist_new_uninit(&result.of.list, expected_moved);
    if (expected_moved) result.of.list.data[0] = value;
    return result;
  }
  assert(!strcmp(mode, "wide-record")); expected_borrows = 2;
  wasmtime_component_val_t result = fields(10);
  for (size_t i = 0; i < 8; ++i) {
    char name[20]; snprintf(name, sizeof(name), "padding%zu", i);
    field(&result, i, name, (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U64, .of.u64 = UINT64_MAX - i});
  }
  field(&result, 8, "left", clone(owner)); field(&result, 9, "right", clone(owner)); return result;
}
int main(int argc, char **argv) {
  assert(argc == 3);
  FILE *file = fopen(argv[1], "rb"); assert(file);
  assert(fseek(file, 0, SEEK_END) == 0); long size = ftell(file); assert(size > 0); rewind(file);
  unsigned char *bytes = malloc((size_t)size); assert(bytes);
  assert(fread(bytes, 1, (size_t)size, file) == (size_t)size); fclose(file);
  wasm_config_t *config = wasm_config_new(); wasmtime_config_wasm_component_model_set(config, true);
  wasm_engine_t *engine = wasm_engine_new_with_config(config);
  wasmtime_component_t *component = NULL;
  ok(wasmtime_component_new(engine, bytes, (size_t)size, &component)); free(bytes);
  wasmtime_store_t *store = wasmtime_store_new(engine, NULL, NULL);
  wasmtime_context_t *context = wasmtime_store_context(store);
  wasmtime_component_linker_t *linker = wasmtime_component_linker_new(engine);
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *host = NULL;
  const char *native = "probe:ownership/native@1.0.0", *api = "probe:ownership/api@1.0.0";
  ok(wasmtime_component_linker_instance_add_instance(root, native, strlen(native), &host));
  wasmtime_component_resource_type_t *type = wasmtime_component_resource_type_new_host(1);
  ok(wasmtime_component_linker_instance_add_resource(host, "ticket", 6, type, drop, NULL, NULL));
  wasmtime_component_resource_type_delete(type);
  ok(wasmtime_component_linker_instance_add_func(host, "inspect", 7, inspect, NULL, NULL));
  wasmtime_component_linker_instance_delete(host); wasmtime_component_linker_instance_delete(root);
  wasmtime_component_instance_t instance;
  ok(wasmtime_component_linker_instantiate(linker, context, component, &instance));
  wasmtime_component_export_index_t *api_index = wasmtime_component_instance_get_export_index(&instance, context, NULL, api, strlen(api));
  assert(api_index);
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&instance, context, api_index, "inspect", 7);
  assert(index); wasmtime_component_func_t function;
  assert(wasmtime_component_instance_get_func(&instance, context, index, &function));
  wasmtime_component_export_index_delete(index); wasmtime_component_export_index_delete(api_index);
  wasmtime_component_val_t owner = resource(context, 1);
  for (unsigned iteration = 0; iteration < 1024; ++iteration) {
    wasmtime_component_val_t args[17];
    const size_t count = !strncmp(argv[2], "indirect-", 9) || !strcmp(argv[2], "wide-variant") ? 17 : 1;
    for (size_t i = 0; i + 1 < count; ++i) args[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = (uint32_t)i};
    args[count - 1] = input(context, argv[2], iteration, &owner);
    wasmtime_component_val_t result = {0};
    ok(wasmtime_component_func_call(&function, context, args, count, &result, 1));
    assert(result.kind == WASMTIME_COMPONENT_RECORD && result.of.record.size == 2);
    assert(result.of.record.data[1].val.of.u32 == 43);
    assert(wasmtime_component_resource_any_owned(result.of.record.data[0].val.of.resource));
    ok(wasmtime_component_resource_any_drop(context, result.of.record.data[0].val.of.resource));
    wasmtime_component_val_delete(&result);
    for (size_t i = 0; i < count; ++i) wasmtime_component_val_delete(&args[i]);
    assert(dropped == iteration + 1);
  }
  wasmtime_component_resource_host_t *original = NULL;
  ok(wasmtime_component_resource_any_to_host(context, owner.of.resource, &original));
  assert(wasmtime_component_resource_host_owned(original));
  assert(wasmtime_component_resource_host_rep(original) == 1);
  wasmtime_component_resource_host_delete(original); wasmtime_component_val_delete(&owner);
  wasmtime_component_linker_delete(linker); wasmtime_store_delete(store);
  wasmtime_component_delete(component); wasm_engine_delete(engine);
  unsigned expected_transfers = !strcmp(argv[2], "list-mixed") ? 512
      : !strcmp(argv[2], "mixed") || !strcmp(argv[2], "indirect-mixed") ? 1024 : 0;
  assert(transferred == expected_transfers);
  printf("%s: calls=%u owned-result-drops=%u transfers=%u original-owner-live=true\n", argv[2], calls, dropped, transferred);
}
