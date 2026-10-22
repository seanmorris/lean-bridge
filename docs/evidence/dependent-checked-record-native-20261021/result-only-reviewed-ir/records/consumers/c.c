#define _GNU_SOURCE
#include <dependentrecords.h>
#include <stdio.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == DEPENDENTRECORDS_STATUS_OK)

int main(void) {
  dependentrecords_error error = {0};
  mpz_t seed; mpz_init(seed);
  for (unsigned long i = 0; i < 512; ++i) {
    dependentrecords_dependent output;
    dependentrecords_dependent_init(&output);
    mpz_set_ui(seed, i);
    if (!OK(dependentrecords_dependent_result(seed, &output, &error))
      || mpz_cmp_ui(output.bound, i + 1) != 0
      || mpz_cmp_ui(output.below, i) != 0) return 1;
    dependentrecords_dependent_clear(&output);
  }
  checks += 512;
  dependentrecords_dependent output;
  dependentrecords_dependent_init(&output);
  mpz_t expected; mpz_init(expected);
  mpz_set_ui(seed, 0); mpz_setbit(seed, 130);
  mpz_add_ui(expected, seed, 1);
  CHECK(OK(dependentrecords_dependent_result(seed, &output, &error))
    && mpz_cmp(output.below, seed) == 0
    && mpz_cmp(output.bound, expected) == 0);
  mpz_clear(expected);
  dependentrecords_dependent_clear(&output);
  mpz_clear(seed);
  printf("dependent-checked-record-ok:%u\n", checks);
  return 0;
}
