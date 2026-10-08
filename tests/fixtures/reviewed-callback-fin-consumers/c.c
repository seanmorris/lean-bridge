#define _GNU_SOURCE
#include <reviewedcallbacks.h>
#include <stdio.h>
#include <string.h>

/* The harness defines CLOSURE_<name> and HOST_<name> from the generated header's callable names. */
#define CALL_(type) type##_call
#define CALL(type) CALL_(type)
#define DISPOSE_(type) type##_dispose
#define DISPOSE(type) DISPOSE_(type)

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == REVIEWEDCALLBACKS_STATUS_OK)
/* A rejected closure call names the argument and the failed leaf's bound. */
static int rejected(reviewedcallbacks_status status, const reviewedcallbacks_error *error, const char *expected) {
  return status == REVIEWEDCALLBACKS_STATUS_INVALID_ARGUMENT && error->code == REVIEWEDCALLBACKS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}

/* Lean passes the host bounded arguments; each must be below Fin 5. */
static unsigned long visited, visited_max;
static reviewedcallbacks_status host_visit(void *context, mpz_srcptr digit, mpz_ptr out, reviewedcallbacks_error *error) {
  (void)context; (void)error;
  ++visited;
  if (mpz_cmp_ui(digit, 5) >= 0) visited_max = 1000;
  else if (mpz_cmp_ui(digit, visited_max) > 0) visited_max = mpz_get_ui(digit);
  mpz_set(out, digit);
  return REVIEWEDCALLBACKS_STATUS_OK;
}
static reviewedcallbacks_status host_apply(void *context, mpz_srcptr value, mpz_ptr out, reviewedcallbacks_error *error) {
  (void)context; (void)error;
  mpz_add_ui(out, value, 1);
  return REVIEWEDCALLBACKS_STATUS_OK;
}

