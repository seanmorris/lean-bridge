#include "defaults.h"

#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(condition) do { assert(condition); ++checks; } while (0)

static int nat_is(const defaults_nat *value, const uint32_t *data, size_t length) {
  return value->length == length
      && (length == 0 || memcmp(value->data, data, length * sizeof(uint32_t)) == 0);
}

int main(void) {
  defaults_error error = {0};
  uint32_t word = 0;
  CHECK(defaults_word(&word, &error) == DEFAULTS_STATUS_OK && word == 7);
  CHECK(defaults_word(UINT32_C(7), &word, &error) == DEFAULTS_STATUS_OK && word == 7);
  CHECK(defaults_word(UINT32_C(11), &word, &error) == DEFAULTS_STATUS_OK && word == 11);

  const uint32_t large[] = {UINT32_C(0), UINT32_C(0), UINT32_C(10)};
  const uint32_t eleven[] = {UINT32_C(11)};
  const defaults_nat large_input = {large, 3, NULL, NULL};
  const defaults_nat eleven_input = {eleven, 1, NULL, NULL};
  defaults_nat natural = {0};
  CHECK(defaults_natural(&natural, &error) == DEFAULTS_STATUS_OK
      && nat_is(&natural, large, 3));
  defaults_nat_clear(&natural);
  CHECK(defaults_natural(&large_input, &natural, &error) == DEFAULTS_STATUS_OK
      && nat_is(&natural, large, 3));
  defaults_nat_clear(&natural);
  CHECK(defaults_natural(&eleven_input, &natural, &error) == DEFAULTS_STATUS_OK
      && nat_is(&natural, eleven, 1));
  defaults_nat_clear(&natural);

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
  CHECK(defaults_natural(NULL, &natural, &error) == DEFAULTS_STATUS_INVALID_ARGUMENT);

  printf("optional-parameter-c:%u\n", checks);
  return 0;
}
