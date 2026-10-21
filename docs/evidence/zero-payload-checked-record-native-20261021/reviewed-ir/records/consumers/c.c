#define _GNU_SOURCE
#include <zeropayloadcheckedrecords.h>
#include <gmp.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
static unsigned calls;
static unsigned rejections;
static unsigned recoveries;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define RUN(call) (++calls, (call))
#define OK(call) ((call) == ZEROPAYLOADCHECKEDRECORDS_STATUS_OK)

_Static_assert(sizeof(zeropayloadcheckedrecords_witness) == 1,
  "C empty carrier must have a stable nonzero size");
_Static_assert(sizeof(zeropayloadcheckedrecords_marker) == 1,
  "C plain-empty carrier must have a stable nonzero size");
_Static_assert(!__builtin_types_compatible_p(zeropayloadcheckedrecords_witness,
  zeropayloadcheckedrecords_marker), "empty record identities must stay distinct");

static int refused(zeropayloadcheckedrecords_status status,
  const zeropayloadcheckedrecords_error *error, const char *expected) {
  return status == ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
    && error->code == ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected)
    && memcmp(error->message, expected, error->message_length) == 0;
}

int main(void) {
  zeropayloadcheckedrecords_error error = {0};
  mpz_t out, count; mpz_init(out); mpz_init_set_ui(count, 3);
  zeropayloadcheckedrecords_witness witness = {.empty = 173};
  zeropayloadcheckedrecords_token token = {.tag = 0};
  zeropayloadcheckedrecords_marker marker = {.empty = 91};

  CHECK(OK(RUN(zeropayloadcheckedrecords_witness_count(&witness, out, &error)))
    && mpz_cmp_ui(out, 1) == 0 && witness.empty == 173);
  mpz_set_ui(out, 77);
  CHECK(refused(RUN(zeropayloadcheckedrecords_absent_count(&witness, out, &error)),
    &error, "value0 was rejected by ZeroPayloadCheckedRecords.mkAbsent")
    && mpz_cmp_ui(out, 77) == 0 && witness.empty == 173);
  ++rejections;
  CHECK(OK(RUN(zeropayloadcheckedrecords_witness_count(&witness, out, &error)))
    && mpz_cmp_ui(out, 1) == 0 && witness.empty == 173);
  ++recoveries;
  CHECK(OK(RUN(zeropayloadcheckedrecords_token_tag(&token, &error)))
    && token.tag == 0);
  CHECK(OK(RUN(zeropayloadcheckedrecords_marker_count(&marker, out, &error)))
    && mpz_cmp_ui(out, 0) == 0 && marker.empty == 91);
  zeropayloadcheckedrecords_mark blank, marked;
  zeropayloadcheckedrecords_mark_init(&blank);
  zeropayloadcheckedrecords_mark_init(&marked);
  CHECK(zeropayloadcheckedrecords_mark_select(&blank,
    ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_BLANK) == ZEROPAYLOADCHECKEDRECORDS_STATUS_OK
    && OK(RUN(zeropayloadcheckedrecords_mark_count(&blank, out, &error)))
    && mpz_cmp_ui(out, 0) == 0 && blank.kind == ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_BLANK);
  CHECK(zeropayloadcheckedrecords_mark_select(&marked,
    ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_MARKED) == ZEROPAYLOADCHECKEDRECORDS_STATUS_OK
    && OK(RUN(zeropayloadcheckedrecords_mark_count(&marked, out, &error)))
    && mpz_cmp_ui(out, 1) == 0 && marked.kind == ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_MARKED);

  zeropayloadcheckedrecords_witness made_witness = {.empty = 255};
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_witness(&made_witness, &error))));
  zeropayloadcheckedrecords_token made_token = {.tag = 255};
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_token(&made_token, &error))));
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span witnesses = {0};
  CHECK(OK(RUN(zeropayloadcheckedrecords_witnesses(count, &witnesses, &error)))
    && witnesses.length == 3 && witnesses.data != NULL);
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value maybe = {0};
  CHECK(OK(RUN(zeropayloadcheckedrecords_maybe_witness(true, &maybe, &error)))
    && maybe.has_value == 1);
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(&maybe);
  CHECK(OK(RUN(zeropayloadcheckedrecords_maybe_witness(false, &maybe, &error)))
    && maybe.has_value == 0);
  zeropayloadcheckedrecords_marker made_marker = {.empty = 255};
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_marker(&made_marker, &error))));
  zeropayloadcheckedrecords_mark made_mark;
  zeropayloadcheckedrecords_mark_init(&made_mark);
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_mark(false, &made_mark, &error)))
    && made_mark.kind == ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_BLANK);
  zeropayloadcheckedrecords_mark_clear(&made_mark);
  zeropayloadcheckedrecords_mark_init(&made_mark);
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_mark(true, &made_mark, &error)))
    && made_mark.kind == ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_MARKED);

  CHECK(calls == 15 && rejections == 1 && recoveries == 1);
  zeropayloadcheckedrecords_witness_clear(&made_witness);
  zeropayloadcheckedrecords_token_clear(&made_token);
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(&witnesses);
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(&maybe);
  zeropayloadcheckedrecords_marker_clear(&made_marker);
  zeropayloadcheckedrecords_mark_clear(&blank);
  zeropayloadcheckedrecords_mark_clear(&marked);
  zeropayloadcheckedrecords_mark_clear(&made_mark);
  mpz_clear(count); mpz_clear(out);
  printf("{\"calls\":%u,\"checks\":%u,\"recoveries\":%u,\"rejections\":%u}\n",
    calls, checks, recoveries, rejections);
  return 0;
}
