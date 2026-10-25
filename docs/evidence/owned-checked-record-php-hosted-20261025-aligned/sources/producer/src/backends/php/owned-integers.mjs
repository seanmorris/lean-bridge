/**
 * Opaque GMP conversion through the component's own linked GMP dependency.
 *
 * @file
 */

/**
 * PHP never declares GMP struct fields or loads a second system GMP library.
 * Input slots are registered in PHP scratch before this code allocates them.
 * GMP retains its documented fatal out-of-memory policy.
 *
 * @param prefix - Validated component identifier from the public C generator.
 */
export const ownedPhpIntegerSupport = prefix => `#include "${prefix}.h"
#include <stdlib.h>
#include <string.h>
#ifndef LB_OWNED_ALLOC
#define LB_OWNED_ALLOC malloc
#define LB_OWNED_FREE free
#endif
${prefix}_status ${prefix}_php_integer_new(const char *text, size_t length, mpz_srcptr *out) {
  if (!out || *out || !text || !length || length > 16385) return ${prefix.toUpperCase()}_INVALID_ARGUMENT;
  size_t start = text[0] == '-' ? 1 : 0, digits = length - start;
  if (!digits || digits > 16384 || (text[start] == '0' && (digits != 1 || start))) return ${prefix.toUpperCase()}_INVALID_ARGUMENT;
  for (size_t i = start; i < length; ++i) if (text[i] < '0' || text[i] > '9') return ${prefix.toUpperCase()}_INVALID_ARGUMENT;
  mpz_ptr number = LB_OWNED_ALLOC(sizeof(*number));
  if (!number) return ${prefix.toUpperCase()}_ALLOCATION_FAILED;
  char *copy = LB_OWNED_ALLOC(length + 1);
  if (!copy) { LB_OWNED_FREE(number); return ${prefix.toUpperCase()}_ALLOCATION_FAILED; }
  memcpy(copy, text, length); copy[length] = 0;
  mpz_init(number); int status = mpz_set_str(number, copy, 10); LB_OWNED_FREE(copy);
  if (status) { mpz_clear(number); LB_OWNED_FREE(number); return ${prefix.toUpperCase()}_INVALID_ARGUMENT; }
  *out = number; return ${prefix.toUpperCase()}_OK;
}
void ${prefix}_php_integer_free(mpz_srcptr *slot) {
  if (!slot || !*slot) return;
  mpz_ptr number = (mpz_ptr)*slot; *slot = NULL;
  mpz_clear(number); LB_OWNED_FREE(number);
}
${prefix}_status ${prefix}_php_integer_text(mpz_srcptr value, char *out, size_t capacity, size_t *written) {
  if (!written || !value) return ${prefix.toUpperCase()}_MALFORMED_RESULT;
  *written = 0;
  size_t digits = mpz_sizeinbase(value, 10), sign = mpz_sgn(value) < 0 ? 1 : 0;
  /* GMP may overestimate the decimal digit count by one. */
  if (digits > 16385) return ${prefix.toUpperCase()}_LIMIT;
  size_t required = digits + sign + 1;
  if (!out) {
    if (capacity) return ${prefix.toUpperCase()}_INVALID_ARGUMENT;
    *written = required; return ${prefix.toUpperCase()}_OK;
  }
  if (capacity < required) return ${prefix.toUpperCase()}_INVALID_ARGUMENT;
  mpz_get_str(out, 10, value); size_t actual = strlen(out);
  if (actual - sign > 16384) return ${prefix.toUpperCase()}_LIMIT;
  *written = actual; return ${prefix.toUpperCase()}_OK;
}
`;
