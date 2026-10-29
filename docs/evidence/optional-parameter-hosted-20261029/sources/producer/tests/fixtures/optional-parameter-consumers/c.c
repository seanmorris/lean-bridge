#include "defaults.h"

#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(condition) do { assert(condition); ++checks; } while (0)

static int nat_is(mpz_srcptr value, const char *decimal) {
  mpz_t expected;
  mpz_init_set_str(expected, decimal, 10);
  const int equal = mpz_cmp(value, expected) == 0;
  mpz_clear(expected);
  return equal;
}

int main(void) {
  defaults_error error = {0};
  uint32_t word = 0;
  CHECK(defaults_word(&word, &error) == DEFAULTS_STATUS_OK && word == 7);
  CHECK(defaults_word(UINT32_C(7), &word, &error) == DEFAULTS_STATUS_OK && word == 7);
  CHECK(defaults_word(UINT32_C(11), &word, &error) == DEFAULTS_STATUS_OK && word == 11);

  mpz_t large_input, eleven_input, natural;
  mpz_init_set_str(large_input, "184467440737095516160", 10);
  mpz_init_set_ui(eleven_input, 11);
  mpz_init(natural);
  CHECK(defaults_natural(natural, &error) == DEFAULTS_STATUS_OK
      && nat_is(natural, "184467440737095516160"));
  CHECK(defaults_natural(large_input, natural, &error) == DEFAULTS_STATUS_OK
      && nat_is(natural, "184467440737095516160"));
  CHECK(defaults_natural(eleven_input, natural, &error) == DEFAULTS_STATUS_OK
      && nat_is(natural, "11"));

  const defaults_string default_text = {"Lean\nBridge", 11, NULL, NULL};
  const defaults_string other_text = {"other", 5, NULL, NULL};
  defaults_string text = {0};
  CHECK(defaults_text(&text, &error) == DEFAULTS_STATUS_OK
      && text.length == 11 && memcmp(text.data, "Lean\nBridge", 11) == 0);
  defaults_string_clear(&text);
  CHECK(defaults_text(&default_text, &text, &error) == DEFAULTS_STATUS_OK
      && text.length == 11 && memcmp(text.data, "Lean\nBridge", 11) == 0);
  defaults_string_clear(&text);
  CHECK(defaults_text(&other_text, &text, &error) == DEFAULTS_STATUS_OK
      && text.length == 5 && memcmp(text.data, "other", 5) == 0);
  defaults_string_clear(&text);

  uint32_t character = 0;
  CHECK(defaults_character(&character, &error) == DEFAULTS_STATUS_OK
      && character == UINT32_C(0x3bb));
  CHECK(defaults_character(UINT32_C(0x3bb), &character, &error)
      == DEFAULTS_STATUS_OK && character == UINT32_C(0x3bb));
  CHECK(defaults_character(UINT32_C(0x732b), &character, &error)
      == DEFAULTS_STATUS_OK && character == UINT32_C(0x732b));

  const defaults_option_uint32_value none = {0};
  const defaults_option_uint32_value some9 = {1, UINT32_C(9)};
  const defaults_option_uint32_value some11 = {1, UINT32_C(11)};
  defaults_option_uint32_value option = {0};
  CHECK(defaults_maybe(&option, &error) == DEFAULTS_STATUS_OK
      && option.has_value == 0);
  defaults_option_uint32_value_clear(&option);
  CHECK(defaults_maybe(&none, &option, &error) == DEFAULTS_STATUS_OK
      && option.has_value == 0);
  defaults_option_uint32_value_clear(&option);
  CHECK(defaults_maybe(&some11, &option, &error) == DEFAULTS_STATUS_OK
      && option.has_value == 1 && option.value == 11);
  defaults_option_uint32_value_clear(&option);
  CHECK(defaults_present(&option, &error) == DEFAULTS_STATUS_OK
      && option.has_value == 1 && option.value == 9);
  defaults_option_uint32_value_clear(&option);
  CHECK(defaults_present(&some9, &option, &error) == DEFAULTS_STATUS_OK
      && option.has_value == 1 && option.value == 9);
  defaults_option_uint32_value_clear(&option);
  CHECK(defaults_present(&none, &option, &error) == DEFAULTS_STATUS_OK
      && option.has_value == 0);
  defaults_option_uint32_value_clear(&option);

  CHECK(defaults_unit_value(&error) == DEFAULTS_STATUS_OK);
  CHECK(defaults_unit_value(UINT8_C(0), &error) == DEFAULTS_STATUS_OK);
  CHECK(defaults_present(NULL, &option, &error) == DEFAULTS_STATUS_INVALID_ARGUMENT);
  CHECK(defaults_natural(NULL, natural, &error) == DEFAULTS_STATUS_INVALID_ARGUMENT);

  mpz_clears(large_input, eleven_input, natural, NULL);

  printf("optional-parameter-c:%u\n", checks);
  return 0;
}
