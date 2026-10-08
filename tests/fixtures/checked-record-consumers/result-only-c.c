#define _GNU_SOURCE
#include <checkedrecords.h>
#include <stdio.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == CHECKEDRECORDS_STATUS_OK)

int main(void) {
  checkedrecords_error error = {0};
  mpz_t value; mpz_init(value);
  /* The package's only checked record is produced by Lean: its proof never crosses and no constructor runs. */
  for (unsigned long i = 0; i < 1000; ++i) {
    checkedrecords_triple triple; checkedrecords_triple_init(&triple);
    mpz_set_ui(value, i);
    if (!OK(checkedrecords_repeated(value, &triple, &error)) || triple.data.length != 3
      || mpz_cmp_ui(triple.data.data[0], i) || mpz_cmp_ui(triple.data.data[1], i) || mpz_cmp_ui(triple.data.data[2], i)) { fprintf(stderr, "round %lu failed\n", i); return 1; }
    checkedrecords_triple_clear(&triple);
  }
  checks += 1000;
  checkedrecords_triple big; checkedrecords_triple_init(&big);
  mpz_set_ui(value, 0); mpz_setbit(value, 80);
  CHECK(OK(checkedrecords_repeated(value, &big, &error)) && big.data.length == 3 && mpz_cmp(big.data.data[2], value) == 0);
  checkedrecords_triple_clear(&big);
  mpz_clear(value);
  printf("checked-record-ok:%u\n", checks);
  return 0;
}
