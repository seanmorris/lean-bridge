/* Independent C/GMP caller. Raw echoes isolate host conversions from Lean. */
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include <gmp.h>
static size_t attempts, fail_at, live, integer_live, calls, releases, checks;
#define CHECK(expression) do { ++checks; if (!(expression)) { fprintf(stderr, "check failed at line %d: %s\n", __LINE__, #expression); abort(); } } while (0)
static void *graph_malloc(size_t bytes) {
  if (++attempts == fail_at) return NULL;
  void *value = malloc(bytes); if (value) ++live; return value;
}
static void graph_free(void *value) { CHECK(value && live); --live; free(value); }
static void *integer_malloc(size_t bytes) { void *value = malloc(bytes); CHECK(value); ++integer_live; return value; }
static void *integer_realloc(void *value, size_t old, size_t bytes) {
  (void)old; CHECK(value && integer_live); void *next = realloc(value, bytes); CHECK(next); return next;
}
static void integer_free(void *value, size_t bytes) { (void)bytes; CHECK(value && integer_live); --integer_live; free(value); }
#define LB_GMP_GRAPH_MALLOC graph_malloc
#define LB_GMP_GRAPH_FREE graph_free
#include "recursive-gmp-conversions.h"
#include "linked-gmp-conversions.h"
#include "test-types.h"

static void release(void *owner) { CHECK(owner == &releases); ++releases; }
#define ECHO(name, type) static uint32_t name(const type *input, type *output) { ++calls; *output = *input; output->_bridge_owner = &releases; output->_bridge_release = release; return 0; }
ECHO(echo_scalars, recursive_scalars_t)
ECHO(echo_tree, recursive_tree_t)
ECHO(echo_forest, recursive_forest_t)
ECHO(echo_envelope, recursive_envelope_t)
ECHO(echo_spine, recursive_spine_t)
ECHO(echo_never, recursive_never_t)
ECHO(echo_wide, recursive_wide_t)
ECHO(echo_left, recursive_left_tree_t)
ECHO(echo_right, recursive_right_tree_t)
ECHO(echo_marker, recursive_marker_t)
ECHO(echo_empty, recursive_empty_record_t)
ECHO(echo_units, RECURSIVE_UNITS_RAW)
ECHO(echo_link, linked_link_t)
ECHO(echo_natural, LINKED_NATURAL_RAW)
ECHO(echo_integer, LINKED_INTEGER_RAW)
static uint32_t echo_pair(const recursive_tree_t *left, const recursive_tree_t *right, recursive_tree_t *out) { (void)right; return echo_tree(left, out); }

