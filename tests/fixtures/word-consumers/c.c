#include "words.h"
#include <assert.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
static unsigned checks;
#define CHECK(test) do { assert(test); ++checks; } while (0)
int main(void) {
  words_error error = {0};
  uint32_t bits = 0;
  CHECK(words_word_bits(&bits, &error) == 0 && bits == 64);
  const uint64_t us[] = {0, 1, UINT32_MAX, UINT64_C(9007199254740993), UINT64_MAX};
  const int64_t ss[] = {INT64_MIN, INT64_C(-9007199254740993), -1, 0, INT64_MAX};
  words_array_usize_span u = {us, 5, NULL, NULL};
  words_array_isize_span s = {ss, 5, NULL, NULL};
  for (int i = 0; i < 5; ++i) {
    uint64_t a = 0; int64_t b = 0;
    CHECK(words_keep_unsigned(us[i], &a, &error) == 0 && a == us[i]);
    CHECK(words_keep_signed(ss[i], &b, &error) == 0 && b == ss[i]);
    CHECK(words_advance_unsigned(us[i], &a, &error) == 0 && a == us[i] + 1);
    CHECK(words_advance_signed(ss[i], &b, &error) == 0 && b == (ss[i] == INT64_MAX ? INT64_MIN : ss[i] + 1));
    char expected[32]; words_string text = {0};
    int n = snprintf(expected, sizeof(expected), "%" PRIu64, us[i]);
    CHECK(words_unsigned_text(us[i], &text, &error) == 0 && text.length == (size_t)n && !memcmp(text.data, expected, text.length));
    words_string_clear(&text);
    n = snprintf(expected, sizeof(expected), "%" PRId64, ss[i]);
    CHECK(words_signed_text(ss[i], &text, &error) == 0 && text.length == (size_t)n && !memcmp(text.data, expected, text.length));
    words_string_clear(&text);
  }
  for (int i = 0; i < 1000; ++i) {
    words_sample input = {UINT64_MAX, INT64_MIN, u, s}, out = {0};
    CHECK(words_keep_sample(&input, &out, &error) == 0 && out.natural == UINT64_MAX && out.integer == INT64_MIN);
    CHECK(out.unsigned_values.length == 5 && !memcmp(out.unsigned_values.data, us, sizeof(us)));
    CHECK(out.signed_values.length == 5 && !memcmp(out.signed_values.data, ss, sizeof(ss)));
    words_sample_clear(&out);
    words_array_usize_span ur[] = {u, {0}}, uo = {0};
    words_array_isize_span sr[] = {s, {0}}, so = {0};
    CHECK(words_keep_unsigned_values(&u, &uo, &error) == 0 && uo.length == 5 && uo.data[4] == UINT64_MAX);
    CHECK(words_keep_signed_values(&s, &so, &error) == 0 && so.length == 5 && so.data[0] == INT64_MIN);
    words_array_usize_span_clear(&uo); words_array_isize_span_clear(&so);
    words_array_array_usize_span ui = {ur, 2, NULL, NULL}, ux = {0};
    words_array_array_isize_span si = {sr, 2, NULL, NULL}, sx = {0};
    CHECK(words_keep_unsigned_rows(&ui, &ux, &error) == 0 && ux.data[0].data[4] == UINT64_MAX && ux.data[1].length == 0);
    CHECK(words_keep_signed_rows(&si, &sx, &error) == 0 && sx.data[0].data[0] == INT64_MIN && sx.data[1].length == 0);
    words_array_array_usize_span_clear(&ux); words_array_array_isize_span_clear(&sx);
  }
  printf("word-ok:%u\n", checks);
}
