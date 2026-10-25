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

/* Keep compatibility with the original smaller API. Current native and WIT
   packaging tests require the expanded header explicitly. */
#ifdef OWNED_CHECKED_RECORDS_TRANSFER_WITH_CLAIM_CALLBACK_ARGUMENT1_T_REQUIRES_RECOVERY
typedef owned_checked_records_transfer_with_claim_callback_argument1_t_host claim_callback;
#else
typedef owned_checked_records_with_claim_callback_argument1_t_host claim_callback;
#endif

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

#ifdef OWNED_CHECKED_RECORDS_TRANSFER_WITH_CLAIM_CALLBACK_ARGUMENT1_T_REQUIRES_RECOVERY
typedef struct {
  size_t calls;
  owned_checked_records_ticket_t holder;
  mpz_srcptr quota;
} foreign_callback_state;

static owned_checked_records_status foreign_claim_reply(
  void *context, owned_checked_records_session *session,
  const owned_checked_records_claim_t *input,
  owned_checked_records_claim_t *out, owned_checked_records_result **owner
) {
  (void)session; (void)owner;
  foreign_callback_state *state = context;
  ++state->calls;
  CHECK(mpz_cmp_ui(input->quota, 7) == 0);
  out->holder = state->holder; out->quota = state->quota;
  return OWNED_CHECKED_RECORDS_OK;
}

/* The same installed caller exercises native C sessions and independent
   Wasmtime instances. Every foreign value comes from a real second session. */
