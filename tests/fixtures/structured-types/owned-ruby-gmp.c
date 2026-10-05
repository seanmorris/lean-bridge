#define _GNU_SOURCE
#include <dlfcn.h>
#include <gmp.h>
#include <stdint.h>
#include <stdio.h>

const char *probe_gmp_path(void) {
  Dl_info info;
  return dladdr((void *)(uintptr_t)&__gmpz_init, &info) ? info.dli_fname : "";
}

int probe_integer(const char *input, char *output, size_t capacity) {
  mpz_t value;
  mpz_init(value);
  if (mpz_set_str(value, input, 10) != 0 || mpz_sizeinbase(value, 10) + 2 > capacity) {
    mpz_clear(value);
    return 1;
  }
  mpz_mul_ui(value, value, 7);
  mpz_add_ui(value, value, 11);
  if (mpz_sizeinbase(value, 10) + 2 > capacity) { mpz_clear(value); return 1; }
  mpz_get_str(output, 10, value);
  mpz_clear(value);
  return 0;
}
