#define _GNU_SOURCE
#include <checkedrecordvalueindices.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
static unsigned calls;
static unsigned rejections;
static unsigned recoveries;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define RUN(call) (++calls, (call))
#define OK(call) ((call) == CHECKEDRECORDVALUEINDICES_STATUS_OK)

static int rejected(checkedrecordvalueindices_status status,
  const checkedrecordvalueindices_error *error, const char *expected) {
  return status == CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT
    && error->code == CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected)
    && memcmp(error->message, expected, error->message_length) == 0;
}

static int recover(checkedrecordvalueindices_zero_token *value, mpz_ptr out,
  checkedrecordvalueindices_error *error) {
  mpz_set_ui(value->count, 99); mpz_set_ui(out, 77);
  if (!OK(RUN(checkedrecordvalueindices_zero_nat_index(value, out, error)))
    || mpz_cmp_ui(out, 99) || mpz_cmp_ui(value->count, 99)) return 0;
  ++recoveries; return 1;
}

int main(void) {
  checkedrecordvalueindices_error error = {0};
  mpz_t out, huge, item; mpz_init(out); mpz_init(huge); mpz_init_set_ui(item, 1);
  mpz_setbit(huge, 128); mpz_add_ui(huge, huge, 1);

  checkedrecordvalueindices_on on; checkedrecordvalueindices_on_init(&on);
  checkedrecordvalueindices_off off; checkedrecordvalueindices_off_init(&off);
  checkedrecordvalueindices_ab ab; checkedrecordvalueindices_ab_init(&ab);
  checkedrecordvalueindices_empty_token empty; checkedrecordvalueindices_empty_token_init(&empty);
  checkedrecordvalueindices_unicode_token unicode; checkedrecordvalueindices_unicode_token_init(&unicode);
  checkedrecordvalueindices_empty_sized sized; checkedrecordvalueindices_empty_sized_init(&sized);
  checkedrecordvalueindices_zero_token zero; checkedrecordvalueindices_zero_token_init(&zero);
  checkedrecordvalueindices_wide_token wide; checkedrecordvalueindices_wide_token_init(&wide);

  mpz_set_ui(on.count, 0);
  CHECK(OK(RUN(checkedrecordvalueindices_true_bool_index(&on, out, &error)))
    && mpz_cmp_ui(out, 0) == 0 && mpz_cmp_ui(on.count, 0) == 0);
  mpz_set_ui(off.count, 1);
  CHECK(OK(RUN(checkedrecordvalueindices_false_bool_index(&off, out, &error)))
    && mpz_cmp_ui(out, 1) == 0 && mpz_cmp_ui(off.count, 1) == 0);
  mpz_set_ui(ab.size, 2);
  CHECK(OK(RUN(checkedrecordvalueindices_ab_string_index(&ab, out, &error)))
    && mpz_cmp_ui(out, 2) == 0 && mpz_cmp_ui(ab.size, 2) == 0);
  mpz_set_ui(empty.count, 9);
  CHECK(OK(RUN(checkedrecordvalueindices_empty_string_index(&empty, out, &error)))
    && mpz_cmp_ui(out, 9) == 0 && mpz_cmp_ui(empty.count, 9) == 0);
  mpz_set_ui(unicode.count, 10);
  CHECK(OK(RUN(checkedrecordvalueindices_unicode_string_index(&unicode, out, &error)))
    && mpz_cmp_ui(out, 10) == 0 && mpz_cmp_ui(unicode.count, 10) == 0);
  sized.data = (checkedrecordvalueindices_array_nat_span){(const mpz_t *)&item, 0, NULL, NULL};
  CHECK(OK(RUN(checkedrecordvalueindices_empty_sized_index(&sized, out, &error)))
    && mpz_cmp_ui(out, 0) == 0 && sized.data.length == 0);
  mpz_set_ui(zero.count, 11);
  CHECK(OK(RUN(checkedrecordvalueindices_zero_nat_index(&zero, out, &error)))
    && mpz_cmp_ui(out, 11) == 0 && mpz_cmp_ui(zero.count, 11) == 0);
  mpz_set(wide.count, huge);
  CHECK(OK(RUN(checkedrecordvalueindices_wide_nat_index(&wide, out, &error)))
    && mpz_cmp(out, huge) == 0 && mpz_cmp(wide.count, huge) == 0);

  mpz_set_ui(ab.size, 1); mpz_set_ui(out, 77);
  CHECK(rejected(RUN(checkedrecordvalueindices_ab_string_index(&ab, out, &error)),
    &error, "arg0 was rejected by CheckedRecordValueIndices.mkAb")
    && mpz_cmp_ui(ab.size, 1) == 0 && mpz_cmp_ui(out, 77) == 0);
  ++rejections; CHECK(recover(&zero, out, &error));
  sized.data.length = 1; mpz_set_ui(out, 77);
  CHECK(rejected(RUN(checkedrecordvalueindices_empty_sized_index(&sized, out, &error)),
    &error, "arg0 was rejected by CheckedRecordValueIndices.mkEmptySized")
    && sized.data.length == 1 && mpz_cmp_ui(item, 1) == 0 && mpz_cmp_ui(out, 77) == 0);
  ++rejections; CHECK(recover(&zero, out, &error));
  mpz_set_ui(on.count, 1); mpz_set_ui(out, 77);
  CHECK(rejected(RUN(checkedrecordvalueindices_true_bool_index(&on, out, &error)),
    &error, "arg0 was rejected by CheckedRecordValueIndices.mkOn")
    && mpz_cmp_ui(on.count, 1) == 0 && mpz_cmp_ui(out, 77) == 0);
  ++rejections; CHECK(recover(&zero, out, &error));
  mpz_set_ui(off.count, 0); mpz_set_ui(out, 77);
  CHECK(rejected(RUN(checkedrecordvalueindices_false_bool_index(&off, out, &error)),
    &error, "arg0 was rejected by CheckedRecordValueIndices.mkOff")
    && mpz_cmp_ui(off.count, 0) == 0 && mpz_cmp_ui(out, 77) == 0);
  ++rejections; CHECK(recover(&zero, out, &error));
  mpz_set_si(on.count, -1); mpz_set_ui(out, 77);
  CHECK(rejected(RUN(checkedrecordvalueindices_true_bool_index(&on, out, &error)),
    &error, "Nat must be nonnegative")
    && mpz_cmp_si(on.count, -1) == 0 && mpz_cmp_ui(out, 77) == 0);
  ++rejections; CHECK(recover(&zero, out, &error));
  mpz_set_si(zero.count, -1); mpz_set_ui(out, 77);
  CHECK(rejected(RUN(checkedrecordvalueindices_zero_nat_index(&zero, out, &error)),
    &error, "Nat must be nonnegative")
    && mpz_cmp_si(zero.count, -1) == 0 && mpz_cmp_ui(out, 77) == 0);
  ++rejections; CHECK(recover(&zero, out, &error));

  checkedrecordvalueindices_on made_on; checkedrecordvalueindices_on_init(&made_on);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_true_bool(&made_on, &error)))
    && mpz_cmp_ui(made_on.count, 0) == 0);
  checkedrecordvalueindices_off made_off; checkedrecordvalueindices_off_init(&made_off);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_false_bool(&made_off, &error)))
    && mpz_cmp_ui(made_off.count, 1) == 0);
  checkedrecordvalueindices_ab made_ab; checkedrecordvalueindices_ab_init(&made_ab);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_ab(&made_ab, &error)))
    && mpz_cmp_ui(made_ab.size, 2) == 0);
  checkedrecordvalueindices_empty_token made_empty; checkedrecordvalueindices_empty_token_init(&made_empty);
  mpz_set_ui(out, 23);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_empty_string(out, &made_empty, &error)))
    && mpz_cmp_ui(made_empty.count, 23) == 0 && mpz_cmp_ui(out, 23) == 0);
  checkedrecordvalueindices_unicode_token made_unicode; checkedrecordvalueindices_unicode_token_init(&made_unicode);
  mpz_set_ui(out, 24);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_unicode_string(out, &made_unicode, &error)))
    && mpz_cmp_ui(made_unicode.count, 24) == 0 && mpz_cmp_ui(out, 24) == 0);
  checkedrecordvalueindices_empty_sized made_sized; checkedrecordvalueindices_empty_sized_init(&made_sized);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_empty_sized(&made_sized, &error)))
    && made_sized.data.length == 0);
  checkedrecordvalueindices_zero_token made_zero; checkedrecordvalueindices_zero_token_init(&made_zero);
  mpz_set_ui(out, 25);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_zero_nat(out, &made_zero, &error)))
    && mpz_cmp_ui(made_zero.count, 25) == 0 && mpz_cmp_ui(out, 25) == 0);
  checkedrecordvalueindices_wide_token made_wide; checkedrecordvalueindices_wide_token_init(&made_wide);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_wide_nat(huge, &made_wide, &error)))
    && mpz_cmp(made_wide.count, huge) == 0 && mpz_cmp(wide.count, huge) == 0);
  CHECK(calls == 28 && rejections == 6 && recoveries == 6);

  checkedrecordvalueindices_on_clear(&made_on); checkedrecordvalueindices_off_clear(&made_off);
  checkedrecordvalueindices_ab_clear(&made_ab); checkedrecordvalueindices_empty_token_clear(&made_empty);
  checkedrecordvalueindices_unicode_token_clear(&made_unicode); checkedrecordvalueindices_empty_sized_clear(&made_sized);
  checkedrecordvalueindices_zero_token_clear(&made_zero); checkedrecordvalueindices_wide_token_clear(&made_wide);
  checkedrecordvalueindices_on_clear(&on); checkedrecordvalueindices_off_clear(&off);
  checkedrecordvalueindices_ab_clear(&ab); checkedrecordvalueindices_empty_token_clear(&empty);
  checkedrecordvalueindices_unicode_token_clear(&unicode); checkedrecordvalueindices_empty_sized_clear(&sized);
  checkedrecordvalueindices_zero_token_clear(&zero); checkedrecordvalueindices_wide_token_clear(&wide);
  mpz_clear(item); mpz_clear(huge); mpz_clear(out);
  printf("{\"calls\":%u,\"checks\":%u,\"recoveries\":%u,\"rejections\":%u}\n",
    calls, checks, recoveries, rejections);
  return 0;
}
