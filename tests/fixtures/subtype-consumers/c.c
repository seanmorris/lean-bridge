#define _GNU_SOURCE
#include <subtypes.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == SUBTYPES_STATUS_OK)
/* A rejected call names the parameter and its checked constructor and leaves outputs unchanged. */
static int rejected(subtypes_status status, const subtypes_error *error, const char *expected) {
  return status == SUBTYPES_STATUS_INVALID_ARGUMENT && error->code == SUBTYPES_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
static int same(const subtypes_string *text, const char *expected, size_t length) { return text->length == length && memcmp(text->data, expected, length) == 0; }

int main(void) {
  subtypes_error error = {0};
  subtypes_string out = {0};
  mpz_t in, factor, result; mpz_init(in); mpz_init(factor); mpz_init(result);
  /* Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected. */
  const subtypes_string hello = {"h\xc3\xa9llo \xf0\x9f\x99\x82", 11, NULL, NULL}, nul = {"a\0b", 3, NULL, NULL}, empty = {"", 0, NULL, NULL};
  CHECK(OK(subtypes_shout(&hello, &out, &error)) && same(&out, "h\xc3\xa9llo \xf0\x9f\x99\x82!", 12)); subtypes_string_clear(&out);
  CHECK(OK(subtypes_shout(&nul, &out, &error)) && same(&out, "a\0b!", 4)); subtypes_string_clear(&out);
  out = (subtypes_string){"kept", 4, NULL, NULL};
  CHECK(rejected(subtypes_shout(&empty, &out, &error), &error, "arg0 was rejected by Subtypes.checkedWord"));
  CHECK(same(&out, "kept", 4) && empty.length == 0); /* Output and input unchanged. */
  out = (subtypes_string){0};
  /* Even Nat: a heap-backed base with a value beyond 64 bits. */
  mpz_set_ui(in, 42); CHECK(OK(subtypes_half(in, result, &error)) && mpz_cmp_ui(result, 21) == 0);
  mpz_setbit(in, 100); mpz_set_ui(in, 0); mpz_setbit(in, 100); CHECK(OK(subtypes_half(in, result, &error)) && mpz_tstbit(result, 99));
  mpz_set_ui(in, 7); mpz_set_ui(result, 99); CHECK(rejected(subtypes_half(in, result, &error), &error, "arg0 was rejected by Subtypes.checkedEven"));
  CHECK(mpz_cmp_ui(result, 99) == 0 && mpz_cmp_ui(in, 7) == 0);
  mpz_set_si(in, -2); CHECK(subtypes_half(in, result, &error) == SUBTYPES_STATUS_INVALID_ARGUMENT && !rejected(SUBTYPES_STATUS_INVALID_ARGUMENT, &error, "arg0 was rejected by Subtypes.checkedEven")); /* Negative is the Nat error. */
  /* Small Int after an unchecked argument: a late rejection leaves the first argument alone. */
  mpz_set_si(factor, -3); mpz_set_si(in, -128); CHECK(OK(subtypes_scale(factor, in, result, &error)) && mpz_cmp_si(result, 384) == 0);
  mpz_set_si(in, 127); CHECK(OK(subtypes_scale(factor, in, result, &error)) && mpz_cmp_si(result, -381) == 0);
  mpz_set_si(in, 128); CHECK(rejected(subtypes_scale(factor, in, result, &error), &error, "arg1 was rejected by Subtypes.checkedSmall"));
  mpz_set_si(in, -129); CHECK(rejected(subtypes_scale(factor, in, result, &error), &error, "arg1 was rejected by Subtypes.checkedSmall"));
  CHECK(mpz_cmp_si(factor, -3) == 0 && mpz_cmp_si(in, -129) == 0 && mpz_cmp_si(result, -381) == 0);
  /* Nonempty ByteArray: the first byte, including NUL; empty bytes are rejected. */
  const uint8_t zero[] = {0, 255}; const subtypes_bytes payload = {zero, 2, NULL, NULL}, none = {NULL, 0, NULL, NULL};
  uint8_t head = 7;
  CHECK(OK(subtypes_head(&payload, &head, &error)) && head == 0);
  CHECK(rejected(subtypes_head(&none, &head, &error), &error, "arg0 was rejected by Subtypes.checkedPayload") && head == 0);
  /* A result-only subtype: the host receives the base value. */
  mpz_set_ui(in, 21); CHECK(OK(subtypes_pad(in, result, &error)) && mpz_cmp_ui(result, 42) == 0);
  /* Two checked arguments: the second is rejected after the first passed. */
  const subtypes_string left = {"ab", 2, NULL, NULL}, right = {"cd", 2, NULL, NULL};
  CHECK(OK(subtypes_join(&left, &right, &out, &error)) && same(&out, "abcd", 4)); subtypes_string_clear(&out);
  CHECK(rejected(subtypes_join(&left, &empty, &out, &error), &error, "arg1 was rejected by Subtypes.checkedWord"));
  CHECK(rejected(subtypes_join(&empty, &right, &out, &error), &error, "arg0 was rejected by Subtypes.checkedWord") && out.length == 0);
  /* A normalizing constructor: the export sees the constructed value, not the caller's input. */
  mpz_set_ui(in, 250); CHECK(OK(subtypes_clamp(in, result, &error)) && mpz_cmp_ui(result, 100) == 0 && mpz_cmp_ui(in, 250) == 0);
  mpz_set_ui(in, 7); CHECK(OK(subtypes_clamp(in, result, &error)) && mpz_cmp_ui(result, 7) == 0);
  /* A checked constructor beside a Fin bound: the Fin precheck runs first, then the constructor. */
  mpz_t digit; mpz_init_set_ui(digit, 3);
  mpz_set_ui(in, 4); CHECK(OK(subtypes_mix(in, digit, result, &error)) && mpz_cmp_ui(result, 7) == 0);
  mpz_set_ui(digit, 10); CHECK(rejected(subtypes_mix(in, digit, result, &error), &error, "arg1 is not below its Fin 10 bound"));
  mpz_set_ui(in, 5); CHECK(rejected(subtypes_mix(in, digit, result, &error), &error, "arg1 is not below its Fin 10 bound")); /* Fin before the constructor. */
  mpz_set_ui(digit, 3); CHECK(rejected(subtypes_mix(in, digit, result, &error), &error, "arg0 was rejected by Subtypes.checkedEven"));
  /* Repeated invalid and valid calls recover without retiring the runtime. */
  for (unsigned long i = 0; i < 1000; ++i) {
    mpz_set_ui(in, 2 * i + 1);
    if (!rejected(subtypes_half(in, result, &error), &error, "arg0 was rejected by Subtypes.checkedEven")) { fprintf(stderr, "invalid call %lu accepted\n", i); return 1; }
    mpz_set_ui(in, 2 * i);
    if (!OK(subtypes_half(in, result, &error)) || mpz_cmp_ui(result, i) != 0) { fprintf(stderr, "valid call %lu failed\n", i); return 1; }
  }
  checks += 2000;
  mpz_clear(in); mpz_clear(factor); mpz_clear(result); mpz_clear(digit);
  printf("subtype-ok:%u\n", checks);
  return 0;
}
