/* Public GMP values call freshly compiled Lean exports, not echo substitutes. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static size_t checks, live, attempts, fail_at;
#define CHECK(expression) do { ++checks; if (!(expression)) { fprintf(stderr, "GMP native check failed at %d: %s\n", __LINE__, #expression); abort(); } } while (0)
static void *host_malloc(size_t bytes) { if (++attempts == fail_at) return NULL; void *p = malloc(bytes); if (p) ++live; return p; }
static void host_free(void *p) { CHECK(p && live); --live; free(p); }
#define LB_GMP_GRAPH_MALLOC host_malloc
#define LB_GMP_GRAPH_FREE host_free
#include "recursive-gmp-conversions.h"
#include "recursive-graph.h"
#include "gmp-test-types.h"
extern size_t gmp_native_live, gmp_native_attempts, gmp_native_fail_at, gmp_native_decodes;
static void fill(recursive_gmp_scalars_t *value) {
  value->bool_ = true; value->u8 = UINT8_MAX; value->u16 = UINT16_MAX; value->u32 = UINT32_MAX; value->u64 = UINT64_MAX;
  value->i8 = INT8_MIN; value->i16 = INT16_MIN; value->i32 = INT32_MIN; value->i64 = INT64_MIN;
  mpz_set_ui(value->natural, 1); mpz_mul_2exp(value->natural, value->natural, 128); mpz_add_ui(value->natural, value->natural, 1); mpz_neg(value->integer, value->natural);
  value->f32 = 1.5f; value->f64 = -2.25; value->text.data = "A\0\xf0\x9f\x8c\xb1"; value->text.length = 6;
  static const uint8_t bytes[] = {0, 255, 1}; value->bytes.data = bytes; value->bytes.length = 3;
  value->char_ = 0x1f331; value->word = UINT32_MAX; value->signed_word = INT32_MIN;
}
static void verify(const recursive_gmp_scalars_t *value) {
  bool accepted = false;
  CHECK(!recursive_inspect_gmp_graph(recursive_inspect_graph, value, &accepted)); CHECK(accepted);
  CHECK(value->bool_ && value->u8 == UINT8_MAX && value->u16 == UINT16_MAX && value->u32 == UINT32_MAX && value->u64 == UINT64_MAX);
  CHECK(value->i8 == INT8_MIN && value->i16 == INT16_MIN && value->i32 == INT32_MIN && value->i64 == INT64_MIN);
  mpz_t expected; mpz_init_set_ui(expected, 1); mpz_mul_2exp(expected, expected, 128); mpz_add_ui(expected, expected, 1);
  CHECK(!mpz_cmp(expected, value->natural)); mpz_neg(expected, expected); CHECK(!mpz_cmp(expected, value->integer)); mpz_clear(expected);
  CHECK(value->text.length == 6 && !memcmp(value->text.data, "A\0\xf0\x9f\x8c\xb1", 6));
  CHECK(value->bytes.length == 3 && value->bytes.data[0] == 0 && value->bytes.data[1] == 255 && value->bytes.data[2] == 1);
}
static void values(void) {
  recursive_gmp_scalars_t input, output; recursive_gmp_scalars_t_init(&input); recursive_gmp_scalars_t_init(&output); fill(&input);
  CHECK(!recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &output)); verify(&output);
  CHECK(input.text.data != output.text.data && input.bytes.data != output.bytes.data);
  CHECK(!recursive_scalars_gmp_graph(recursive_scalars_graph, &output, &output)); verify(&output);
  mpz_mul_2exp(input.natural, input.natural, 872); mpz_neg(input.integer, input.natural);
  CHECK(!recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &output));
  CHECK(!mpz_cmp(input.natural, output.natural) && !mpz_cmp(input.integer, output.integer));
  recursive_gmp_scalars_t_clear(&input); recursive_gmp_scalars_t_clear(&output);
  bool accepted = false; uint64_t maximum = UINT64_MAX; int64_t minimum = INT64_MIN;
  CHECK(!recursive_word_max_gmp_graph(recursive_word_max_graph, &maximum, &accepted)); CHECK(accepted);
  CHECK(!recursive_signed_min_gmp_graph(recursive_signed_min_graph, &minimum, &accepted)); CHECK(accepted);
  recursive_gmp_tree_t trees[2], joined, empty;
  for (size_t i = 0; i < 2; ++i) { recursive_gmp_tree_t_init(&trees[i]); CHECK(recursive_gmp_tree_t_select(&trees[i], RECURSIVE_GMP_TREE_T_KIND_LEAF)); fill(&trees[i].cases.leaf.payload); }
  recursive_gmp_tree_t_init(&joined); recursive_gmp_tree_t_init(&empty);
  CHECK(!recursive_empty_gmp_graph(recursive_empty_graph, &empty)); CHECK(empty.kind == RECURSIVE_GMP_TREE_T_KIND_BRANCH && !empty.cases.branch.children.length);
  CHECK(!recursive_join_trees_gmp_graph(recursive_join_trees_graph, &trees[0], &trees[1], &joined));
  CHECK(joined.cases.branch.children.length == 2); verify(&joined.cases.branch.children.data[0].cases.leaf.payload); verify(&joined.cases.branch.children.data[1].cases.leaf.payload);
  CHECK(!recursive_tree_gmp_graph(recursive_tree_graph, &joined, &empty)); CHECK(empty.cases.branch.children.length == 2);
  recursive_gmp_forest_t forest, forest_out; recursive_gmp_forest_t_init(&forest); recursive_gmp_forest_t_init(&forest_out);
  forest.data = trees; forest.length = 2;
  CHECK(!recursive_forest_gmp_graph(recursive_forest_graph, &forest, &forest_out)); CHECK(forest_out.length == 2); verify(&forest_out.data[1].cases.leaf.payload);
  recursive_gmp_envelope_t envelope, envelope_out; recursive_gmp_envelope_t_init(&envelope); recursive_gmp_envelope_t_init(&envelope_out);
  ENVELOPE_OUTCOME outcome = {0}; envelope.outcome = &outcome; outcome.error.data = "expected"; outcome.error.length = 8;
  CHECK(recursive_gmp_tree_t_select(&envelope.tree, RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  envelope.alternatives.data = &forest; envelope.alternatives.length = 1;
  for (unsigned mode = 0; mode < 3; ++mode) {
    envelope.marker.has_value = mode > 0; envelope.marker.value.has_value = mode > 1;
    CHECK(!recursive_envelope_gmp_graph(recursive_envelope_graph, &envelope, &envelope_out));
    CHECK(envelope_out.marker.has_value == (mode > 0) && envelope_out.marker.value.has_value == (mode > 1));
    CHECK(envelope_out.alternatives.length == 1 && envelope_out.alternatives.data[0].length == 2);
    verify(&envelope_out.alternatives.data[0].data[0].cases.leaf.payload);
    CHECK(!envelope_out.outcome->is_ok && envelope_out.outcome->error.length == 8);
  }
  recursive_gmp_envelope_t_clear(&envelope_out); recursive_gmp_envelope_t_clear(&envelope);
  recursive_gmp_forest_t_clear(&forest_out); recursive_gmp_forest_t_clear(&forest);
  recursive_gmp_tree_t_clear(&joined); recursive_gmp_tree_t_clear(&empty);
  for (size_t i = 0; i < 2; ++i) recursive_gmp_tree_t_clear(&trees[i]);
  CHECK(!live && !gmp_native_live);
}
static void structures(void) {
  recursive_gmp_left_tree_t left, left_out, terminal; recursive_gmp_right_tree_t right, right_out;
  recursive_gmp_left_tree_t_init(&left); recursive_gmp_left_tree_t_init(&left_out); recursive_gmp_left_tree_t_init(&terminal);
  recursive_gmp_right_tree_t_init(&right); recursive_gmp_right_tree_t_init(&right_out);
  CHECK(recursive_gmp_left_tree_t_select(&terminal, RECURSIVE_GMP_LEFT_TREE_T_KIND_LEAF)); terminal.cases.leaf.value = 7;
  CHECK(recursive_gmp_right_tree_t_select(&right, RECURSIVE_GMP_RIGHT_TREE_T_KIND_MANY)); right.cases.many.lefts.data = &terminal; right.cases.many.lefts.length = 1;
  CHECK(recursive_gmp_left_tree_t_select(&left, RECURSIVE_GMP_LEFT_TREE_T_KIND_NEXT)); left.cases.next.right = right;
  CHECK(!recursive_left_gmp_graph(recursive_left_graph, &left, &left_out)); CHECK(left_out.cases.next.right.cases.many.lefts.data[0].cases.leaf.value == 7);
  CHECK(!recursive_right_gmp_graph(recursive_right_graph, &right, &right_out)); CHECK(right_out.cases.many.lefts.length == 1);
  recursive_gmp_left_tree_t_clear(&left); recursive_gmp_left_tree_t_clear(&left_out); recursive_gmp_left_tree_t_clear(&terminal);
  recursive_gmp_right_tree_t_clear(&right); recursive_gmp_right_tree_t_clear(&right_out);
  recursive_gmp_marker_t marker, next, marker_out; recursive_gmp_marker_t_init(&marker); recursive_gmp_marker_t_init(&next); recursive_gmp_marker_t_init(&marker_out);
  CHECK(recursive_gmp_marker_t_select(&next, RECURSIVE_GMP_MARKER_T_KIND_NEXT)); next.cases.next.value = &marker;
  for (unsigned i = 0; i < 2; ++i) {
    CHECK(recursive_gmp_marker_t_select(&marker, (recursive_gmp_marker_t_tag)i));
    CHECK(!recursive_marker_gmp_graph(recursive_marker_graph, &next, &marker_out)); CHECK(marker_out.cases.next.value->kind == i);
  }
  recursive_gmp_marker_t_clear(&marker_out); recursive_gmp_marker_t_clear(&marker); recursive_gmp_marker_t_clear(&next);
  recursive_gmp_empty_record_t record, record_out; recursive_gmp_empty_record_t_init(&record); recursive_gmp_empty_record_t_init(&record_out);
  CHECK(!recursive_empty_record_gmp_graph(recursive_empty_record_graph, &record, &record_out)); recursive_gmp_empty_record_t_clear(&record_out);
  RECURSIVE_UNITS_RESULT units = {0}, units_out = {0}; uint8_t bytes[123] = {0}; units.data = bytes; units.length = sizeof(bytes);
  CHECK(!recursive_units_gmp_graph(recursive_units_graph, &units, &units_out)); CHECK(units_out.length == sizeof(bytes));
  units_out._bridge_release(units_out._bridge_owner, &units_out);
  recursive_gmp_spine_t spine[130], out; recursive_gmp_spine_t_init(&out);
  for (size_t i = 0; i < 130; ++i) {
    recursive_gmp_spine_t_init(&spine[i]); CHECK(recursive_gmp_spine_t_select(&spine[i], i == 129 ? RECURSIVE_GMP_SPINE_T_KIND_LEAF : RECURSIVE_GMP_SPINE_T_KIND_NEXT));
    if (i != 129) spine[i].cases.next.value = spine + i + 1;
  }
  CHECK(!recursive_spine_gmp_graph(recursive_spine_graph, &spine[2], &out)); recursive_gmp_spine_t_clear(&out);
  CHECK(!recursive_grow_gmp_graph(recursive_grow_graph, &spine[3], &out)); recursive_gmp_spine_t_clear(&out);
  CHECK(recursive_grow_gmp_graph(recursive_grow_graph, &spine[2], &out) == 2); CHECK(!live && !gmp_native_live);
  size_t before = gmp_native_decodes; CHECK(recursive_spine_gmp_graph(recursive_spine_graph, &spine[1], &out) == 2); CHECK(gmp_native_decodes == before);
  for (size_t i = 0; i < 130; ++i) recursive_gmp_spine_t_clear(&spine[i]);
  recursive_gmp_wide_t wide, leaf, wide_out; recursive_gmp_wide_t_init(&wide); recursive_gmp_wide_t_init(&leaf); recursive_gmp_wide_t_init(&wide_out);
  CHECK(recursive_gmp_wide_t_select(&wide, RECURSIVE_GMP_WIDE_T_KIND_NEXT)); CHECK(recursive_gmp_wide_t_select(&leaf, RECURSIVE_GMP_WIDE_T_KIND_LEAF));
  wide.cases.next.child = &leaf; wide.cases.next.field0 = 7; wide.cases.next.field254 = UINT16_MAX; leaf.cases.leaf.value = 17;
  CHECK(!recursive_wide_gmp_graph(recursive_wide_graph, &wide, &wide_out)); CHECK(wide_out.cases.next.field0 == 7 && wide_out.cases.next.field254 == UINT16_MAX && wide_out.cases.next.child->cases.leaf.value == 17);
  recursive_gmp_wide_t_clear(&wide); recursive_gmp_wide_t_clear(&leaf); recursive_gmp_wide_t_clear(&wide_out);
  recursive_gmp_never_t never, never_out; recursive_gmp_never_t_init(&never); recursive_gmp_never_t_init(&never_out);
  CHECK(recursive_gmp_never_t_select(&never, RECURSIVE_GMP_NEVER_T_KIND_AGAIN)); never.cases.again.value = &never;
  CHECK(recursive_never_gmp_graph(recursive_never_graph, &never, &never_out) == 1);
  recursive_gmp_never_t_clear(&never); recursive_gmp_never_t_clear(&never_out); CHECK(!live && !gmp_native_live);
}
static void failures(void) {
  recursive_gmp_scalars_t input, output; recursive_gmp_scalars_t_init(&input); recursive_gmp_scalars_t_init(&output); fill(&input);
  attempts = 0; gmp_native_attempts = 0;
  CHECK(!recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &output));
  size_t count = attempts, native_count = gmp_native_attempts;
  recursive_gmp_scalars_t_clear(&output); output.u32 = 123;
  for (size_t i = 1; i <= count; ++i) {
    attempts = 0; fail_at = i;
    CHECK(recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &output) == 3); fail_at = 0;
    CHECK(!live && !gmp_native_live && output.u32 == 123 && !output._bridge_owner);
  }
  for (size_t i = 1; i <= native_count; ++i) {
    gmp_native_attempts = 0; gmp_native_fail_at = i;
    CHECK(recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &output) == 3); gmp_native_fail_at = 0;
    CHECK(!live && !gmp_native_live && output.u32 == 123 && !output._bridge_owner);
  }
  CHECK(lean_bridge_native_component_ready("recursive@1.0.0"));
  CHECK(!recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &output)); verify(&output);
  recursive_gmp_scalars_t_clear(&input); recursive_gmp_scalars_t_clear(&output);
}
static uint32_t malformed(const recursive_scalars_t *input, recursive_scalars_t *out) {
  uint32_t status = recursive_scalars_graph(input, out); if (!status) out->natural.data = NULL; return status;
}
static void retirement(void) {
  recursive_gmp_scalars_t input, output, held; recursive_gmp_scalars_t_init(&input); recursive_gmp_scalars_t_init(&output); recursive_gmp_scalars_t_init(&held); fill(&input);
  CHECK(!recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &held));
  output.u32 = 123; CHECK(recursive_scalars_gmp_graph(malformed, &input, &output) == 4); CHECK(output.u32 == 123);
  CHECK(!lean_bridge_native_component_ready("recursive@1.0.0"));
  size_t before = gmp_native_decodes;
  CHECK(recursive_scalars_gmp_graph(recursive_scalars_graph, &input, &output) == 5); CHECK(gmp_native_decodes == before && output.u32 == 123);
  CHECK(!mpz_cmp(input.natural, held.natural));
  recursive_gmp_scalars_t_clear(&held); recursive_gmp_scalars_t_clear(&output); recursive_gmp_scalars_t_clear(&input);
  CHECK(!live && !gmp_native_live);
}
int main(void) {
  values(); structures(); failures(); retirement();
  lean_bridge_native_component_detach("recursive@1.0.0");
  printf("gmp-native-graphs-ok %zu\n", checks);
}
