#define _GNU_SOURCE
#include <assert.h>
#include <link.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "recursive_wasmtime.h"

static unsigned checks, calls, rejections;
#define CHECK(value) do { ++checks; assert(value); } while (0)
static void ok(wasmtime_error_t *error) {
  ++calls;
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data); abort();
}
static void failed(wasmtime_error_t *error) {
  CHECK(error != NULL); ++rejections; wasmtime_error_delete(error);
}
static int loaded(struct dl_phdr_info *info, size_t size, void *raw) {
  (void)size; bool *comma = raw;
  if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  fputc('"', stdout);
  for (const unsigned char *p = (const unsigned char *)info->dlpi_name; *p; ++p) {
    if (*p == '"' || *p == '\\') fputc('\\', stdout);
    if (*p < 32) printf("\\u%04x", *p); else fputc(*p, stdout);
  }
  fputc('"', stdout); *comma = true; return 0;
}
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
  CHECK(retained._bridge_owner && retained.natural.data != input.natural.data && retained.text.data != input.text.data);
  bool inspected = false; ok(recursive_wasmtime_value_inspect(session, &retained, &inspected)); CHECK(inspected);
  uint64_t word = UINT64_MAX; int64_t signed_word = INT64_MIN;
  bool matches = false; ok(recursive_wasmtime_value_word_max(session, &word, &matches)); CHECK(matches);
  matches = false; ok(recursive_wasmtime_value_signed_min(session, &signed_word, &matches)); CHECK(matches);
  word = 0; signed_word = 0;
  ok(recursive_wasmtime_value_word_max(session, &word, &matches)); CHECK(!matches);
  ok(recursive_wasmtime_value_signed_min(session, &signed_word, &matches)); CHECK(!matches);
  const double floating[] = {0., -0., INFINITY, -INFINITY, NAN};
  for (size_t i = 0; i < sizeof(floating) / sizeof(*floating); ++i) {
    recursive_scalars_t value = input, result = {0}; value.f32 = (float)floating[i]; value.f64 = floating[i];
    ok(recursive_wasmtime_value_scalars(session, &value, &result));
    if (isnan(value.f64)) { CHECK(isnan(result.f32)); CHECK(isnan(result.f64)); }
    else { CHECK(result.f32 == value.f32 && result.f64 == value.f64); CHECK(!!signbit(result.f32) == !!signbit(value.f32)); CHECK(!!signbit(result.f64) == !!signbit(value.f64)); }
    recursive_scalars_t_clear(&result);
  }
  recursive_scalars_t zero = input, zero_result = {0};
  zero.natural.length = 0; zero.natural.data = NULL; zero.integer.length = 0; zero.integer.data = NULL; zero.integer.negative = false;
  zero.text.length = 0; zero.text.data = NULL; zero.bytes.length = 0; zero.bytes.data = NULL;
  ok(recursive_wasmtime_value_scalars(session, &zero, &zero_result));
  CHECK(!zero_result.natural.length && !zero_result.integer.length && !zero_result.integer.negative && !zero_result.text.length && !zero_result.bytes.length);
  recursive_scalars_t_clear(&zero_result);

  recursive_spine_t leaf = {.kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 71}, grown = {0};
  ok(recursive_wasmtime_value_grow(session, &leaf, &grown));
  CHECK(grown.kind == RECURSIVE_SPINE_T_KIND_NEXT && grown.cases.next.value->kind == RECURSIVE_SPINE_T_KIND_LEAF && grown.cases.next.value->cases.leaf.value == 71);
  recursive_spine_t result_spine = {0}; ok(recursive_wasmtime_value_spine(session, &grown, &result_spine));
  CHECK(result_spine.cases.next.value != grown.cases.next.value && result_spine.cases.next.value->cases.leaf.value == 71);
  recursive_spine_t_clear(&result_spine); recursive_spine_t_clear(&grown);
  recursive_tree_t left = {.kind = RECURSIVE_TREE_T_KIND_LEAF, .cases.leaf.payload = input}, empty = {0}, joined = {0};
  ok(recursive_wasmtime_value_empty(session, &empty)); CHECK(empty.kind == RECURSIVE_TREE_T_KIND_BRANCH && empty.cases.branch.children.length == 0);
  ok(recursive_wasmtime_value_join_trees(session, &left, &empty, &joined));
  CHECK(joined.kind == RECURSIVE_TREE_T_KIND_BRANCH && joined.cases.branch.children.length == 2);
  CHECK(joined.cases.branch.children.data[0].cases.leaf.payload.natural.data[4] == 1);
  recursive_tree_t result_tree = {0}; ok(recursive_wasmtime_value_tree(session, &joined, &result_tree));
  CHECK(result_tree.cases.branch.children.data != joined.cases.branch.children.data);
  recursive_tree_t_clear(&result_tree);
  recursive_forest_t forest = {.data = joined.cases.branch.children.data, .length = 2}, forest_result = {0};
  ok(recursive_wasmtime_value_forest(session, &forest, &forest_result)); CHECK(forest_result.data != forest.data && forest_result.length == 2);
  recursive_forest_t_clear(&forest_result);
  recursive_forest_t no_trees = {0}; ok(recursive_wasmtime_value_forest(session, &no_trees, &forest_result));
  CHECK(forest_result.length == 0); recursive_forest_t_clear(&forest_result);
  recursive_envelope_outcome_t outcome = {.is_ok = 1, .ok = {.fst = left, .snd = empty}};
  recursive_envelope_t envelope = {.tree = left, .outcome = &outcome};
  envelope.alternatives.data = &forest; envelope.alternatives.length = 1;
  envelope.fallback.has_value = 1; envelope.fallback.value = empty;
  for (size_t marker = 0; marker < 3; ++marker) {
    envelope.marker.has_value = marker != 0; envelope.marker.value.has_value = marker == 2;
    recursive_envelope_t result = {0}; ok(recursive_wasmtime_value_envelope(session, &envelope, &result));
    CHECK(result.outcome->is_ok && result.outcome != &outcome);
    CHECK(result.marker.has_value == (marker != 0));
    if (marker) CHECK(result.marker.value.has_value == (marker == 2));
    CHECK(result.alternatives.data[0].data[1].cases.branch.children.length == 0);
    recursive_envelope_t_clear(&result);
  }
  outcome.is_ok = 0; outcome.error.data = "problem\0🌱"; outcome.error.length = 12;
  envelope.fallback.has_value = 0;
  recursive_envelope_t error_result = {0}; ok(recursive_wasmtime_value_envelope(session, &envelope, &error_result));
  CHECK(!error_result.outcome->is_ok && !error_result.fallback.has_value);
  CHECK(error_result.outcome->error.length == 12 && memcmp(error_result.outcome->error.data, outcome.error.data, 12) == 0);
  recursive_envelope_t_clear(&error_result);
  recursive_left_tree_t mutual_leaf = {.kind = RECURSIVE_LEFT_TREE_T_KIND_LEAF, .cases.leaf.value = 37};
  recursive_right_tree_t mutual = {.kind = RECURSIVE_RIGHT_TREE_T_KIND_MANY}, mutual_result = {0};
  mutual.cases.many.lefts.data = &mutual_leaf; mutual.cases.many.lefts.length = 1;
  ok(recursive_wasmtime_value_right(session, &mutual, &mutual_result));
  CHECK(mutual_result.cases.many.lefts.data[0].cases.leaf.value == 37); recursive_right_tree_t_clear(&mutual_result);
  recursive_left_tree_t next = {.kind = RECURSIVE_LEFT_TREE_T_KIND_NEXT, .cases.next.right = mutual}, left_result = {0};
  ok(recursive_wasmtime_value_left(session, &next, &left_result));
  CHECK(left_result.cases.next.right.cases.many.lefts.data[0].cases.leaf.value == 37); recursive_left_tree_t_clear(&left_result);
  recursive_marker_t marker = {.kind = RECURSIVE_MARKER_T_KIND_UNIT}, marker_result = {0};
  ok(recursive_wasmtime_value_marker(session, &marker, &marker_result)); CHECK(marker_result.kind == RECURSIVE_MARKER_T_KIND_UNIT); recursive_marker_t_clear(&marker_result);
  marker.kind = RECURSIVE_MARKER_T_KIND_EMPTY;
  ok(recursive_wasmtime_value_marker(session, &marker, &marker_result)); CHECK(marker_result.kind == RECURSIVE_MARKER_T_KIND_EMPTY); recursive_marker_t_clear(&marker_result);
  recursive_marker_t marker_next = {.kind = RECURSIVE_MARKER_T_KIND_NEXT, .cases.next.value = &marker};
  ok(recursive_wasmtime_value_marker(session, &marker_next, &marker_result)); CHECK(marker_result.cases.next.value->kind == RECURSIVE_MARKER_T_KIND_EMPTY); recursive_marker_t_clear(&marker_result);
  recursive_empty_record_t record = {0}, record_result = {0};
  ok(recursive_wasmtime_value_empty_record(session, &record, &record_result)); recursive_empty_record_t_clear(&record_result);
  uint8_t unit_values[] = {0, 0, 0}; recursive_units_argument0_t units = {.data = unit_values, .length = 3}; recursive_units_result_t unit_result = {0};
  ok(recursive_wasmtime_value_units(session, &units, &unit_result)); CHECK(unit_result.length == 3); recursive_units_result_t_clear(&unit_result);
  recursive_wide_t wide_leaf = {.kind = RECURSIVE_WIDE_T_KIND_LEAF, .cases.leaf.value = 9}, wide = {.kind = RECURSIVE_WIDE_T_KIND_NEXT}, wide_result = {0};
  wide.cases.next.field254 = 254; wide.cases.next.child = &wide_leaf;
  ok(recursive_wasmtime_value_wide(session, &wide, &wide_result));
  CHECK(wide_result.cases.next.field254 == 254 && wide_result.cases.next.child->cases.leaf.value == 9); recursive_wide_t_clear(&wide_result);

  recursive_spine_t sentinel = {.kind = UINT32_MAX}, unchanged = sentinel, cycle = {.kind = RECURSIVE_SPINE_T_KIND_NEXT}; cycle.cases.next.value = &cycle;
  failed(recursive_wasmtime_value_spine(session, &cycle, &unchanged)); CHECK(unchanged.kind == UINT32_MAX);
  recursive_never_t impossible = {.kind = RECURSIVE_NEVER_T_KIND_AGAIN}, never_result = {0}; impossible.cases.again.value = &impossible;
  failed(recursive_wasmtime_value_never(session, &impossible, &never_result)); CHECK(!never_result._bridge_owner);
  failed(recursive_wasmtime_value_scalars(session, &input, &retained)); CHECK(retained.natural.length == 5);
  for (unsigned bad = 0; bad < 6; ++bad) {
    recursive_scalars_t value = input, result = {0}; const uint32_t trailing[] = {1, 0};
    if (bad == 0) { value.natural.data = trailing; value.natural.length = 2; }
    if (bad == 1) { value.integer.length = 0; value.integer.data = NULL; value.integer.negative = true; }
    if (bad == 2) value.char_ = 0xd800;
    if (bad == 3) { value.text.data = "\xff"; value.text.length = 1; }
    if (bad == 4) value.bytes.data = NULL;
    if (bad == 5) value.unit = 1;
    failed(recursive_wasmtime_value_scalars(session, &value, &result)); CHECK(!result._bridge_owner);
  }
  wasmtime_component_val_t invalid = {.kind = WASMTIME_COMPONENT_BOOL}, output = {.kind = WASMTIME_COMPONENT_U64, .of.u64 = UINT64_MAX};
  failed(recursive_wasmtime_call(session, "tree", &invalid, 1, &output)); CHECK(output.kind == WASMTIME_COMPONENT_U64 && output.of.u64 == UINT64_MAX);
  recursive_spine_t deep[128]; memset(deep, 0, sizeof(deep));
  for (size_t i = 0; i < 127; ++i) { deep[i].kind = RECURSIVE_SPINE_T_KIND_NEXT; deep[i].cases.next.value = &deep[i + 1]; }
  deep[127].kind = RECURSIVE_SPINE_T_KIND_LEAF;
  failed(recursive_wasmtime_value_grow(session, &deep[0], &unchanged)); CHECK(unchanged.kind == UINT32_MAX);
  ok(recursive_wasmtime_value_grow(session, &leaf, &grown)); CHECK(grown.kind == RECURSIVE_SPINE_T_KIND_NEXT); recursive_spine_t_clear(&grown);
  recursive_tree_t_clear(&joined); recursive_tree_t_clear(&empty);
  recursive_wasmtime_close(session);
  CHECK(retained.text.length == 6 && memcmp(retained.text.data, "A\0🌱", 6) == 0 && retained.integer.data[4] == 1);
  recursive_scalars_t_clear(&retained); recursive_scalars_t_clear(&retained);
  printf("{\"exports\":18,\"scalarTypes\":19,\"checks\":%u,\"calls\":%u,\"rejections\":%u,\"compiledLean\":true,\"independentResult\":true,\"trapRecovery\":true,\"loadedLibraries\":[", checks, calls, rejections);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
}