int main(void) {
  reviewedcallbacks_error error = {0};
  mpz_t factor, digit, out, before; mpz_init(factor); mpz_init(digit); mpz_init(out); mpz_init(before);

  /* scaler: a leased closure's Fin 10 argument is checked before Lean runs, then the closure recovers. */
  CLOSURE_SCALER *scaler = NULL; mpz_set_ui(factor, 3);
  CHECK(OK(reviewedcallbacks_scaler(factor, &scaler, &error)) && scaler);
  for (unsigned long d = 0; d < 10; ++d) { mpz_set_ui(digit, d); CHECK(OK(CALL(CLOSURE_SCALER)(scaler, digit, out, &error)) && mpz_cmp_ui(out, d * 3) == 0); }
  for (unsigned round = 0; round < 100; ++round) {
    mpz_set_ui(digit, 10 + round); mpz_set(before, digit);
    CHECK(rejected(CALL(CLOSURE_SCALER)(scaler, digit, out, &error), &error, "arg0 is not below its Fin 10 bound") && mpz_cmp(digit, before) == 0);
    mpz_set_ui(digit, round % 10);
    CHECK(OK(CALL(CLOSURE_SCALER)(scaler, digit, out, &error)) && mpz_cmp_ui(out, (round % 10) * 3) == 0);
  }
  mpz_set_ui(digit, 0); mpz_setbit(digit, 70);
  CHECK(rejected(CALL(CLOSURE_SCALER)(scaler, digit, out, &error), &error, "arg0 is not below its Fin 10 bound"));
  DISPOSE(CLOSURE_SCALER)(&scaler); CHECK(scaler == NULL);

  /* counter: Lean produces the Fin 10 result. */
  CLOSURE_COUNTER *counter = NULL; mpz_set_ui(factor, 7);
  CHECK(OK(reviewedcallbacks_counter(factor, &counter, &error)) && counter);
  for (unsigned long step = 0; step < 25; ++step) { mpz_set_ui(digit, step); CHECK(OK(CALL(CLOSURE_COUNTER)(counter, digit, out, &error)) && mpz_cmp_ui(out, (7 + step) % 10) == 0); }
  DISPOSE(CLOSURE_COUNTER)(&counter);

  /* visit: Lean passes Fin 5 arguments to the host. */
  HOST_VISIT host = {host_visit, NULL};
  CHECK(OK(reviewedcallbacks_visit(&host, out, &error)) && mpz_cmp_ui(out, 10) == 0 && visited == 5 && visited_max == 4);

  /* digits: every element of an Array (Fin 3) argument is checked. */
  CLOSURE_DIGITS *digits = NULL;
  CHECK(OK(reviewedcallbacks_digits(0, &digits, &error)) && digits);
  mpz_t items[3]; for (unsigned i = 0; i < 3; ++i) mpz_init_set_ui(items[i], i);
  reviewedcallbacks_array_nat_span span = {(const reviewedcallbacks_nat *)items, 3, NULL, NULL};
  CHECK(OK(CALL(CLOSURE_DIGITS)(digits, &span, out, &error)) && mpz_cmp_ui(out, 5) == 0);
  for (unsigned bad = 0; bad < 3; ++bad) {
    mpz_set_ui(items[bad], 3);
    CHECK(rejected(CALL(CLOSURE_DIGITS)(digits, &span, out, &error), &error, "arg0 is not below its Fin 3 bound") && mpz_cmp_ui(items[bad], 3) == 0);
    mpz_set_ui(items[bad], bad);
  }
  span.length = 0; CHECK(OK(CALL(CLOSURE_DIGITS)(digits, &span, out, &error)) && mpz_cmp_ui(out, 0) == 0);
  for (unsigned i = 0; i < 3; ++i) mpz_clear(items[i]);
  DISPOSE(CLOSURE_DIGITS)(&digits);

  /* tiles: the nominal Tile's Fin 5 field is checked in every element of a closure argument. */
  CLOSURE_TILES *tiles = NULL;
  CHECK(OK(reviewedcallbacks_tiles(0, &tiles, &error)) && tiles);
  reviewedcallbacks_tile row[3];
  for (unsigned i = 0; i < 3; ++i) { reviewedcallbacks_tile_init(&row[i]); mpz_set_ui(row[i].digit, i); mpz_set_ui(row[i].count, 10); }
  reviewedcallbacks_list_lean_reviewed_callbacks_tile_span rows = {row, 3, NULL, NULL};
  CHECK(OK(CALL(CLOSURE_TILES)(tiles, &rows, out, &error)) && mpz_cmp_ui(out, 330) == 0);
  for (unsigned bad = 0; bad < 3; ++bad) {
    mpz_set_ui(row[bad].digit, 5);
    CHECK(rejected(CALL(CLOSURE_TILES)(tiles, &rows, out, &error), &error, "arg0 is not below its Fin 5 bound") && mpz_cmp_ui(row[bad].digit, 5) == 0);
    mpz_set_ui(row[bad].digit, bad);
  }
  CHECK(OK(CALL(CLOSURE_TILES)(tiles, &rows, out, &error)) && mpz_cmp_ui(out, 330) == 0);
  for (unsigned i = 0; i < 3; ++i) reviewedcallbacks_tile_clear(&row[i]);
  DISPOSE(CLOSURE_TILES)(&tiles);

  /* tileMaker: Lean produces a Tile whose Fin 5 field it proved. */
  CLOSURE_TILEMAKER *maker = NULL; mpz_set_ui(factor, 3);
  CHECK(OK(reviewedcallbacks_tile_maker(factor, &maker, &error)) && maker);
  for (unsigned long n = 0; n < 12; ++n) {
    reviewedcallbacks_tile made; reviewedcallbacks_tile_init(&made); mpz_set_ui(digit, n);
    CHECK(OK(CALL(CLOSURE_TILEMAKER)(maker, digit, &made, &error)) && mpz_cmp_ui(made.digit, (3 + n) % 5) == 0 && mpz_cmp_ui(made.count, n) == 0);
    reviewedcallbacks_tile_clear(&made);
  }
  DISPOSE(CLOSURE_TILEMAKER)(&maker);

  /* apply: an unrefined host callback is unchanged. */
  HOST_APPLY plus = {host_apply, NULL}; mpz_set_ui(digit, 41);
  CHECK(OK(reviewedcallbacks_apply(&plus, digit, out, &error)) && mpz_cmp_ui(out, 42) == 0);

  mpz_clear(factor); mpz_clear(digit); mpz_clear(out); mpz_clear(before);
  printf("reviewed-callback-fin-ok:%u\n", checks);
  return 0;
}
