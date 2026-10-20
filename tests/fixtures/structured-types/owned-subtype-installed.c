/* Installed C consumer for proof-erased checked fields in owned aggregates. */
#include "owned_subtypes.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) { \
  fprintf(stderr, "owned Subtype C check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_SUBTYPES_OK)

static void release(owned_subtypes_result **owner) {
  OK(owned_subtypes_result_release(owner)); CHECK(*owner == NULL);
}

static owned_subtypes_ticket_t make_ticket(
  owned_subtypes_session *session, unsigned serial, owned_subtypes_result **owner
) {
  mpz_t value; mpz_init_set_ui(value, serial);
  owned_subtypes_ticket_t ticket = NULL;
  OK(owned_subtypes_new_ticket(
    session, value, (owned_subtypes_scalar_string_t){"native", 6}, &ticket, owner
  ));
  CHECK(ticket != NULL); mpz_clear(value); return ticket;
}

static void expect_serial(
  owned_subtypes_session *session, owned_subtypes_ticket_t ticket, unsigned expected
) {
  mpz_srcptr value = NULL; owned_subtypes_result *owner = NULL;
  OK(owned_subtypes_serial(session, ticket, &value, &owner));
  CHECK(mpz_cmp_ui(value, expected) == 0); release(&owner);
}

int main(void) {
  owned_subtypes_session *session = NULL; OK(owned_subtypes_session_open(&session));
  owned_subtypes_result *ticket_owner = NULL, *owner = NULL;
  owned_subtypes_ticket_t ticket = make_ticket(session, 41, &ticket_owner);
  mpz_t valid, invalid; mpz_init_set_si(valid, 7); mpz_init_set_si(invalid, -1);
  uint8_t bytes[] = {0, 255};
  owned_subtypes_payload_t payload = {valid, {bytes, 2}};
  owned_subtypes_payload_t bad_payload = {invalid, {bytes, 2}};
  owned_subtypes_bundle_spare_t spare = {false, NULL};
  owned_subtypes_ticket_t items[] = {ticket};
  owned_subtypes_bundle_peers_t peers = {items, 1};
  owned_subtypes_bundle_history_t history = {items, 1};
  owned_subtypes_bundle_t input = {ticket, &spare, &peers, &history, &payload};
  owned_subtypes_bundle_t bad = {ticket, &spare, &peers, &history, &bad_payload};
  owned_subtypes_bundle_t out = {0};

  for(size_t i = 0; i < 12; ++i) {
    OK(owned_subtypes_echo_record(session, &input, &out, &owner));
    CHECK(out.primary == ticket && mpz_cmp_si(out.payload->count, 7) == 0); release(&owner);
    OK(owned_subtypes_echo_record_alternate(session, &input, &out, &owner));
    CHECK(out.payload->bytes.length == 2 && out.payload->bytes.data[1] == 255); release(&owner);
  }

  memset(&out, 0xa5, sizeof(out)); unsigned char saved[sizeof(out)];
  memcpy(saved, &out, sizeof(out));
  CHECK(owned_subtypes_echo_record(session, &bad, &out, &owner) == OWNED_SUBTYPES_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0); expect_serial(session, ticket, 41);
  CHECK(owned_subtypes_echo_record_alternate(session, &bad, &out, &owner) == OWNED_SUBTYPES_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0); expect_serial(session, ticket, 41);

  owned_subtypes_bundle_t moving = {0}; owned_subtypes_result *move_owner = NULL;
  OK(owned_subtypes_bundle_t_copy(session, &bad, &moving, &move_owner));
  CHECK(move_owner != NULL);
  CHECK(owned_subtypes_transfer_record(session, &moving, &move_owner, &out, &owner) == OWNED_SUBTYPES_INVALID_ARGUMENT);
  CHECK(move_owner != NULL && owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(session, moving.primary, 41); release(&move_owner);

  OK(owned_subtypes_bundle_t_copy(session, &input, &moving, &move_owner));
  OK(owned_subtypes_transfer_record(session, &moving, &move_owner, &out, &owner));
  CHECK(move_owner == NULL && out.primary == ticket && mpz_cmp_si(out.payload->count, 7) == 0);
  expect_serial(session, out.primary, 41); release(&owner);

  release(&ticket_owner); mpz_clear(valid); mpz_clear(invalid);
  OK(owned_subtypes_session_close(&session)); CHECK(session == NULL);
  printf("owned-subtype-c:%zu\n", checks); return 0;
}
