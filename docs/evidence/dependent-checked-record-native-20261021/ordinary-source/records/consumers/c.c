#define _GNU_SOURCE
#include <dependentrecords.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == DEPENDENTRECORDS_STATUS_OK)

static int rejected(dependentrecords_status status,
  const dependentrecords_error *error) {
  const char *expected = "arg0 was rejected by DependentRecords.mkDependent";
  return status == DEPENDENTRECORDS_STATUS_INVALID_ARGUMENT
    && error->code == DEPENDENTRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected)
    && memcmp(error->message, expected, error->message_length) == 0;
}

int main(void) {
  dependentrecords_error error = {0};
  mpz_t total; mpz_init(total);
  dependentrecords_dependent input, output;
  dependentrecords_dependent_init(&input);
  dependentrecords_dependent_init(&output);

  mpz_set_ui(input.bound, 3); mpz_set_ui(input.below, 2);
  CHECK(OK(dependentrecords_dependent_total(&input, total, &error))
    && mpz_cmp_ui(total, 5) == 0);
  mpz_set_ui(input.bound, 2); mpz_set_ui(input.below, 2);
  mpz_set_ui(total, 99);
  CHECK(rejected(dependentrecords_dependent_total(&input, total, &error), &error));
  CHECK(mpz_cmp_ui(total, 99) == 0 && mpz_cmp_ui(input.bound, 2) == 0
    && mpz_cmp_ui(input.below, 2) == 0);
  mpz_set_ui(input.bound, 0); mpz_set_ui(input.below, 0);
  CHECK(rejected(dependentrecords_dependent_total(&input, total, &error), &error));
  mpz_set_ui(input.bound, 2); mpz_set_ui(input.below, 1);
  CHECK(OK(dependentrecords_dependent_total(&input, total, &error))
    && mpz_cmp_ui(total, 3) == 0);

  mpz_set_ui(input.bound, 3); mpz_set_ui(input.below, 2);
  CHECK(OK(dependentrecords_dependent_roundtrip(&input, &output, &error))
    && mpz_cmp_ui(output.bound, 3) == 0 && mpz_cmp_ui(output.below, 2) == 0);
  CHECK(mpz_cmp_ui(input.bound, 3) == 0 && mpz_cmp_ui(input.below, 2) == 0);

  mpz_set_ui(input.bound, 0); mpz_setbit(input.bound, 130);
  mpz_sub_ui(input.below, input.bound, 1);
  CHECK(OK(dependentrecords_dependent_total(&input, total, &error))
    && mpz_tstbit(total, 131) == 0 && mpz_tstbit(total, 130)
    && mpz_fdiv_ui(total, 1024) == 1023);
  CHECK(OK(dependentrecords_dependent_roundtrip(&input, &output, &error))
    && mpz_cmp(output.bound, input.bound) == 0
    && mpz_cmp(output.below, input.below) == 0);

  for (unsigned long i = 0; i < 256; ++i) {
    mpz_set_ui(input.bound, i + 1); mpz_set_ui(input.below, i);
    if (!OK(dependentrecords_dependent_total(&input, total, &error))
      || mpz_cmp_ui(total, 2 * i + 1) != 0) return 1;
    mpz_set_ui(input.below, i + 1);
    if (!rejected(dependentrecords_dependent_total(&input, total, &error), &error))
      return 1;
  }
  checks += 512;

  dependentrecords_dependent_clear(&output);
  dependentrecords_dependent_clear(&input);
  mpz_clear(total);
  printf("dependent-checked-record-ok:%u\n", checks);
  return 0;
}
