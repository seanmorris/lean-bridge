#define _GNU_SOURCE
#include <checkedrecordvalueindices.h>
#include <stdio.h>

static unsigned checks;
static unsigned calls;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define RUN(call) (++calls, (call))
#define OK(call) ((call) == CHECKEDRECORDVALUEINDICES_STATUS_OK)

int main(void) {
  checkedrecordvalueindices_error error = {0};
  mpz_t value, huge; mpz_init(value); mpz_init(huge);
  mpz_setbit(huge, 128); mpz_add_ui(huge, huge, 1);
  checkedrecordvalueindices_on on; checkedrecordvalueindices_on_init(&on);
  checkedrecordvalueindices_off off; checkedrecordvalueindices_off_init(&off);
  checkedrecordvalueindices_ab ab; checkedrecordvalueindices_ab_init(&ab);
  checkedrecordvalueindices_empty_token empty; checkedrecordvalueindices_empty_token_init(&empty);
  checkedrecordvalueindices_unicode_token unicode; checkedrecordvalueindices_unicode_token_init(&unicode);
  checkedrecordvalueindices_empty_sized sized; checkedrecordvalueindices_empty_sized_init(&sized);
  checkedrecordvalueindices_zero_token zero; checkedrecordvalueindices_zero_token_init(&zero);
  checkedrecordvalueindices_wide_token wide; checkedrecordvalueindices_wide_token_init(&wide);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_true_bool(&on, &error))) && mpz_cmp_ui(on.count, 0) == 0);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_false_bool(&off, &error))) && mpz_cmp_ui(off.count, 1) == 0);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_ab(&ab, &error))) && mpz_cmp_ui(ab.size, 2) == 0);
  mpz_set_ui(value, 23); CHECK(OK(RUN(checkedrecordvalueindices_produce_empty_string(value, &empty, &error))) && mpz_cmp_ui(empty.count, 23) == 0 && mpz_cmp_ui(value, 23) == 0);
  mpz_set_ui(value, 24); CHECK(OK(RUN(checkedrecordvalueindices_produce_unicode_string(value, &unicode, &error))) && mpz_cmp_ui(unicode.count, 24) == 0 && mpz_cmp_ui(value, 24) == 0);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_empty_sized(&sized, &error))) && sized.data.length == 0);
  mpz_set_ui(value, 25); CHECK(OK(RUN(checkedrecordvalueindices_produce_zero_nat(value, &zero, &error))) && mpz_cmp_ui(zero.count, 25) == 0 && mpz_cmp_ui(value, 25) == 0);
  CHECK(OK(RUN(checkedrecordvalueindices_produce_wide_nat(huge, &wide, &error))) && mpz_cmp(wide.count, huge) == 0 && mpz_cmp_ui(value, 25) == 0);
  CHECK(calls == 8);
  checkedrecordvalueindices_on_clear(&on); checkedrecordvalueindices_off_clear(&off);
  checkedrecordvalueindices_ab_clear(&ab); checkedrecordvalueindices_empty_token_clear(&empty);
  checkedrecordvalueindices_unicode_token_clear(&unicode); checkedrecordvalueindices_empty_sized_clear(&sized);
  checkedrecordvalueindices_zero_token_clear(&zero); checkedrecordvalueindices_wide_token_clear(&wide);
  mpz_clear(huge); mpz_clear(value);
  printf("{\"calls\":%u,\"checks\":%u,\"recoveries\":0,\"rejections\":0}\n", calls, checks);
  return 0;
}
