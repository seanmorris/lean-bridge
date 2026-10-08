#define _GNU_SOURCE
#include <fincallbacks.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>

/* The harness defines CLOSURE_<name> and HOST_VISIT from the generated header's closure names. */
#define CALL_(type) type##_call
#define CALL(type) CALL_(type)
#define DISPOSE_(type) type##_dispose
#define DISPOSE(type) DISPOSE_(type)

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == FINCALLBACKS_STATUS_OK)
/* A rejected closure call names the argument and the failed leaf's bound. */
static int rejected(fincallbacks_status status, const fincallbacks_error *error, const char *expected) {
  return status == FINCALLBACKS_STATUS_INVALID_ARGUMENT && error->code == FINCALLBACKS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}

/* The host callback records every argument Lean passes; each must be below its Fin 5 bound. */
static unsigned long visited, visited_max;
static fincallbacks_status host_visit(void *context, mpz_srcptr digit, mpz_ptr out, fincallbacks_error *error) {
  (void)context; (void)error;
  ++visited;
  if (mpz_cmp_ui(digit, visited_max) > 0) visited_max = mpz_get_ui(digit);
  if (mpz_cmp_ui(digit, 5) >= 0) visited_max = 1000;
  mpz_mul_ui(out, digit, 10);
  return FINCALLBACKS_STATUS_OK;
}

static CLOSURE_SCALER *shared_scaler;
static fincallbacks_status thread_status;
static void *other_thread(void *unused) {
  (void)unused;
  fincallbacks_error error = {0};
  mpz_t digit, out; mpz_init_set_ui(digit, 4); mpz_init(out);
  thread_status = CALL(CLOSURE_SCALER)(shared_scaler, digit, out, &error);
  mpz_clear(digit); mpz_clear(out);
  return NULL;
}

