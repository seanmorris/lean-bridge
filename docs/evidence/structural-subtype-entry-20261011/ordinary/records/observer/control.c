#include <structuralsubtypes.h>
#include <stdio.h>
int main(void) {
  mpz_t input, output; mpz_init_set_ui(input, 42); mpz_init(output);
  structuralsubtypes_error error = {0};
  int ok = structuralsubtypes_unrestricted(input, output, &error) == STRUCTURALSUBTYPES_STATUS_OK && mpz_cmp_ui(output, 42) == 0;
  mpz_clears(input, output, NULL); if (!ok) return 1;
  puts("unrestricted-ok"); return 0;
}
