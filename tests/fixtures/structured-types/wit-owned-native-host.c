/* Compiled Lean through the full generated owned Component Model projection. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
static size_t live_allocations, calls, resources, shapes, closures, failures;
static long allocation_failure = -1;
static void *allocate(size_t size) {
  if (allocation_failure == 0) return NULL;
  if (allocation_failure > 0) --allocation_failure;
  void *result = calloc(1, size); if (result) ++live_allocations; return result;
}
static void release(void *value) {
  if (value) { assert(live_allocations); --live_allocations; free(value); }
}
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE release
#include "owned-host.h"
#include "bindings.h"
#include "component.h"

extern lean_object *COMPONENT_INITIALIZER(uint8_t);
extern lean_object *initialize_Witness(uint8_t);
static void *initialize_component(uint8_t builtin) {
  lean_object *result = COMPONENT_INITIALIZER(builtin);
  if (lean_io_result_is_error(result)) return result;
  lean_dec(result); return initialize_Witness(builtin);
}
static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error); abort();
}
static lb_owned_context native;
static ow_native_host host;
static wasmtime_component_instance_t instance;
static wasmtime_error_t *try_invoke(const char *name, const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  ow_native_call frame = {0}; assert(ow_native_call_begin(&host, &frame));
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&instance, host.context, NULL, API_NAME, strlen(API_NAME));
  assert(api);
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&instance, host.context, api, name, strlen(name));
  assert(index); wasmtime_component_func_t function;
  assert(wasmtime_component_instance_get_func(&instance, host.context, index, &function));
  wasmtime_component_export_index_delete(index); wasmtime_component_export_index_delete(api);
  wasmtime_component_val_t result = {0};
  wasmtime_error_t *error = wasmtime_component_func_call(&function, host.context, args, count, &result, 1);
  if (host.failure) {
    if (error) wasmtime_error_delete(error);
    error = host.failure; host.failure = NULL;
  }
  bool committed = ow_native_call_end(&frame, !error);
  if (!committed && !error) error = wasmtime_error_new("Native WIT call failed to commit");
  if (!error) { *out = result; ++calls; }
  else wasmtime_component_val_delete(&result);
  return error;
}
static wasmtime_component_val_t invoke(const char *name, const wasmtime_component_val_t *args, size_t count) {
  wasmtime_component_val_t result = {0}; ok(try_invoke(name, args, count, &result)); return result;
}
static wasmtime_component_val_t copy(const wasmtime_component_val_t *value) {
  wasmtime_component_val_t result; wasmtime_component_val_clone(value, &result); return result;
}
static ow_scope plain_scope(void) { return (ow_scope){.memory = {.remaining = OW_BYTES}, .visits = OW_NODES}; }
static wasmtime_component_val_t new_ticket(unsigned number) {
  uint32_t limb = number; native_Nat nat = {.data = &limb, .length = 1};
  const char text[] = "owned\0λ🙂"; native_Text label = {.data = text, .length = sizeof(text) - 1};
  ow_scope scope = plain_scope(); wasmtime_component_val_t args[2] = {{0}};
  assert(ENCODE_Nat(&nat, &scope, &args[0])); assert(ENCODE_Text(&label, &scope, &args[1]));
  wasmtime_component_val_t result = invoke(FN_newTicket, args, 2);
  for (size_t i = 0; i < 2; ++i) wasmtime_component_val_delete(&args[i]);
  lb_scope_close(&scope.memory); return result;
}
static void expect_ticket(const wasmtime_component_val_t *ticket, unsigned number) {
  wasmtime_component_val_t result = invoke(FN_serial, ticket, 1);
  ow_scope scope = plain_scope(); native_Nat nat = {0};
  assert(DECODE_Nat(&result, &scope, &nat)); assert(nat.length == 1 && nat.data[0] == number);
  lb_scope_close(&scope.memory); wasmtime_component_val_delete(&result);
  result = invoke(FN_label, ticket, 1); scope = plain_scope(); native_Text text = {0};
  assert(DECODE_Text(&result, &scope, &text));
  const char expected[] = "owned\0λ🙂";
  assert(text.length == sizeof(expected) - 1 && !memcmp(text.data, expected, text.length));
  lb_scope_close(&scope.memory); wasmtime_component_val_delete(&result); ++resources;
}
static void visit(const wasmtime_component_val_t *value, unsigned serial, bool drop) {
  switch (value->kind) {
  case WASMTIME_COMPONENT_RESOURCE:
    assert(wasmtime_component_resource_any_owned(value->of.resource));
    if (drop) ok(wasmtime_component_resource_any_drop(host.context, value->of.resource));
    else if (ow_native_type(&host, TYPE_Ticket, value->of.resource)) expect_ticket(value, serial);
    break;
  case WASMTIME_COMPONENT_RECORD:
    for (size_t i = 0; i < value->of.record.size; ++i) visit(&value->of.record.data[i].val, serial, drop);
    break;
  case WASMTIME_COMPONENT_LIST:
    for (size_t i = 0; i < value->of.list.size; ++i) visit(&value->of.list.data[i], serial, drop);
    break;
  case WASMTIME_COMPONENT_TUPLE:
    for (size_t i = 0; i < value->of.tuple.size; ++i) visit(&value->of.tuple.data[i], serial, drop);
    break;
  case WASMTIME_COMPONENT_VARIANT:
    if (value->of.variant.val) visit(value->of.variant.val, serial, drop);
    break;
  case WASMTIME_COMPONENT_OPTION:
    if (value->of.option) visit(value->of.option, serial, drop);
    break;
  case WASMTIME_COMPONENT_RESULT:
    if (value->of.result.val) visit(value->of.result.val, serial, drop);
    break;
  default: break;
  }
}
static void dispose(wasmtime_component_val_t *value) {
  visit(value, 0, true); wasmtime_component_val_delete(value); *value = (wasmtime_component_val_t){0};
}
/* Input encoders clone a live owned ResourceAny. Canonical lowering borrows
 * that logical resource; deleting the temporary C boxes must not drop it. */
