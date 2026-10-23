#include <nominalsubtypes.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == NOMINALSUBTYPES_STATUS_OK)

static int small(mpz_srcptr value, unsigned long expected) {
  return mpz_cmp_ui(value, expected) == 0;
}

static int rejected(nominalsubtypes_status status, const nominalsubtypes_error *error, const char *expected) {
  return status == NOMINALSUBTYPES_STATUS_INVALID_ARGUMENT
    && error->code == NOMINALSUBTYPES_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected)
    && memcmp(error->message, expected, error->message_length) == 0;
}

static void set_generic(nominalsubtypes_generic_nat *value, unsigned long member, unsigned long marker) {
  mpz_set_ui(value->value, member);
  mpz_set_ui(value->marker, marker);
}

static int same_generic(const nominalsubtypes_generic_nat *value, unsigned long member, unsigned long marker) {
  return small(value->value, member) && small(value->marker, marker);
}

int main(void) {
  nominalsubtypes_error error = {0};
  nominalsubtypes_generic_nat input, output;
  nominalsubtypes_generic_nat_init(&input);
  nominalsubtypes_generic_nat_init(&output);
  mpz_t result;
  mpz_init(result);

  set_generic(&input, 40, 2);
  CHECK(OK(nominalsubtypes_generic_use(&input, result, &error)) && small(result, 43));
  CHECK(same_generic(&input, 40, 2));
  CHECK(OK(nominalsubtypes_echo_generic_first(&input, &output, &error)) && same_generic(&output, 41, 2));
  CHECK(same_generic(&input, 40, 2));
  nominalsubtypes_generic_nat_clear(&output); nominalsubtypes_generic_nat_init(&output);
  CHECK(OK(nominalsubtypes_echo_generic_second(&input, &output, &error)) && same_generic(&output, 42, 2));
  CHECK(same_generic(&input, 40, 2));

  set_generic(&input, 99, 7);
  CHECK(OK(nominalsubtypes_generic_use(&input, result, &error)) && small(result, 107));
  nominalsubtypes_generic_nat_clear(&output); nominalsubtypes_generic_nat_init(&output);
  CHECK(OK(nominalsubtypes_echo_generic_first(&input, &output, &error)) && same_generic(&output, 100, 7));

  set_generic(&input, 100, 2); mpz_set_ui(result, 777);
  CHECK(rejected(nominalsubtypes_generic_use(&input, result, &error), &error,
    "value0.value was rejected by NominalSubtypes.plusOne") && small(result, 777));
  CHECK(same_generic(&input, 100, 2));
  set_generic(&input, 90, 2); set_generic(&output, 777, 888);
  CHECK(rejected(nominalsubtypes_echo_generic_second(&input, &output, &error), &error,
    "value0.value was rejected by NominalSubtypes.plusTwo") && same_generic(&output, 777, 888));
  CHECK(same_generic(&input, 90, 2));

  set_generic(&input, 40, 2);
  CHECK(OK(nominalsubtypes_echo_generic_second(&input, &output, &error)) && same_generic(&output, 42, 2));
  CHECK(OK(nominalsubtypes_generic_use(&input, result, &error)) && small(result, 43));

  nominalsubtypes_generic_nat_clear(&input);
  nominalsubtypes_generic_nat_clear(&output);
  mpz_clear(result);
  printf("generic-subtype-ok:%u\n", checks);
  return 0;
}
