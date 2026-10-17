#define INHERITED_CHECKED_RECORD_RESULT_ONLY
#define INHERITED_PARAMETER_PREFIX "value"
#include <inheritedcheckedrecords.h>
#include <stdio.h>
#include <string.h>

#ifndef INHERITED_PARAMETER_PREFIX
#define INHERITED_PARAMETER_PREFIX "arg"
#endif

static unsigned checks;
static unsigned rejections;
static const unsigned rounds = 256;

#define CHECK(test) do { \
  if (!(test)) { fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } \
  ++checks; \
} while (0)
#define OK(call) ((call) == INHERITEDCHECKEDRECORDS_STATUS_OK)

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
static int rejected(inheritedcheckedrecords_status status,
                    const inheritedcheckedrecords_error *error,
                    const char *expected) {
  const int accepted = status == INHERITEDCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
    && error->code == INHERITEDCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected)
    && memcmp(error->message, expected, error->message_length) == 0;
  if (accepted) ++rejections;
  return accepted;
}

static const char *message(char *buffer, size_t size, const char *suffix) {
  snprintf(buffer, size, "%s%s", INHERITED_PARAMETER_PREFIX, suffix);
  return buffer;
}
#endif

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
static void ticket_set(inheritedcheckedrecords_ticket *value,
                       unsigned long lo, unsigned long hi, unsigned long word) {
  mpz_set_ui(value->to_span.lo, lo);
  mpz_set_ui(value->to_span.hi, hi);
  mpz_set_ui(value->word, word);
}
#endif

static int ticket_is(const inheritedcheckedrecords_ticket *value,
                     unsigned long lo, unsigned long hi, unsigned long word) {
  return mpz_cmp_ui(value->to_span.lo, lo) == 0
    && mpz_cmp_ui(value->to_span.hi, hi) == 0
    && mpz_cmp_ui(value->word, word) == 0;
}

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
static void stamped_set(inheritedcheckedrecords_stamped *value,
                        unsigned long lo, unsigned long hi,
                        unsigned long word, unsigned long mark) {
  ticket_set(&value->to_ticket, lo, hi, word);
  mpz_set_ui(value->mark, mark);
}
#endif

static int stamped_is(const inheritedcheckedrecords_stamped *value,
                      unsigned long lo, unsigned long hi,
                      unsigned long word, unsigned long mark) {
  return ticket_is(&value->to_ticket, lo, hi, word)
    && mpz_cmp_ui(value->mark, mark) == 0;
}

