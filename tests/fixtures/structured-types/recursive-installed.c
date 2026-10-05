/* Independent consumer of the prepared C11 API. No carrier or Lean headers. */
#include "recursive.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static size_t checks;
#define CHECK(expression) do { ++checks; if (!(expression)) { fprintf(stderr, "installed C check %d: %s\n", __LINE__, #expression); abort(); } } while (0)
#define OK(expression) CHECK((expression) == RECURSIVE_STATUS_OK)
static void fill(recursive_scalars_t *value) {
  value->bool_ = true; value->u8 = UINT8_MAX; value->u16 = UINT16_MAX; value->u32 = UINT32_MAX; value->u64 = UINT64_MAX;
  value->i8 = INT8_MIN; value->i16 = INT16_MIN; value->i32 = INT32_MIN; value->i64 = INT64_MIN;
  mpz_set_ui(value->natural, 1); mpz_mul_2exp(value->natural, value->natural, 128); mpz_add_ui(value->natural, value->natural, 1); mpz_neg(value->integer, value->natural);
  value->f32 = 1.5f; value->f64 = -2.25; value->text.data = "A\0\xf0\x9f\x8c\xb1"; value->text.length = 6;
  static const uint8_t bytes[] = {0, 255, 1}; value->bytes.data = bytes; value->bytes.length = 3;
  value->char_ = 0x1f331; value->word = UINT32_MAX; value->signed_word = INT32_MIN;
}
static void verify(const recursive_scalars_t *value) {
  bool accepted = false; OK(recursive_inspect(value, &accepted, NULL)); CHECK(accepted);
  CHECK(value->bool_ && value->u8 == UINT8_MAX && value->u16 == UINT16_MAX && value->u32 == UINT32_MAX && value->u64 == UINT64_MAX);
  CHECK(value->i8 == INT8_MIN && value->i16 == INT16_MIN && value->i32 == INT32_MIN && value->i64 == INT64_MIN);
  mpz_t expected; mpz_init_set_ui(expected, 1); mpz_mul_2exp(expected, expected, 128); mpz_add_ui(expected, expected, 1);
  CHECK(!mpz_cmp(expected, value->natural)); mpz_neg(expected, expected); CHECK(!mpz_cmp(expected, value->integer)); mpz_clear(expected);
  CHECK(value->text.length == 6 && !memcmp(value->text.data, "A\0\xf0\x9f\x8c\xb1", 6));
  CHECK(value->bytes.length == 3 && value->bytes.data[0] == 0 && value->bytes.data[1] == 255 && value->bytes.data[2] == 1);
}
static void scalars(void) {
  recursive_error error = {0};
  recursive_scalars_t input, output; recursive_scalars_t_init(&input); recursive_scalars_t_init(&output); fill(&input);
  /* The first call initializes the embedded runtime automatically. */
  OK(recursive_scalars(&input, &output, &error)); verify(&output);
  CHECK(error.code == RECURSIVE_ERROR_NONE && error.message_length == 0);
  CHECK(input.text.data != output.text.data && input.bytes.data != output.bytes.data);
  for (unsigned i = 0; i < 100; ++i) { OK(recursive_scalars(&output, &output, NULL)); verify(&output); }
  mpz_mul_2exp(input.natural, input.natural, 872); mpz_neg(input.integer, input.natural);
  OK(recursive_scalars(&input, &output, &error)); CHECK(!mpz_cmp(input.natural, output.natural) && !mpz_cmp(input.integer, output.integer));
  output.u32 = 123; mpz_neg(input.natural, input.natural);
  CHECK(recursive_scalars(&input, &output, &error) == RECURSIVE_STATUS_INVALID_ARGUMENT);
  CHECK(error.code == RECURSIVE_ERROR_INVALID_ARGUMENT && error.message && error.message_length && output.u32 == 123);
  mpz_neg(input.natural, input.natural); input.text.data = "\xc0\x80"; input.text.length = 2;
  CHECK(recursive_scalars(&input, &output, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT); CHECK(output.u32 == 123);
  fill(&input); input.char_ = 0xd800;
  CHECK(recursive_scalars(&input, &output, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT); CHECK(output.u32 == 123);
  fill(&input); input.bytes.data = NULL;
  CHECK(recursive_scalars(&input, &output, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT);
  fill(&input); OK(recursive_scalars(&input, &output, &error)); verify(&output); CHECK(error.code == RECURSIVE_ERROR_NONE);
  recursive_scalars_t_clear(&input); recursive_scalars_t_clear(&output); recursive_scalars_t_clear(&output);
  bool accepted = false;
  OK(recursive_word_max(UINT64_MAX, &accepted, NULL)); CHECK(accepted);
  OK(recursive_signed_min(INT64_MIN, &accepted, NULL)); CHECK(accepted);
  OK(recursive_initialize(&error)); CHECK(error.code == RECURSIVE_ERROR_NONE);
}
static void trees(void) {
  recursive_tree_t leaves[2], joined, empty;
  for (size_t i = 0; i < 2; ++i) { recursive_tree_t_init(&leaves[i]); OK(recursive_tree_t_select(&leaves[i], RECURSIVE_TREE_T_KIND_LEAF)); fill(&leaves[i].cases.leaf.payload); }
  recursive_tree_t_init(&joined); recursive_tree_t_init(&empty);
  OK(recursive_empty(&empty, NULL)); CHECK(empty.kind == RECURSIVE_TREE_T_KIND_BRANCH && !empty.cases.branch.children.length);
  OK(recursive_join_trees(&leaves[0], &leaves[1], &joined, NULL)); CHECK(joined.cases.branch.children.length == 2);
  verify(&joined.cases.branch.children.data[0].cases.leaf.payload);
  OK(recursive_tree(&joined, &empty, NULL)); CHECK(empty.cases.branch.children.length == 2);
  CHECK(empty.cases.branch.children.data != joined.cases.branch.children.data);
  CHECK(recursive_tree_t_select(&empty, (recursive_tree_t_tag)UINT32_MAX) == RECURSIVE_STATUS_INVALID_ARGUMENT);
  CHECK(empty.cases.branch.children.length == 2);
  recursive_forest_t forest, forest_out; recursive_forest_t_init(&forest); recursive_forest_t_init(&forest_out);
  forest.data = leaves; forest.length = 2;
  OK(recursive_forest(&forest, &forest_out, NULL)); CHECK(forest_out.length == 2); verify(&forest_out.data[1].cases.leaf.payload);
  recursive_envelope_t envelope, out; recursive_envelope_t_init(&envelope); recursive_envelope_t_init(&out);
  recursive_envelope_outcome_t outcome; recursive_envelope_outcome_t_init(&outcome); envelope.outcome = &outcome;
  outcome.error.data = "nested\0error"; outcome.error.length = 12;
  OK(recursive_empty(&envelope.tree, NULL));
  envelope.alternatives.data = &forest; envelope.alternatives.length = 1;
  for (unsigned mode = 0; mode < 3; ++mode) {
    envelope.marker.has_value = mode > 0; envelope.marker.value.has_value = mode > 1;
    OK(recursive_envelope(&envelope, &out, NULL));
    CHECK(out.marker.has_value == (mode > 0) && out.marker.value.has_value == (mode > 1));
    CHECK(out.alternatives.length == 1 && out.alternatives.data[0].length == 2);
    verify(&out.alternatives.data[0].data[0].cases.leaf.payload);
    CHECK(!out.outcome->is_ok && out.outcome->error.length == 12 && !memcmp(out.outcome->error.data, "nested\0error", 12));
  }
  OK(recursive_empty(&outcome.ok.fst, NULL)); OK(recursive_empty(&outcome.ok.snd, NULL));
  outcome.is_ok = true;
  OK(recursive_envelope(&envelope, &out, NULL)); CHECK(out.outcome->is_ok);
  CHECK(out.outcome->ok.fst.kind == RECURSIVE_TREE_T_KIND_BRANCH);
  recursive_envelope_t_clear(&out); recursive_envelope_t_clear(&envelope);
  recursive_envelope_outcome_t_clear(&outcome);
  recursive_forest_t_clear(&forest_out); recursive_forest_t_clear(&forest);
  recursive_tree_t_clear(&joined); recursive_tree_t_clear(&empty);
  for (size_t i = 0; i < 2; ++i) recursive_tree_t_clear(&leaves[i]);
}
static void structures(void) {
  recursive_left_tree_t left, out, leaf; recursive_right_tree_t right, right_out;
  recursive_left_tree_t_init(&left); recursive_left_tree_t_init(&out); recursive_left_tree_t_init(&leaf);
  recursive_right_tree_t_init(&right); recursive_right_tree_t_init(&right_out);
  OK(recursive_left_tree_t_select(&leaf, RECURSIVE_LEFT_TREE_T_KIND_LEAF)); leaf.cases.leaf.value = 7;
  OK(recursive_right_tree_t_select(&right, RECURSIVE_RIGHT_TREE_T_KIND_MANY)); right.cases.many.lefts.data = &leaf; right.cases.many.lefts.length = 1;
  OK(recursive_left_tree_t_select(&left, RECURSIVE_LEFT_TREE_T_KIND_NEXT));
  OK(recursive_right_tree_t_select(&left.cases.next.right, RECURSIVE_RIGHT_TREE_T_KIND_MANY));
  left.cases.next.right.cases.many.lefts.data = &leaf; left.cases.next.right.cases.many.lefts.length = 1;
  OK(recursive_left(&left, &out, NULL)); CHECK(out.cases.next.right.cases.many.lefts.data[0].cases.leaf.value == 7);
  OK(recursive_right(&right, &right_out, NULL)); CHECK(right_out.cases.many.lefts.length == 1);
  recursive_left_tree_t_clear(&left); recursive_left_tree_t_clear(&out); recursive_left_tree_t_clear(&leaf);
  recursive_right_tree_t_clear(&right); recursive_right_tree_t_clear(&right_out);
  recursive_marker_t marker, next, copied; recursive_marker_t_init(&marker); recursive_marker_t_init(&next); recursive_marker_t_init(&copied);
  OK(recursive_marker_t_select(&next, RECURSIVE_MARKER_T_KIND_NEXT)); next.cases.next.value = &marker;
  const recursive_marker_t_tag tags[] = {RECURSIVE_MARKER_T_KIND_EMPTY, RECURSIVE_MARKER_T_KIND_UNIT};
  for (size_t i = 0; i < 2; ++i) { OK(recursive_marker_t_select(&marker, tags[i])); OK(recursive_marker(&next, &copied, NULL)); CHECK(copied.cases.next.value->kind == (uint32_t)tags[i]); }
  recursive_marker_t_clear(&marker); recursive_marker_t_clear(&next); recursive_marker_t_clear(&copied);
  recursive_empty_record_t record, record_out; recursive_empty_record_t_init(&record); recursive_empty_record_t_init(&record_out);
  OK(recursive_empty_record(&record, &record_out, NULL)); recursive_empty_record_t_clear(&record); recursive_empty_record_t_clear(&record_out);
  recursive_units_argument0_t units; recursive_units_result_t units_out; recursive_units_argument0_t_init(&units); recursive_units_result_t_init(&units_out);
  uint8_t unit_values[123] = {0}; units.data = unit_values; units.length = sizeof(unit_values);
  OK(recursive_units(&units, &units_out, NULL)); CHECK(units_out.length == sizeof(unit_values));
  unit_values[10] = 1; CHECK(recursive_units(&units, &units_out, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT); CHECK(units_out.length == 123);
  recursive_units_argument0_t_clear(&units); recursive_units_result_t_clear(&units_out);
}
static void recursion(void) {
  recursive_spine_t spine[130], out; recursive_spine_t_init(&out);
  for (size_t i = 0; i < 130; ++i) {
    recursive_spine_t_init(&spine[i]); OK(recursive_spine_t_select(&spine[i], i == 129 ? RECURSIVE_SPINE_T_KIND_LEAF : RECURSIVE_SPINE_T_KIND_NEXT));
    if (i != 129) spine[i].cases.next.value = spine + i + 1;
  }
  spine[129].cases.leaf.value = 41;
  OK(recursive_spine(&spine[2], &out, NULL));
  const recursive_spine_t *cursor = &out;
  for (unsigned i = 0; i < 127; ++i) { CHECK(cursor != &spine[i + 2]); CHECK(cursor->kind == RECURSIVE_SPINE_T_KIND_NEXT); cursor = cursor->cases.next.value; }
  CHECK(cursor->kind == RECURSIVE_SPINE_T_KIND_LEAF && cursor->cases.leaf.value == 41);
  CHECK(recursive_grow(&spine[2], &out, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT); CHECK(out.kind == RECURSIVE_SPINE_T_KIND_NEXT);
  CHECK(recursive_spine(&spine[1], &out, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT);
  OK(recursive_grow(&spine[129], &out, NULL)); CHECK(out.cases.next.value->cases.leaf.value == 41);
  spine[128].cases.next.value = &spine[128]; CHECK(recursive_spine(&spine[128], &out, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT);
  for (size_t i = 0; i < 130; ++i) { recursive_spine_t_clear(&spine[i]); }
  recursive_spine_t_clear(&out);
  recursive_wide_t wide, leaf, wide_out; recursive_wide_t_init(&wide); recursive_wide_t_init(&leaf); recursive_wide_t_init(&wide_out);
  OK(recursive_wide_t_select(&wide, RECURSIVE_WIDE_T_KIND_NEXT)); OK(recursive_wide_t_select(&leaf, RECURSIVE_WIDE_T_KIND_LEAF));
  wide.cases.next.child = &leaf; wide.cases.next.field0 = 7; wide.cases.next.field254 = UINT16_MAX; leaf.cases.leaf.value = 17;
  OK(recursive_wide(&wide, &wide_out, NULL)); CHECK(wide_out.cases.next.field0 == 7 && wide_out.cases.next.field254 == UINT16_MAX && wide_out.cases.next.child->cases.leaf.value == 17);
  recursive_wide_t_clear(&wide); recursive_wide_t_clear(&leaf); recursive_wide_t_clear(&wide_out);
  recursive_never_t never, never_out; recursive_never_t_init(&never); recursive_never_t_init(&never_out);
  OK(recursive_never_t_select(&never, RECURSIVE_NEVER_T_KIND_AGAIN)); never.cases.again.value = &never;
  CHECK(recursive_never(&never, &never_out, NULL) == RECURSIVE_STATUS_INVALID_ARGUMENT);
  recursive_never_t_clear(&never); recursive_never_t_clear(&never_out);
}
int main(void) { scalars(); trees(); structures(); recursion(); printf("recursive-installed-ok:%zu\n", checks); }