static void check_session_boundaries(
  owned_checked_records_session *session,
  owned_checked_records_ticket_t ticket,
  owned_checked_records_ticket_t retained
) {
  owned_checked_records_session *peer = NULL;
  OK(owned_checked_records_session_open(&peer));
  CHECK(peer != session);
  owned_checked_records_result *peer_owner = NULL, *peer_kept_owner = NULL;
  owned_checked_records_ticket_t peer_ticket = make_ticket(peer, 73, &peer_owner);
  owned_checked_records_ticket_t peer_kept = NULL;
  OK(owned_checked_records_ticket_t_retain(peer, peer_ticket,
    &peer_kept, &peer_kept_owner));
  mpz_t lo, hi, quota;
  mpz_init_set_ui(lo, 3); mpz_init_set_ui(hi, 8); mpz_init_set_ui(quota, 7);
  owned_checked_records_window_t window = {lo, hi};
  owned_checked_records_booking_t booking = {ticket, &window};
  owned_checked_records_claim_t valid = {ticket, quota};
  owned_checked_records_claim_t foreign = {peer_ticket, quota};
  owned_checked_records_claim_t out;
  memset(&out, 0xa5, sizeof(out));
  unsigned char saved[sizeof(out)]; save_claim(&out, saved);
  owned_checked_records_result *owner = NULL;

  for(size_t iteration = 0; iteration < 10; ++iteration) {
    CHECK(owned_checked_records_echo_claim(session, &foreign, &out, &owner)
      == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
    CHECK(owned_checked_records_echo_claim(peer, &valid, &out, &owner)
      == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
    CHECK(owned_checked_records_pair_claim(session, &booking, &foreign,
      &out, &owner) == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);

    owned_checked_records_claim_t entries[] = {valid, foreign};
    owned_checked_records_echo_claims_argument0_t input = {entries, 2};
    owned_checked_records_echo_claims_result_t array_out;
    memset(&array_out, 0xa5, sizeof(array_out));
    unsigned char array_saved[sizeof(array_out)];
    memcpy(array_saved, &array_out, sizeof(array_out));
    CHECK(owned_checked_records_echo_claims(session, &input, &array_out, &owner)
      == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(owner == NULL && memcmp(array_saved, &array_out, sizeof(array_out)) == 0);
    CHECK(entries[0].holder == ticket && entries[1].holder == peer_ticket
      && entries[0].quota == quota && entries[1].quota == quota);

    owned_checked_records_booking_t moving_booking;
    owned_checked_records_claim_t moving_claim;
    owned_checked_records_result *first_owner = NULL, *second_owner = NULL;
    OK(owned_checked_records_booking_t_copy(session, &booking,
      &moving_booking, &first_owner));
    OK(owned_checked_records_claim_t_copy(peer, &foreign,
      &moving_claim, &second_owner));
    owned_checked_records_result *first_saved = first_owner, *second_saved = second_owner;
    CHECK(owned_checked_records_transfer_pair_claim(session, &moving_booking,
      &first_owner, &moving_claim, &second_owner, &out, &owner)
      == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(first_owner == first_saved && second_owner == second_saved);
    CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
    expect_serial(session, moving_booking.holder, 41);
    expect_serial(peer, moving_claim.holder, 73);
    release(&first_owner); release(&second_owner);
    CHECK(booking.holder == ticket && booking.window == &window
      && mpz_cmp_ui(lo, 3) == 0 && mpz_cmp_ui(hi, 8) == 0
      && mpz_cmp_ui(quota, 7) == 0);
    expect_serial(session, retained, 41); expect_serial(peer, peer_kept, 73);
  }

  foreign_callback_state state = {.calls = 0, .holder = peer_ticket, .quota = quota};
  claim_callback callback = {
    .call = foreign_claim_reply, .context = &state, .closure = NULL, .recovery = NULL
  };
  CHECK(owned_checked_records_with_claim_callback(session, &valid, &callback,
    &out, &owner) == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(state.calls == 1 && owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(session, ticket, 41); expect_serial(peer, peer_ticket, 73);

  owned_checked_records_claim_t moving;
  owned_checked_records_result *moving_owner = NULL;
  OK(owned_checked_records_claim_t_copy(session, &valid, &moving, &moving_owner));
  owned_checked_records_result *consumed_owner = moving_owner;
  CHECK(owned_checked_records_transfer_with_claim_callback(session, &moving,
    &moving_owner, &callback, &out, &owner) == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(state.calls == 2 && moving_owner == NULL && owner == NULL
    && memcmp(saved, &out, sizeof(out)) == 0);
  CHECK(owned_checked_records_result_release(&consumed_owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  expect_serial(session, retained, 41); expect_serial(peer, peer_kept, 73);

  owned_checked_records_claim_closure_result_t closure = NULL;
  owned_checked_records_result *closure_owner = NULL;
  OK(owned_checked_records_claim_closure(session, &closure, &closure_owner));
  CHECK(owned_checked_records_claim_closure_result_t_call(peer, closure,
    &foreign, &out, &owner) == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  CHECK(owned_checked_records_claim_closure_result_t_call(session, closure,
    &foreign, &out, &owner) == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  OK(owned_checked_records_claim_closure_result_t_call(session, closure,
    &valid, &out, &owner));
  CHECK(mpz_cmp_ui(out.quota, 7) == 0);
  expect_serial(session, out.holder, 41); release(&owner); release(&closure_owner);

  release(&peer_owner);
  /* Ordinary retained resources share an identity while any owning lease is
     live. This is not an anchored view: peer_kept still owns foreign.holder. */
  OK(owned_checked_records_echo_claim(peer, &foreign, &out, &owner));
  expect_serial(peer, out.holder, 73); release(&owner);
  /* Use a different resource with no retained lease to test actual expiry. */
  owned_checked_records_result *expired_owner = NULL;
  owned_checked_records_ticket_t expired_ticket = make_ticket(peer, 74, &expired_owner);
  owned_checked_records_claim_t expired = {expired_ticket, quota};
  release(&expired_owner);
  memset(&out, 0xa5, sizeof(out)); save_claim(&out, saved);
  CHECK(owned_checked_records_echo_claim(peer, &expired, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(peer, peer_kept, 73);
  owned_checked_records_claim_t peer_valid = {peer_kept, quota};
  owned_checked_records_session *closed_peer = peer;
  OK(owned_checked_records_session_close(&peer)); CHECK(peer == NULL);
  CHECK(owned_checked_records_echo_claim(closed_peer, &peer_valid, &out, &owner)
    == OWNED_CHECKED_RECORDS_CLOSED);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  release(&peer_kept_owner);
  CHECK(owned_checked_records_session_close(&closed_peer)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  expect_serial(session, retained, 41);

  OK(owned_checked_records_session_open(&peer));
  CHECK(peer != closed_peer);
  peer_ticket = make_ticket(peer, 89, &peer_owner);
  CHECK(owned_checked_records_echo_claim(peer, &foreign, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(peer, peer_ticket, 89);
  OK(owned_checked_records_echo_claim(session, &valid, &out, &owner));
  CHECK(mpz_cmp_ui(out.quota, 7) == 0); expect_serial(session, out.holder, 41);
  release(&owner); release(&peer_owner);
  OK(owned_checked_records_session_close(&peer)); CHECK(peer == NULL);
  mpz_clear(lo); mpz_clear(hi); mpz_clear(quota);
}
#endif

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
  owned_checked_records_window_t invalid_window = {hi, lo};
  owned_checked_records_booking_t invalid_booking = {ticket, &invalid_window};
  memset(&echoed_booking, 0xa5, sizeof(echoed_booking));
  unsigned char booking_saved[sizeof(echoed_booking)];
  memcpy(booking_saved, &echoed_booking, sizeof(echoed_booking));
  for(size_t i = 0; i < 10; ++i) {
    CHECK(owned_checked_records_echo_booking(session, &invalid_booking,
      &echoed_booking, &owner) == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(owner == NULL && memcmp(booking_saved, &echoed_booking, sizeof(echoed_booking)) == 0);
    CHECK(invalid_booking.holder == ticket && invalid_booking.window == &invalid_window
      && mpz_cmp_ui(invalid_window.lo, 8) == 0 && mpz_cmp_ui(invalid_window.hi, 3) == 0);
    expect_serial(session, ticket, 41);
  }
  owned_checked_records_window_t equal_window = {lo, lo};
  owned_checked_records_booking_t equal_booking = {ticket, &equal_window};
  OK(owned_checked_records_echo_booking(session, &equal_booking, &echoed_booking, &owner));
  CHECK(mpz_cmp_ui(echoed_booking.window->lo, 3) == 0
    && mpz_cmp_ui(echoed_booking.window->hi, 3) == 0);
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
  claim_callback callback = {
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

#ifdef OWNED_CHECKED_RECORDS_TRANSFER_WITH_CLAIM_CALLBACK_ARGUMENT1_T_REQUIRES_RECOVERY
  mpz_srcptr scalar = NULL;
  OK(owned_checked_records_booking_span(session, &booking, &scalar, &owner));
  CHECK(mpz_cmp_ui(scalar, 5) == 0); release(&owner);
  OK(owned_checked_records_claim_quota(session, &claim, &scalar, &owner));
  CHECK(mpz_cmp_ui(scalar, 7) == 0); release(&owner);

  mpz_t zero; mpz_init_set_ui(zero, 0);
  owned_checked_records_grant_t grant = {ticket, valid, hi}, grant_out;
  OK(owned_checked_records_echo_grant(session, &grant, &grant_out, &owner));
  CHECK(mpz_cmp_ui(grant_out.weight, 7) == 0
    && mpz_cmp_ui(grant_out.limit, 8) == 0);
  expect_serial(session, grant_out.holder, 41); release(&owner);
  memset(&grant_out, 0xa5, sizeof(grant_out));
  unsigned char grant_saved[sizeof(grant_out)];
  memcpy(grant_saved, &grant_out, sizeof(grant_out));
  const owned_checked_records_grant_t invalid_grants[] = {
    {ticket, zero, hi}, {ticket, valid, lo}
  };
  for(size_t i = 0; i < 2; ++i) {
    CHECK(owned_checked_records_echo_grant(session, &invalid_grants[i], &grant_out, &owner)
      == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(owner == NULL && memcmp(grant_saved, &grant_out, sizeof(grant_out)) == 0);
    expect_serial(session, ticket, 41);
  }

  owned_checked_records_claim_t entries[] = {claim, claim};
  owned_checked_records_echo_claims_argument0_t claims = {entries, 2};
  owned_checked_records_echo_claims_result_t claims_out;
  OK(owned_checked_records_echo_claims(session, &claims, &claims_out, &owner));
  CHECK(claims_out.length == 2 && mpz_cmp_ui(claims_out.data[1].quota, 7) == 0);
  expect_serial(session, claims_out.data[0].holder, 41); release(&owner);
  entries[1] = bad;
  memset(&claims_out, 0xa5, sizeof(claims_out));
  unsigned char claims_saved[sizeof(claims_out)];
  memcpy(claims_saved, &claims_out, sizeof(claims_out));
  for(size_t i = 0; i < 10; ++i) {
    CHECK(owned_checked_records_echo_claims(session, &claims, &claims_out, &owner)
      == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
    CHECK(owner == NULL && memcmp(claims_saved, &claims_out, sizeof(claims_out)) == 0);
    expect_serial(session, ticket, 41);
  }
  entries[1] = claim;
  OK(owned_checked_records_echo_claims(session, &claims, &claims_out, &owner));
  CHECK(claims_out.length == 2); release(&owner);
  claims.data = NULL; claims.length = 0;
  OK(owned_checked_records_echo_claims(session, &claims, &claims_out, &owner));
  CHECK(claims_out.length == 0); release(&owner);

  owned_checked_records_booking_t moving_booking;
  owned_checked_records_result *booking_owner = NULL;
  OK(owned_checked_records_booking_t_copy(session, &booking, &moving_booking, &booking_owner));
  OK(owned_checked_records_claim_t_copy(session, &bad, &moving, &move_owner));
  owned_checked_records_result *original_booking_owner = booking_owner;
  owned_checked_records_result *original_claim_owner = move_owner;
  memset(&out, 0xa5, sizeof(out)); save_claim(&out, saved);
  CHECK(owned_checked_records_transfer_pair_claim(session, &moving_booking,
    &booking_owner, &moving, &move_owner, &out, &owner)
    == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  CHECK(booking_owner == original_booking_owner && move_owner == original_claim_owner);
  CHECK(owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
  expect_serial(session, moving_booking.holder, 41);
  expect_serial(session, moving.holder, 41);
  release(&move_owner);
  OK(owned_checked_records_claim_t_copy(session, &claim, &moving, &move_owner));
  OK(owned_checked_records_transfer_pair_claim(session, &moving_booking,
    &booking_owner, &moving, &move_owner, &out, &owner));
  CHECK(booking_owner == NULL && move_owner == NULL && mpz_cmp_ui(out.quota, 7) == 0);
  release(&owner);

  /* Once Lean invokes the host, a failed reply must not restore the input
     owner. Output bytes remain untouched, and an independent retain survives. */
  for(int failure = 0; failure < 2; ++failure) {
    OK(owned_checked_records_claim_t_copy(session, &claim, &moving, &move_owner));
    state.fail = failure; mpz_set_ui(state.quota, 99);
    memset(&out, 0xa5, sizeof(out)); save_claim(&out, saved);
    CHECK(owned_checked_records_transfer_with_claim_callback(session, &moving,
      &move_owner, &callback, &out, &owner) == (failure
        ? OWNED_CHECKED_RECORDS_CALLBACK_FAILED : OWNED_CHECKED_RECORDS_INVALID_ARGUMENT));
    CHECK(move_owner == NULL && owner == NULL && memcmp(saved, &out, sizeof(out)) == 0);
    expect_serial(session, retained, 41);
  }
  state.fail = 0; mpz_set_ui(state.quota, 9);
  OK(owned_checked_records_claim_t_copy(session, &claim, &moving, &move_owner));
  OK(owned_checked_records_transfer_with_claim_callback(session, &moving,
    &move_owner, &callback, &out, &owner));
  CHECK(move_owner == NULL && mpz_cmp_ui(out.quota, 9) == 0);
  release(&owner); mpz_clear(zero);
  check_session_boundaries(session, ticket, retained);
#endif

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
