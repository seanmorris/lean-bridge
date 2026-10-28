#define _GNU_SOURCE
#include <dependentfin.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == DEPENDENTFIN_STATUS_OK)

static int rejected(dependentfin_status status, const dependentfin_error *error,
    const char *parameter, const char *bound) {
  char expected[96];
  int length = snprintf(expected, sizeof expected,
    "%s is not below its dependent Fin bound %s", parameter, bound);
  return status == DEPENDENTFIN_STATUS_INVALID_ARGUMENT
    && error->code == DEPENDENTFIN_ERROR_INVALID_ARGUMENT
    && length >= 0 && (size_t)length == error->message_length
    && memcmp(error->message, expected, error->message_length) == 0;
}

static int mirror_rejected(mpz_srcptr bound, mpz_srcptr value,
    mpz_ptr out, dependentfin_error *error) {
  return rejected(dependentfin_mirror(bound, value, out, error), error,
    "arg1", "arg0");
}

int main(void) {
  dependentfin_error error = {0};
  mpz_t bound, value, out, huge, word, saved;
  mpz_inits(bound, value, out, huge, word, saved, NULL);
  mpz_setbit(huge, 70); mpz_setbit(word, 32);
  /* Fin 0: the live bound zero has no values. */
  CHECK(mirror_rejected(bound, value, out, &error));
  mpz_set_ui(value, 1);
  CHECK(mirror_rejected(bound, value, out, &error));
  /* Fin 1: only zero. */
  mpz_set_ui(bound, 1); mpz_set_ui(value, 0);
  CHECK(OK(dependentfin_mirror(bound, value, out, &error)) && mpz_cmp_ui(out, 0) == 0);
  mpz_set_ui(value, 1);
  CHECK(mirror_rejected(bound, value, out, &error));
  /* Exact endpoints and values far above a small live bound. */
  mpz_set_ui(bound, 10); mpz_set_ui(value, 0);
  CHECK(OK(dependentfin_mirror(bound, value, out, &error)) && mpz_cmp_ui(out, 9) == 0);
  mpz_set_ui(value, 9);
  CHECK(OK(dependentfin_mirror(bound, value, out, &error)) && mpz_cmp_ui(out, 0) == 0);
  for (unsigned i = 0; i < 4; ++i) {
    if (i == 0) mpz_set_ui(value, 10);
    else if (i == 1) mpz_set_ui(value, 11);
    else if (i == 2) mpz_set(value, word);
    else mpz_set(value, huge);
    CHECK(mirror_rejected(bound, value, out, &error));
  }
  /* Word and 2^70 bounds are compared exactly, limb by limb. */
  mpz_set(bound, word); mpz_sub_ui(value, word, 1);
  CHECK(OK(dependentfin_mirror(bound, value, out, &error)) && mpz_cmp_ui(out, 0) == 0);
  mpz_set(value, word); CHECK(mirror_rejected(bound, value, out, &error));
  mpz_set(bound, huge); mpz_sub_ui(value, huge, 1);
  CHECK(OK(dependentfin_mirror(bound, value, out, &error)) && mpz_cmp_ui(out, 0) == 0);
  mpz_set_ui(value, 0);
  CHECK(OK(dependentfin_mirror(bound, value, out, &error))
    && mpz_cmp_ui(out, 0) > 0);
  mpz_add_ui(bound, huge, 1); mpz_set(value, huge);
  CHECK(OK(dependentfin_mirror(bound, value, out, &error)) && mpz_cmp_ui(out, 0) == 0);
  mpz_set(bound, huge);
  for (unsigned i = 0; i < 3; ++i) {
    if (i == 0) mpz_set(value, huge);
    else if (i == 1) mpz_add_ui(value, huge, 1);
    else { mpz_set_ui(value, 0); mpz_setbit(value, 128); }
    CHECK(mirror_rejected(bound, value, out, &error));
  }
  /* The bound is the argument of this call, never a frozen constant. */
  for (unsigned live = 0; live < 12; ++live) {
    mpz_set_ui(bound, live); mpz_set_ui(value, 5);
    if (live > 5)
      CHECK(OK(dependentfin_mirror(bound, value, out, &error))
        && mpz_cmp_ui(out, live - 6) == 0);
    else CHECK(mirror_rejected(bound, value, out, &error));
  }
  /* The later arg2 depends on arg1, not the unrelated larger arg0. */
  dependentfin_string name = {"slot", 4, NULL, NULL}, text = {0};
  mpz_t start; mpz_init_set_ui(start, 100);
  mpz_set_ui(bound, 3); mpz_set_ui(value, 2);
  CHECK(OK(dependentfin_label(start, bound, value, &name, &text, &error))
    && text.length == 8 && memcmp(text.data, "slot:102", 8) == 0);
  dependentfin_string_clear(&text);
  mpz_set_ui(value, 3);
  CHECK(rejected(dependentfin_label(start, bound, value, &name, &text, &error),
    &error, "arg2", "arg1"));
  mpz_set_ui(bound, 0); mpz_set_ui(value, 0);
  CHECK(rejected(dependentfin_label(start, bound, value, &name, &text, &error),
    &error, "arg2", "arg1"));
  /* Negative Nat values fail the Nat contract, not the dependent Fin check. */
  mpz_set_si(bound, -1); mpz_set_ui(value, 0);
  CHECK(dependentfin_mirror(bound, value, out, &error)
    == DEPENDENTFIN_STATUS_INVALID_ARGUMENT
    && !rejected(DEPENDENTFIN_STATUS_INVALID_ARGUMENT, &error, "arg1", "arg0"));
  mpz_set_ui(bound, 5); mpz_set_si(value, -1);
  CHECK(dependentfin_mirror(bound, value, out, &error)
    == DEPENDENTFIN_STATUS_INVALID_ARGUMENT
    && !rejected(DEPENDENTFIN_STATUS_INVALID_ARGUMENT, &error, "arg1", "arg0"));
  /* Rejection leaves caller-owned values unchanged. */
  mpz_set_ui(start, 7); mpz_set_ui(bound, 4); mpz_set_ui(value, 4);
  mpz_set(saved, value);
  CHECK(rejected(dependentfin_label(start, bound, value, &name, &text, &error),
    &error, "arg2", "arg1") && mpz_cmp(value, saved) == 0
    && name.length == 4 && memcmp(name.data, "slot", 4) == 0);
  /* Repeated invalid and valid calls recover; the bound changes every call. */
  for (unsigned i = 0; i < 1000; ++i) {
    mpz_set_ui(bound, 10); mpz_set_ui(value, 10 + i % 5);
    if (!mirror_rejected(bound, value, out, &error)) {
      fprintf(stderr, "invalid call accepted at %u\n", i); return 1;
    }
    mpz_set_ui(bound, i % 7 + 1); mpz_set_ui(value, i % 7);
    if (!OK(dependentfin_mirror(bound, value, out, &error))
      || mpz_cmp_ui(out, 0) != 0) {
      fprintf(stderr, "valid call failed at %u\n", i); return 1;
    }
  }
  checks += 2000;
  dependentfin_string_clear(&text);
  mpz_clear(start);
  mpz_clears(bound, value, out, huge, word, saved, NULL);
  printf("dependent-fin-ok:%u\n", checks);
  return 0;
}
