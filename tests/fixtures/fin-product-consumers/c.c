#define _GNU_SOURCE
#include <finproducts.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == FINPRODUCTS_STATUS_OK)
typedef finproducts_tuple_nat_nat_value pair;
typedef finproducts_result_nat_string_value ok_only;
typedef finproducts_result_nat_nat_value branches;
static const char *wide_text = "184467440737095516170"; /* 10 * 2^64 + 10 */
/* A rejected call names the parameter and the failed leaf's bound. */
static int rejected(finproducts_status status, const finproducts_error *error, const char *expected) {
  return status == FINPRODUCTS_STATUS_INVALID_ARGUMENT && error->code == FINPRODUCTS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
static int is_small(mpz_srcptr value, unsigned long n) { return mpz_cmp_ui(value, n) == 0; }
static finproducts_string text(const char *value) { finproducts_string result = {value, strlen(value), NULL, NULL}; return result; }

int main(void) {
  finproducts_error error = {0};
  mpz_t count; mpz_init(count);
  pair in, out; finproducts_tuple_nat_nat_value_init(&in); finproducts_tuple_nat_nat_value_init(&out);
  /* Fin 10 × Nat: only the first component is bounded. */
  for (unsigned long d = 0; d < 10; ++d) {
    mpz_set_ui(in.fst, d); mpz_set_ui(in.snd, 1000);
    CHECK(OK(finproducts_first(&in, &out, &error)) && is_small(out.fst, 9 - d) && is_small(out.snd, 1001));
  }
  mpz_set_ui(in.fst, 10); mpz_set_ui(in.snd, 0);
  CHECK(rejected(finproducts_first(&in, &out, &error), &error, "arg0 is not below its Fin 10 bound"));
  mpz_set_ui(in.fst, 0); mpz_setbit(in.fst, 70);
  CHECK(rejected(finproducts_first(&in, &out, &error), &error, "arg0 is not below its Fin 10 bound"));
  mpz_set_ui(in.fst, 3); mpz_setbit(in.snd, 200); /* The unbounded component accepts any Nat. */
  CHECK(OK(finproducts_first(&in, &out, &error)) && is_small(out.fst, 6) && mpz_tstbit(out.snd, 200));
  /* Nat × Fin 1: only zero is admitted in the second component. */
  mpz_set_ui(in.fst, 41); mpz_set_ui(in.snd, 0);
  CHECK(OK(finproducts_second(&in, count, &error)) && is_small(count, 41));
  mpz_set_ui(in.snd, 1);
  CHECK(rejected(finproducts_second(&in, count, &error), &error, "arg0 is not below its Fin 1 bound"));
  /* A bound wider than 64 bits in one component, Fin 10 in the other. */
  mpz_set_str(in.fst, wide_text, 10); mpz_sub_ui(in.fst, in.fst, 1); mpz_set_ui(in.snd, 9);
  CHECK(OK(finproducts_wide(&in, count, &error)));
  mpz_add_ui(in.fst, in.fst, 1);
  CHECK(rejected(finproducts_wide(&in, count, &error), &error, "arg0 is not below its Fin 184467440737095516170 bound"));
  mpz_sub_ui(in.fst, in.fst, 1); mpz_set_ui(in.snd, 10);
  CHECK(rejected(finproducts_wide(&in, count, &error), &error, "arg0 is not below its Fin 10 bound"));
  /* Option (Fin 0 × Nat): only none is valid. */
  finproducts_option_tuple_nat_nat_value never; finproducts_option_tuple_nat_nat_value_init(&never);
  CHECK(OK(finproducts_never(&never, count, &error)) && is_small(count, 7));
  never.has_value = 1;
  CHECK(rejected(finproducts_never(&never, count, &error), &error, "arg0 is not below its Fin 0 bound"));
  finproducts_option_tuple_nat_nat_value_clear(&never);
  /* Except String (Fin 10): the ok branch is bounded; any error text is valid. */
  ok_only o; finproducts_result_nat_string_value_init(&o);
  o.is_ok = 1; mpz_set_ui(o.ok, 9);
  CHECK(OK(finproducts_ok_only(&o, count, &error)) && is_small(count, 9));
  mpz_set_ui(o.ok, 10);
  CHECK(rejected(finproducts_ok_only(&o, count, &error), &error, "arg0 is not below its Fin 10 bound"));
  finproducts_result_nat_string_value_clear(&o);
  /* The inactive branch is never checked: a well-formed error text passes without an ok value. */
  ok_only text_error; finproducts_result_nat_string_value_init(&text_error);
  text_error.is_ok = 0; text_error.error = text("four");
  CHECK(OK(finproducts_ok_only(&text_error, count, &error)) && is_small(count, 104));
  mpz_clear(text_error.ok);
  /* Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid. */
  branches e; finproducts_result_nat_nat_value_init(&e);
  e.is_ok = 1; mpz_setbit(e.ok, 100); /* A well-formed ok Nat; the bounded error slot is never written. */
  CHECK(OK(finproducts_error_only(&e, count, &error)) && mpz_tstbit(count, 100));
  finproducts_result_nat_nat_value_clear(&e); finproducts_result_nat_nat_value_init(&e);
  e.is_ok = 0; mpz_set_ui(e.error, 4);
  CHECK(OK(finproducts_error_only(&e, count, &error)) && is_small(count, 104));
  mpz_set_ui(e.error, 5);
  CHECK(rejected(finproducts_error_only(&e, count, &error), &error, "arg0 is not below its Fin 5 bound"));
  finproducts_result_nat_nat_value_clear(&e);
  /* Except (Fin 3) (Fin 7): only the active branch is checked. Each call builds a fresh value
     whose inactive slot is never written, so no inactive payload is fabricated. */
  const unsigned long both_cases[4][2] = {{1, 6}, {1, 7}, {0, 2}, {0, 3}};
  for (int i = 0; i < 4; ++i) {
    branches b; finproducts_result_nat_nat_value_init(&b);
    b.is_ok = (int)both_cases[i][0];
    mpz_set_ui(both_cases[i][0] ? b.ok : b.error, both_cases[i][1]);
    finproducts_status status = finproducts_both(&b, count, &error);
    if (i == 0) CHECK(OK(status) && is_small(count, 6));
    if (i == 1) CHECK(rejected(status, &error, "arg0 is not below its Fin 7 bound"));
    if (i == 2) CHECK(OK(status) && is_small(count, 102));
    if (i == 3) CHECK(rejected(status, &error, "arg0 is not below its Fin 3 bound"));
    finproducts_result_nat_nat_value_clear(&b);
  }
  /* List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels. */
  finproducts_option_tuple_nat_result_nat_nat_value rows[3];
  for (int i = 0; i < 3; ++i) finproducts_option_tuple_nat_result_nat_nat_value_init(&rows[i]);
  rows[1].has_value = 1; mpz_set_ui(rows[1].value.fst, 2); rows[1].value.snd.is_ok = 1; mpz_set_ui(rows[1].value.snd.ok, 50);
  rows[2].has_value = 1; mpz_set_ui(rows[2].value.fst, 1); rows[2].value.snd.is_ok = 0; mpz_set_ui(rows[2].value.snd.error, 1);
  finproducts_list_option_tuple_nat_result_nat_nat_span list = {rows, 3, NULL, NULL};
  CHECK(OK(finproducts_nested(&list, count, &error)) && is_small(count, 54));
  mpz_set_ui(rows[2].value.snd.error, 2);
  CHECK(rejected(finproducts_nested(&list, count, &error), &error, "arg0 is not below its Fin 2 bound"));
  mpz_set_ui(rows[2].value.snd.error, 1); mpz_set_ui(rows[1].value.fst, 3);
  CHECK(rejected(finproducts_nested(&list, count, &error), &error, "arg0 is not below its Fin 3 bound"));
  mpz_set_ui(rows[1].value.fst, 2);
  CHECK(OK(finproducts_nested(&list, count, &error)) && is_small(count, 54)); /* Recovery after rejections. */
  for (int i = 0; i < 3; ++i) finproducts_option_tuple_nat_result_nat_nat_value_clear(&rows[i]);
  /* DigitPair := Digit × Digit through the alias: both components are bounded and swapped. */
  mpz_set_ui(in.fst, 1); mpz_set_ui(in.snd, 9);
  CHECK(OK(finproducts_aliased(&in, &out, &error)) && is_small(out.fst, 9) && is_small(out.snd, 1));
  mpz_set_ui(in.snd, 10);
  CHECK(rejected(finproducts_aliased(&in, &out, &error), &error, "arg0 is not below its Fin 10 bound"));
  /* Results carrying bounds are produced by Lean and arrive below them. */
  finproducts_result_string_nat_value produced; finproducts_result_string_nat_value_init(&produced);
  mpz_set_ui(count, 4);
  CHECK(OK(finproducts_produce(count, &produced, &error)) && !produced.is_ok && is_small(produced.error, 4));
  finproducts_result_string_nat_value_clear(&produced);
  mpz_set_ui(count, 23);
  CHECK(OK(finproducts_pair_up(count, &out, &error)) && is_small(out.fst, 3) && is_small(out.snd, 23));
  for (unsigned long i = 0; i < 1000; ++i) {
    mpz_set_ui(in.fst, i % 10); mpz_set_ui(in.snd, i);
    if (!OK(finproducts_first(&in, &out, &error)) || !is_small(out.fst, 9 - i % 10)) { fprintf(stderr, "round %lu failed\n", i); return 1; }
    mpz_set_ui(in.fst, 10 + i);
    if (!rejected(finproducts_first(&in, &out, &error), &error, "arg0 is not below its Fin 10 bound")) { fprintf(stderr, "rejection round %lu failed\n", i); return 1; }
  }
  checks += 2000;
  finproducts_tuple_nat_nat_value_clear(&in); finproducts_tuple_nat_nat_value_clear(&out); mpz_clear(count);
  printf("fin-product-ok:%u\n", checks);
  return 0;
}
