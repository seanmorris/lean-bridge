/* Installed C consumer for owned proof-erased checked records. */
#include "owned_checked_records.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) { \
  fprintf(stderr, "owned checked-record C check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_CHECKED_RECORDS_OK)

static void release(owned_checked_records_result **owner) {
  OK(owned_checked_records_result_release(owner)); CHECK(*owner == NULL);
}

static owned_checked_records_ticket_t make_ticket(
  owned_checked_records_session *session, unsigned serial,
  owned_checked_records_result **owner
) {
  mpz_t value; mpz_init_set_ui(value, serial);
  owned_checked_records_ticket_t ticket = NULL;
  OK(owned_checked_records_new_ticket(
    session, value, (owned_checked_records_scalar_string_t){"native", 6},
    &ticket, owner
  ));
  CHECK(ticket != NULL); mpz_clear(value); return ticket;
}

static void expect_serial(
  owned_checked_records_session *session,
  owned_checked_records_ticket_t ticket, unsigned expected
) {
  mpz_srcptr value = NULL; owned_checked_records_result *owner = NULL;
  OK(owned_checked_records_serial(session, ticket, &value, &owner));
  CHECK(mpz_cmp_ui(value, expected) == 0); release(&owner);
}

typedef struct { size_t calls; mpz_t quota; int fail; } callback_state;
static owned_checked_records_status callback_claim(
  void *context, owned_checked_records_session *session,
  const owned_checked_records_claim_t *input,
  owned_checked_records_claim_t *out, owned_checked_records_result **owner
) {
  (void)session; (void)owner; callback_state *state = context;
  if(state->fail) return OWNED_CHECKED_RECORDS_CALLBACK_FAILED;
  ++state->calls;
  if(mpz_cmp_ui(input->quota, 7) != 0)
    return OWNED_CHECKED_RECORDS_INVALID_ARGUMENT;
  out->holder = input->holder; out->quota = state->quota;
  return OWNED_CHECKED_RECORDS_OK;
}

static void save_claim(
  const owned_checked_records_claim_t *value,
  unsigned char saved[sizeof(owned_checked_records_claim_t)]
) { memcpy(saved, value, sizeof(*value)); }

int main(void) {
  owned_checked_records_session *session = NULL;
  OK(owned_checked_records_session_open(&session));
  owned_checked_records_result *ticket_owner = NULL, *retained_owner = NULL;
  owned_checked_records_ticket_t ticket = make_ticket(session, 41, &ticket_owner);
  owned_checked_records_ticket_t retained = NULL;
  OK(owned_checked_records_ticket_t_retain(session, ticket, &retained, &retained_owner));
  expect_serial(session, retained, 41);

  mpz_t lo, hi, valid, invalid;
  mpz_init_set_ui(lo, 3); mpz_init_set_ui(hi, 8);
  mpz_init_set_ui(valid, 7); mpz_init_set_ui(invalid, 99);
  owned_checked_records_window_t window = {lo, hi};
  owned_checked_records_booking_t booking = {ticket, &window};
  owned_checked_records_claim_t claim = {ticket, valid};
  owned_checked_records_claim_t bad = {ticket, invalid};
  owned_checked_records_booking_t echoed_booking = {0};
  owned_checked_records_claim_t out = {0};
  owned_checked_records_result *owner = NULL;

  OK(owned_checked_records_echo_booking(
    session, &booking, &echoed_booking, &owner));
  CHECK(mpz_cmp_ui(echoed_booking.window->hi, 8) == 0);
  expect_serial(session, echoed_booking.holder, 41); release(&owner);
  OK(owned_checked_records_echo_claim(session, &claim, &out, &owner));
  CHECK(mpz_cmp_ui(out.quota, 7) == 0); expect_serial(session, out.holder, 41);
  release(&owner);
  for(size_t i = 0; i < 20; ++i) {
    OK(owned_checked_records_echo_claim(session, &claim, &out, &owner));
    CHECK(mpz_cmp_ui(out.quota, 7) == 0);
    expect_serial(session, out.holder, 41); release(&owner);
  }

  memset(&out, 0xa5, sizeof(out)); unsigned char saved[sizeof(out)];
  save_claim(&out, saved);
  CHECK(owned_checked_records_echo_claim(session, &bad, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(session, ticket, 41);
  CHECK(owned_checked_records_pair_claim(
    session, &booking, &bad, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(session, ticket, 41);

  owned_checked_records_claim_t moving = {0};
  owned_checked_records_result *move_owner = NULL;
  OK(owned_checked_records_claim_t_copy(session, &bad, &moving, &move_owner));
  CHECK(owned_checked_records_transfer_claim(
    session, &moving, &move_owner, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(move_owner != NULL && owner == NULL
    && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(session, moving.holder, 41); release(&move_owner);
  OK(owned_checked_records_claim_t_copy(session, &claim, &moving, &move_owner));
  OK(owned_checked_records_transfer_claim(
    session, &moving, &move_owner, &out, &owner));
  CHECK(move_owner == NULL && mpz_cmp_ui(out.quota, 7) == 0);
  expect_serial(session, out.holder, 41); release(&owner);

  callback_state state = {.calls = 0, .fail = 0};
  mpz_init_set_ui(state.quota, 10);
  owned_checked_records_with_claim_callback_argument1_t_host callback = {
    .call = callback_claim, .context = &state, .closure = NULL, .recovery = NULL
  };
  OK(owned_checked_records_with_claim_callback(
    session, &claim, &callback, &out, &owner));
  CHECK(state.calls == 1 && mpz_cmp_ui(out.quota, 10) == 0);
  release(&owner); expect_serial(session, ticket, 41);
  mpz_set_ui(state.quota, 99); memset(&out, 0xa5, sizeof(out)); save_claim(&out, saved);
  CHECK(owned_checked_records_with_claim_callback(
    session, &claim, &callback, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(state.calls == 2 && owner == NULL
    && memcmp(saved, &out, sizeof(out)) == 0);
  state.fail = 1;
  CHECK(owned_checked_records_with_claim_callback(
    session, &claim, &callback, &out, &owner)
    == OWNED_CHECKED_RECORDS_CALLBACK_FAILED);
  CHECK(state.calls == 2 && owner == NULL
    && memcmp(saved, &out, sizeof(out)) == 0);
  state.fail = 0; mpz_set_ui(state.quota, 9);
  OK(owned_checked_records_with_claim_callback(
    session, &claim, &callback, &out, &owner));
  CHECK(state.calls == 3 && mpz_cmp_ui(out.quota, 9) == 0); release(&owner);

  owned_checked_records_claim_closure_result_t closure = NULL;
  owned_checked_records_result *closure_owner = NULL;
  OK(owned_checked_records_claim_closure(session, &closure, &closure_owner));
  OK(owned_checked_records_claim_closure_result_t_call(
    session, closure, &claim, &out, &owner));
  CHECK(mpz_cmp_ui(out.quota, 7) == 0); release(&owner);
  memset(&out, 0xa5, sizeof(out)); save_claim(&out, saved);
  CHECK(owned_checked_records_claim_closure_result_t_call(
    session, closure, &bad, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  OK(owned_checked_records_claim_closure_result_t_call(
    session, closure, &claim, &out, &owner));
  CHECK(mpz_cmp_ui(out.quota, 7) == 0); release(&owner);

  owned_checked_records_claim_for_result_t produced = {0};
  OK(owned_checked_records_claim_for(session, retained, &produced, &owner));
  CHECK(produced.has_value && mpz_cmp_ui(produced.value->quota, 0) == 0);
  expect_serial(session, produced.value->holder, 41); release(&owner);

  release(&closure_owner); release(&ticket_owner);
  expect_serial(session, retained, 41); release(&retained_owner);
  mpz_clear(state.quota);
  mpz_clear(lo); mpz_clear(hi); mpz_clear(valid); mpz_clear(invalid);
  OK(owned_checked_records_session_close(&session)); CHECK(session == NULL);
  printf("owned-checked-record-c:%zu\n", checks); return 0;
}