int main(void) {
  inheritedcheckedrecords_error error = {0};
  mpz_t value, result;
  mpz_inits(value, result, NULL);
  inheritedcheckedrecords_ticket produced;
  inheritedcheckedrecords_stamped produced_stamped;
  inheritedcheckedrecords_ticket_init(&produced);
  inheritedcheckedrecords_stamped_init(&produced_stamped);
  for (unsigned round = 0; round < rounds; ++round) {
    mpz_set_ui(value, round);
    CHECK(OK(inheritedcheckedrecords_produce(value, &produced, &error))
      && ticket_is(&produced, round, round, round + 1));
    CHECK(OK(inheritedcheckedrecords_produce_stamped(value, &produced_stamped, &error))
      && stamped_is(&produced_stamped, round, round, round + 1, 0));
  }

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
  char expected[160];
  inheritedcheckedrecords_ticket first, invalid, echoed;
  inheritedcheckedrecords_stamped stamped;
  inheritedcheckedrecords_ticket_alias_t alias;
  inheritedcheckedrecords_ticket_init(&first);
  inheritedcheckedrecords_ticket_init(&invalid);
  inheritedcheckedrecords_ticket_init(&echoed);
  inheritedcheckedrecords_stamped_init(&stamped);
  inheritedcheckedrecords_ticket_alias_t_init(&alias);

  ticket_set(&first, 2, 3, 4);
  CHECK(OK(inheritedcheckedrecords_first(&first, result, &error))
    && mpz_cmp_ui(result, 9) == 0);
  ticket_set(&invalid, 4, 1, 0);
  CHECK(OK(inheritedcheckedrecords_normalized(&invalid, result, &error))
    && mpz_cmp_ui(result, 11) == 0);
  ticket_set(&invalid, 4, 1, 999);
  CHECK(OK(inheritedcheckedrecords_pair(&first, &invalid, result, &error))
    && mpz_cmp_ui(result, 10) == 0);
  mpz_set_ui(alias.to_span.lo, 4); mpz_set_ui(alias.to_span.hi, 1);
  mpz_set_ui(alias.word, 4);
  CHECK(OK(inheritedcheckedrecords_aliased(&alias, result, &error))
    && mpz_cmp_ui(result, 5) == 0);
  stamped_set(&stamped, 1, 2, 4, 3);
  CHECK(OK(inheritedcheckedrecords_nested(&stamped, result, &error))
    && mpz_cmp_ui(result, 7) == 0);
  ticket_set(&invalid, 1, 2, 0);
  CHECK(OK(inheritedcheckedrecords_echo(&invalid, &echoed, &error))
    && ticket_is(&echoed, 1, 2, 3));

  ticket_set(&invalid, 4, 1, 5);
  CHECK(rejected(inheritedcheckedrecords_first(&invalid, result, &error), &error,
    message(expected, sizeof expected, "0.toSpan was rejected by InheritedCheckedRecords.mkSpan"))
    && ticket_is(&invalid, 4, 1, 5));
  ticket_set(&invalid, 1, 2, 0);
  CHECK(rejected(inheritedcheckedrecords_first(&invalid, result, &error), &error,
    message(expected, sizeof expected, "0.word was rejected by InheritedCheckedRecords.mkWord"))
    && ticket_is(&invalid, 1, 2, 0));
  ticket_set(&invalid, 1, 5, 3);
  CHECK(rejected(inheritedcheckedrecords_first(&invalid, result, &error), &error,
    message(expected, sizeof expected, "0 was rejected by InheritedCheckedRecords.mkTicket"))
    && ticket_is(&invalid, 1, 5, 3));
  stamped_set(&stamped, 1, 2, 9, 8);
  CHECK(rejected(inheritedcheckedrecords_nested(&stamped, result, &error), &error,
    message(expected, sizeof expected, "0.mark is not below its Fin 8 bound"))
    && stamped_is(&stamped, 1, 2, 9, 8));
  stamped_set(&stamped, 1, 2, 4, 5);
  CHECK(rejected(inheritedcheckedrecords_nested(&stamped, result, &error), &error,
    message(expected, sizeof expected, "0 was rejected by InheritedCheckedRecords.mkStamped"))
    && stamped_is(&stamped, 1, 2, 4, 5));
  mpz_set_ui(alias.to_span.lo, 1); mpz_set_ui(alias.to_span.hi, 5);
  mpz_set_ui(alias.word, 3);
  CHECK(rejected(inheritedcheckedrecords_aliased(&alias, result, &error), &error,
    message(expected, sizeof expected, "0 was rejected by InheritedCheckedRecords.mkTicket"))
    && mpz_cmp_ui(alias.to_span.lo, 1) == 0
    && mpz_cmp_ui(alias.to_span.hi, 5) == 0 && mpz_cmp_ui(alias.word, 3) == 0);

  for (unsigned round = 0; round < rounds; ++round) {
    const unsigned long n = round + 10;
    ticket_set(&first, n, n + 1, n + 2);
    CHECK(OK(inheritedcheckedrecords_first(&first, result, &error))
      && mpz_cmp_ui(result, 3 * n + 3) == 0);
    ticket_set(&invalid, n + 2, n, 0);
    CHECK(OK(inheritedcheckedrecords_normalized(&invalid, result, &error))
      && mpz_cmp_ui(result, 4 * n + 5) == 0);
    CHECK(OK(inheritedcheckedrecords_pair(&first, &invalid, result, &error))
      && mpz_cmp_ui(result, 3 * n + 5) == 0);
    mpz_set_ui(alias.to_span.lo, n + 2); mpz_set_ui(alias.to_span.hi, n);
    mpz_set_ui(alias.word, 2 * n + 1);
    CHECK(OK(inheritedcheckedrecords_aliased(&alias, result, &error))
      && mpz_cmp_ui(result, 2 * n + 2) == 0);
    const unsigned long mark = round % 8;
    stamped_set(&stamped, mark, mark, mark + 1, mark);
    CHECK(OK(inheritedcheckedrecords_nested(&stamped, result, &error))
      && mpz_cmp_ui(result, 2 * mark + 1) == 0);

    ticket_set(&invalid, n + 1, n, n + 2);
    CHECK(rejected(inheritedcheckedrecords_first(&invalid, result, &error), &error,
      message(expected, sizeof expected, "0.toSpan was rejected by InheritedCheckedRecords.mkSpan"))
      && ticket_is(&invalid, n + 1, n, n + 2));
    ticket_set(&invalid, 0, 1, 0);
    CHECK(rejected(inheritedcheckedrecords_first(&invalid, result, &error), &error,
      message(expected, sizeof expected, "0.word was rejected by InheritedCheckedRecords.mkWord"))
      && ticket_is(&invalid, 0, 1, 0));
    ticket_set(&invalid, 0, n + 2, n + 1);
    CHECK(rejected(inheritedcheckedrecords_first(&invalid, result, &error), &error,
      message(expected, sizeof expected, "0 was rejected by InheritedCheckedRecords.mkTicket"))
      && ticket_is(&invalid, 0, n + 2, n + 1));
    stamped_set(&stamped, 0, 9, 9, 8);
    CHECK(rejected(inheritedcheckedrecords_nested(&stamped, result, &error), &error,
      message(expected, sizeof expected, "0.mark is not below its Fin 8 bound"))
      && stamped_is(&stamped, 0, 9, 9, 8));
    stamped_set(&stamped, 0, 6, 6, 7);
    CHECK(rejected(inheritedcheckedrecords_nested(&stamped, result, &error), &error,
      message(expected, sizeof expected, "0 was rejected by InheritedCheckedRecords.mkStamped"))
      && stamped_is(&stamped, 0, 6, 6, 7));
    CHECK(OK(inheritedcheckedrecords_first(&first, result, &error))
      && mpz_cmp_ui(result, 3 * n + 3) == 0);
  }

  inheritedcheckedrecords_ticket_clear(&first);
  inheritedcheckedrecords_ticket_clear(&invalid);
  inheritedcheckedrecords_ticket_clear(&echoed);
  inheritedcheckedrecords_stamped_clear(&stamped);
  inheritedcheckedrecords_ticket_alias_t_clear(&alias);
#endif

  inheritedcheckedrecords_ticket_clear(&produced);
  inheritedcheckedrecords_stamped_clear(&produced_stamped);
  mpz_clears(value, result, NULL);
  printf("{\"checks\":%u,\"rejections\":%u,\"rounds\":%u}\n"
    , checks, rejections, rounds);
  return 0;
}
