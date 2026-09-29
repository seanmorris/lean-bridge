/* Independent installed consumer. Only the shipped semantic C header is used. */
#include "owned_aggregates.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "installed scalar check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
static void clear(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(!*owner);
}
static const char text[] = {'A', 0, (char)0xf0, (char)0x9f, (char)0x8c, (char)0xb1};
static const uint8_t bytes[] = {0, 255, 1};
static void inspect(owned_aggregates_session *session, const owned_aggregates_packet_t *value) {
  bool correct = false; owned_aggregates_result *owner = NULL;
  OK(owned_aggregates_inspect(session, value, &correct, &owner)); CHECK(correct); clear(&owner);
  const owned_aggregates_scalars_t *p = value->scalars;
  CHECK(!p->unit && p->flag && p->char_ == 0x1f331);
  CHECK(p->u8 == UINT8_MAX && p->u16 == UINT16_MAX && p->u32 == UINT32_MAX && p->u64 == UINT64_MAX);
  CHECK(p->i8 == INT8_MIN && p->i16 == INT16_MIN && p->i32 == INT32_MIN && p->i64 == INT64_MIN);
  CHECK(p->word == UINT64_MAX && p->signed_word == INT64_MIN && p->f32 == 1.5f && p->f64 == -2.25);
  mpz_t expected; mpz_init_set_ui(expected, 1); mpz_mul_2exp(expected, expected, 128); mpz_add_ui(expected, expected, 1);
  CHECK(mpz_cmp(p->natural, expected) == 0); mpz_neg(expected, expected); CHECK(mpz_cmp(p->integer, expected) == 0); mpz_clear(expected);
  CHECK(p->text.length == sizeof(text) && !memcmp(p->text.data, text, sizeof(text)));
  CHECK(p->bytes.length == sizeof(bytes) && !memcmp(p->bytes.data, bytes, sizeof(bytes)));
}
static void rejected(owned_aggregates_session *session, const owned_aggregates_packet_t *value) {
  owned_aggregates_packet_t out; memset(&out, 0xa5, sizeof(out));
  unsigned char saved[sizeof(out)]; memcpy(saved, &out, sizeof(out));
  owned_aggregates_result *owner = NULL;
  CHECK(owned_aggregates_echo(session, value, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!owner && !memcmp(saved, &out, sizeof(out)));
}
int main(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *owner = NULL;
  mpz_t serial, natural, integer; mpz_init_set_ui(serial, 42); mpz_init_set_ui(natural, 1); mpz_init(integer);
  mpz_mul_2exp(natural, natural, 128); mpz_add_ui(natural, natural, 1); mpz_neg(integer, natural);
  owned_aggregates_ticket_t ticket = NULL;
  OK(owned_aggregates_new_ticket(session, serial, (owned_aggregates_scalar_string_t){"ticket", 6}, &ticket, &ticket_owner));
  owned_aggregates_scalars_t p = {
    .unit = 0, .flag = true, .char_ = 0x1f331, .natural = natural, .integer = integer,
    .u8 = UINT8_MAX, .u16 = UINT16_MAX, .u32 = UINT32_MAX, .u64 = UINT64_MAX,
    .i8 = INT8_MIN, .i16 = INT16_MIN, .i32 = INT32_MIN, .i64 = INT64_MIN,
    .word = UINT64_MAX, .signed_word = INT64_MIN, .f32 = 1.5f, .f64 = -2.25,
    .text = {text, sizeof(text)}, .bytes = {bytes, sizeof(bytes)}
  };
  owned_aggregates_packet_optional_value_t inner = {true, 0};
  owned_aggregates_packet_optional_t outer = {true, &inner};
  owned_aggregates_empty_t empty = {0};
  owned_aggregates_packet_t input = {ticket, &p, &outer, &empty}, out = {0};
  inspect(session, &input);
  OK(owned_aggregates_echo(session, &input, &out, &owner)); inspect(session, &out);
  CHECK(out.ticket == ticket && out.scalars != &p && out.empty != &empty && out.scalars->natural != natural); clear(&owner);
  OK(owned_aggregates_make_packet(session, ticket, &out, &owner)); inspect(session, &out); clear(&owner);
  for (uint8_t branch = 0; branch < 3; ++branch) {
    outer.has_value = branch != 0; inner.has_value = branch == 2;
    OK(owned_aggregates_echo(session, &input, &out, &owner));
    CHECK(out.optional->has_value == outer.has_value);
    if (outer.has_value) CHECK(out.optional->value->has_value == inner.has_value);
    else CHECK(!out.optional->value);
    uint8_t actual = 99; owned_aggregates_result *temporary = NULL;
    OK(owned_aggregates_option_case(session, &out, &actual, &temporary)); CHECK(actual == branch);
    clear(&temporary); clear(&owner);
  }
  const uint32_t floats[] = {0, 0x80000000u, 0x7f800000u, 0xff800000u, 0x7fc12345u};
  const uint64_t doubles[] = {0, UINT64_C(0x8000000000000000), UINT64_C(0x7ff0000000000000), UINT64_C(0xfff0000000000000), UINT64_C(0x7ff8123456789abc)};
  for (size_t i = 0; i < 5; ++i) {
    memcpy(&p.f32, floats + i, 4); memcpy(&p.f64, doubles + i, 8);
    OK(owned_aggregates_echo(session, &input, &out, &owner));
    CHECK(!memcmp(&out.scalars->f32, floats + i, 4) && !memcmp(&out.scalars->f64, doubles + i, 8)); clear(&owner);
    uint32_t bits32 = 99; uint64_t bits64 = 99;
    OK(owned_aggregates_bits32(session, &input, &bits32, &owner)); CHECK(bits32 == (i == 4 ? 0x7fc00000u : floats[i])); clear(&owner);
    OK(owned_aggregates_bits64(session, &input, &bits64, &owner)); CHECK(bits64 == (i == 4 ? UINT64_C(0x7ff8000000000000) : doubles[i])); clear(&owner);
  }
  p.f32 = 1.5f; p.f64 = -2.25;
  p.unit = 1; rejected(session, &input); p.unit = 0;
  uint8_t invalid_bool = 2; memcpy(&p.flag, &invalid_bool, 1); rejected(session, &input); p.flag = true;
  p.char_ = 0xd800; rejected(session, &input); p.char_ = 0x1f331;
  mpz_neg(natural, natural); rejected(session, &input); mpz_neg(natural, natural);
  p.natural = NULL; rejected(session, &input); p.natural = natural;
  p.text = (owned_aggregates_scalar_string_t){"\xc0\x80", 2}; rejected(session, &input); p.text = (owned_aggregates_scalar_string_t){text, sizeof(text)};
  p.bytes.data = NULL; rejected(session, &input); p.bytes.data = bytes;
  uint8_t *units = calloc(131072, 1); CHECK(units != NULL);
  owned_aggregates_units_argument0_t list = {units, 131071}, returned = {0};
  OK(owned_aggregates_units(session, &list, &returned, &owner)); CHECK(returned.length == 131071 && !returned.data[131070]); clear(&owner);
  list.length = 131072;
  CHECK(owned_aggregates_units(session, &list, &returned, &owner) == OWNED_AGGREGATES_LIMIT); CHECK(!owner);
  free(units);
  OK(owned_aggregates_make_packet(session, ticket, &out, &owner));
  clear(&ticket_owner); OK(owned_aggregates_session_close(&session));
  CHECK(mpz_cmp(out.scalars->natural, natural) == 0); clear(&owner);
  mpz_clear(serial); mpz_clear(natural); mpz_clear(integer);
  printf("owned-installed-scalars:%zu\n", checks);
  return 0;
}
