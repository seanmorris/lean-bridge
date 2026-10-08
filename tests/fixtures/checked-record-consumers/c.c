#define _GNU_SOURCE
#include <checkedrecords.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == CHECKEDRECORDS_STATUS_OK)
/* A refused call names the parameter and its site's checked constructor. */
static int rejected(checkedrecords_status status, const checkedrecords_error *error, const char *expected) {
  return status == CHECKEDRECORDS_STATUS_INVALID_ARGUMENT && error->code == CHECKEDRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
/* A caller-owned payload borrowed by a Triple. */
static checkedrecords_triple triple(mpz_t *items, size_t length) {
  checkedrecords_triple value; checkedrecords_triple_init(&value);
  value.data = (checkedrecords_array_nat_span){(const checkedrecords_nat *)items, length, NULL, NULL};
  return value;
}
static int same(const checkedrecords_triple *value, const unsigned long *expected, size_t length) {
  if (value->data.length != length) return 0;
  for (size_t i = 0; i < length; ++i) if (mpz_cmp_ui(value->data.data[i], expected[i]) != 0) return 0;
  return 1;
}

int main(void) {
  checkedrecords_error error = {0};
  mpz_t out; mpz_init(out);
  /* Interval: the proof relates the two payload fields; only mkInterval builds one. */
  checkedrecords_interval low, high; checkedrecords_interval_init(&low); checkedrecords_interval_init(&high);
  mpz_set_ui(low.lo, 3); mpz_set_ui(low.hi, 10);
  CHECK(OK(checkedrecords_width(&low, out, &error)) && mpz_cmp_ui(out, 7) == 0);
  mpz_set_ui(high.lo, 10); mpz_set_ui(high.hi, 3);
  mpz_set_ui(out, 99);
  CHECK(rejected(checkedrecords_width(&high, out, &error), &error, "arg0 was rejected by CheckedRecords.mkInterval"));
  CHECK(mpz_cmp_ui(out, 99) == 0 && mpz_cmp_ui(high.lo, 10) == 0 && mpz_cmp_ui(high.hi, 3) == 0); /* Output and input unchanged. */
  /* Two checked parameters: the second is refused after the first passed, and the first alone too. */
  mpz_set_ui(low.lo, 1); mpz_set_ui(low.hi, 5); mpz_set_ui(high.lo, 2); mpz_set_ui(high.hi, 9);
  CHECK(OK(checkedrecords_span(&low, &high, out, &error)) && mpz_cmp_ui(out, 8) == 0);
  mpz_set_ui(high.lo, 9); mpz_set_ui(high.hi, 2);
  CHECK(rejected(checkedrecords_span(&low, &high, out, &error), &error, "arg1 was rejected by CheckedRecords.mkInterval"));
  CHECK(rejected(checkedrecords_span(&high, &low, out, &error), &error, "arg0 was rejected by CheckedRecords.mkInterval"));
  /* Triple := Sized 3: the index constrains the payload length. */
  mpz_t items[4]; for (size_t i = 0; i < 4; ++i) mpz_init(items[i]);
  mpz_set_ui(items[0], 3); mpz_set_ui(items[1], 1); mpz_set_ui(items[2], 2); mpz_set_ui(items[3], 7);
  checkedrecords_triple three = triple(items, 3), two = triple(items, 2), four = triple(items, 4);
  CHECK(OK(checkedrecords_total(&three, out, &error)) && mpz_cmp_ui(out, 6) == 0);
  CHECK(rejected(checkedrecords_total(&two, out, &error), &error, "arg0 was rejected by CheckedRecords.mkTriple"));
  CHECK(rejected(checkedrecords_total(&four, out, &error), &error, "arg0 was rejected by CheckedRecords.mkTriple"));
  /* Each site chooses its constructor: sortedTriple normalizes only inside Lean. */
  CHECK(OK(checkedrecords_first_of(&three, out, &error)) && mpz_cmp_ui(out, 3) == 0);
  CHECK(OK(checkedrecords_smallest(&three, out, &error)) && mpz_cmp_ui(out, 1) == 0);
  CHECK(mpz_cmp_ui(items[0], 3) == 0 && mpz_cmp_ui(items[1], 1) == 0 && mpz_cmp_ui(items[2], 2) == 0); /* Caller payload unchanged. */
  CHECK(rejected(checkedrecords_smallest(&two, out, &error), &error, "arg0 was rejected by CheckedRecords.sortedTriple"));
  /* An unchecked argument before a checked one, and a Lean-produced checked result. */
  mpz_t factor; mpz_init_set_ui(factor, 2);
  checkedrecords_triple scaled; checkedrecords_triple_init(&scaled);
  CHECK(OK(checkedrecords_scale(factor, &three, &scaled, &error)) && same(&scaled, (const unsigned long[]){6, 2, 4}, 3));
  CHECK(rejected(checkedrecords_scale(factor, &two, &scaled, &error), &error, "arg1 was rejected by CheckedRecords.mkTriple") && same(&scaled, (const unsigned long[]){6, 2, 4}, 3));
  /* A Lean-produced value passed back re-enters only through its site's constructor. */
  CHECK(OK(checkedrecords_smallest(&scaled, out, &error)) && mpz_cmp_ui(out, 2) == 0);
  checkedrecords_triple_clear(&scaled);
  checkedrecords_triple repeated; checkedrecords_triple_init(&repeated);
  mpz_set_ui(factor, 4);
  CHECK(OK(checkedrecords_repeated(factor, &repeated, &error)) && same(&repeated, (const unsigned long[]){4, 4, 4}, 3));
  checkedrecords_triple_clear(&repeated);
  /* Nat stays arbitrary precision through the payload. */
  mpz_set_ui(items[0], 0); mpz_setbit(items[0], 70);
  CHECK(OK(checkedrecords_total(&three, out, &error)) && mpz_tstbit(out, 70) && mpz_fdiv_ui(out, 1024) == 3);
  /* Percent := Bounded 0 101: two indices and two proofs. */
  checkedrecords_percent percent; checkedrecords_percent_init(&percent);
  mpz_set_ui(percent.value, 40);
  CHECK(OK(checkedrecords_complement(&percent, out, &error)) && mpz_cmp_ui(out, 60) == 0);
  mpz_set_ui(percent.value, 101);
  CHECK(rejected(checkedrecords_complement(&percent, out, &error), &error, "arg0 was rejected by CheckedRecords.mkPercent"));
  /* Refusal and recovery alternate without leaking or corrupting state. */
  for (unsigned long i = 0; i < 1000; ++i) {
    mpz_set_ui(low.lo, i); mpz_set_ui(low.hi, i + 1);
    if (!OK(checkedrecords_width(&low, out, &error)) || mpz_cmp_ui(out, 1) != 0) { fprintf(stderr, "round %lu failed\n", i); return 1; }
    mpz_set_ui(low.lo, i + 1); mpz_set_ui(low.hi, i);
    if (!rejected(checkedrecords_width(&low, out, &error), &error, "arg0 was rejected by CheckedRecords.mkInterval")) { fprintf(stderr, "rejection round %lu failed\n", i); return 1; }
  }
  checks += 2000;
  /* Caller-owned spans were borrowed views; clear only what the caller initialized. */
  three.data = two.data = four.data = (checkedrecords_array_nat_span){0};
  checkedrecords_triple_clear(&three); checkedrecords_triple_clear(&two); checkedrecords_triple_clear(&four);
  for (size_t i = 0; i < 4; ++i) mpz_clear(items[i]);
  checkedrecords_interval_clear(&low); checkedrecords_interval_clear(&high); checkedrecords_percent_clear(&percent);
  mpz_clear(factor); mpz_clear(out);
  printf("checked-record-ok:%u\n", checks);
  return 0;
}
