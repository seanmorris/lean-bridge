#define _GNU_SOURCE
#include <finrecords.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == FINRECORDS_STATUS_OK)
/* A rejected call names the parameter and the failed leaf's bound. */
static int rejected(finrecords_status status, const finrecords_error *error, const char *expected) {
  return status == FINRECORDS_STATUS_INVALID_ARGUMENT && error->code == FINRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
static finrecords_string text(const char *value) { finrecords_string result = {value, strlen(value), NULL, NULL}; return result; }
static void tile(finrecords_tile *value, unsigned long digit, unsigned long count) { finrecords_tile_init(value); mpz_set_ui(value->digit, digit); mpz_set_ui(value->count, count); }
static int same_tile(const finrecords_tile *a, const finrecords_tile *b) { return mpz_cmp(a->digit, b->digit) == 0 && mpz_cmp(a->count, b->count) == 0; }

int main(void) {
  finrecords_error error = {0};
  mpz_t count; mpz_init(count);
  /* Tile: the digit is Fin 5; any count is valid. Each rejected input is compared with an
     independently built copy before the caller changes it back. */
  finrecords_tile t, before;
  for (unsigned long d = 0; d < 5; ++d) { tile(&t, d, 10); CHECK(OK(finrecords_tile_sum(&t, count, &error)) && mpz_cmp_ui(count, d + 10) == 0); finrecords_tile_clear(&t); }
  tile(&t, 3, 0); mpz_setbit(t.count, 100);
  CHECK(OK(finrecords_tile_sum(&t, count, &error)) && mpz_tstbit(count, 100));
  mpz_set_ui(t.digit, 5); tile(&before, 5, 0); mpz_setbit(before.count, 100);
  CHECK(rejected(finrecords_tile_sum(&t, count, &error), &error, "arg0 is not below its Fin 5 bound") && same_tile(&t, &before));
  mpz_set_ui(t.digit, 0); mpz_setbit(t.digit, 70); mpz_set(before.digit, t.digit);
  CHECK(rejected(finrecords_tile_sum(&t, count, &error), &error, "arg0 is not below its Fin 5 bound") && same_tile(&t, &before));
  finrecords_tile_clear(&before);
  /* Nest: the inner record's own bound and the outer bound are both checked. */
  finrecords_nest n; finrecords_nest_init(&n);
  mpz_set_ui(n.inner.digit, 4); mpz_set_ui(n.inner.count, 6); mpz_set_ui(n.tag, 2);
  CHECK(OK(finrecords_nest_sum(&n, count, &error)) && mpz_cmp_ui(count, 210) == 0);
  mpz_set_ui(n.inner.digit, 5);
  CHECK(rejected(finrecords_nest_sum(&n, count, &error), &error, "arg0 is not below its Fin 5 bound") && mpz_cmp_ui(n.inner.digit, 5) == 0 && mpz_cmp_ui(n.tag, 2) == 0);
  mpz_set_ui(n.inner.digit, 4); mpz_set_ui(n.tag, 3);
  CHECK(rejected(finrecords_nest_sum(&n, count, &error), &error, "arg0 is not below its Fin 3 bound") && mpz_cmp_ui(n.inner.digit, 4) == 0 && mpz_cmp_ui(n.tag, 3) == 0);
  mpz_set_ui(n.tag, 2);
  CHECK(OK(finrecords_nest_sum(&n, count, &error)) && mpz_cmp_ui(count, 210) == 0); /* Recovery. */
  finrecords_nest_clear(&n);
  /* Late: heap fields precede the bound; a rejection leaves them as the caller built them. */
  mpz_t items[2]; mpz_init_set_ui(items[0], 1); mpz_init_set_ui(items[1], 2);
  finrecords_late late; finrecords_late_init(&late);
  late.label = text("ab"); late.items.data = items; late.items.length = 2; mpz_set_ui(late.digit, 4);
  CHECK(OK(finrecords_late_sum(&late, count, &error)) && mpz_cmp_ui(count, 4005) == 0);
  mpz_set_ui(late.digit, 5);
  CHECK(rejected(finrecords_late_sum(&late, count, &error), &error, "arg0 is not below its Fin 5 bound")
    && late.label.length == 2 && memcmp(late.label.data, "ab", 2) == 0 && late.items.length == 2 && mpz_cmp_ui(items[1], 2) == 0 && mpz_cmp_ui(late.digit, 5) == 0);
  mpz_set_ui(late.digit, 4);
  CHECK(OK(finrecords_late_sum(&late, count, &error)) && mpz_cmp_ui(count, 4005) == 0);
  mpz_clear(late.digit); mpz_clear(items[0]); mpz_clear(items[1]);
  /* Slot: Option (Fin 0) is valid only when absent. */
  finrecords_slot slot; finrecords_slot_init(&slot); mpz_set_ui(slot.count, 8);
  CHECK(OK(finrecords_slot_count(&slot, count, &error)) && mpz_cmp_ui(count, 8) == 0);
  slot.maybe.has_value = 1;
  CHECK(rejected(finrecords_slot_count(&slot, count, &error), &error, "arg0 is not below its Fin 0 bound") && slot.maybe.has_value && mpz_sgn(slot.maybe.value) == 0);
  finrecords_slot_clear(&slot);
  /* Shape: only the active case is checked. */
  finrecords_shape s; finrecords_shape_init(&s);
  CHECK(OK(finrecords_shape_select(&s, FINRECORDS_SHAPE_KIND_CIRCLE))); mpz_set_ui(s.cases.circle.radius, 9);
  CHECK(OK(finrecords_shape_size(&s, count, &error)) && mpz_cmp_ui(count, 9) == 0);
  mpz_set_ui(s.cases.circle.radius, 10);
  CHECK(rejected(finrecords_shape_size(&s, count, &error), &error, "arg0 is not below its Fin 10 bound") && s.kind == FINRECORDS_SHAPE_KIND_CIRCLE && mpz_cmp_ui(s.cases.circle.radius, 10) == 0);
  CHECK(OK(finrecords_shape_select(&s, FINRECORDS_SHAPE_KIND_LABEL))); s.cases.label.text = text("abc");
  CHECK(OK(finrecords_shape_size(&s, count, &error)) && mpz_cmp_ui(count, 1003) == 0);
  s.cases.label.text = text("");
  CHECK(OK(finrecords_shape_select(&s, FINRECORDS_SHAPE_KIND_EMPTY)));
  CHECK(OK(finrecords_shape_size(&s, count, &error)) && mpz_cmp_ui(count, 7) == 0);
  finrecords_shape_clear(&s);
  /* Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid. */
  finrecords_gate g; finrecords_gate_init(&g);
  CHECK(OK(finrecords_gate_select(&g, FINRECORDS_GATE_KIND_CLOSED)));
  CHECK(OK(finrecords_gate_open(&g, count, &error)) && mpz_cmp_ui(count, 1) == 0);
  CHECK(OK(finrecords_gate_select(&g, FINRECORDS_GATE_KIND_NEVER)));
  CHECK(rejected(finrecords_gate_open(&g, count, &error), &error, "arg0 is not below its Fin 0 bound") && g.kind == FINRECORDS_GATE_KIND_NEVER);
  finrecords_gate_clear(&g);
  /* Array Tile: every element; the empty array is valid. */
  finrecords_tile row[3]; tile(&row[0], 0, 1); tile(&row[1], 4, 2); tile(&row[2], 1, 0);
  finrecords_array_lean_fin_records_tile_span tiles = {row, 3, NULL, NULL}, none = {NULL, 0, NULL, NULL};
  CHECK(OK(finrecords_tiles(&none, count, &error)) && mpz_cmp_ui(count, 0) == 0);
  CHECK(OK(finrecords_tiles(&tiles, count, &error)) && mpz_cmp_ui(count, 8) == 0);
  for (int k = 0; k < 3; ++k) {
    unsigned long kept = mpz_get_ui(row[k].digit);
    mpz_set_ui(row[k].digit, 5);
    CHECK(rejected(finrecords_tiles(&tiles, count, &error), &error, "arg0 is not below its Fin 5 bound") && mpz_cmp_ui(row[k].digit, 5) == 0);
    mpz_set_ui(row[k].digit, kept);
  }
  CHECK(OK(finrecords_tiles(&tiles, count, &error)) && mpz_cmp_ui(count, 8) == 0);
  /* Option Shape: absent, a valid present circle, then an invalid one. */
  finrecords_option_lean_fin_records_shape_value maybe; finrecords_option_lean_fin_records_shape_value_init(&maybe);
  CHECK(OK(finrecords_maybe_shape(&maybe, count, &error)) && mpz_cmp_ui(count, 99) == 0);
  maybe.has_value = 1; CHECK(OK(finrecords_shape_select(&maybe.value, FINRECORDS_SHAPE_KIND_CIRCLE))); mpz_set_ui(maybe.value.cases.circle.radius, 3);
  CHECK(OK(finrecords_maybe_shape(&maybe, count, &error)) && mpz_cmp_ui(count, 3) == 0);
  mpz_set_ui(maybe.value.cases.circle.radius, 10);
  CHECK(rejected(finrecords_maybe_shape(&maybe, count, &error), &error, "arg0 is not below its Fin 10 bound"));
  finrecords_option_lean_fin_records_shape_value_clear(&maybe);
  /* Results carrying bounds are produced by Lean and arrive below them. */
  finrecords_tile bumped; finrecords_tile_init(&bumped); tile(&t, 4, 9);
  CHECK(OK(finrecords_bump(&t, &bumped, &error)) && mpz_cmp_ui(bumped.digit, 0) == 0 && mpz_cmp_ui(bumped.count, 10) == 0);
  mpz_set_ui(t.digit, 5);
  CHECK(rejected(finrecords_bump(&t, &bumped, &error), &error, "arg0 is not below its Fin 5 bound"));
  finrecords_tile_clear(&bumped);
  finrecords_shape made; finrecords_shape_init(&made); mpz_set_ui(count, 4);
  CHECK(OK(finrecords_make_shape(count, &made, &error)) && made.kind == FINRECORDS_SHAPE_KIND_CIRCLE && mpz_cmp_ui(made.cases.circle.radius, 4) == 0);
  finrecords_shape_clear(&made); finrecords_shape_init(&made); mpz_set_ui(count, 23);
  CHECK(OK(finrecords_make_shape(count, &made, &error)) && made.kind == FINRECORDS_SHAPE_KIND_LABEL && made.cases.label.text.length == 2);
  finrecords_shape_clear(&made);
  for (unsigned long i = 0; i < 1000; ++i) {
    mpz_set_ui(t.digit, i % 5); mpz_set_ui(t.count, i);
    if (!OK(finrecords_tile_sum(&t, count, &error)) || mpz_cmp_ui(count, i % 5 + i) != 0) { fprintf(stderr, "round %lu failed\n", i); return 1; }
    mpz_set_ui(t.digit, 5 + i);
    if (!rejected(finrecords_tile_sum(&t, count, &error), &error, "arg0 is not below its Fin 5 bound") || mpz_cmp_ui(t.digit, 5 + i) != 0) { fprintf(stderr, "rejection round %lu failed\n", i); return 1; }
  }
  checks += 2000;
  finrecords_tile_clear(&t); for (int k = 0; k < 3; ++k) finrecords_tile_clear(&row[k]); mpz_clear(count);
  printf("fin-record-ok:%u\n", checks);
  return 0;
}