static bool copy_ticket(void *data, size_t type, bool borrowed, uint64_t token, wasmtime_component_val_t *out) {
  assert(type == TYPE_Ticket && borrowed && token == 1); *out = copy(data); return true;
}
static void keep_ticket(void *data, wasmtime_component_resource_any_t *value) { (void)data; (void)value; }
static ow_scope input_scope(wasmtime_component_val_t *ticket) {
  ow_scope scope = plain_scope(); scope.identities = (ow_identities){.data = ticket, .write = copy_ticket, .discard = keep_ticket}; return scope;
}
typedef struct {
  native_Ticket repeated[2]; native_Option option; native_Tickets peers; native_History history;
  uint32_t limbs[4]; uint8_t bytes[3]; native_Payload payload; native_Bundle bundle;
} input_bundle;
static void make_bundle(input_bundle *input) {
  *input = (input_bundle){0};
  input->repeated[0].token = input->repeated[1].token = 1;
  input->option = (native_Option){.tag = 1, .f0 = {.token = 1}};
  input->peers = (native_Tickets){.data = input->repeated, .length = 2};
  input->history = (native_History){.data = input->repeated, .length = 2};
  input->limbs[0] = 17; input->limbs[3] = 8;
  input->bytes[0] = 0; input->bytes[1] = 255; input->bytes[2] = 19;
  input->payload.f0.data = input->limbs; input->payload.f0.length = 4; input->payload.f0.negative = 1;
  input->payload.f1.data = input->bytes; input->payload.f1.length = 3;
  input->bundle = (native_Bundle){.f0 = {.token = 1}, .f1 = &input->option,
    .f2 = &input->peers, .f3 = &input->history, .f4 = &input->payload};
}
#define ROUNDTRIP(Name, function, value) do { \
  ow_scope scope = input_scope(&ticket); wasmtime_component_val_t input = {0}; \
  assert(ENCODE_##Name(&(value), &scope, &input)); lb_scope_close(&scope.memory); \
  size_t baseline = host.live; \
  wasmtime_component_val_t result = invoke(FN_##function, &input, 1); \
  visit(&result, 42, false); dispose(&result); assert(host.live == baseline); \
  wasmtime_component_val_delete(&input); ++shapes; \
} while (0)
static void graph_shapes(void) {
  wasmtime_component_val_t ticket = new_ticket(42); expect_ticket(&ticket, 42);
  input_bundle data; make_bundle(&data);
  for (size_t i = 0; i < 32; ++i) ROUNDTRIP(Bundle, echoRecord, data.bundle);
  ROUNDTRIP(Bundle, echoAlias, data.bundle); ROUNDTRIP(Tickets, echoArray, data.peers);
  ROUNDTRIP(History, echoList, data.history); ROUNDTRIP(Option, echoOption, data.option);
  native_Option none = {0}; ROUNDTRIP(Option, echoOption, none);
  native_Result result = {.tag = 0, .f0 = &data.bundle}; ROUNDTRIP(Result, echoResult, result);
  result = (native_Result){.tag = 1, .f1 = {.token = 1}}; ROUNDTRIP(Result, echoResult, result);
  native_TupleInner inner = {.f0 = &data.option, .f1 = &data.payload};
  native_Tuple tuple = {.f0 = {.token = 1}, .f1 = &inner}; ROUNDTRIP(Tuple, echoTuple, tuple);
  for (uint32_t i = 0; i < 4; ++i) {
    native_Choice choice = {.tag = i};
    if (i == 1) choice.cases.c1.f0.token = 1;
    if (i == 2) choice.cases.c2.f0.token = choice.cases.c2.f1.token = 1;
    if (i == 3) choice.cases.c3.f0 = &data.peers;
    ROUNDTRIP(Choice, echoVariant, choice);
  }
  native_Option options[] = {none, data.option}; native_Row row = {.data = options, .length = 2}; ROUNDTRIP(Row, echoRow, row);
  native_NestedOption nested_option = {.tag = 1, .f0 = &result};
  native_NestedList nested_list = {.data = &nested_option, .length = 1};
  native_Nested nested = {.data = &nested_list, .length = 1}; ROUNDTRIP(Nested, echoNested, nested);
  native_Tree tree = {.tag = 0, .cases.c0.f0 = {.token = 1}}; ROUNDTRIP(Tree, echoRecursive, tree);
  native_Trees children = {.data = &tree, .length = 1}; native_Tree branch = {.tag = 1, .cases.c1.f0 = &children}; ROUNDTRIP(Tree, echoRecursive, branch);
  ow_scope scope = input_scope(&ticket); wasmtime_component_val_t input = {0};
  assert(ENCODE_Bundle(&data.bundle, &scope, &input)); lb_scope_close(&scope.memory);
  wasmtime_component_val_t payload = invoke(FN_payload, &input, 1);
  native_Payload decoded = {0}; scope = plain_scope();
  assert(DECODE_Payload(&payload, &scope, &decoded));
  assert(decoded.f0.negative && decoded.f0.length == 4 && decoded.f0.data[0] == 17 && decoded.f0.data[3] == 8);
  assert(decoded.f1.length == 3 && !memcmp(decoded.f1.data, data.bytes, 3));
  lb_scope_close(&scope.memory); wasmtime_component_val_delete(&payload); wasmtime_component_val_delete(&input);
  expect_ticket(&ticket, 42); dispose(&ticket); assert(host.live == 0 && native.live_owners == 0);
}
static wasmtime_component_vallist_t *table(wasmtime_component_val_t *value, size_t type) {
  char name[40]; snprintf(name, sizeof(name), "nodes%zu", type);
  wasmtime_component_val_t *arena = &value->of.record.data[1].val;
  for (size_t i = 0; i < arena->of.record.size; ++i)
    if (lb_name(&arena->of.record.data[i].name, name)) return &arena->of.record.data[i].val.of.list;
  abort();
}
static void shared_nodes(void) {
  wasmtime_component_val_t ticket = new_ticket(42);
  native_Tree leaves[] = {{.tag = 0, .cases.c0.f0 = {.token = 1}}, {.tag = 0, .cases.c0.f0 = {.token = 1}}};
  native_Trees children = {.data = leaves, .length = 2}; native_Tree branch = {.tag = 1, .cases.c1.f0 = &children};
  ow_scope scope = input_scope(&ticket); wasmtime_component_val_t input = {0};
  assert(ENCODE_Tree(&branch, &scope, &input)); lb_scope_close(&scope.memory);
  wasmtime_component_vallist_t *trees = table(&input, TYPE_Tree), *arrays = table(&input, TYPE_Trees);
  assert(trees->size == 3 && arrays->size == 1);
  wasmtime_component_vallist_t replacement;
  wasmtime_component_vallist_new_uninit(&replacement, 2);
  for (size_t i = 0; i < 2; ++i) { replacement.data[i] = trees->data[i]; trees->data[i] = (wasmtime_component_val_t){0}; }
  wasmtime_component_vallist_delete(trees); *trees = replacement;
  wasmtime_component_val_t *reference = &arrays->data[0].of.list.data[1];
  assert(reference->kind == WASMTIME_COMPONENT_RECORD);
  reference->of.record.data[0].val.of.u32 = 1;
  /* Both edges now visit the identical resource box in node one. */
  wasmtime_component_val_t result = invoke(FN_echoRecursive, &input, 1);
  visit(&result, 42, false); dispose(&result); wasmtime_component_val_delete(&input);
  dispose(&ticket); assert(!host.live && !native.live_owners); ++shapes;
}
static void registry_rollback(void) {
  wasmtime_component_val_t ticket = new_ticket(42);
  ow_native_entry *entry = NULL;
  for (size_t i = 0; i < OW_RESOURCE_CAPACITY; ++i) if (host.entries[i].rep) { assert(!entry); entry = &host.entries[i]; }
  assert(entry && entry->type == TYPE_Ticket); uint64_t token = entry->token;
  bool completed = false;
  for (long site = 0; site < 16; ++site) {
    ow_native_call frame = {0}; assert(ow_native_call_begin(&host, &frame));
    ow_native_conversion conversion; ow_native_conversion_init(&conversion, &host);
    wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 123};
    allocation_failure = site;
    bool written = ow_native_write_identity(&conversion, TYPE_Ticket, false, token, &value);
    allocation_failure = -1;
    if (written) { ow_value_delete(&conversion.scope, &value); completed = true; }
    else { assert(value.kind == WASMTIME_COMPONENT_U32 && value.of.u32 == 123); ++failures; }
    ow_native_conversion_close(&conversion); assert(ow_native_call_end(&frame, true));
    assert(host.live == 1 && native.live_owners == 1);
    expect_ticket(&ticket, 42); if (completed) break;
  }
  assert(completed);
  ow_native_call outer = {0}, inner = {0};
  assert(ow_native_call_begin(&host, &outer)); assert(ow_native_call_begin(&host, &inner));
  assert(!ow_native_call_end(&outer, true)); assert(host.depth == 2);
  ow_native_conversion conversion; ow_native_conversion_init(&conversion, &host);
  wasmtime_component_val_t value = {0};
  assert(ow_native_write_identity(&conversion, TYPE_Ticket, false, token, &value));
  assert(host.live == 2); assert(ow_native_call_end(&inner, true));
  assert(!ow_native_call_end(&outer, false)); assert(host.live == 1);
  /* This unexported host proxy has no component destructor. Rollback has
   * already released its lease; only its Wasmtime table entry remains. */
  ok(wasmtime_component_resource_any_drop(host.context, value.of.resource)); wasmtime_component_val_delete(&value);
  ow_native_conversion_close(&conversion);
  assert(ow_native_call_begin(&host, &outer)); ow_native_conversion_init(&conversion, &host);
  uint32_t last = host.next_rep; host.next_rep = UINT32_MAX;
  assert(!ow_native_write_identity(&conversion, TYPE_Ticket, false, token, &value));
  host.next_rep = last;
  assert(!ow_native_write_identity(&conversion, TYPE_Ticket, false, UINT64_MAX, &value));
  assert(!ow_native_write_identity(&conversion, TYPE_Nat, false, token, &value));
  ow_native_conversion_close(&conversion); assert(ow_native_call_end(&outer, true));
  expect_ticket(&ticket, 42); dispose(&ticket); assert(!host.live && !native.live_owners);
}
static void returned_closures(void) {
  wasmtime_component_val_t ticket = new_ticket(42);
  input_bundle data; make_bundle(&data); ow_scope scope = input_scope(&ticket);
  wasmtime_component_val_t input = {0}; assert(ENCODE_Bundle(&data.bundle, &scope, &input)); lb_scope_close(&scope.memory);
  wasmtime_component_val_t bundle = invoke(FN_echoRecord, &input, 1);
  wasmtime_component_val_delete(&input); dispose(&ticket);
  visit(&bundle, 42, false);
  wasmtime_component_val_t child = invoke(FN_primary, &bundle, 1);
  wasmtime_component_val_t closure = invoke(FN_makeRecord, &bundle, 1);
  dispose(&bundle); expect_ticket(&child, 42); dispose(&child);
  assert(host.live == 1 && native.live_owners == 1);
  ticket = new_ticket(99); scope = input_scope(&ticket);
  assert(ENCODE_Bundle(&data.bundle, &scope, &input)); lb_scope_close(&scope.memory);
  wasmtime_component_val_t args[] = {copy(&closure), {.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = true}, input};
  wasmtime_component_val_t captured = invoke(FN_recordApply, args, 3);
  args[1].of.boolean = false; wasmtime_component_val_t supplied = invoke(FN_recordApply, args, 3);
  wasmtime_component_val_delete(&args[0]); wasmtime_component_val_delete(&input);
  dispose(&ticket); dispose(&closure);
  visit(&captured, 42, false); visit(&supplied, 99, false);
  dispose(&captured); dispose(&supplied); closures += 2;
  assert(host.live == 0 && native.live_owners == 0);
}
static void reset_instance(wasmtime_store_t **store, wasmtime_component_linker_t **linker,
    wasm_engine_t *engine, wasmtime_component_t *component) {
  if (*store) {
    assert(ow_native_host_close(&host)); wasmtime_component_linker_delete(*linker); wasmtime_store_delete(*store);
    assert(!native.live_owners && !native.batches && !native.top && !live_allocations);
  }
  *store = wasmtime_store_new(engine, NULL, NULL);
  assert(ow_native_host_init(&host, &native, wasmtime_store_context(*store)));
  *linker = wasmtime_component_linker_new(engine); ok(ow_native_link(&host, *linker));
  ok(wasmtime_component_linker_instantiate(*linker, host.context, component, &instance));
}
static void allocation_failures(wasmtime_store_t **store, wasmtime_component_linker_t **linker,
    wasm_engine_t *engine, wasmtime_component_t *component) {
  uint32_t limb = 42; native_Nat nat = {.data = &limb, .length = 1};
  native_Text text = {.data = "fault", .length = 5}; ow_scope scope = plain_scope();
  wasmtime_component_val_t args[2] = {{0}};
  assert(ENCODE_Nat(&nat, &scope, &args[0])); assert(ENCODE_Text(&text, &scope, &args[1]));
  bool completed = false;
  for (long site = 0; site < 100; ++site) {
    reset_instance(store, linker, engine, component);
    wasmtime_component_val_t result = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 123};
    allocation_failure = site; wasmtime_error_t *error = try_invoke(FN_newTicket, args, 2, &result); allocation_failure = -1;
    if (!error) {
      dispose(&result); assert(!host.live && !native.live_owners); completed = true; break;
    }
    assert(result.kind == WASMTIME_COMPONENT_U32 && result.of.u32 == 123);
    wasmtime_error_delete(error);
    assert(!host.live && !native.live_owners && !native.batches && !native.top); ++failures;
  }
  assert(completed && failures > 0);
  for (size_t i = 0; i < 2; ++i) wasmtime_component_val_delete(&args[i]);
  lb_scope_close(&scope.memory);
}
int main(void) {
  assert(lean_bridge_native_component_initialize(COMPONENT_ID, initialize_component));
  assert(lb_owned_context_init(&native, COMPONENT_ID) == LB_OWNED_OK);
  wasm_config_t *config = wasm_config_new(); wasmtime_config_wasm_component_model_set(config, true);
  wasm_engine_t *engine = wasm_engine_new_with_config(config);
  wasmtime_component_t *component = NULL;
  ok(wasmtime_component_new(engine, component_bytes, sizeof(component_bytes), &component));
  wasmtime_store_t *store = NULL; wasmtime_component_linker_t *linker = NULL;
  reset_instance(&store, &linker, engine, component);
  bool cold = getenv("LEAN_BRIDGE_OWNED_COLD_ONLY") != NULL;
  if (!cold) {
    graph_shapes(); shared_nodes(); returned_closures(); registry_rollback();
    allocation_failures(&store, &linker, engine, component);
  }
  assert(ow_native_host_close(&host)); assert(lb_owned_context_close(&native) == LB_OWNED_OK);
  wasmtime_component_linker_delete(linker); wasmtime_store_delete(store);
  wasmtime_component_delete(component); wasm_engine_delete(engine);
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  assert(!snapshot.live_identities && !live_allocations);
  if (cold) { puts("{\"cold\":true}"); return 0; }
  printf("{\"calls\":%zu,\"resources\":%zu,\"shapes\":%zu,\"closures\":%zu,\"allocationFailures\":%zu,\"liveIdentities\":%zu,\"liveAllocations\":%zu}\n",
    calls, resources, shapes, closures, failures, (size_t)snapshot.live_identities, live_allocations);
}
