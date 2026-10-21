#define _GNU_SOURCE
#include <zeropayloadcheckedrecords.h>
#include <gmp.h>
#include <stdio.h>

static unsigned checks;
static unsigned calls;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define RUN(call) (++calls, (call))
#define OK(call) ((call) == ZEROPAYLOADCHECKEDRECORDS_STATUS_OK)

_Static_assert(sizeof(zeropayloadcheckedrecords_witness) == 1,
  "C empty carrier must have a stable nonzero size");
_Static_assert(!__builtin_types_compatible_p(zeropayloadcheckedrecords_witness,
  zeropayloadcheckedrecords_marker), "empty record identities must stay distinct");

int main(void) {
  zeropayloadcheckedrecords_error error = {0};
  mpz_t count; mpz_init_set_ui(count, 3);
  zeropayloadcheckedrecords_witness witness = {.empty = 255};
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_witness(&witness, &error))));
  zeropayloadcheckedrecords_token token = {.tag = 255};
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_token(&token, &error))));
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span witnesses = {0};
  CHECK(OK(RUN(zeropayloadcheckedrecords_witnesses(count, &witnesses, &error)))
    && witnesses.length == 3 && witnesses.data != NULL);
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value maybe = {0};
  CHECK(OK(RUN(zeropayloadcheckedrecords_maybe_witness(true, &maybe, &error)))
    && maybe.has_value == 1);
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(&maybe);
  CHECK(OK(RUN(zeropayloadcheckedrecords_maybe_witness(false, &maybe, &error)))
    && maybe.has_value == 0);
  zeropayloadcheckedrecords_marker marker = {.empty = 255};
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_marker(&marker, &error))));
  zeropayloadcheckedrecords_mark mark;
  zeropayloadcheckedrecords_mark_init(&mark);
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_mark(false, &mark, &error)))
    && mark.kind == ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_BLANK);
  zeropayloadcheckedrecords_mark_clear(&mark);
  zeropayloadcheckedrecords_mark_init(&mark);
  CHECK(OK(RUN(zeropayloadcheckedrecords_produce_mark(true, &mark, &error)))
    && mark.kind == ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_MARKED);
  CHECK(calls == 8);
  zeropayloadcheckedrecords_witness_clear(&witness);
  zeropayloadcheckedrecords_token_clear(&token);
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(&witnesses);
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(&maybe);
  zeropayloadcheckedrecords_marker_clear(&marker);
  zeropayloadcheckedrecords_mark_clear(&mark);
  mpz_clear(count);
  printf("{\"calls\":%u,\"checks\":%u,\"recoveries\":0,\"rejections\":0}\n",
    calls, checks);
  return 0;
}
