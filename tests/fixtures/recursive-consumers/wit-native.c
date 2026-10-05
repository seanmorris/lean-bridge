#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "recursive_wasmtime.h"
/* GENERATED_TYPES */

static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data); abort();
}
static void failed(wasmtime_error_t *error) { assert(error); wasmtime_error_delete(error); }
static recursive_scalars_t scalars(void) {
  static const uint32_t limbs[] = {1, 0, 0, 0, 1};
  static const uint8_t bytes[] = {0, 255, 1};
  recursive_scalars_t value = {0};
  value.bool_ = true; value.u8 = UINT8_MAX; value.u16 = UINT16_MAX; value.u32 = UINT32_MAX; value.u64 = UINT64_MAX;
  value.i8 = INT8_MIN; value.i16 = INT16_MIN; value.i32 = INT32_MIN; value.i64 = INT64_MIN;
  value.natural.data = limbs; value.natural.length = 5;
  value.integer.data = limbs; value.integer.length = 5; value.integer.negative = true;
  value.f32 = 1.5f; value.f64 = -2.25;
  value.text.data = "A\0🌱"; value.text.length = 6; value.bytes.data = bytes; value.bytes.length = 3;
  value.char_ = 0x1f331; value.word = UINT32_MAX; value.signed_word = INT32_MIN;
  return value;
}
int main(void) {
  recursive_wasmtime *session = NULL; ok(recursive_wasmtime_open(&session));
  recursive_scalars_t input = scalars(), retained = {0};
  ok(recursive_wasmtime_value_scalars(session, &input, &retained));
  assert(retained._bridge_owner && retained.natural.data != input.natural.data && retained.text.data != input.text.data);
  bool inspected = false; ok(recursive_wasmtime_value_inspect(session, &retained, &inspected)); assert(inspected);
  uint64_t word = UINT64_MAX; int64_t signed_word = INT64_MIN;
  bool matches = false; ok(recursive_wasmtime_value_word_max(session, &word, &matches)); assert(matches);
  matches = false; ok(recursive_wasmtime_value_signed_min(session, &signed_word, &matches)); assert(matches);

  recursive_spine_t leaf = {.kind = 1, .cases.leaf.value = 71}, grown = {0};
  ok(recursive_wasmtime_value_grow(session, &leaf, &grown));
  assert(grown.kind == 0 && grown.cases.next.value->kind == 1 && grown.cases.next.value->cases.leaf.value == 71);
  recursive_spine_t_clear(&grown);
  recursive_tree_t left = {.kind = 1, .cases.leaf.payload = input}, empty = {0}, joined = {0};
  ok(recursive_wasmtime_value_empty(session, &empty)); assert(empty.kind == 0 && empty.cases.branch.children.length == 0);
  ok(recursive_wasmtime_value_join_trees(session, &left, &empty, &joined));
  assert(joined.kind == 0 && joined.cases.branch.children.length == 2);
  assert(joined.cases.branch.children.data[0].cases.leaf.payload.natural.data[4] == 1);
  native_Forest forest = {.data = joined.cases.branch.children.data, .length = 2};
  native_Forest forest_result = {0}; ok(recursive_wasmtime_value_forest(session, &forest, &forest_result));
  assert(forest_result.data != forest.data && forest_result.length == 2);
  native_Outcome outcome = {.is_ok = 1, .ok = {.fst = left, .snd = empty}};
  recursive_envelope_t envelope = {.tree = left, .outcome = &outcome};
  envelope.alternatives.data = &forest; envelope.alternatives.length = 1;
  envelope.fallback.has_value = 1; envelope.fallback.value = empty;
  for (size_t marker = 0; marker < 3; ++marker) {
    envelope.marker.has_value = marker != 0; envelope.marker.value.has_value = marker == 2;
    recursive_envelope_t result = {0}; ok(recursive_wasmtime_value_envelope(session, &envelope, &result));
    assert(result.outcome->is_ok && result.outcome != &outcome);
    assert(result.marker.has_value == (marker != 0));
    if (marker) assert(result.marker.value.has_value == (marker == 2));
    recursive_envelope_t_clear(&result);
  }
  recursive_left_tree_t mutual_leaf = {.kind = 1, .cases.leaf.value = 37};
  recursive_right_tree_t mutual = {.kind = 0}, mutual_result = {0};
  mutual.cases.many.lefts.data = &mutual_leaf; mutual.cases.many.lefts.length = 1;
  ok(recursive_wasmtime_value_right(session, &mutual, &mutual_result));
  assert(mutual_result.cases.many.lefts.data[0].cases.leaf.value == 37); recursive_right_tree_t_clear(&mutual_result);
  recursive_marker_t marker = {.kind = 1}, marker_result = {0};
  ok(recursive_wasmtime_value_marker(session, &marker, &marker_result)); assert(marker_result.kind == 1); recursive_marker_t_clear(&marker_result);
  recursive_empty_record_t record = {0}, record_result = {0};
  ok(recursive_wasmtime_value_empty_record(session, &record, &record_result)); recursive_empty_record_t_clear(&record_result);
  uint8_t unit_values[] = {0, 0, 0}; native_Units units = {.data = unit_values, .length = 3}, unit_result = {0};
  ok(recursive_wasmtime_value_units(session, &units, &unit_result)); assert(unit_result.length == 3);
  if (unit_result._bridge_owner) unit_result._bridge_release(unit_result._bridge_owner);
  recursive_wide_t wide_leaf = {.kind = 1, .cases.leaf.value = 9}, wide = {.kind = 0}, wide_result = {0};
  wide.cases.next.field254 = 254; wide.cases.next.child = &wide_leaf;
  ok(recursive_wasmtime_value_wide(session, &wide, &wide_result));
  assert(wide_result.cases.next.field254 == 254 && wide_result.cases.next.child->cases.leaf.value == 9); recursive_wide_t_clear(&wide_result);

  recursive_spine_t sentinel = {.kind = 55}, unchanged = sentinel, cycle = {.kind = 0}; cycle.cases.next.value = &cycle;
  failed(recursive_wasmtime_value_spine(session, &cycle, &unchanged)); assert(unchanged.kind == 55);
  recursive_spine_t deep[128]; memset(deep, 0, sizeof(deep));
  for (size_t i = 0; i < 127; ++i) deep[i].cases.next.value = &deep[i + 1];
  deep[127].kind = 1;
  failed(recursive_wasmtime_value_grow(session, &deep[0], &unchanged)); assert(unchanged.kind == 55);
  ok(recursive_wasmtime_value_grow(session, &leaf, &grown)); assert(grown.kind == 0); recursive_spine_t_clear(&grown);
  if (forest_result._bridge_owner) forest_result._bridge_release(forest_result._bridge_owner);
  recursive_tree_t_clear(&joined); recursive_tree_t_clear(&empty);
  recursive_wasmtime_close(session);
  assert(retained.text.length == 6 && memcmp(retained.text.data, "A\0🌱", 6) == 0 && retained.integer.data[4] == 1);
  recursive_scalars_t_clear(&retained); recursive_scalars_t_clear(&retained);
  puts("{\"scalarTypes\":19,\"mixedValues\":true,\"growth\":true,\"join\":true,\"words64\":true,\"independentResult\":true,\"invalidInput\":true,\"trapRecovery\":true}");
}
