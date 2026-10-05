/* Synthetic Wasmtime/native view conversion probe. No compiled Lean calls. */
#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wasmtime.h>
#include <wasmtime/component.h>
#include "owned.h"
#include "driver.h"

static long allocation_failure = -1;
static size_t live_allocations;
static void *scratch_calloc(size_t count, size_t width) {
  if (allocation_failure == 0) return NULL;
  if (allocation_failure > 0) --allocation_failure;
  void *value = calloc(count, width); if (value) ++live_allocations; return value;
}
static void scratch_free(void *value) {
  if (value) { assert(live_allocations); --live_allocations; free(value); }
}
#define calloc scratch_calloc
#define free scratch_free
#include "conversions.h"
#undef calloc
#undef free
/* GENERATED_TYPES */

static wasmtime_context_t *context;
static struct { wasmtime_component_resource_any_t *handle; uint64_t token; size_t type; bool borrowed; } ledger[1024];
static size_t created, dropped, live_resources, roundtrips, malformed_inputs, malformed_outputs;
static size_t scratch_failures, budget_failures, identity_failures;
static size_t input_allocation_sites, output_allocation_sites;
static long identity_failure = -1;
static bool fail_after_identity_write;
static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t text; wasmtime_error_message(error, &text);
  fprintf(stderr, "%.*s\n", (int)text.size, text.data);
  wasm_name_delete(&text); wasmtime_error_delete(error); abort();
}
static bool read_identity(void *data, size_t type, bool borrowed, const wasmtime_component_val_t *value, uint64_t *out) {
  assert(data == ledger);
  for (size_t i = 0; i < 1024; ++i) if (ledger[i].handle == value->of.resource) {
    if (ledger[i].type != type || ledger[i].borrowed != borrowed) return false;
    assert(wasmtime_component_resource_any_owned(value->of.resource) == !borrowed);
    if (out) *out = ledger[i].token;
    return true;
  }
  return false;
}
static bool write_identity(void *data, size_t type, bool borrowed, uint64_t token, wasmtime_component_val_t *out) {
  assert(data == ledger);
  if (identity_failure == 0) return false;
  if (identity_failure > 0) --identity_failure;
  for (size_t i = 0; i < 1024; ++i) if (!ledger[i].handle) {
    wasmtime_component_resource_host_t *host = wasmtime_component_resource_host_new(!borrowed, (uint32_t)i + 1, (uint32_t)type + 1);
    out->kind = WASMTIME_COMPONENT_RESOURCE;
    ok(wasmtime_component_resource_host_to_any(context, host, &out->of.resource));
    wasmtime_component_resource_host_delete(host);
    ledger[i].handle = out->of.resource; ledger[i].token = token;
    ledger[i].type = type; ledger[i].borrowed = borrowed;
    ++created; ++live_resources; return !fail_after_identity_write;
  }
  return false;
}
static void discard_identity(void *data, wasmtime_component_resource_any_t *value) {
  assert(data == ledger);
  for (size_t i = 0; i < 1024; ++i) if (ledger[i].handle == value) {
    ok(wasmtime_component_resource_any_drop(context, value));
    ledger[i].handle = NULL; ++dropped; assert(live_resources); --live_resources; return;
  }
  assert(!"unregistered or duplicate resource drop");
}
static ow_scope scope(void) {
  return (ow_scope){.memory = {.remaining = OW_BYTES}, .visits = OW_NODES,
    .identities = {.data = ledger, .read = read_identity, .write = write_identity, .discard = discard_identity}};
}
static void close_scope(ow_scope *value) { lb_scope_close(&value->memory); }
static wasmtime_component_val_t *table_row(wasmtime_component_val_t *value, size_t type, size_t index) {
  char name[32]; snprintf(name, sizeof(name), "nodes%zu", type);
  wasmtime_component_val_t *arena = &value->of.record.data[1].val;
  for (size_t i = 0; i < arena->of.record.size; ++i) if (lb_name(&arena->of.record.data[i].name, name)) {
    assert(index < arena->of.record.data[i].val.of.list.size);
    return &arena->of.record.data[i].val.of.list.data[index];
  }
  abort();
}
#define ROUNDTRIP_MODE(Name, original, mode, checks) do { \
  ow_scope output_scope = scope(); wasmtime_component_val_t encoded = {0}; \
  assert(ENCODE_##Name(mode)(&(original), &output_scope, &encoded)); \
  close_scope(&output_scope); assert(live_allocations == 0); \
  ow_scope validation = scope(); assert(DECODE_##Name(mode)(&encoded, &validation, NULL)); close_scope(&validation); \
  ow_scope input_scope = scope(); native_##Name decoded = {0}; \
  assert(DECODE_##Name(mode)(&encoded, &input_scope, &decoded)); checks; \
  close_scope(&input_scope); ow_value_delete(&output_scope, &encoded); \
  assert(live_allocations == 0 && live_resources == 0); ++roundtrips; \
} while (0)
#define ROUNDTRIP(Name, original, checks) do { \
  ROUNDTRIP_MODE(Name, original, input, checks); \
  ROUNDTRIP_MODE(Name, original, output, checks); \
} while (0)

static const uint64_t identity = (UINT64_C(1) << 62) + 123;
static native_Bundle bundle(void) {
  static const uint32_t limbs[] = {1, 0, 0, 0, 4};
  static const uint8_t bytes[] = {0, 255, 2};
  static native_Ticket tickets[2];
  static native_Option option;
  static native_Tickets peers;
  static native_History history;
  static native_Payload payload;
  tickets[0].token = identity; tickets[1].token = identity + 1;
  option = (native_Option){.tag = 1, .f0 = tickets[1]};
  peers = (native_Tickets){.data = tickets, .length = 2};
  history = (native_History){.data = tickets, .length = 2};
  payload.f0.data = limbs; payload.f0.length = 5; payload.f0.negative = 1;
  payload.f1.data = bytes; payload.f1.length = 3;
  return (native_Bundle){.f0 = tickets[0], .f1 = &option, .f2 = &peers, .f3 = &history, .f4 = &payload};
}
static void check_bundle(const native_Bundle *value) {
  assert(value->f0.token == identity && value->f1->tag == 1 && value->f1->f0.token == identity + 1);
  assert(value->f2->length == 2 && value->f2->data[0].token == identity && value->f2->data[1].token == identity + 1);
  assert(value->f3->length == 2 && value->f3->data[1].token == identity + 1);
  assert(value->f4->f0.negative == 1 && value->f4->f0.length == 5 && value->f4->f0.data[4] == 4);
  assert(value->f4->f1.length == 3 && value->f4->f1.data[1] == 255);
}
static void valid_values(void) {
  native_Bundle value = bundle();
  ROUNDTRIP(Bundle, value, check_bundle(&decoded); assert(decoded.f4 != value.f4 && decoded.f4->f0.data != value.f4->f0.data));
  native_Option option = {.tag = 0, .f0 = {.token = 0}};
  ROUNDTRIP(Option, option, assert(decoded.tag == 0));
  native_Result result = {.tag = 0, .f0 = &value, .f1 = {.token = 0}};
  ROUNDTRIP(Result, result, assert(decoded.tag == 0); check_bundle(decoded.f0));
  result = (native_Result){.tag = 1, .f0 = NULL, .f1 = {.token = identity}};
  ROUNDTRIP(Result, result, assert(decoded.tag == 1 && decoded.f1.token == identity));
  native_TupleInner inner = {.f0 = &option, .f1 = value.f4};
  native_Tuple tuple = {.f0 = value.f0, .f1 = &inner};
  ROUNDTRIP(Tuple, tuple, assert(decoded.f0.token == identity && !decoded.f1->f0->tag));
  native_Choice choice = {.tag = 0};
  ROUNDTRIP(Choice, choice, assert(decoded.tag == 0));
  choice.tag = 2; choice.cases.c2.f0 = value.f0; choice.cases.c2.f1 = value.f0;
  ROUNDTRIP(Choice, choice, assert(decoded.tag == 2 && decoded.cases.c2.f1.token == identity));
  native_Tree leaves[2] = {{.tag = 0, .cases.c0.f0 = value.f0}, {.tag = 0, .cases.c0.f0 = value.f0}};
  native_TreeArray children = {.data = leaves, .length = 2};
  native_Tree tree = {.tag = 1, .cases.c1.f0 = &children};
  ROUNDTRIP(Tree, tree, assert(decoded.tag == 1 && decoded.cases.c1.f0->length == 2 && decoded.cases.c1.f0->data[1].cases.c0.f0.token == identity));
  native_Callback callback = {.token = identity + 17};
  ROUNDTRIP(Callback, callback, assert(decoded.token == identity + 17));
}
#define SCALAR(Name, value) do { native_Scalar_##Name original = value; ROUNDTRIP(Scalar_##Name, original, assert(decoded == original)); } while (0)
static void scalar_values(void) {
  SCALAR(unit, 0); SCALAR(bool, 1); SCALAR(char, 0x1f33f);
  SCALAR(uint8, UINT8_MAX); SCALAR(uint16, UINT16_MAX); SCALAR(uint32, UINT32_MAX); SCALAR(uint64, UINT64_MAX);
  SCALAR(int8, INT8_MIN); SCALAR(int16, INT16_MIN); SCALAR(int32, INT32_MIN); SCALAR(int64, INT64_MIN);
  SCALAR(usize, UINT64_MAX); SCALAR(isize, INT64_MIN);
  native_Scalar_float32 narrow = -0.0f; ROUNDTRIP(Scalar_float32, narrow, assert(signbit(decoded)));
  native_Scalar_float64 wide = INFINITY; ROUNDTRIP(Scalar_float64, wide, assert(isinf(decoded)));
  wide = NAN; ROUNDTRIP(Scalar_float64, wide, assert(isnan(decoded)));
  const uint32_t limbs[] = {1, 0, 0, 4};
  native_Scalar_nat natural = {.data = limbs, .length = 4};
  ROUNDTRIP(Scalar_nat, natural, assert(decoded.length == 4 && decoded.data[3] == 4 && decoded.data != limbs));
  native_Scalar_int integer = {.data = limbs, .length = 4, .negative = 1};
  ROUNDTRIP(Scalar_int, integer, assert(decoded.negative && decoded.length == 4 && decoded.data[0] == 1));
  const char text[] = "NUL\0λ🙂"; native_Scalar_string string = {.data = text, .length = sizeof(text) - 1};
  ROUNDTRIP(Scalar_string, string, assert(decoded.data != text && decoded.length == string.length && !memcmp(decoded.data, text, string.length)));
  const uint8_t bytes[] = {0, 255, 1}; native_Scalar_bytes binary = {.data = bytes, .length = 3};
  ROUNDTRIP(Scalar_bytes, binary, assert(decoded.data != bytes && decoded.length == 3 && decoded.data[1] == 255));
}
static void output_failures(void) {
  native_Bundle value = bundle();
  bool exhausted = false;
  for (long failure = 0; failure < 200; ++failure) {
    ow_scope output = scope(); wasmtime_component_val_t encoded = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 99};
    allocation_failure = failure;
    bool success = ENCODE_Bundle(output)(&value, &output, &encoded);
    allocation_failure = -1;
    if (success) ow_value_delete(&output, &encoded);
    else { assert(encoded.kind == WASMTIME_COMPONENT_U32 && encoded.of.u32 == 99); ++scratch_failures; ++output_allocation_sites; }
    close_scope(&output); assert(live_allocations == 0 && live_resources == 0);
    if (success) { assert((size_t)failure == output_allocation_sites); exhausted = true; break; }
  }
  assert(exhausted);
  for (size_t budget = 0; budget < 20000; budget += 37) {
    ow_scope output = scope(); output.memory.remaining = budget;
    wasmtime_component_val_t encoded = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 99};
    if (ENCODE_Bundle(output)(&value, &output, &encoded)) ow_value_delete(&output, &encoded);
    else { assert(encoded.kind == WASMTIME_COMPONENT_U32 && encoded.of.u32 == 99); ++budget_failures; }
    close_scope(&output); assert(live_allocations == 0 && live_resources == 0);
  }
  for (identity_failure = 0; identity_failure < 6; ) {
    long failure = identity_failure; ow_scope output = scope(); wasmtime_component_val_t encoded = {0};
    assert(!ENCODE_Bundle(output)(&value, &output, &encoded));
    close_scope(&output); assert(live_allocations == 0 && live_resources == 0); ++identity_failures;
    identity_failure = failure + 1;
  }
  identity_failure = -1;
  fail_after_identity_write = true;
  ow_scope failed_write = scope(); wasmtime_component_val_t unchanged = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 99};
  assert(!ENCODE_Bundle(output)(&value, &failed_write, &unchanged));
  assert(unchanged.kind == WASMTIME_COMPONENT_U32 && unchanged.of.u32 == 99);
  close_scope(&failed_write); assert(!live_allocations && !live_resources); ++identity_failures;
  fail_after_identity_write = false;
  native_Option bad_option = {.tag = 2}; ow_scope s = scope(); wasmtime_component_val_t out = {0};
  assert(!ENCODE_Option(output)(&bad_option, &s, &out)); close_scope(&s); ++malformed_outputs;
  native_Tree cycle = {.tag = 1}; native_TreeArray children = {.data = &cycle, .length = 1}; cycle.cases.c1.f0 = &children;
  s = scope(); assert(!ENCODE_Tree(output)(&cycle, &s, &out)); close_scope(&s); ++malformed_outputs;
  native_Choice bad_choice = {.tag = UINT32_MAX}; s = scope();
  assert(!ENCODE_Choice(output)(&bad_choice, &s, &out)); close_scope(&s); ++malformed_outputs;
  native_Ticket empty = {0}; s = scope(); assert(!ENCODE_Ticket(output)(&empty, &s, &out)); close_scope(&s); ++malformed_outputs;
  assert(live_allocations == 0 && live_resources == 0);
}
static void reject_bundle(wasmtime_component_val_t *encoded) {
  ow_scope input = scope(); native_Bundle value, before; memset(&value, 0xa5, sizeof(value)); memcpy(&before, &value, sizeof(value));
  assert(!DECODE_Bundle(input)(encoded, &input, &value)); assert(!memcmp(&before, &value, sizeof(value)));
  close_scope(&input); ++malformed_inputs;
}
static void input_failures(void) {
  native_Bundle value = bundle(); ow_scope output = scope(); wasmtime_component_val_t encoded = {0};
  assert(ENCODE_Bundle(input)(&value, &output, &encoded)); close_scope(&output);
  size_t owners = live_resources;
  bool exhausted = false;
  for (long failure = 0; failure < 200; ++failure) {
    ow_scope input = scope(); native_Bundle decoded, before; memset(&decoded, 0xa5, sizeof(decoded)); memcpy(&before, &decoded, sizeof(decoded));
    allocation_failure = failure; bool success = DECODE_Bundle(input)(&encoded, &input, &decoded); allocation_failure = -1;
    if (!success) { assert(!memcmp(&before, &decoded, sizeof(decoded))); ++scratch_failures; ++input_allocation_sites; }
    else check_bundle(&decoded);
    close_scope(&input); assert(!live_allocations && live_resources == owners);
    if (success) { assert((size_t)failure == input_allocation_sites); exhausted = true; break; }
  }
  assert(exhausted);
  for (size_t budget = 0; budget < 20000; budget += 71) {
    ow_scope input = scope(); input.memory.remaining = budget;
    native_Bundle decoded, before; memset(&decoded, 0xa5, sizeof(decoded)); memcpy(&before, &decoded, sizeof(decoded));
    if (!DECODE_Bundle(input)(&encoded, &input, &decoded)) { assert(!memcmp(&before, &decoded, sizeof(decoded))); ++budget_failures; }
    else check_bundle(&decoded);
    close_scope(&input); assert(!live_allocations && live_resources == owners);
  }
  uint32_t *root = &encoded.of.record.data[0].val.of.record.data[0].val.of.u32;
  uint32_t saved = *root; *root = UINT32_MAX; reject_bundle(&encoded); *root = saved;
  wasmtime_component_val_t *row = table_row(&encoded, INDEX_Bundle, 0);
  uint8_t kind = row->kind; row->kind = WASMTIME_COMPONENT_U32; reject_bundle(&encoded); row->kind = kind;
  size_t count = row->of.record.size; --row->of.record.size; reject_bundle(&encoded); row->of.record.size = count;
  char first = row->of.record.data[0].name.data[0]; row->of.record.data[0].name.data[0] = '?'; reject_bundle(&encoded); row->of.record.data[0].name.data[0] = first;
  wasmtime_component_val_t *option = table_row(&encoded, INDEX_Option, 0);
  kind = option->kind; option->kind = WASMTIME_COMPONENT_U32; reject_bundle(&encoded); option->kind = kind;
  kind = row->of.record.data[0].val.kind; row->of.record.data[0].val.kind = WASMTIME_COMPONENT_U64; reject_bundle(&encoded); row->of.record.data[0].val.kind = kind;
  size_t old_type = ledger[0].type; ledger[0].type = INDEX_Callback; reject_bundle(&encoded); ledger[0].type = old_type;
  ledger[0].borrowed = false; reject_bundle(&encoded); ledger[0].borrowed = true;
  wasmtime_component_val_t *arena = &encoded.of.record.data[1].val;
  wasmtime_component_vallist_t *table = &arena->of.record.data[0].val.of.list;
  count = table->size; table->size = OW_NODES + 1; reject_bundle(&encoded); table->size = count;
  for (size_t i = 0; i < arena->of.record.size; ++i) {
    char name[32]; snprintf(name, sizeof(name), "nodes%zu", (size_t)INDEX_Payload);
    if (!lb_name(&arena->of.record.data[i].name, name)) continue;
    wasmtime_component_vallist_t *rows = &arena->of.record.data[i].val.of.list, prior = *rows, extra;
    wasmtime_component_vallist_new_uninit(&extra, prior.size + 1);
    memcpy(extra.data, prior.data, prior.size * sizeof(*prior.data));
    wasmtime_component_val_clone(&prior.data[0], &extra.data[prior.size]);
    *rows = extra; reject_bundle(&encoded); *rows = prior;
    memset(extra.data, 0, prior.size * sizeof(*prior.data)); wasmtime_component_vallist_delete(&extra);
    break;
  }
  ow_scope exhausted_input = scope(); exhausted_input.visits = 0; native_Bundle untouched = {0};
  assert(!DECODE_Bundle(input)(&encoded, &exhausted_input, &untouched)); close_scope(&exhausted_input); ++malformed_inputs;
  assert(live_resources == owners); ow_value_delete(&output, &encoded);
  assert(!live_allocations && !live_resources);
  native_Tree leaf = {.tag = 0, .cases.c0.f0 = value.f0};
  native_TreeArray children = {.data = &leaf, .length = 1};
  native_Tree tree = {.tag = 1, .cases.c1.f0 = &children};
  output = scope(); assert(ENCODE_Tree(input)(&tree, &output, &encoded)); close_scope(&output);
  wasmtime_component_val_t *children_row = table_row(&encoded, INDEX_TreeArray, 0);
  uint32_t *child_index = &children_row->of.list.data[0].of.record.data[0].val.of.u32;
  saved = *child_index; *child_index = 0;
  ow_scope cycle_input = scope(); native_Tree decoded = {0};
  assert(!DECODE_Tree(input)(&encoded, &cycle_input, &decoded)); ++malformed_inputs;
  close_scope(&cycle_input); *child_index = saved;
  ow_value_delete(&output, &encoded); assert(!live_allocations && !live_resources);
}
static wasmtime_error_t *probe(void *data, wasmtime_context_t *call_context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *out, size_t result_count) {
  (void)data; (void)type; (void)args; assert(count == 0 && result_count == 1);
  context = call_context;
  valid_values(); scalar_values(); output_failures(); input_failures();
  *out = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 42};
  return NULL;
}
int main(void) {
  wasm_config_t *config = wasm_config_new(); wasmtime_config_wasm_component_model_set(config, true);
  wasm_engine_t *engine = wasm_engine_new_with_config(config);
  wasmtime_store_t *store = wasmtime_store_new(engine, NULL, NULL); context = wasmtime_store_context(store);
  wasmtime_component_t *component = NULL; ok(wasmtime_component_new(engine, driver, sizeof(driver), &component));
  wasmtime_component_linker_t *linker = wasmtime_component_linker_new(engine);
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker);
  ok(wasmtime_component_linker_instance_add_func(root, "probe", 5, probe, NULL, NULL));
  wasmtime_component_linker_instance_delete(root);
  wasmtime_component_instance_t instance; ok(wasmtime_component_linker_instantiate(linker, context, component, &instance));
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&instance, context, NULL, "run", 3);
  assert(index); wasmtime_component_func_t run; assert(wasmtime_component_instance_get_func(&instance, context, index, &run));
  wasmtime_component_export_index_delete(index);
  wasmtime_component_val_t result = {0}; ok(wasmtime_component_func_call(&run, context, NULL, 0, &result, 1));
  assert(result.kind == WASMTIME_COMPONENT_U32 && result.of.u32 == 42); wasmtime_component_val_delete(&result);
  wasmtime_component_linker_delete(linker); wasmtime_store_delete(store);
  wasmtime_component_delete(component); wasm_engine_delete(engine);
  printf("{\"roundtrips\":%zu,\"scalars\":19,\"created\":%zu,\"dropped\":%zu,\"liveResources\":%zu,\"liveAllocations\":%zu,\"scratchFailures\":%zu,\"budgetFailures\":%zu,\"malformedInputs\":%zu,\"malformedOutputs\":%zu,\"identityFailures\":%zu,\"inputAllocationSites\":%zu,\"outputAllocationSites\":%zu}\n",
    roundtrips, created, dropped, live_resources, live_allocations, scratch_failures, budget_failures, malformed_inputs, malformed_outputs, identity_failures, input_allocation_sites, output_allocation_sites);
  return 0;
}