int main(void) {
  fincallbacks_error error = {0};
  mpz_t factor, digit, out, before; mpz_init(factor); mpz_init(digit); mpz_init(out); mpz_init(before);

  /* Fin 10 argument of a leased closure: every value below 10 runs, 10 and a 2^70 value are refused. */
  CLOSURE_SCALER *scaler = NULL; mpz_set_ui(factor, 7);
  CHECK(OK(fincallbacks_scaler(factor, &scaler, &error)) && scaler);
  for (unsigned long d = 0; d < 10; ++d) { mpz_set_ui(digit, d); CHECK(OK(CALL(CLOSURE_SCALER)(scaler, digit, out, &error)) && mpz_cmp_ui(out, d * 7) == 0); }
  mpz_set_ui(digit, 10); mpz_set(before, digit);
  CHECK(rejected(CALL(CLOSURE_SCALER)(scaler, digit, out, &error), &error, "arg0 is not below its Fin 10 bound") && mpz_cmp(digit, before) == 0);
  mpz_set_ui(digit, 0); mpz_setbit(digit, 70);
  CHECK(rejected(CALL(CLOSURE_SCALER)(scaler, digit, out, &error), &error, "arg0 is not below its Fin 10 bound"));
  /* The same closure recovers after each rejection: identity and lease are unchanged. */
  for (unsigned round = 0; round < 100; ++round) {
    mpz_set_ui(digit, 10 + round);
    CHECK(rejected(CALL(CLOSURE_SCALER)(scaler, digit, out, &error), &error, "arg0 is not below its Fin 10 bound"));
    mpz_set_ui(digit, round % 10);
    CHECK(OK(CALL(CLOSURE_SCALER)(scaler, digit, out, &error)) && mpz_cmp_ui(out, (round % 10) * 7) == 0);
  }
  /* A closure leased on one thread is refused on another, and still works on its own. */
  shared_scaler = scaler; pthread_t thread;
  CHECK(pthread_create(&thread, NULL, other_thread, NULL) == 0 && pthread_join(thread, NULL) == 0);
  CHECK(thread_status == FINCALLBACKS_STATUS_INVALID_ARGUMENT);
  mpz_set_ui(digit, 9); CHECK(OK(CALL(CLOSURE_SCALER)(scaler, digit, out, &error)) && mpz_cmp_ui(out, 63) == 0);
  /* Disposal releases the lease exactly once and clears the caller's pointer. */
  DISPOSE(CLOSURE_SCALER)(&scaler); CHECK(scaler == NULL);

  /* Fin 0 has no values: every argument is refused, nothing is manufactured, and the closure stays disposable. */
  CLOSURE_IMPOSSIBLE *impossible = NULL;
  CHECK(OK(fincallbacks_impossible(0, &impossible, &error)) && impossible);
  for (unsigned long d = 0; d < 3; ++d) { mpz_set_ui(digit, d); CHECK(rejected(CALL(CLOSURE_IMPOSSIBLE)(impossible, digit, out, &error), &error, "arg0 is not below its Fin 0 bound")); }
  DISPOSE(CLOSURE_IMPOSSIBLE)(&impossible); CHECK(impossible == NULL);

  /* A bound wider than 64 bits: its predecessor runs, the bound itself is refused. */
  CLOSURE_WIDE *wide = NULL;
  CHECK(OK(fincallbacks_wide(0, &wide, &error)) && wide);
  mpz_set_str(digit, "184467440737095516169", 10);
  mpz_set_str(before, "184467440737095516170", 10);
  CHECK(OK(CALL(CLOSURE_WIDE)(wide, digit, out, &error)) && mpz_cmp(out, before) == 0);
  mpz_set_str(digit, "184467440737095516170", 10);
  CHECK(rejected(CALL(CLOSURE_WIDE)(wide, digit, out, &error), &error, "arg0 is not below its Fin 184467440737095516170 bound"));
  DISPOSE(CLOSURE_WIDE)(&wide);

  /* Array (Fin 3): the first, middle and last invalid element are refused; the caller's array is unchanged. */
  CLOSURE_DIGITS *digits = NULL;
  CHECK(OK(fincallbacks_digits(0, &digits, &error)) && digits);
  mpz_t items[3]; for (unsigned i = 0; i < 3; ++i) mpz_init_set_ui(items[i], i);
  fincallbacks_array_nat_span span = {(const fincallbacks_nat *)items, 3, NULL, NULL};
  CHECK(OK(CALL(CLOSURE_DIGITS)(digits, &span, out, &error)) && mpz_cmp_ui(out, 5) == 0);
  for (unsigned bad = 0; bad < 3; ++bad) {
    mpz_set_ui(items[bad], 3);
    CHECK(rejected(CALL(CLOSURE_DIGITS)(digits, &span, out, &error), &error, "arg0 is not below its Fin 3 bound") && mpz_cmp_ui(items[bad], 3) == 0);
    mpz_set_ui(items[bad], bad);
  }
  span.length = 0; CHECK(OK(CALL(CLOSURE_DIGITS)(digits, &span, out, &error)) && mpz_cmp_ui(out, 0) == 0);
  for (unsigned i = 0; i < 3; ++i) mpz_clear(items[i]);
  DISPOSE(CLOSURE_DIGITS)(&digits);

  /* Option (Fin 5 × Nat): an absent value runs, a present component at its bound is refused. */
  CLOSURE_PICK *pick = NULL;
  CHECK(OK(fincallbacks_pick(0, &pick, &error)) && pick);
  fincallbacks_option_tuple_nat_nat_value choice; fincallbacks_option_tuple_nat_nat_value_init(&choice);
  CHECK(OK(CALL(CLOSURE_PICK)(pick, &choice, out, &error)) && mpz_cmp_ui(out, 100) == 0);
  choice.has_value = 1; mpz_set_ui(choice.value.fst, 4); mpz_set_ui(choice.value.snd, 7);
  CHECK(OK(CALL(CLOSURE_PICK)(pick, &choice, out, &error)) && mpz_cmp_ui(out, 11) == 0);
  mpz_set_ui(choice.value.fst, 5);
  CHECK(rejected(CALL(CLOSURE_PICK)(pick, &choice, out, &error), &error, "arg0 is not below its Fin 5 bound") && mpz_cmp_ui(choice.value.fst, 5) == 0);
  fincallbacks_option_tuple_nat_nat_value_clear(&choice);
  DISPOSE(CLOSURE_PICK)(&pick);

  /* Except String (Fin 7): only the active ok branch is bounded. */
  CLOSURE_BRANCH *branch = NULL;
  CHECK(OK(fincallbacks_branch(0, &branch, &error)) && branch);
  fincallbacks_result_nat_string_value value; fincallbacks_result_nat_string_value_init(&value);
  value.is_ok = 1; mpz_set_ui(value.ok, 6);
  CHECK(OK(CALL(CLOSURE_BRANCH)(branch, &value, out, &error)) && mpz_cmp_ui(out, 6) == 0);
  mpz_set_ui(value.ok, 7);
  CHECK(rejected(CALL(CLOSURE_BRANCH)(branch, &value, out, &error), &error, "arg0 is not below its Fin 7 bound"));
  fincallbacks_result_nat_string_value_clear(&value); fincallbacks_result_nat_string_value_init(&value);
  value.is_ok = 0; value.error = (fincallbacks_string){"abc", 3, NULL, NULL};
  CHECK(OK(CALL(CLOSURE_BRANCH)(branch, &value, out, &error)) && mpz_cmp_ui(out, 53) == 0);
  DISPOSE(CLOSURE_BRANCH)(&branch);

  /* A leased closure's Fin 10 result: Lean produces it, so the host only receives values below 10. */
  CLOSURE_COUNTER *counter = NULL; mpz_set_ui(factor, 8);
  CHECK(OK(fincallbacks_counter(factor, &counter, &error)) && counter);
  for (unsigned long step = 0; step < 25; ++step) { mpz_set_ui(digit, step); CHECK(OK(CALL(CLOSURE_COUNTER)(counter, digit, out, &error)) && mpz_cmp_ui(out, (8 + step) % 10) == 0); }
  DISPOSE(CLOSURE_COUNTER)(&counter);

  /* A host callback's Fin 5 arguments come from Lean: the host sees every value 0 through 4 and nothing at the bound. */
  HOST_VISIT host = {host_visit, NULL};
  CHECK(OK(fincallbacks_visit(&host, out, &error)) && mpz_cmp_ui(out, 100) == 0 && visited == 5 && visited_max == 4);

  mpz_clear(factor); mpz_clear(digit); mpz_clear(out); mpz_clear(before);
  printf("fin-callback-ok:%u\n", checks);
  return 0;
}
