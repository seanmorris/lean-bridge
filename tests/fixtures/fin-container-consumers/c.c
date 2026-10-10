#define _GNU_SOURCE
#include <fincontainers.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == FINCONTAINERS_STATUS_OK)
typedef fincontainers_array_nat_span nats;
typedef fincontainers_option_nat_value maybe;
static const char *huge_text = "1180591620717411303424"; /* 2^70 */
/* A rejected call names the parameter and the failed leaf's bound and leaves outputs unchanged. */
static int rejected(fincontainers_status status, const fincontainers_error *error, const char *expected) {
  return status == FINCONTAINERS_STATUS_INVALID_ARGUMENT && error->code == FINCONTAINERS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
static int is_small(mpz_srcptr value, unsigned long n) { return mpz_cmp_ui(value, n) == 0; }

int main(void) {
  fincontainers_error error = {0};
  nats out = {0};
  mpz_t count, huge, last, word; mpz_init(count); mpz_init_set_str(huge, huge_text, 10); mpz_init(last); mpz_sub_ui(last, huge, 1); mpz_init(word); mpz_setbit(word, 32);
  /* Array (Fin 10): every element is checked; results stay below the bound. */
  mpz_t digits[10]; for (unsigned long i = 0; i < 10; ++i) mpz_init_set_ui(digits[i], i);
  nats all = {digits, 10, NULL, NULL}, none = {NULL, 0, NULL, NULL};
  CHECK(OK(fincontainers_mirror_all(&all, &out, &error)) && out.length == 10);
  for (unsigned long i = 0; i < 10; ++i) CHECK(is_small(out.data[i], 9 - i));
  fincontainers_array_nat_span_clear(&out);
  CHECK(OK(fincontainers_mirror_all(&none, &out, &error)) && out.length == 0);
  fincontainers_array_nat_span_clear(&out);
  mpz_t bad[3]; for (int i = 0; i < 3; ++i) mpz_init(bad[i]);
  for (int position = 0; position < 3; ++position) {
    mpz_set_ui(bad[0], 1); mpz_set_ui(bad[1], 2); mpz_set_ui(bad[2], 3); mpz_set_ui(bad[position], 10);
    nats values = {bad, 3, NULL, NULL};
    out = (nats){digits, 10, NULL, NULL};
    CHECK(rejected(fincontainers_mirror_all(&values, &out, &error), &error, (const char *[]){"arg0[0] is not below its Fin 10 bound", "arg0[1] is not below its Fin 10 bound", "arg0[2] is not below its Fin 10 bound"}[position]));
    CHECK(out.data == digits && out.length == 10 && is_small(bad[position], 10)); /* Output and input unchanged. */
  }
  mpz_set(bad[0], word); mpz_set_ui(bad[1], 1); mpz_set_ui(bad[2], 2);
  { nats values = {bad, 3, NULL, NULL}; CHECK(rejected(fincontainers_mirror_all(&values, &out, &error), &error, "arg0[0] is not below its Fin 10 bound")); }
  mpz_set_si(bad[0], -1);
  { nats values = {bad, 3, NULL, NULL}; CHECK(fincontainers_mirror_all(&values, &out, &error) == FINCONTAINERS_STATUS_INVALID_ARGUMENT); } /* Negative is the Nat error. */
  out = (nats){0};
  /* Array (Fin 0): only the empty array has values. */
  CHECK(OK(fincontainers_count_none(&none, count, &error)) && is_small(count, 0));
  { mpz_t zero; mpz_init(zero); nats values = {&zero, 1, NULL, NULL}; CHECK(rejected(fincontainers_count_none(&values, count, &error), &error, "arg0[0] is not below its Fin 0 bound")); mpz_clear(zero); }
  /* List Huge: a 2^70 bound compared limb by limb. */
  mpz_t big[2]; mpz_init_set(big[0], word); mpz_init_set(big[1], last);
  fincontainers_list_nat_span list = {big, 2, NULL, NULL}, empty_list = {NULL, 0, NULL, NULL};
  mpz_t expected; mpz_init(expected); mpz_add(expected, word, last);
  CHECK(OK(fincontainers_sum_huge(&list, count, &error)) && mpz_cmp(count, expected) == 0);
  CHECK(OK(fincontainers_sum_huge(&empty_list, count, &error)) && is_small(count, 0));
  mpz_set(big[1], huge);
  CHECK(rejected(fincontainers_sum_huge(&list, count, &error), &error, "arg0[1] is not below its Fin 1180591620717411303424 bound"));
  /* Option (Fin 1): none is valid; a present value is checked. */
  maybe absent, zero, one; fincontainers_option_nat_value_init(&absent); fincontainers_option_nat_value_init(&zero); fincontainers_option_nat_value_init(&one);
  zero.has_value = 1; one.has_value = 1; mpz_set_ui(one.value, 1);
  CHECK(OK(fincontainers_or_default(&absent, count, &error)) && is_small(count, 7));
  CHECK(OK(fincontainers_or_default(&zero, count, &error)) && is_small(count, 0));
  CHECK(rejected(fincontainers_or_default(&one, count, &error), &error, "arg0? is not below its Fin 1 bound"));
  /* Malformed raw ABI inputs fail the structural check before any bound check. */
  one.has_value = 2;
  CHECK(fincontainers_or_default(&one, count, &error) == FINCONTAINERS_STATUS_INVALID_ARGUMENT && !rejected(FINCONTAINERS_STATUS_INVALID_ARGUMENT, &error, "arg0? is not below its Fin 1 bound"));
  one.has_value = 1;
  { nats dangling = {NULL, 2, NULL, NULL}; CHECK(fincontainers_mirror_all(&dangling, &out, &error) == FINCONTAINERS_STATUS_INVALID_ARGUMENT && out.length == 0); }
  /* Array (Option Digit): only present elements are checked. */
  maybe mixed[3]; for (int i = 0; i < 3; ++i) fincontainers_option_nat_value_init(&mixed[i]);
  mixed[0].has_value = 1; mpz_set_ui(mixed[0].value, 1); mixed[2].has_value = 1; mpz_set_ui(mixed[2].value, 9);
  fincontainers_array_option_nat_span options = {mixed, 3, NULL, NULL};
  CHECK(OK(fincontainers_present(&options, &out, &error)) && out.length == 2 && is_small(out.data[0], 1) && is_small(out.data[1], 9));
  fincontainers_array_nat_span_clear(&out);
  mpz_set_ui(mixed[2].value, 10);
  CHECK(rejected(fincontainers_present(&options, &out, &error), &error, "arg0[2]? is not below its Fin 10 bound"));
  mixed[2].has_value = 0;
  CHECK(OK(fincontainers_present(&options, &out, &error)) && out.length == 1); /* An absent invalid payload is never read. */
  fincontainers_array_nat_span_clear(&out);
  /* List (Array Digit) → Option (List Digit): nested rows. */
  mpz_t row0[2], row1[1]; mpz_init_set_ui(row0[0], 1); mpz_init_set_ui(row0[1], 2); mpz_init_set_ui(row1[0], 3);
  nats rows[2] = {{row0, 2, NULL, NULL}, {row1, 1, NULL, NULL}};
  fincontainers_list_array_nat_span table = {rows, 2, NULL, NULL}, no_rows = {NULL, 0, NULL, NULL};
  fincontainers_option_list_nat_value flat; fincontainers_option_list_nat_value_init(&flat);
  CHECK(OK(fincontainers_flatten(&table, &flat, &error)) && flat.has_value && flat.value.length == 3 && is_small(flat.value.data[2], 3));
  fincontainers_option_list_nat_value_clear(&flat); fincontainers_option_list_nat_value_init(&flat);
  CHECK(OK(fincontainers_flatten(&no_rows, &flat, &error)) && !flat.has_value);
  fincontainers_option_list_nat_value_clear(&flat);
  mpz_set_ui(row1[0], 10);
  CHECK(rejected(fincontainers_flatten(&table, &flat, &error), &error, "arg0[1][0] is not below its Fin 10 bound"));
  /* A late refined argument after an unrefined one; earlier inputs stay untouched. */
  fincontainers_string names[2] = {{"a", 1, NULL, NULL}, {"b", 1, NULL, NULL}};
  fincontainers_array_string_span labels = {names, 2, NULL, NULL};
  mpz_t offsets[2]; mpz_init_set_ui(offsets[0], 1); mpz_init_set_ui(offsets[1], 3);
  nats offset_values = {offsets, 2, NULL, NULL};
  fincontainers_string text = {0};
  CHECK(OK(fincontainers_label(&labels, &offset_values, &text, &error)) && text.length == 7 && memcmp(text.data, "a:1,b:3", 7) == 0);
  fincontainers_string_clear(&text);
  mpz_set_ui(offsets[1], 4);
  CHECK(rejected(fincontainers_label(&labels, &offset_values, &text, &error), &error, "arg1[1] is not below its Fin 4 bound"));
  CHECK(text.length == 0 && names[1].data[0] == 'b');
  /* A result-only container refinement projects each element after Lean returns. */
  mpz_t inputs[2]; mpz_init_set_ui(inputs[0], 100); mpz_init_set(inputs[1], huge);
  nats input_values = {inputs, 2, NULL, NULL};
  CHECK(OK(fincontainers_wrap_all(&input_values, &out, &error)) && out.length == 2 && is_small(out.data[0], 2) && is_small(out.data[1], 2));
  fincontainers_array_nat_span_clear(&out);
  CHECK(OK(fincontainers_wrap_all(&none, &out, &error)) && out.length == 0);
  fincontainers_array_nat_span_clear(&out);
  /* Repeated invalid and valid calls recover without retiring the runtime. */
  mpz_t value; mpz_init(value);
  for (unsigned long i = 0; i < 1000; ++i) {
    nats values = {&value, 1, NULL, NULL};
    mpz_set_ui(value, 10 + i % 5);
    if (!rejected(fincontainers_mirror_all(&values, &out, &error), &error, "arg0[0] is not below its Fin 10 bound")) { fprintf(stderr, "invalid call %lu accepted\n", i); return 1; }
    mpz_set_ui(value, i % 10);
    if (!OK(fincontainers_mirror_all(&values, &out, &error)) || out.length != 1 || !is_small(out.data[0], 9 - i % 10)) { fprintf(stderr, "valid call %lu failed\n", i); return 1; }
    fincontainers_array_nat_span_clear(&out);
  }
  checks += 2000;
  mpz_clear(value); mpz_clear(count); mpz_clear(huge); mpz_clear(last); mpz_clear(word); mpz_clear(expected);
  for (int i = 0; i < 10; ++i) mpz_clear(digits[i]);
  for (int i = 0; i < 3; ++i) { mpz_clear(bad[i]); fincontainers_option_nat_value_clear(&mixed[i]); }
  mpz_clear(big[0]); mpz_clear(big[1]); mpz_clear(row0[0]); mpz_clear(row0[1]); mpz_clear(row1[0]); mpz_clear(offsets[0]); mpz_clear(offsets[1]); mpz_clear(inputs[0]); mpz_clear(inputs[1]);
  fincontainers_option_nat_value_clear(&absent); fincontainers_option_nat_value_clear(&zero); fincontainers_option_nat_value_clear(&one);
  printf("fin-container-ok:%u\n", checks);
  return 0;
}
