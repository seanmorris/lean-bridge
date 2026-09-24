#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wasmtime.h>
#include "graph.h"

static long allocation_failure = -1;
static size_t live_allocations;
static void *scratch_calloc(size_t count, size_t width) {
  if (allocation_failure == 0) return NULL;
  if (allocation_failure > 0) --allocation_failure;
  void *value = calloc(count, width);
  if (value) ++live_allocations;
  return value;
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

static size_t roundtrips, malformed_inputs, malformed_outputs;
static size_t scratch_failures, input_budget_failures, output_budget_failures;
static lb_graph_scope scope(void) {
  return (lb_graph_scope){.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
}
static void close_scope(lb_graph_scope *scope) { lb_scope_close(&scope->memory); }
static wasmtime_component_val_t *row(wasmtime_component_val_t *value, size_t table, size_t index) {
  return &value->of.record.data[1].val.of.record.data[table].val.of.list.data[index];
}
static wasmtime_component_val_t *reference(wasmtime_component_val_t *value) {
  return &value->of.record.data[0].val;
}
static uint32_t *index_of(wasmtime_component_val_t *value) {
  return &value->of.record.data[0].val.of.u32;
}
static void resize_table(wasmtime_component_vallist_t *table, size_t count) {
  wasmtime_component_vallist_t replacement;
  wasmtime_component_vallist_new_uninit(&replacement, count);
  if (count) memset(replacement.data, 0, count * sizeof(*replacement.data));
  for (size_t i = 0; i < count && i < table->size; ++i) {
    replacement.data[i] = table->data[i]; table->data[i] = (wasmtime_component_val_t){0};
  }
  wasmtime_component_vallist_delete(table); *table = replacement;
}
static native_Scalars scalar_value(void) {
  static const uint32_t limbs[] = {1, 0, 0, 1};
  static const uint8_t bytes[] = {0, 255, 17};
  static const char text[] = "a\0λ🌿";
  native_Scalars result = {0};
  result.bool_ = true; result.u8 = UINT8_MAX; result.u16 = UINT16_MAX;
  result.u32 = UINT32_MAX; result.u64 = UINT64_MAX;
  result.i8 = INT8_MIN; result.i16 = INT16_MIN; result.i32 = INT32_MIN; result.i64 = INT64_MIN;
  result.natural.data = limbs; result.natural.length = 4;
  result.integer.data = limbs; result.integer.length = 4; result.integer.negative = true;
  result.f32 = -0.0f; result.f64 = INFINITY;
  result.text.data = text; result.text.length = sizeof(text) - 1;
  result.bytes.data = bytes; result.bytes.length = sizeof(bytes);
  result.char_ = 0x1f33f; result.word = UINT64_MAX; result.signed_word = INT64_MIN;
  return result;
}
static void check_scalars(const native_Scalars *value) {
  assert(value->unit == 0 && value->bool_ && value->u8 == UINT8_MAX && value->u16 == UINT16_MAX);
  assert(value->u32 == UINT32_MAX && value->u64 == UINT64_MAX && value->i8 == INT8_MIN);
  assert(value->i16 == INT16_MIN && value->i32 == INT32_MIN && value->i64 == INT64_MIN);
  assert(value->natural.length == 4 && value->natural.data[3] == 1);
  assert(value->integer.negative && value->integer.length == 4 && value->integer.data[0] == 1);
  assert(signbit(value->f32) && isinf(value->f64));
  assert(value->text.length == 8 && memcmp(value->text.data, "a\0λ🌿", 8) == 0);
  assert(value->bytes.length == 3 && value->bytes.data[1] == 255);
  assert(value->char_ == 0x1f33f && value->word == UINT64_MAX && value->signed_word == INT64_MIN);
}
#define ROUNDTRIP(Name, original, checks) do { \
  lb_graph_scope output_scope = scope(); \
  wasmtime_component_val_t encoded = {0}; \
  assert(OUT_##Name(&(original), &output_scope, &encoded)); \
  close_scope(&output_scope); assert(live_allocations == 0); \
  lb_graph_scope check_scope = scope(); \
  assert(IN_##Name(&encoded, &check_scope, NULL)); close_scope(&check_scope); \
  lb_graph_scope input_scope = scope(); native_##Name decoded = {0}; \
  assert(IN_##Name(&encoded, &input_scope, &decoded)); \
  checks; \
  close_scope(&input_scope); wasmtime_component_val_delete(&encoded); \
  assert(live_allocations == 0); ++roundtrips; \
} while (0)

static void valid_values(void) {
  native_Scalars scalars = scalar_value();
  ROUNDTRIP(Scalars, scalars, check_scalars(&decoded));
  native_Spine leaf = {.kind = 1, .cases.leaf.value = 17};
  native_Spine spine = {.kind = 0, .cases.next.value = &leaf};
  ROUNDTRIP(Spine, spine, assert(decoded.kind == 0 && decoded.cases.next.value != &leaf && decoded.cases.next.value->cases.leaf.value == 17));
  native_Tree leaves[] = {{.kind = 1, .cases.leaf.payload = scalars}, {.kind = 0}};
  native_Tree tree = {.kind = 0}; tree.cases.branch.children.data = leaves; tree.cases.branch.children.length = 2;
  ROUNDTRIP(Tree, tree, assert(decoded.cases.branch.children.length == 2); check_scalars(&decoded.cases.branch.children.data[0].cases.leaf.payload));
  native_Forest forest = {.data = leaves, .length = 2};
  ROUNDTRIP(Forest, forest, assert(decoded.length == 2 && decoded.data != leaves));
  native_Outcome outcome = {.is_ok = 1, .ok = {.fst = leaves[0], .snd = leaves[1]}};
  native_Envelope envelope = {.tree = leaves[0], .outcome = &outcome};
  envelope.alternatives.data = &forest; envelope.alternatives.length = 1;
  envelope.fallback.has_value = 1; envelope.fallback.value = leaves[1];
  envelope.marker.has_value = 1; envelope.marker.value.has_value = 1;
  ROUNDTRIP(Envelope, envelope, assert(decoded.outcome != &outcome && decoded.outcome->is_ok == 1 && decoded.marker.has_value && decoded.marker.value.has_value); check_scalars(&decoded.outcome->ok.fst.cases.leaf.payload));
  outcome.is_ok = 0; outcome.error.data = "failed"; outcome.error.length = 6;
  envelope.marker.value.has_value = 0;
  ROUNDTRIP(Envelope, envelope, assert(!decoded.outcome->is_ok && decoded.outcome->error.length == 6 && decoded.marker.has_value && !decoded.marker.value.has_value));
  envelope.marker.has_value = 0; envelope.fallback.has_value = 0;
  ROUNDTRIP(Envelope, envelope, assert(!decoded.marker.has_value && !decoded.fallback.has_value));
  native_Marker marker = {.kind = 0};
  ROUNDTRIP(Marker, marker, assert(decoded.kind == 0));
  marker.kind = 1;
  ROUNDTRIP(Marker, marker, assert(decoded.kind == 1 && !decoded.cases.unit.value));
  native_Marker next = {.kind = 2, .cases.next.value = &marker};
  ROUNDTRIP(Marker, next, assert(decoded.cases.next.value->kind == 1));
  native_EmptyRecord empty = {0};
  ROUNDTRIP(EmptyRecord, empty, assert(!decoded._bridge_owner));
  uint8_t units[] = {0, 0, 0}; native_Units array = {.data = units, .length = 3};
  ROUNDTRIP(Units, array, assert(decoded.length == 3 && decoded.data[2] == 0));
  native_LeftTree left = {.kind = 1, .cases.leaf.value = 41};
  native_RightTree right = {.kind = 0}; right.cases.many.lefts.data = &left; right.cases.many.lefts.length = 1;
  native_LeftTree mutual = {.kind = 0, .cases.next.right = right};
  ROUNDTRIP(LeftTree, mutual, assert(decoded.cases.next.right.cases.many.lefts.data[0].cases.leaf.value == 41));
  native_Wide last = {.kind = 1, .cases.leaf.value = 99}, wide = {.kind = 0};
  wide.cases.next.field0 = 0; wide.cases.next.field254 = 254; wide.cases.next.child = &last;
  ROUNDTRIP(Wide, wide, assert(decoded.cases.next.field254 == 254 && decoded.cases.next.child->cases.leaf.value == 99));
}

static void invalid_inputs(void) {
  native_Spine leaf = {.kind = 1, .cases.leaf.value = 17}, source = {.kind = 0, .cases.next.value = &leaf};
  lb_graph_scope output_scope = scope(); wasmtime_component_val_t encoded = {0};
  assert(OUT_Spine(&source, &output_scope, &encoded)); close_scope(&output_scope);
  native_Spine sentinel = {.kind = 99}, target;
#define BAD_INPUT() do { \
  lb_graph_scope input_scope = scope(); target = sentinel; \
  assert(!IN_Spine(&encoded, &input_scope, &target)); \
  assert(memcmp(&target, &sentinel, sizeof(target)) == 0); close_scope(&input_scope); \
  input_scope = scope(); assert(!IN_Spine(&encoded, &input_scope, NULL)); close_scope(&input_scope); \
  assert(!live_allocations); ++malformed_inputs; \
} while (0)
  uint32_t *root = index_of(reference(&encoded));
  *root = UINT32_MAX; BAD_INPUT(); *root = 0;
  wasmtime_component_val_t *first = row(&encoded, TABLE_Spine, 0);
  wasmtime_component_val_t *child = &first->of.variant.val->of.record.data[0].val;
  *index_of(child) = 0; BAD_INPUT(); *index_of(child) = 1;
  *root = 1; BAD_INPUT(); *root = 0; /* Root 0 becomes unreachable. */
  child->of.record.data[0].val.kind = WASMTIME_COMPONENT_S32; BAD_INPUT(); child->of.record.data[0].val.kind = WASMTIME_COMPONENT_U32;
  child->of.record.data[0].name.data[0] = 'z'; BAD_INPUT(); child->of.record.data[0].name.data[0] = 'i';
  first->of.variant.discriminant.data[0] = 'z'; BAD_INPUT(); first->of.variant.discriminant.data[0] = 'n';
  first->of.variant.val->of.record.size = 0; BAD_INPUT(); first->of.variant.val->of.record.size = 1;
  wasmtime_component_val_t *last = row(&encoded, TABLE_Spine, 1);
  last->of.variant.val->of.record.data[0].val.kind = WASMTIME_COMPONENT_U8; BAD_INPUT(); last->of.variant.val->of.record.data[0].val.kind = WASMTIME_COMPONENT_U32;
  wasmtime_component_val_t *table = &encoded.of.record.data[1].val.of.record.data[TABLE_Spine].val;
  size_t count = table->of.list.size; table->of.list.size = SIZE_MAX; BAD_INPUT(); table->of.list.size = count;
  encoded.of.record.data[1].val.of.record.data[TABLE_Spine].name.data[0] = 'z'; BAD_INPUT(); encoded.of.record.data[1].val.of.record.data[TABLE_Spine].name.data[0] = 'n';
  lb_graph_scope input_scope = scope(); input_scope.nodes = 2;
  assert(!IN_Spine(&encoded, &input_scope, &target)); close_scope(&input_scope); ++malformed_inputs;
  for (size_t bytes = 0; bytes < 12000; bytes += 17) {
    input_scope = scope(); input_scope.memory.remaining = bytes; target = sentinel;
    if (!IN_Spine(&encoded, &input_scope, &target)) { assert(memcmp(&target, &sentinel, sizeof(target)) == 0); ++input_budget_failures; }
    close_scope(&input_scope); assert(!live_allocations);
  }
  for (long index = 0; index < 12; ++index) {
    input_scope = scope(); target = sentinel; allocation_failure = index;
    if (!IN_Spine(&encoded, &input_scope, &target)) { ++scratch_failures; assert(memcmp(&target, &sentinel, sizeof(target)) == 0); }
    allocation_failure = -1; close_scope(&input_scope); assert(!live_allocations);
  }
  wasmtime_component_val_delete(&encoded);
#undef BAD_INPUT
}

static void invalid_outputs(void) {
  native_Spine leaf = {.kind = 1, .cases.leaf.value = 7}, source = {.kind = 0, .cases.next.value = &leaf};
  wasmtime_component_val_t sentinel = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 77}, target;
#define BAD_OUTPUT(Name, value) do { \
  lb_graph_scope output_scope = scope(); target = sentinel; \
  assert(!OUT_##Name(&(value), &output_scope, &target)); \
  assert(memcmp(&target, &sentinel, sizeof(target)) == 0); close_scope(&output_scope); \
  assert(!live_allocations); ++malformed_outputs; \
} while (0)
  source.cases.next.value = &source; BAD_OUTPUT(Spine, source);
  source.cases.next.value = NULL; BAD_OUTPUT(Spine, source);
  source.kind = 9; BAD_OUTPUT(Spine, source); source.kind = 0; source.cases.next.value = &leaf;
  native_Never never = {.kind = 0}; never.cases.again.value = &never; BAD_OUTPUT(Never, never);
  native_Scalars scalars = scalar_value(); scalars.char_ = 0xd800; BAD_OUTPUT(Scalars, scalars);
  scalars = scalar_value(); scalars.unit = 1; BAD_OUTPUT(Scalars, scalars);
  scalars = scalar_value(); scalars.integer.length = 0; BAD_OUTPUT(Scalars, scalars);
  scalars = scalar_value(); scalars.text.data = "\xc0\x80"; scalars.text.length = 2; BAD_OUTPUT(Scalars, scalars);
  for (unsigned raw = 2; raw < 256; ++raw) {
    scalars = scalar_value(); uint8_t invalid = raw; memcpy(&scalars.bool_, &invalid, 1);
    BAD_OUTPUT(Scalars, scalars);
  }
  native_Spine deep[129]; memset(deep, 0, sizeof(deep));
  for (size_t i = 0; i < 128; ++i) deep[i].cases.next.value = &deep[i + 1];
  deep[128].kind = 1; BAD_OUTPUT(Spine, deep[0]);
  deep[127].kind = 1;
  ROUNDTRIP(Spine, deep[0], assert(decoded.kind == 0)); --roundtrips;
  lb_graph_scope depth_scope = scope(); wasmtime_component_val_t deep_wire = {0};
  assert(OUT_Spine(&deep[0], &depth_scope, &deep_wire)); close_scope(&depth_scope);
  wasmtime_component_vallist_t *deep_table = &deep_wire.of.record.data[1].val.of.record.data[TABLE_Spine].val.of.list;
  size_t depth_count = deep_table->size;
  resize_table(deep_table, depth_count + 1);
  wasmtime_component_val_clone(&deep_table->data[0], &deep_table->data[depth_count]);
  *index_of(&deep_table->data[depth_count].of.variant.val->of.record.data[0].val) = 0;
  *index_of(reference(&deep_wire)) = (uint32_t)depth_count;
  depth_scope = scope(); assert(!IN_Spine(&deep_wire, &depth_scope, NULL)); close_scope(&depth_scope);
  wasmtime_component_val_delete(&deep_wire); ++malformed_inputs;
  for (size_t bytes = 0; bytes < 16000; bytes += 17) {
    lb_graph_scope output_scope = scope(); output_scope.memory.remaining = bytes; target = sentinel;
    if (!OUT_Spine(&source, &output_scope, &target)) { assert(memcmp(&target, &sentinel, sizeof(target)) == 0); ++output_budget_failures; }
    else wasmtime_component_val_delete(&target);
    close_scope(&output_scope); assert(!live_allocations);
  }
  for (long index = 0; index < 140; ++index) {
    lb_graph_scope output_scope = scope(); target = sentinel; allocation_failure = index;
    if (!OUT_Spine(&deep[0], &output_scope, &target)) { ++scratch_failures; assert(memcmp(&target, &sentinel, sizeof(target)) == 0); }
    else wasmtime_component_val_delete(&target);
    allocation_failure = -1; close_scope(&output_scope); assert(!live_allocations);
  }
#undef BAD_OUTPUT
}

static void shared_dag(void) {
  native_Tree leaves[] = {{.kind = 1, .cases.leaf.payload = scalar_value()}, {.kind = 1, .cases.leaf.payload = scalar_value()}};
  native_Forest forest = {.data = leaves, .length = 2};
  lb_graph_scope output_scope = scope(); wasmtime_component_val_t wire = {0};
  assert(OUT_Forest(&forest, &output_scope, &wire)); close_scope(&output_scope);
  wasmtime_component_val_t *references = row(&wire, TABLE_Forest, 0);
  *index_of(&references->of.list.data[1]) = 0;
  resize_table(&wire.of.record.data[1].val.of.record.data[TABLE_Tree].val.of.list, 1);
  resize_table(&wire.of.record.data[1].val.of.record.data[TABLE_Scalars].val.of.list, 1);
  lb_graph_scope input_scope = scope(); native_Forest decoded = {0}; input_scope.nodes = 43;
  assert(IN_Forest(&wire, &input_scope, &decoded) && input_scope.nodes == 0);
  assert(decoded.length == 2 && decoded.data[0].cases.leaf.payload.natural.data != decoded.data[1].cases.leaf.payload.natural.data);
  check_scalars(&decoded.data[0].cases.leaf.payload); check_scalars(&decoded.data[1].cases.leaf.payload);
  close_scope(&input_scope);
  input_scope = scope(); input_scope.nodes = 42;
  assert(!IN_Forest(&wire, &input_scope, NULL)); close_scope(&input_scope); ++malformed_inputs;
  wasmtime_component_val_delete(&wire); assert(!live_allocations);
}

int main(void) {
  valid_values(); invalid_inputs(); invalid_outputs(); shared_dag();
  assert(!live_allocations);
  printf("{\"roundtrips\":%zu,\"scalarTypes\":19,\"malformedInputs\":%zu,\"malformedOutputs\":%zu,\"scratchFailures\":%zu,\"inputBudgetFailures\":%zu,\"outputBudgetFailures\":%zu,\"liveAllocations\":%zu}\n", roundtrips, malformed_inputs, malformed_outputs, scratch_failures, input_budget_failures, output_budget_failures, live_allocations);
}
