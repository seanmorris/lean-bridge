/* Independent native caller. Generated code is inserted after allocator hooks. */
#include <assert.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <lean/lean.h>

static uint32_t checks;
static size_t attempts, fail_at, live, decodes;
static size_t encodes, fail_encode;
static void *allocations[4096];
#define CHECK(expression) do { ++checks; assert(expression); } while (0)
static void *test_malloc(size_t bytes) {
  ++attempts;
  if (fail_at && attempts == fail_at) return NULL;
  void *value = malloc(bytes);
  CHECK(value != NULL);
  for (size_t i = 0; i < 4096; ++i) if (!allocations[i]) {
    allocations[i] = value; ++live; return value;
  }
  abort();
}
static void test_free(void *value) {
  for (size_t i = 0; i < 4096; ++i) if (allocations[i] == value) {
    CHECK(value != NULL); CHECK(live > 0);
    allocations[i] = NULL; --live; free(value); return;
  }
  abort();
}
#define LB_GRAPH_MALLOC test_malloc
#define LB_GRAPH_FREE test_free
#define LB_GRAPH_DECODE() (++decodes)
static lean_object *test_encode(lean_object *value) {
  if (++encodes == fail_encode) {
    lean_dec(value); return lean_alloc_array(0, 0);
  }
  return value;
}
#define LB_GRAPH_ENCODE(value) test_encode(value)

/* GENERATED_TRANSPORT */

static const uint32_t magnitude[] = {1, 0, 0, 0, 1};
static const char text[] = {'A', 0, (char)0xf0, (char)0x9f, (char)0x8c, (char)0xb1};
static const uint8_t bytes[] = {0, 255, 1};

static recursive_scalars_t scalars_input(void) {
  recursive_scalars_t value;
  recursive_scalars_t_init(&value);
  value.bool_ = true;
  value.u8 = UINT8_MAX; value.u16 = UINT16_MAX;
  value.u32 = UINT32_MAX; value.u64 = UINT64_MAX;
  value.i8 = INT8_MIN; value.i16 = INT16_MIN;
  value.i32 = INT32_MIN; value.i64 = INT64_MIN;
  value.natural.data = magnitude; value.natural.length = 5;
  value.integer.data = magnitude; value.integer.length = 5;
  value.integer.negative = true;
  value.f32 = 1.5f; value.f64 = -2.25;
  value.text.data = text; value.text.length = sizeof(text);
  value.bytes.data = bytes; value.bytes.length = sizeof(bytes);
  value.char_ = 0x1f331; value.word = UINT32_MAX; value.signed_word = INT32_MIN;
  return value;
}

static void check_scalars(const recursive_scalars_t *value) {
  bool accepted = false;
  CHECK(recursive_inspect_graph(value, &accepted) == NG_OK); CHECK(accepted);
  CHECK(value->unit == 0); CHECK(value->bool_);
  CHECK(value->u8 == UINT8_MAX); CHECK(value->u16 == UINT16_MAX);
  CHECK(value->u32 == UINT32_MAX); CHECK(value->u64 == UINT64_MAX);
  CHECK(value->i8 == INT8_MIN); CHECK(value->i16 == INT16_MIN);
  CHECK(value->i32 == INT32_MIN); CHECK(value->i64 == INT64_MIN);
  CHECK(value->natural.length == 5); CHECK(value->natural.data != magnitude);
  CHECK(memcmp(value->natural.data, magnitude, sizeof(magnitude)) == 0);
  CHECK(value->integer.length == 5); CHECK(value->integer.data != magnitude);
  CHECK(memcmp(value->integer.data, magnitude, sizeof(magnitude)) == 0);
  CHECK(value->integer.negative); CHECK(value->f32 == 1.5f); CHECK(value->f64 == -2.25);
  CHECK(value->text.length == sizeof(text)); CHECK(value->text.data != text);
  CHECK(memcmp(value->text.data, text, sizeof(text)) == 0);
  CHECK(value->bytes.length == sizeof(bytes)); CHECK(value->bytes.data != bytes);
  CHECK(memcmp(value->bytes.data, bytes, sizeof(bytes)) == 0);
  CHECK(value->char_ == 0x1f331); CHECK(value->word == UINT32_MAX);
  CHECK(value->signed_word == INT32_MIN);
  CHECK(!value->natural._bridge_owner && !value->natural._bridge_release);
  CHECK(!value->integer._bridge_owner && !value->integer._bridge_release);
  CHECK(!value->text._bridge_owner && !value->text._bridge_release);
  CHECK(!value->bytes._bridge_owner && !value->bytes._bridge_release);
}

