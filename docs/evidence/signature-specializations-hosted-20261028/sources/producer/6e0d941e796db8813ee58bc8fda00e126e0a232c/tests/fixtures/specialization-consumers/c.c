#include <specialized.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == SPECIALIZED_STATUS_OK)
static int same(const specialized_string *text, const char *expected) {
  return text->length == strlen(expected) && memcmp(text->data, expected, text->length) == 0;
}

int main(void) {
  specialized_error error = {0};
  uint32_t word = 0;
  specialized_string text;
  specialized_nat in, out;
  mpz_init(in); specialized_nat_init(out); specialized_string_init(&text);
  const specialized_string greeting = {"h\xc3\xa9llo \xf0\x9f\x99\x82", 11, NULL, NULL};
  const specialized_string empty = {"", 0, NULL, NULL};

  /* One generic declaration, three concrete exports. */
  CHECK(OK(specialized_echo_word(0, &word, &error)) && word == 0);
  CHECK(OK(specialized_echo_word(UINT32_MAX, &word, &error)) && word == UINT32_MAX);
  CHECK(OK(specialized_echo_text(&greeting, &text, &error)) && same(&text, greeting.data));
  CHECK(OK(specialized_echo_text(&empty, &text, &error)) && text.length == 0);
  mpz_set_str(in, "1606938044258990275541962092341162602522202993782792835301376", 10);
  CHECK(OK(specialized_echo_nat(in, out, &error)) && mpz_cmp(out, in) == 0);
  /* A constructed type argument through an alias: Array Word. */
  const uint32_t items[] = {0, 42, UINT32_MAX};
  const specialized_array_uint32_span words = {items, 3, NULL, NULL};
  specialized_array_uint32_span copied = {0};
  CHECK(OK(specialized_echo_words(&words, &copied, &error)) && copied.length == 3 && memcmp(copied.data, items, sizeof(items)) == 0);
  specialized_array_uint32_span_clear(&copied);

  /* Lean resolved each instance dictionary at build time. */
  CHECK(OK(specialized_choose_word(true, 5, &word, &error)) && word == 5);
  CHECK(OK(specialized_choose_word(false, 5, &word, &error)) && word == 37);
  CHECK(OK(specialized_choose_text(true, &greeting, &text, &error)) && same(&text, greeting.data));
  CHECK(OK(specialized_choose_text(false, &greeting, &text, &error)) && text.length == 0);
  CHECK(OK(specialized_choose_words(true, &words, &copied, &error)) && copied.length == 3 && copied.data[1] == 42);
  specialized_array_uint32_span_clear(&copied);
  CHECK(OK(specialized_choose_words(false, &words, &copied, &error)) && copied.length == 0);
  specialized_array_uint32_span_clear(&copied);
  CHECK(OK(specialized_double_word(UINT32_C(2147483649), &word, &error)) && word == 2);
  mpz_ui_pow_ui(in, 2, 100);
  CHECK(OK(specialized_double_nat(in, out, &error)) && mpz_sizeinbase(out, 2) == 102 && mpz_scan1(out, 0) == 101);

  /* Two explicit type arguments, then a monomorphic neighbour. */
  CHECK(OK(specialized_first_text_word(&greeting, 9, &text, &error)) && same(&text, greeting.data));
  CHECK(OK(specialized_plain(1, &word, &error)) && word == 4);

  for (uint32_t i = 0; i < 1000; ++i) {
    CHECK(OK(specialized_choose_word(i % 2 == 0, i, &word, &error)) && word == (i % 2 == 0 ? i : 37));
    CHECK(OK(specialized_double_word(i, &word, &error)) && word == 2 * i);
  }
  mpz_clear(in); specialized_nat_clear(out); specialized_string_clear(&text);
  printf("specialization-ok:%u\n", checks);
  return 0;
}
