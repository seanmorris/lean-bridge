#define _GNU_SOURCE
#include <inheritedrecords.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == INHERITEDRECORDS_STATUS_OK)
/* A rejected call names the parameter and the bound of the parent's field. */
static int rejected(inheritedrecords_status status, const inheritedrecords_error *error, const char *expected) {
  return status == INHERITEDRECORDS_STATUS_INVALID_ARGUMENT && error->code == INHERITEDRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
static inheritedrecords_string text(const char *value) { inheritedrecords_string result = {value, strlen(value), NULL, NULL}; return result; }
static int same_text(const inheritedrecords_string *value, const char *expected) { return value->length == strlen(expected) && memcmp(value->data, expected, value->length) == 0; }
static void point(inheritedrecords_point *value, unsigned long x, unsigned long y) { mpz_set_ui(value->x, x); mpz_set_ui(value->y, y); }

int main(void) {
  inheritedrecords_error error = {0};
  mpz_t count; mpz_init(count);
  /* Labeled extends Point: the parent is the toPoint field, read and rebuilt by Lean. */
  inheritedrecords_labeled labeled, moved; inheritedrecords_labeled_init(&labeled); inheritedrecords_labeled_init(&moved);
  point(&labeled.to_point, 4, 7); labeled.label = text("héllo");
  CHECK(OK(inheritedrecords_move(&labeled, &moved, &error)) && mpz_cmp_ui(moved.to_point.x, 5) == 0 && mpz_cmp_ui(moved.to_point.y, 7) == 0 && same_text(&moved.label, "héllo!"));
  inheritedrecords_labeled_clear(&moved);
  /* Tagged extends Digit and Point: Digit's Fin 10 field is checked through toDigit. */
  inheritedrecords_tagged tagged, bumped; inheritedrecords_tagged_init(&tagged); inheritedrecords_tagged_init(&bumped);
  mpz_set_ui(tagged.to_digit.digit, 9); point(&tagged.to_point, 2, 3); tagged.tag = text("ab");
  CHECK(OK(inheritedrecords_total(&tagged, count, &error)) && mpz_cmp_ui(count, 16) == 0);
  CHECK(OK(inheritedrecords_bump(&tagged, &bumped, &error)) && mpz_cmp_ui(bumped.to_digit.digit, 0) == 0 && mpz_cmp_ui(bumped.to_point.x, 2) == 0 && same_text(&bumped.tag, "ab"));
  inheritedrecords_tagged_clear(&bumped); inheritedrecords_tagged_init(&bumped);
  mpz_set_ui(tagged.to_digit.digit, 10);
  CHECK(rejected(inheritedrecords_total(&tagged, count, &error), &error, "arg0 is not below its Fin 10 bound") && mpz_cmp_ui(tagged.to_digit.digit, 10) == 0);
  CHECK(rejected(inheritedrecords_bump(&tagged, &bumped, &error), &error, "arg0 is not below its Fin 10 bound"));
  mpz_set_ui(tagged.to_digit.digit, 0); mpz_setbit(tagged.to_digit.digit, 70);
  CHECK(rejected(inheritedrecords_total(&tagged, count, &error), &error, "arg0 is not below its Fin 10 bound"));
  mpz_set_ui(tagged.to_digit.digit, 4);
  CHECK(OK(inheritedrecords_total(&tagged, count, &error)) && mpz_cmp_ui(count, 11) == 0); /* Recovery. */
  /* Stamped extends Labeled: two levels of subobjects. */
  inheritedrecords_stamped stamped, restamped; inheritedrecords_stamped_init(&stamped); inheritedrecords_stamped_init(&restamped);
  point(&stamped.to_labeled.to_point, 1, 21); stamped.to_labeled.label = text("s"); mpz_set_ui(stamped.stamp, 41);
  CHECK(OK(inheritedrecords_restamp(&stamped, &restamped, &error)) && mpz_cmp_ui(restamped.stamp, 42) == 0
    && mpz_cmp_ui(restamped.to_labeled.to_point.y, 42) == 0 && mpz_cmp_ui(restamped.to_labeled.to_point.x, 1) == 0 && same_text(&restamped.to_labeled.label, "s"));
  inheritedrecords_stamped_clear(&restamped);
  /* Merged extends Labeled and Tagged: Lean keeps toLabeled and flattens the rest of Tagged. */
  inheritedrecords_merged merged; inheritedrecords_merged_init(&merged);
  point(&merged.to_labeled.to_point, 5, 0); merged.to_labeled.label = text("m"); mpz_set_ui(merged.to_digit.digit, 3); merged.tag = text("t"); mpz_set_ui(merged.extra, 100);
  CHECK(OK(inheritedrecords_merged_total(&merged, count, &error)) && mpz_cmp_ui(count, 108) == 0);
  mpz_set_ui(merged.to_digit.digit, 10);
  CHECK(rejected(inheritedrecords_merged_total(&merged, count, &error), &error, "arg0 is not below its Fin 10 bound"));
  for (unsigned long i = 0; i < 1000; ++i) {
    mpz_set_ui(tagged.to_digit.digit, i % 10);
    if (!OK(inheritedrecords_total(&tagged, count, &error)) || mpz_cmp_ui(count, i % 10 + 7) != 0) { fprintf(stderr, "round %lu failed\n", i); return 1; }
    mpz_set_ui(tagged.to_digit.digit, 10 + i);
    if (!rejected(inheritedrecords_total(&tagged, count, &error), &error, "arg0 is not below its Fin 10 bound")) { fprintf(stderr, "rejection round %lu failed\n", i); return 1; }
  }
  checks += 2000;
  /* Caller-owned strings were borrowed views; clear only the numbers the caller initialized. */
  labeled.label = text(""); tagged.tag = text(""); stamped.to_labeled.label = text(""); merged.to_labeled.label = text(""); merged.tag = text("");
  inheritedrecords_labeled_clear(&labeled); inheritedrecords_tagged_clear(&tagged); inheritedrecords_tagged_clear(&bumped);
  inheritedrecords_stamped_clear(&stamped); inheritedrecords_merged_clear(&merged); mpz_clear(count);
  printf("inherited-record-ok:%u\n", checks);
  return 0;
}