static void reject_scalars(const recursive_scalars_t *input, uint32_t expected) {
  recursive_scalars_t output, snapshot;
  recursive_scalars_t_init(&output); output.u32 = 123;
  memcpy(&snapshot, &output, sizeof(output));
  decodes = 0;
  CHECK(recursive_scalars_graph(input, &output) == expected);
  CHECK(decodes == 0); CHECK(live == 0);
  CHECK(memcmp(&snapshot, &output, sizeof(output)) == 0);
}

uint32_t native_graph_check(lean_object *unit) {
  (void)unit;
  recursive_scalars_t input = scalars_input(), output;
  recursive_scalars_t_init(&output);
  bool accepted = false;
  CHECK(recursive_inspect_graph(&input, &accepted) == NG_OK); CHECK(accepted);
  CHECK(recursive_scalars_graph(&input, &output) == NG_OK);
  check_scalars(&output); CHECK(output._bridge_owner && output._bridge_release);
  size_t owned = live;
  CHECK(recursive_scalars_graph(&input, &output) == NG_INVALID); CHECK(live == owned);
  check_scalars(&output);
  recursive_scalars_t_clear(&output); recursive_scalars_t_clear(&output); CHECK(live == 0);
  uint64_t word = UINT64_MAX; int64_t signed_word = INT64_MIN;
  CHECK(recursive_word_max_graph(&word, &accepted) == NG_OK); CHECK(accepted);
  CHECK(recursive_signed_min_graph(&signed_word, &accepted) == NG_OK); CHECK(accepted);

  recursive_empty_record_t empty_record = {0}, empty_record_out = {0};
  CHECK(recursive_empty_record_graph(&empty_record, &empty_record_out) == NG_OK);
  CHECK(!empty_record_out._bridge_owner && !empty_record_out._bridge_release);
  recursive_empty_record_t_clear(&empty_record_out); CHECK(live == 0);
  recursive_marker_t marker = {0}, marker_out;
  recursive_marker_t_init(&marker_out);
  marker.kind = RECURSIVE_MARKER_T_KIND_EMPTY;
  marker.cases.unit.value = 255;
  CHECK(recursive_marker_graph(&marker, &marker_out) == NG_OK);
  CHECK(marker_out.kind == RECURSIVE_MARKER_T_KIND_EMPTY);
  recursive_marker_t_clear(&marker_out); CHECK(live == 0);
  marker.kind = RECURSIVE_MARKER_T_KIND_UNIT; marker.cases.unit.value = 0;
  CHECK(recursive_marker_graph(&marker, &marker_out) == NG_OK);
  CHECK(marker_out.kind == RECURSIVE_MARKER_T_KIND_UNIT);
  CHECK(marker_out.cases.unit.value == 0);
  recursive_marker_t_clear(&marker_out); CHECK(live == 0);
  marker.cases.unit.value = 1; decodes = 0;
  CHECK(recursive_marker_graph(&marker, &marker_out) == NG_INVALID); CHECK(decodes == 0);
  marker.kind = RECURSIVE_MARKER_T_KIND_EMPTY;
  recursive_marker_t marker_next = {0}; marker_next.kind = RECURSIVE_MARKER_T_KIND_NEXT;
  marker_next.cases.next.value = &marker;
  CHECK(recursive_marker_graph(&marker_next, &marker_out) == NG_OK);
  CHECK(marker_out.kind == RECURSIVE_MARKER_T_KIND_NEXT);
  CHECK(marker_out.cases.next.value->kind == RECURSIVE_MARKER_T_KIND_EMPTY);
  CHECK(marker_out.cases.next.value != &marker);
  recursive_marker_t_clear(&marker_out); CHECK(live == 0);

  const uint32_t float_bits[] = {0, 0x80000000u, 0x7f800000u, 0xff800000u, 0x7fc12345u};
  const uint64_t double_bits[] = {0, UINT64_C(0x8000000000000000), UINT64_C(0x7ff0000000000000), UINT64_C(0xfff0000000000000), UINT64_C(0x7ff8123456789abc)};
  for (size_t i = 0; i < sizeof(float_bits) / sizeof(*float_bits); ++i) {
    recursive_scalars_t special = input;
    memcpy(&special.f32, &float_bits[i], sizeof(special.f32));
    memcpy(&special.f64, &double_bits[i], sizeof(special.f64));
    CHECK(recursive_scalars_graph(&special, &output) == NG_OK);
    CHECK(memcmp(&output.f32, &float_bits[i], sizeof(output.f32)) == 0);
    CHECK(memcmp(&output.f64, &double_bits[i], sizeof(output.f64)) == 0);
    recursive_scalars_t_clear(&output); CHECK(live == 0);
  }
  recursive_scalars_t zero = {0};
  zero.integer.negative = true;
  CHECK(recursive_scalars_graph(&zero, &output) == NG_OK);
  CHECK(output.natural.length == 0 && output.integer.length == 0);
  CHECK(!output.integer.negative);
  CHECK(output.text.length == 0 && output.bytes.length == 0);
  recursive_scalars_t_clear(&output); CHECK(live == 0);

  recursive_scalars_t bad = input;
  bad.unit = 1; reject_scalars(&bad, NG_INVALID);
  bad = input; uint8_t invalid_bool = 2;
  memcpy(&bad.bool_, &invalid_bool, 1); reject_scalars(&bad, NG_INVALID);
  bad = input; memcpy(&bad.integer.negative, &invalid_bool, 1); reject_scalars(&bad, NG_INVALID);
  bad = input; bad.char_ = 0xd800; reject_scalars(&bad, NG_INVALID);
  bad = input; bad.char_ = 0x110000; reject_scalars(&bad, NG_INVALID);
  static const char *invalid_text[] = {"\xc0\x80", "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xe2\x82", "\x80"};
  for (size_t i = 0; i < sizeof(invalid_text) / sizeof(*invalid_text); ++i) {
    bad = input; bad.text.data = invalid_text[i]; bad.text.length = strlen(invalid_text[i]);
    reject_scalars(&bad, NG_INVALID);
  }
  bad = input; bad.bytes.data = NULL; reject_scalars(&bad, NG_INVALID);
  bad = input; bad.natural.length = SIZE_MAX; reject_scalars(&bad, NG_LIMIT);
  bad = input; bad.bytes.length = SIZE_MAX; reject_scalars(&bad, NG_LIMIT);
  bad = input; bad.natural.data = (const uint32_t *)((const char *)magnitude + 1);
  reject_scalars(&bad, NG_INVALID);
  reject_scalars(NULL, NG_INVALID);
  CHECK(recursive_scalars_graph(&input, NULL) == NG_INVALID);

  recursive_tree_t leaf, tree;
  recursive_tree_t_init(&leaf); recursive_tree_t_init(&tree);
  leaf.kind = RECURSIVE_TREE_T_KIND_LEAF; leaf.cases.leaf.payload = input;
  CHECK(recursive_empty_graph(&tree) == NG_OK);
  CHECK(tree.kind == RECURSIVE_TREE_T_KIND_BRANCH); CHECK(tree.cases.branch.children.length == 0);
  recursive_tree_t_clear(&tree); CHECK(live == 0);
  attempts = 0;
  CHECK(recursive_join_trees_graph(&leaf, &leaf, &tree) == NG_OK);
  size_t allocation_count = attempts; CHECK(allocation_count > 4);
  CHECK(tree.kind == RECURSIVE_TREE_T_KIND_BRANCH); CHECK(tree.cases.branch.children.length == 2);
  for (size_t i = 0; i < 2; ++i) {
    CHECK(tree.cases.branch.children.data[i].kind == RECURSIVE_TREE_T_KIND_LEAF);
    check_scalars(&tree.cases.branch.children.data[i].cases.leaf.payload);
    CHECK(!tree.cases.branch.children.data[i]._bridge_owner);
  }
  CHECK(tree.cases.branch.children.data[0].cases.leaf.payload.text.data != tree.cases.branch.children.data[1].cases.leaf.payload.text.data);
  tree.kind = UINT32_MAX;
  tree.cases.branch.children.data = (const recursive_tree_t *)(uintptr_t)1;
  tree.cases.branch.children.length = SIZE_MAX;
  recursive_tree_t_clear(&tree); recursive_tree_t_clear(&tree); CHECK(live == 0);
  for (size_t i = 1; i <= allocation_count; ++i) {
    attempts = 0; fail_at = i;
    CHECK(recursive_join_trees_graph(&leaf, &leaf, &tree) == NG_ALLOC);
    CHECK(live == 0); CHECK(tree.kind == UINT32_MAX); CHECK(!tree._bridge_owner);
    fail_at = 0;
    CHECK(recursive_join_trees_graph(&leaf, &leaf, &tree) == NG_OK);
    recursive_tree_t_clear(&tree); CHECK(live == 0);
  }
  encodes = 0;
  CHECK(recursive_join_trees_graph(&leaf, &leaf, &tree) == NG_OK);
  size_t encode_count = encodes; CHECK(encode_count > 20);
  recursive_tree_t_clear(&tree); CHECK(live == 0);
  for (size_t i = 1; i <= encode_count; ++i) {
    encodes = 0; fail_encode = i;
    CHECK(recursive_join_trees_graph(&leaf, &leaf, &tree) == NG_RESULT);
    CHECK(live == 0); CHECK(tree.kind == UINT32_MAX); CHECK(!tree._bridge_owner);
    fail_encode = 0;
    CHECK(recursive_join_trees_graph(&leaf, &leaf, &tree) == NG_OK);
    recursive_tree_t_clear(&tree); CHECK(live == 0);
  }
  decodes = 0;
  CHECK(recursive_join_trees_graph(&leaf, &tree, &tree) == NG_INVALID);
  CHECK(decodes == 0); CHECK(live == 0);
  recursive_forest_t forest = {0}, forest_out = {0};
  forest.data = &leaf; forest.length = 1;
  CHECK(recursive_forest_graph(&forest, &forest_out) == NG_OK);
  CHECK(forest_out.length == 1 && forest_out.data != &leaf);
  check_scalars(&forest_out.data[0].cases.leaf.payload);
  recursive_forest_t_clear(&forest_out); CHECK(live == 0);

  recursive_tree_t empty = {0}; empty.kind = RECURSIVE_TREE_T_KIND_BRANCH;
  recursive_tree_t alternatives[] = {leaf, empty};
  recursive_forest_t forests[2] = {{0}};
  forests[1].data = alternatives; forests[1].length = 2;
  recursive_envelope_t envelope = {0}, envelope_out = {0};
  OUTCOME_TYPE outcome = {0};
  envelope.tree = leaf; envelope.outcome = &outcome;
  envelope.alternatives.data = forests; envelope.alternatives.length = 2;
  outcome.ok.fst = leaf; outcome.ok.snd = empty; outcome.error = input.text;
  envelope.fallback.value = leaf;
  for (uint8_t fallback = 0; fallback < 2; ++fallback)
    for (uint8_t ok = 0; ok < 2; ++ok)
      for (uint8_t marker = 0; marker < 3; ++marker) {
        envelope.fallback.has_value = fallback; outcome.is_ok = ok;
        envelope.marker.has_value = marker != 0;
        envelope.marker.value.has_value = marker == 2;
        CHECK(recursive_envelope_graph(&envelope, &envelope_out) == NG_OK);
        CHECK(envelope_out.tree.kind == RECURSIVE_TREE_T_KIND_LEAF);
        check_scalars(&envelope_out.tree.cases.leaf.payload);
        CHECK(envelope_out.alternatives.length == 2);
        CHECK(envelope_out.alternatives.data != forests);
        CHECK(envelope_out.alternatives.data[0].length == 0);
        CHECK(envelope_out.alternatives.data[1].length == 2);
        CHECK(envelope_out.alternatives.data[1].data != alternatives);
        check_scalars(&envelope_out.alternatives.data[1].data[0].cases.leaf.payload);
        CHECK(envelope_out.alternatives.data[1].data[1].kind == RECURSIVE_TREE_T_KIND_BRANCH);
        CHECK(envelope_out.alternatives.data[1].data[1].cases.branch.children.length == 0);
        CHECK(envelope_out.fallback.has_value == fallback);
        if (fallback) check_scalars(&envelope_out.fallback.value.cases.leaf.payload);
        CHECK(envelope_out.outcome != &outcome); CHECK(envelope_out.outcome->is_ok == ok);
        if (ok) {
          check_scalars(&envelope_out.outcome->ok.fst.cases.leaf.payload);
          CHECK(envelope_out.outcome->ok.snd.kind == RECURSIVE_TREE_T_KIND_BRANCH);
          CHECK(envelope_out.outcome->ok.snd.cases.branch.children.length == 0);
        } else {
          CHECK(envelope_out.outcome->error.length == sizeof(text));
          CHECK(envelope_out.outcome->error.data != text);
          CHECK(memcmp(envelope_out.outcome->error.data, text, sizeof(text)) == 0);
        }
        CHECK(envelope_out.marker.has_value == (marker != 0));
        if (marker) CHECK(envelope_out.marker.value.has_value == (marker == 2));
        if (marker == 2) CHECK(envelope_out.marker.value.value == 0);
        recursive_envelope_t_clear(&envelope_out); CHECK(live == 0);
      }
  envelope.fallback.has_value = 2; decodes = 0;
  CHECK(recursive_envelope_graph(&envelope, &envelope_out) == NG_INVALID); CHECK(decodes == 0);
  envelope.fallback.has_value = 0; outcome.is_ok = 2;
  CHECK(recursive_envelope_graph(&envelope, &envelope_out) == NG_INVALID); CHECK(decodes == 0);
  outcome.is_ok = 0; envelope.marker.value.has_value = 2;
  CHECK(recursive_envelope_graph(&envelope, &envelope_out) == NG_INVALID); CHECK(decodes == 0);
  envelope.marker.value.has_value = 0; envelope.outcome = NULL;
  CHECK(recursive_envelope_graph(&envelope, &envelope_out) == NG_INVALID); CHECK(decodes == 0);
  CHECK(live == 0);

  recursive_left_tree_t left = {0}, left_out = {0};
  recursive_right_tree_t right = {0}, right_out = {0};
  left.kind = RECURSIVE_LEFT_TREE_T_KIND_LEAF; left.cases.leaf.value = 42;
  right.kind = RECURSIVE_RIGHT_TREE_T_KIND_MANY;
  right.cases.many.lefts.data = &left; right.cases.many.lefts.length = 1;
  CHECK(recursive_right_graph(&right, &right_out) == NG_OK);
  CHECK(right_out.cases.many.lefts.length == 1);
  CHECK(right_out.cases.many.lefts.data != &left);
  CHECK(right_out.cases.many.lefts.data[0].kind == RECURSIVE_LEFT_TREE_T_KIND_LEAF);
  CHECK(right_out.cases.many.lefts.data[0].cases.leaf.value == 42);
  recursive_right_tree_t_clear(&right_out); CHECK(live == 0);
  recursive_left_tree_t next = {0}; next.kind = RECURSIVE_LEFT_TREE_T_KIND_NEXT;
  next.cases.next.right = right;
  CHECK(recursive_left_graph(&next, &left_out) == NG_OK);
  CHECK(left_out.kind == RECURSIVE_LEFT_TREE_T_KIND_NEXT);
  CHECK(left_out.cases.next.right.cases.many.lefts.data[0].cases.leaf.value == 42);
  recursive_left_tree_t_clear(&left_out); CHECK(live == 0);

  recursive_spine_t spine[129] = {{0}}, spine_out;
  recursive_spine_t_init(&spine_out);
  spine[0].kind = RECURSIVE_SPINE_T_KIND_LEAF; spine[0].cases.leaf.value = 42;
  for (size_t i = 1; i < 129; ++i) {
    spine[i].kind = RECURSIVE_SPINE_T_KIND_NEXT; spine[i].cases.next.value = &spine[i - 1];
  }
  CHECK(recursive_spine_graph(&spine[127], &spine_out) == NG_OK);
  const recursive_spine_t *cursor = &spine_out;
  for (size_t i = 127; i; --i) { CHECK(cursor->kind == RECURSIVE_SPINE_T_KIND_NEXT); cursor = cursor->cases.next.value; }
  CHECK(cursor->kind == RECURSIVE_SPINE_T_KIND_LEAF); CHECK(cursor->cases.leaf.value == 42);
  recursive_spine_t_clear(&spine_out); CHECK(live == 0);
  CHECK(recursive_grow_graph(&spine[127], &spine_out) == NG_LIMIT); CHECK(live == 0);
  decodes = 0; CHECK(recursive_spine_graph(&spine[128], &spine_out) == NG_LIMIT); CHECK(decodes == 0);
  spine[1].cases.next.value = &spine[1]; decodes = 0;
  CHECK(recursive_spine_graph(&spine[1], &spine_out) == NG_INVALID); CHECK(decodes == 0);
  spine[1].cases.next.value = NULL;
  CHECK(recursive_spine_graph(&spine[1], &spine_out) == NG_INVALID); CHECK(decodes == 0);
  CHECK(recursive_grow_graph(&spine[0], &spine_out) == NG_OK);
  CHECK(spine_out.kind == RECURSIVE_SPINE_T_KIND_NEXT);
  CHECK(spine_out.cases.next.value->cases.leaf.value == 42);
  recursive_spine_t_clear(&spine_out); CHECK(live == 0);
  recursive_never_t never = {0}, never_out = {0};
  never.kind = RECURSIVE_NEVER_T_KIND_AGAIN; decodes = 0;
  CHECK(recursive_never_graph(&never, &never_out) == NG_INVALID); CHECK(decodes == 0);

  /* A legal shared input is copied by value, while a backedge rejects. */
  recursive_tree_t shared[2] = {leaf, leaf}, branch = {0};
  branch.kind = RECURSIVE_TREE_T_KIND_BRANCH;
  branch.cases.branch.children.data = shared; branch.cases.branch.children.length = 2;
  CHECK(recursive_tree_graph(&branch, &tree) == NG_OK);
  CHECK(tree.cases.branch.children.data[0].cases.leaf.payload.bytes.data != tree.cases.branch.children.data[1].cases.leaf.payload.bytes.data);
  recursive_tree_t_clear(&tree); CHECK(live == 0);
  branch.cases.branch.children.data = &branch; branch.cases.branch.children.length = 1;
  decodes = 0; CHECK(recursive_tree_graph(&branch, &tree) == NG_INVALID); CHECK(decodes == 0);
  never.cases.again.value = &never;
  CHECK(recursive_never_graph(&never, &never_out) == NG_INVALID); CHECK(decodes == 0);

  UNIT_ARRAY_TYPE units = {0}, units_out = {0};
  uint8_t *unit_data = calloc(131072, 1); CHECK(unit_data != NULL);
  units.data = unit_data; units.length = 131071;
  CHECK(recursive_units_graph(&units, &units_out) == NG_OK);
  CHECK(units_out.length == units.length); CHECK(units_out.data != unit_data);
  for (size_t i = 0; i < units.length; ++i) CHECK(units_out.data[i] == 0);
  UNIT_ARRAY_TYPE_clear(&units_out); CHECK(live == 0);
  units.length = 131072;
  CHECK(recursive_units_graph(&units, &units_out) == NG_LIMIT); CHECK(live == 0);
  units.length = 262144; decodes = 0;
  CHECK(recursive_units_graph(&units, &units_out) == NG_LIMIT); CHECK(decodes == 0);
  units.length = 0;
  CHECK(recursive_units_graph(&units, &units_out) == NG_OK);
  CHECK(units_out.length == 0); UNIT_ARRAY_TYPE_clear(&units_out); CHECK(live == 0);
  free(unit_data);

  size_t large_length = 8u * 1024u * 1024u + 4096;
  char *large_text = malloc(large_length); CHECK(large_text != NULL);
  memset(large_text, 'z', large_length);
  bad = input; bad.text.data = large_text; bad.text.length = large_length - 8192;
  CHECK(recursive_scalars_graph(&bad, &output) == NG_OK);
  CHECK(output.text.length == bad.text.length); CHECK(output.text.data[0] == 'z');
  CHECK(output.text.data[output.text.length - 1] == 'z');
  recursive_scalars_t_clear(&output); CHECK(live == 0);
  bad.text.length = large_length;
  CHECK(recursive_scalars_graph(&bad, &output) == NG_LIMIT); CHECK(live == 0);
  free(large_text);
  CHECK(recursive_scalars_graph(&input, &output) == NG_OK);
  check_scalars(&output); recursive_scalars_t_clear(&output); CHECK(live == 0);

  recursive_wide_t *wide = calloc(128, sizeof(*wide)), wide_out = {0};
  CHECK(wide != NULL); wide[0].kind = RECURSIVE_WIDE_T_KIND_LEAF; wide[0].cases.leaf.value = 42;
  for (size_t depth = 1; depth < 128; ++depth) {
    wide[depth].kind = RECURSIVE_WIDE_T_KIND_NEXT; wide[depth].cases.next.child = &wide[depth - 1];
    WIDE_FIELDS
  }
  CHECK(recursive_wide_graph(&wide[127], &wide_out) == NG_OK);
  const recursive_wide_t *current = &wide_out;
  for (size_t depth = 127; depth; --depth) {
    CHECK(current->kind == RECURSIVE_WIDE_T_KIND_NEXT);
    WIDE_CHECKS
    current = current->cases.next.child;
  }
  CHECK(current->kind == RECURSIVE_WIDE_T_KIND_LEAF); CHECK(current->cases.leaf.value == 42);
  recursive_wide_t_clear(&wide_out); CHECK(live == 0); free(wide);
  return checks;
}