static void scalars(recursive_gmp_scalars_t *value) {
  recursive_gmp_scalars_t_init(value);
  value->bool_ = true; value->u8 = UINT8_MAX; value->u16 = UINT16_MAX; value->u32 = UINT32_MAX; value->u64 = UINT64_MAX;
  value->i8 = INT8_MIN; value->i16 = INT16_MIN; value->i32 = INT32_MIN; value->i64 = INT64_MIN;
  mpz_set_ui(value->natural, 1); mpz_mul_2exp(value->natural, value->natural, 1000); mpz_add_ui(value->natural, value->natural, 7);
  mpz_neg(value->integer, value->natural);
  value->f32 = 1.5f; value->f64 = -2.25;
  value->text.data = "A\0\xf0\x9f\x8c\xb1"; value->text.length = 6;
  static const uint8_t bytes[] = {0, 255, 1}; value->bytes.data = bytes; value->bytes.length = 3;
  value->char_ = 0x1f331; value->word = UINT64_MAX; value->signed_word = INT64_MIN;
}
static void equal_scalars(const recursive_gmp_scalars_t *left, const recursive_gmp_scalars_t *right) {
  CHECK(left->unit == right->unit && left->bool_ == right->bool_);
  CHECK(left->u8 == right->u8 && left->u16 == right->u16 && left->u32 == right->u32 && left->u64 == right->u64);
  CHECK(left->i8 == right->i8 && left->i16 == right->i16 && left->i32 == right->i32 && left->i64 == right->i64);
  CHECK(mpz_cmp(left->natural, right->natural) == 0 && mpz_cmp(left->integer, right->integer) == 0);
  CHECK(memcmp(&left->f32, &right->f32, sizeof(left->f32)) == 0 && memcmp(&left->f64, &right->f64, sizeof(left->f64)) == 0);
  CHECK(left->char_ == right->char_ && left->word == right->word && left->signed_word == right->signed_word);
  CHECK(left->text.length == right->text.length && !memcmp(left->text.data, right->text.data, left->text.length));
  CHECK(left->bytes.length == right->bytes.length && !memcmp(left->bytes.data, right->bytes.data, left->bytes.length));
}
static void leaf(recursive_gmp_tree_t *tree) {
  recursive_gmp_tree_t_init(tree); CHECK(recursive_gmp_tree_t_select(tree, RECURSIVE_GMP_TREE_T_KIND_LEAF));
  /* select initializes the inline GMP fields. Set values without overwriting them. */
  recursive_gmp_scalars_t_clear(&tree->cases.leaf.payload); scalars(&tree->cases.leaf.payload);
}
static void round_trips(void) {
  recursive_gmp_scalars_t value, copy; scalars(&value); recursive_gmp_scalars_t_init(&copy);
  CHECK(!recursive_scalars_gmp_graph(echo_scalars, &value, &copy)); equal_scalars(&value, &copy);
  CHECK(copy.text.data != value.text.data && copy.bytes.data != value.bytes.data);
  mpz_mul_2exp(copy.natural, copy.natural, 10000); /* Finalizer must see a realloc at the moved root. */
  CHECK(mpz_cmp(value.natural, copy.natural) != 0);
  CHECK(!recursive_scalars_gmp_graph(echo_scalars, &value, &copy)); equal_scalars(&value, &copy);
  CHECK(!recursive_scalars_gmp_graph(echo_scalars, &copy, &copy)); equal_scalars(&value, &copy);
  for (unsigned i = 0; i < 3; ++i) {
    value.f32 = -0.0f; value.f64 = i == 0 ? INFINITY : i == 1 ? -INFINITY : NAN;
    CHECK(!recursive_scalars_gmp_graph(echo_scalars, &value, &copy)); equal_scalars(&value, &copy);
  }
  recursive_gmp_scalars_t_clear(&copy); recursive_gmp_scalars_t_clear(&copy); recursive_gmp_scalars_t_clear(&value);

  recursive_gmp_tree_t items[2], tree, output;
  leaf(&items[0]); recursive_gmp_tree_t_init(&items[1]); CHECK(recursive_gmp_tree_t_select(&items[1], RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  recursive_gmp_tree_t_init(&tree); CHECK(recursive_gmp_tree_t_select(&tree, RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  tree.cases.branch.children.data = items; tree.cases.branch.children.length = 2;
  recursive_gmp_tree_t_init(&output); CHECK(!recursive_tree_gmp_graph(echo_tree, &tree, &output));
  CHECK(output.cases.branch.children.length == 2 && output.cases.branch.children.data != items);
  equal_scalars(&items[0].cases.leaf.payload, &output.cases.branch.children.data[0].cases.leaf.payload);
  recursive_gmp_forest_t forest, forest_out; recursive_gmp_forest_t_init(&forest); recursive_gmp_forest_t_init(&forest_out);
  forest.data = items; forest.length = 2; CHECK(!recursive_forest_gmp_graph(echo_forest, &forest, &forest_out));
  CHECK(forest_out.length == 2 && forest_out.data != items); recursive_gmp_forest_t_clear(&forest_out);
  /* Root ownership is independent of public tags, child pointers and lengths. */
  output.cases.branch.children.data = (const recursive_gmp_tree_t *)(uintptr_t)1;
  output.cases.branch.children.length = SIZE_MAX; output.kind = UINT32_MAX; recursive_gmp_tree_t_clear(&output);
  CHECK(!recursive_tree_gmp_graph(echo_tree, &items[0], &output));
  output.kind = UINT32_MAX; recursive_gmp_tree_t_clear(&output);
  CHECK(!recursive_tree_gmp_graph(echo_tree, &items[0], &output));
  CHECK(recursive_gmp_tree_t_select(&output, RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  CHECK(!output.cases.branch.children.length);
  /* Embed an owning result in a caller-owned record, then clear the parent. */
  recursive_gmp_envelope_t parent; recursive_gmp_envelope_t_init(&parent);
  CHECK(!recursive_tree_gmp_graph(echo_tree, &items[0], &parent.tree));
  recursive_gmp_envelope_t_clear(&parent);
  recursive_gmp_tree_t_clear(&tree); CHECK(mpz_sgn(items[0].cases.leaf.payload.natural) > 0);
  recursive_gmp_tree_t_clear(&items[0]); recursive_gmp_tree_t_clear(&items[1]); recursive_gmp_tree_t_clear(&output);
  recursive_gmp_forest_t_clear(&forest);
}
static void compounds(void) {
  recursive_gmp_envelope_t value, output; recursive_gmp_envelope_t_init(&value); recursive_gmp_envelope_t_init(&output);
  RECURSIVE_OUTCOME outcome = {0}; value.outcome = &outcome;
  CHECK(recursive_gmp_tree_t_select(&value.tree, RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  outcome.error.data = "nested error"; outcome.error.length = 12;
  CHECK(!recursive_envelope_gmp_graph(echo_envelope, &value, &output)); CHECK(!output.marker.has_value);
  value.marker.has_value = 1;
  CHECK(!recursive_envelope_gmp_graph(echo_envelope, &value, &output)); CHECK(output.marker.has_value && !output.marker.value.has_value);
  value.marker.value.has_value = 1;
  CHECK(!recursive_envelope_gmp_graph(echo_envelope, &value, &output)); CHECK(output.marker.value.has_value && output.marker.value.value == 0);
  value.fallback.has_value = 1; CHECK(recursive_gmp_tree_t_select(&value.fallback.value, RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  outcome.is_ok = 1;
  recursive_gmp_tree_t_init(&outcome.ok.fst); recursive_gmp_tree_t_init(&outcome.ok.snd);
  CHECK(recursive_gmp_tree_t_select(&outcome.ok.fst, RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  CHECK(recursive_gmp_tree_t_select(&outcome.ok.snd, RECURSIVE_GMP_TREE_T_KIND_BRANCH));
  CHECK(!recursive_envelope_gmp_graph(echo_envelope, &value, &output)); CHECK(output.fallback.has_value && output.outcome->is_ok);
  recursive_gmp_envelope_t_clear(&value); recursive_gmp_envelope_t_clear(&output);

  recursive_gmp_left_tree_t left, left_out, terminal; recursive_gmp_right_tree_t right, right_out;
  recursive_gmp_left_tree_t_init(&left); recursive_gmp_left_tree_t_init(&left_out); recursive_gmp_left_tree_t_init(&terminal);
  recursive_gmp_right_tree_t_init(&right); recursive_gmp_right_tree_t_init(&right_out);
  CHECK(recursive_gmp_left_tree_t_select(&terminal, RECURSIVE_GMP_LEFT_TREE_T_KIND_LEAF)); terminal.cases.leaf.value = 7;
  CHECK(recursive_gmp_right_tree_t_select(&right, RECURSIVE_GMP_RIGHT_TREE_T_KIND_MANY)); right.cases.many.lefts.data = &terminal; right.cases.many.lefts.length = 1;
  CHECK(recursive_gmp_left_tree_t_select(&left, RECURSIVE_GMP_LEFT_TREE_T_KIND_NEXT)); left.cases.next.right = right;
  CHECK(!recursive_left_gmp_graph(echo_left, &left, &left_out));
  CHECK(left_out.cases.next.right.cases.many.lefts.data[0].cases.leaf.value == 7);
  CHECK(!recursive_right_gmp_graph(echo_right, &right, &right_out)); CHECK(right_out.cases.many.lefts.length == 1);
  recursive_gmp_left_tree_t_clear(&left); recursive_gmp_left_tree_t_clear(&left_out); recursive_gmp_left_tree_t_clear(&terminal);
  recursive_gmp_right_tree_t_clear(&right); recursive_gmp_right_tree_t_clear(&right_out);

  recursive_gmp_marker_t marker, marker_out; recursive_gmp_marker_t_init(&marker); recursive_gmp_marker_t_init(&marker_out);
  for (unsigned kind = 0; kind < 2; ++kind) {
    CHECK(recursive_gmp_marker_t_select(&marker, (recursive_gmp_marker_t_tag)kind));
    CHECK(!recursive_marker_gmp_graph(echo_marker, &marker, &marker_out)); CHECK(marker_out.kind == kind);
  }
  recursive_gmp_marker_t_clear(&marker); recursive_gmp_marker_t_clear(&marker_out);
  recursive_gmp_empty_record_t empty, empty_out; recursive_gmp_empty_record_t_init(&empty); recursive_gmp_empty_record_t_init(&empty_out);
  CHECK(!recursive_empty_record_gmp_graph(echo_empty, &empty, &empty_out)); recursive_gmp_empty_record_t_clear(&empty_out);
  RECURSIVE_UNITS_RESULT units = {0}, units_out = {0}; uint8_t data[123] = {0}; units.data = data; units.length = sizeof(data);
  CHECK(!recursive_units_gmp_graph(echo_units, &units, &units_out)); CHECK(units_out.length == 123);
  units_out._bridge_release(units_out._bridge_owner, &units_out);
}
static void failures(void) {
  recursive_gmp_tree_t value, output; leaf(&value); recursive_gmp_tree_t_init(&output);
  size_t base = live, integers = integer_live;
  attempts = 0; CHECK(!recursive_tree_gmp_graph(echo_tree, &value, &output)); size_t count = attempts;
  recursive_gmp_tree_t_clear(&output); CHECK(count > 1 && live == base && integer_live == integers);
  size_t input_failures = 0, output_failures = 0;
  for (size_t i = 1; i <= count; ++i) {
    size_t previous_calls = calls, previous_releases = releases;
    attempts = 0; fail_at = i;
    CHECK(recursive_tree_gmp_graph(echo_tree, &value, &output) == 3);
    fail_at = 0;
    CHECK(output.kind == UINT32_MAX && !output._bridge_owner);
    CHECK(live == base && integer_live == integers);
    CHECK(releases - previous_releases == calls - previous_calls);
    if (calls == previous_calls) ++input_failures; else ++output_failures;
  }
  CHECK(input_failures && output_failures);
  recursive_gmp_tree_t invalid; leaf(&invalid); invalid.cases.leaf.payload.char_ = 0x110000;
  size_t previous_calls = calls, previous_attempts = attempts;
  CHECK(recursive_join_trees_gmp_graph(echo_pair, &value, &invalid, &output) == 1);
  CHECK(calls == previous_calls && attempts == previous_attempts);
  mpz_set_si(value.cases.leaf.payload.natural, -1);
  CHECK(recursive_tree_gmp_graph(echo_tree, &value, &output) == 1);
  CHECK(calls == previous_calls && attempts == previous_attempts);
  recursive_gmp_tree_t_clear(&invalid); recursive_gmp_tree_t_clear(&value); recursive_gmp_tree_t_clear(&output);
}
static void limits(void) {
  recursive_gmp_scalars_t value, scalars_out; scalars(&value); recursive_gmp_scalars_t_init(&scalars_out);
  const size_t initial_calls = calls, initial_attempts = attempts;
  const char *texts[] = {"\xc0\x80", "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xf0\x9f", "\xe2X\x80", "\x80"};
  for (size_t i = 0; i < sizeof(texts) / sizeof(*texts); ++i) {
    value.text.data = texts[i]; value.text.length = strlen(texts[i]);
    CHECK(recursive_scalars_gmp_graph(echo_scalars, &value, &scalars_out) == 1);
  }
  value.text.data = NULL; value.text.length = SIZE_MAX;
  CHECK(recursive_scalars_gmp_graph(echo_scalars, &value, &scalars_out) == 2);
  value.text.length = 0; mpz_set_ui(value.natural, 1); mpz_mul_2exp(value.natural, value.natural, 16u * 1024u * 1024u * 8u);
  CHECK(recursive_scalars_gmp_graph(echo_scalars, &value, &scalars_out) == 2);
  CHECK(calls == initial_calls && attempts == initial_attempts);
  recursive_gmp_scalars_t_clear(&value); recursive_gmp_scalars_t_clear(&scalars_out);
  RECURSIVE_UNITS_RESULT units = {0}, units_out = {0}; uint8_t byte = 0; units.data = &byte; units.length = 262144;
  CHECK(recursive_units_gmp_graph(echo_units, &units, &units_out) == 2); CHECK(calls == initial_calls && attempts == initial_attempts);
  recursive_gmp_never_t never, never_out; recursive_gmp_never_t_init(&never); recursive_gmp_never_t_init(&never_out);
  CHECK(recursive_gmp_never_t_select(&never, RECURSIVE_GMP_NEVER_T_KIND_AGAIN)); never.cases.again.value = &never;
  CHECK(recursive_never_gmp_graph(echo_never, &never, &never_out) == 1); CHECK(calls == initial_calls && attempts == initial_attempts);
  recursive_gmp_never_t_clear(&never); recursive_gmp_never_t_clear(&never_out);
  recursive_gmp_spine_t spine[130], result; recursive_gmp_spine_t_init(&result);
  for (size_t i = 0; i < 130; ++i) {
    recursive_gmp_spine_t_init(&spine[i]);
    CHECK(recursive_gmp_spine_t_select(&spine[i], i == 129 ? RECURSIVE_GMP_SPINE_T_KIND_LEAF : RECURSIVE_GMP_SPINE_T_KIND_NEXT));
    if (i != 129) spine[i].cases.next.value = &spine[i + 1];
  }
  CHECK(!recursive_spine_gmp_graph(echo_spine, &spine[2], &result));
  recursive_gmp_spine_t_clear(&result); size_t before = calls;
  CHECK(recursive_spine_gmp_graph(echo_spine, &spine[1], &result) == 2);
  spine[0].cases.next.value = &spine[0]; CHECK(recursive_spine_gmp_graph(echo_spine, &spine[0], &result) == 1);
  spine[0].cases.next.value = NULL; CHECK(recursive_spine_gmp_graph(echo_spine, &spine[0], &result) == 1);
  CHECK(calls == before);
  for (size_t i = 0; i < 130; ++i) recursive_gmp_spine_t_clear(&spine[i]);
  recursive_gmp_wide_t wide, child, wide_out; recursive_gmp_wide_t_init(&wide); recursive_gmp_wide_t_init(&child); recursive_gmp_wide_t_init(&wide_out);
  CHECK(recursive_gmp_wide_t_select(&wide, RECURSIVE_GMP_WIDE_T_KIND_NEXT)); CHECK(recursive_gmp_wide_t_select(&child, RECURSIVE_GMP_WIDE_T_KIND_LEAF));
  wide.cases.next.field0 = 7; wide.cases.next.field254 = UINT16_MAX; wide.cases.next.child = &child; child.cases.leaf.value = 17;
  CHECK(!recursive_wide_gmp_graph(echo_wide, &wide, &wide_out));
  CHECK(wide_out.cases.next.field0 == 7 && wide_out.cases.next.field254 == UINT16_MAX && wide_out.cases.next.child->cases.leaf.value == 17);
  recursive_gmp_wide_t_clear(&wide_out); recursive_gmp_wide_t_clear(&wide); recursive_gmp_wide_t_clear(&child);
}
static unsigned bad_mode;
static uint32_t bad_spine(const recursive_spine_t *value, recursive_spine_t *out) {
  echo_spine(value, out);
  if (!bad_mode) out->kind = UINT32_MAX;
  else { out->kind = RECURSIVE_SPINE_T_KIND_NEXT; out->cases.next.value = bad_mode == 1 ? out : (const recursive_spine_t *)(uintptr_t)1; }
  return 0;
}
static uint32_t bad_scalars(const recursive_scalars_t *value, recursive_scalars_t *out) {
  echo_scalars(value, out);
  switch (bad_mode) {
    case 0: out->text.data = "\xed\xa0\x80"; out->text.length = 3; break;
    case 1: out->bytes.data = NULL; break;
    case 2: { uint8_t bad = 2; memcpy(&out->bool_, &bad, 1); break; }
    case 3: { uint8_t bad = 2; memcpy(&out->integer.negative, &bad, 1); break; }
    case 4: out->natural.data = (const uint32_t *)(uintptr_t)1; break;
    case 5: out->bytes.data = (const uint8_t *)(UINTPTR_MAX - 1); break;
    case 6: out->text.length = SIZE_MAX; break;
    default: return bad_mode - 6;
  }
  return 0;
}
static void malformed(void) {
  recursive_gmp_scalars_t value, output; scalars(&value); scalars(&output);
  size_t base = live, integers = integer_live;
  for (bad_mode = 0; bad_mode < 12; ++bad_mode) {
    size_t before = releases;
    uint32_t expected = bad_mode < 6 ? 4 : bad_mode == 6 ? 2 : bad_mode - 6;
    CHECK(recursive_scalars_gmp_graph(bad_scalars, &value, &output) == expected);
    CHECK(live == base && integer_live == integers && releases == before + 1);
    equal_scalars(&value, &output);
  }
  recursive_gmp_scalars_t_clear(&value); recursive_gmp_scalars_t_clear(&output);
  recursive_gmp_spine_t spine, spine_out; recursive_gmp_spine_t_init(&spine); recursive_gmp_spine_t_init(&spine_out);
  CHECK(recursive_gmp_spine_t_select(&spine, RECURSIVE_GMP_SPINE_T_KIND_LEAF));
  for (bad_mode = 0; bad_mode < 3; ++bad_mode) {
    CHECK(recursive_spine_gmp_graph(bad_spine, &spine, &spine_out) == 4);
    CHECK(spine_out.kind == UINT32_MAX && !spine_out._bridge_owner && !live);
  }
  recursive_gmp_spine_t_clear(&spine); recursive_gmp_spine_t_clear(&spine_out);
}
static void integers(void) {
  linked_gmp_exact_t input, output; linked_gmp_exact_t_init(input); linked_gmp_exact_t_init(output);
  mpz_set_ui(input, 1); mpz_mul_2exp(input, input, 1000); mpz_add_ui(input, input, 7); mpz_set_si(output, -1);
  CHECK(!linked_natural_gmp_graph(echo_natural, input, output)); CHECK(!mpz_cmp(input, output));
  mpz_neg(input, input); CHECK(!linked_integer_gmp_graph(echo_integer, input, output)); CHECK(!mpz_cmp(input, output));
  CHECK(linked_natural_gmp_graph(echo_natural, input, output) == 1); CHECK(!mpz_cmp(input, output));
  CHECK(!linked_integer_gmp_graph(echo_integer, output, output)); CHECK(!mpz_cmp(input, output));
  linked_gmp_exact_t_clear(input); linked_gmp_exact_t_clear(output); mpz_clear(input); mpz_clear(output);

  linked_gmp_link_t terminal, head, copy; linked_gmp_link_t_init(&terminal); linked_gmp_link_t_init(&head); linked_gmp_link_t_init(&copy);
  LINKED_NEXT next; LINKED_OUTCOME outcome;
  memset(&next, 0, sizeof(next)); memset(&outcome, 0, sizeof(outcome)); mpz_init(outcome.error);
  next.has_value = 1; next.value = &terminal; outcome.is_ok = 1; outcome.ok = &terminal;
  LINKED_NEXT none = {0}; LINKED_OUTCOME error = {0}; mpz_init(error.error); mpz_set_si(error.error, -9);
  terminal.next = &none; terminal.outcome = &error; head.next = &next; head.outcome = &outcome;
  bool flags[] = {true, false, true}; head.flags.data = flags; head.flags.length = 3;
  mpz_t numbers[3]; for (size_t i = 0; i < 3; ++i) { mpz_init_set_ui(numbers[i], i); mpz_mul_2exp(numbers[i], numbers[i], 1000); }
  head.values.data = (const linked_gmp_scalar_nat_t *)numbers; head.values.length = 3;
  CHECK(!linked_tree_gmp_graph(echo_link, &head, &copy));
  CHECK(copy.next->has_value && copy.next->value != &terminal && !copy.next->value->next->has_value);
  CHECK(copy.outcome->is_ok && mpz_cmp_si(copy.outcome->ok->outcome->error, -9) == 0);
  for (size_t i = 0; i < 3; ++i) CHECK(!mpz_cmp(copy.values.data[i], numbers[i]));
  CHECK(copy.flags.data[0] && !copy.flags.data[1] && copy.flags.data[2]);
  linked_gmp_link_t_clear(&copy);
  attempts = 0; CHECK(!linked_tree_gmp_graph(echo_link, &head, &copy)); size_t count = attempts;
  linked_gmp_link_t_clear(&copy);
  size_t baseline = live, integer_baseline = integer_live;
  for (size_t i = 1; i <= count; ++i) {
    attempts = 0; fail_at = i; CHECK(linked_tree_gmp_graph(echo_link, &head, &copy) == 3); fail_at = 0;
    CHECK(live == baseline && integer_live == integer_baseline && !copy._bridge_owner && !copy.next && !copy.values.length);
  }
  const size_t previous_calls = calls, previous_attempts = attempts;
  uint8_t invalid_bool = 2; memcpy(&flags[1], &invalid_bool, 1);
  CHECK(linked_tree_gmp_graph(echo_link, &head, &copy) == 1); flags[1] = false;
  mpz_set_si(numbers[2], -1); CHECK(linked_tree_gmp_graph(echo_link, &head, &copy) == 1);
  CHECK(calls == previous_calls && attempts == previous_attempts);
  linked_gmp_link_t_clear(&copy); linked_gmp_link_t_clear(&head); linked_gmp_link_t_clear(&terminal);
  for (size_t i = 0; i < 3; ++i) mpz_clear(numbers[i]);
  mpz_clear(error.error); mpz_clear(outcome.error);
}
int main(void) {
  mp_set_memory_functions(integer_malloc, integer_realloc, integer_free);
  round_trips(); compounds(); failures(); limits(); malformed(); integers();
  CHECK(live == 0 && integer_live == 0);
  printf("gmp-graphs-ok %zu\n", checks);
}
