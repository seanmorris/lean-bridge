#include <genericrecords.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == GENERICRECORDS_STATUS_OK)
static int is_small(mpz_srcptr value, unsigned long n) { return mpz_cmp_ui(value, n) == 0; }
static int same(const genericrecords_string *text, const char *expected) {
  return text->length == strlen(expected) && memcmp(text->data, expected, text->length) == 0;
}
static genericrecords_string text(const char *value) { genericrecords_string result = {value, strlen(value), NULL, NULL}; return result; }

int main(void) {
  genericrecords_error error = {0};
  /* Each alias is its own C struct with the structure's fields instantiated; Nat fields are GMP integers. */
  genericrecords_nat_box box, bumped; genericrecords_nat_box_init(&box); genericrecords_nat_box_init(&bumped);
  mpz_set_ui(box.value, 4); mpz_set_ui(box.count, 1);
  CHECK(OK(genericrecords_bump(&box, &bumped, &error)) && is_small(bumped.value, 5) && is_small(bumped.count, 2) && is_small(box.value, 4));
  genericrecords_nat_box_clear(&bumped);
  genericrecords_nat_box_again again_in, again_out; genericrecords_nat_box_again_init(&again_in); genericrecords_nat_box_again_init(&again_out);
  mpz_set_ui(again_in.value, 4); mpz_set_ui(again_in.count, 1);
  CHECK(OK(genericrecords_again(&again_in, &again_out, &error)) && is_small(again_out.value, 8) && is_small(again_out.count, 1));
  genericrecords_nat_box_again_clear(&again_in); genericrecords_nat_box_again_clear(&again_out);
  genericrecords_text_box text_in, text_out; genericrecords_text_box_init(&text_in); genericrecords_text_box_init(&text_out);
  text_in.value = text("h\xc3\xa9llo \xf0\x9f\x99\x82"); mpz_set_ui(text_in.count, 3);
  CHECK(OK(genericrecords_shout(&text_in, &text_out, &error)) && same(&text_out.value, "h\xc3\xa9llo \xf0\x9f\x99\x82!") && is_small(text_out.count, 3));
  genericrecords_text_box_clear(&text_out); mpz_clear(text_in.count);
  genericrecords_word_pair pair_in, pair_out; genericrecords_word_pair_init(&pair_in); genericrecords_word_pair_init(&pair_out);
  pair_in.first = text("a"); mpz_set_ui(pair_in.second, 1);
  CHECK(OK(genericrecords_swap_named(&pair_in, &pair_out, &error)) && same(&pair_out.first, "a!") && is_small(pair_out.second, 2));
  genericrecords_word_pair_clear(&pair_out); mpz_clear(pair_in.second);
  /* A parameter instantiated with Option Nat and a List of a named instantiation. */
  genericrecords_maybe_box maybe; genericrecords_maybe_box_init(&maybe);
  mpz_t sum; mpz_init(sum);
  maybe.value.has_value = 1; mpz_set_ui(maybe.value.value, 5); mpz_set_ui(maybe.count, 2);
  CHECK(OK(genericrecords_or_zero(&maybe, sum, &error)) && is_small(sum, 7));
  maybe.value.has_value = 0;
  CHECK(OK(genericrecords_or_zero(&maybe, sum, &error)) && is_small(sum, 2));
  genericrecords_maybe_box_clear(&maybe);
  genericrecords_nat_box items[2];
  genericrecords_nat_box_init(&items[0]); genericrecords_nat_box_init(&items[1]);
  mpz_set_ui(items[0].value, 1); mpz_set_ui(items[1].value, 2);
  const genericrecords_list_lean_generic_records_nat_box_span boxes = {items, 2, NULL, NULL}, none = {NULL, 0, NULL, NULL};
  CHECK(OK(genericrecords_total(&boxes, sum, &error)) && is_small(sum, 3));
  CHECK(OK(genericrecords_total(&none, sum, &error)) && is_small(sum, 0));
  genericrecords_nat_box_clear(&items[0]); genericrecords_nat_box_clear(&items[1]);
  genericrecords_option_list_lean_generic_records_nat_box_value first; genericrecords_option_list_lean_generic_records_nat_box_value_init(&first);
  mpz_t count; mpz_init_set_ui(count, 2);
  CHECK(OK(genericrecords_first_boxes(count, &first, &error)) && first.has_value && first.value.length == 2 && is_small(first.value.data[1].value, 1) && is_small(first.value.data[1].count, 2));
  genericrecords_option_list_lean_generic_records_nat_box_value_clear(&first);
  genericrecords_option_list_lean_generic_records_nat_box_value_init(&first);
  mpz_set_ui(count, 0);
  CHECK(OK(genericrecords_first_boxes(count, &first, &error)) && !first.has_value);
  genericrecords_option_list_lean_generic_records_nat_box_value_clear(&first);
  /* A pair of two named instantiations. */
  genericrecords_box_pair both; genericrecords_box_pair_init(&both);
  mpz_set_ui(both.first.value, 3); both.second.value = text("abcd");
  CHECK(OK(genericrecords_unpair(&both, sum, &error)) && is_small(sum, 7));
  mpz_clear(both.first.value); mpz_clear(both.first.count); mpz_clear(both.second.count);
  /* A universe-polymorphic structure instantiated at Type. */
  genericrecords_tagged_nat tagged_in, tagged_out; genericrecords_tagged_nat_init(&tagged_in); genericrecords_tagged_nat_init(&tagged_out);
  tagged_in.tag = text("t"); mpz_set_ui(tagged_in.payload, 1);
  CHECK(OK(genericrecords_retag(&tagged_in, &tagged_out, &error)) && same(&tagged_out.tag, "t#") && is_small(tagged_out.payload, 2));
  genericrecords_tagged_nat_clear(&tagged_out); mpz_clear(tagged_in.payload);
  for (unsigned long i = 0; i < 1000; ++i) {
    genericrecords_nat_box round; genericrecords_nat_box_init(&round);
    mpz_set_ui(box.value, i); mpz_set_ui(box.count, i);
    if (!OK(genericrecords_bump(&box, &round, &error)) || !is_small(round.value, i + 1) || !is_small(round.count, i + 1)) { fprintf(stderr, "round %lu failed\n", i); return 1; }
    genericrecords_nat_box_clear(&round);
  }
  checks += 1000;
  genericrecords_nat_box_clear(&box); mpz_clear(sum); mpz_clear(count);
  printf("generic-records-ok:%u\n", checks);
  return 0;
}
