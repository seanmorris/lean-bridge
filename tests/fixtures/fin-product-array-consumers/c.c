#define _GNU_SOURCE
#include <finproductarrays.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == FINPRODUCTARRAYS_STATUS_OK)
typedef finproductarrays_tuple_nat_result_nat_nat_value row;
typedef finproductarrays_array_tuple_nat_result_nat_nat_span rows;
/* A rejected call names the parameter and the failed leaf's bound. */
static int rejected(finproductarrays_status status, const finproductarrays_error *error, const char *expected) {
  return status == FINPRODUCTARRAYS_STATUS_INVALID_ARGUMENT && error->code == FINPRODUCTARRAYS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
/* (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
   Each row is built fresh, so no inactive branch is ever written. */
static void fill(row *items) {
  for (int i = 0; i < 3; ++i) finproductarrays_tuple_nat_result_nat_nat_value_init(&items[i]);
  items[0].snd.is_ok = 1; mpz_setbit(items[0].snd.ok, 100);
  mpz_set_ui(items[1].fst, 2); items[1].snd.is_ok = 0; mpz_set_ui(items[1].snd.error, 5);
  mpz_set_ui(items[2].fst, 3); items[2].snd.is_ok = 1; mpz_set_ui(items[2].snd.ok, 6);
}
/* Rows compare by component, active branch and that branch's value. */
static int same(const row *a, const row *b) {
  return mpz_cmp(a->fst, b->fst) == 0 && a->snd.is_ok == b->snd.is_ok
    && mpz_cmp(a->snd.is_ok ? a->snd.ok : a->snd.error, b->snd.is_ok ? b->snd.ok : b->snd.error) == 0;
}
static int all_same(const row *a, const row *b) { return same(&a[0], &b[0]) && same(&a[1], &b[1]) && same(&a[2], &b[2]); }

int main(void) {
  finproductarrays_error error = {0};
  mpz_t count, expected; mpz_init(count); mpz_init(expected);
  row items[3], copy[3]; fill(items); fill(copy);
  rows span = {items, 3, NULL, NULL}, empty = {NULL, 0, NULL, NULL}, out;
  /* An empty array is valid, in and out. */
  CHECK(OK(finproductarrays_rows(&empty, count, &error)) && mpz_cmp_ui(count, 0) == 0);
  finproductarrays_array_tuple_nat_result_nat_nat_span_init(&out);
  CHECK(OK(finproductarrays_reversed(&empty, &out, &error)) && out.length == 0);
  finproductarrays_array_tuple_nat_result_nat_nat_span_clear(&out);
  /* Endpoints 3 and 5, and an ok Nat wider than any bound: 2^100 + (2 + 5 + 1000) + (3 + 6). */
  mpz_setbit(expected, 100); mpz_add_ui(expected, expected, 1016);
  CHECK(OK(finproductarrays_rows(&span, count, &error)) && mpz_cmp(count, expected) == 0);
  /* A component at its bound is rejected in the first, middle and last element, and the active error
     branch at its bound in the middle one, while ok 6 in the last row passed above. Each rejected input
     is compared with an independently built copy before the caller restores it. */
  for (int k = 0; k < 4; ++k) {
    row bad[3]; fill(bad);
    if (k < 3) { mpz_set_ui(items[k].fst, 4); mpz_set_ui(bad[k].fst, 4); }
    else { mpz_set_ui(items[1].snd.error, 6); mpz_set_ui(bad[1].snd.error, 6); }
    CHECK(rejected(finproductarrays_rows(&span, count, &error), &error, k < 3 ? (const char *[]){"arg0[0].0 is not below its Fin 4 bound", "arg0[1].0 is not below its Fin 4 bound", "arg0[2].0 is not below its Fin 4 bound"}[k] : "arg0[1].1.error is not below its Fin 6 bound"));
    CHECK(all_same(items, bad));
    for (int i = 0; i < 3; ++i) finproductarrays_tuple_nat_result_nat_nat_value_clear(&bad[i]);
    if (k < 3) mpz_set(items[k].fst, copy[k].fst); else mpz_set_ui(items[1].snd.error, 5);
  }
  /* A valid call recovers. */
  CHECK(all_same(items, copy));
  CHECK(OK(finproductarrays_rows(&span, count, &error)) && mpz_cmp(count, expected) == 0);
  /* Lean returns the rows reversed, each below its bounds; the input is untouched. */
  finproductarrays_array_tuple_nat_result_nat_nat_span_init(&out);
  CHECK(OK(finproductarrays_reversed(&span, &out, &error)) && out.length == 3);
  CHECK(same(&out.data[0], &copy[2]) && same(&out.data[1], &copy[1]) && same(&out.data[2], &copy[0]) && all_same(items, copy));
  finproductarrays_array_tuple_nat_result_nat_nat_span_clear(&out);
  for (unsigned long i = 0; i < 1000; ++i) {
    if (!OK(finproductarrays_rows(&span, count, &error)) || mpz_cmp(count, expected) != 0) { fprintf(stderr, "round %lu failed\n", i); return 1; }
    mpz_set_ui(items[2].fst, 4 + i);
    if (!rejected(finproductarrays_rows(&span, count, &error), &error, "arg0[2].0 is not below its Fin 4 bound") || mpz_cmp_ui(items[2].fst, 4 + i) != 0) { fprintf(stderr, "rejection round %lu failed\n", i); return 1; }
    mpz_set_ui(items[2].fst, 3);
  }
  checks += 2000;
  for (int i = 0; i < 3; ++i) { finproductarrays_tuple_nat_result_nat_nat_value_clear(&items[i]); finproductarrays_tuple_nat_result_nat_nat_value_clear(&copy[i]); }
  mpz_clear(count); mpz_clear(expected);
  printf("fin-product-array-ok:%u\n", checks);
  return 0;
}
