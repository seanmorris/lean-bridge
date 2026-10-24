/* Installed C result-only consumer for owned proof-erased checked records. */
#include "owned_checked_records.h"
#include <stdio.h>
#include <stdlib.h>

static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) abort(); } while (0)
#define OK(call) CHECK((call) == OWNED_CHECKED_RECORDS_OK)
static void release(owned_checked_records_result **owner) {
  OK(owned_checked_records_result_release(owner)); CHECK(*owner == NULL);
}
int main(void) {
  owned_checked_records_session *session = NULL; OK(owned_checked_records_session_open(&session));
  mpz_t serial; mpz_init_set_ui(serial, 20);
  owned_checked_records_ticket_t ticket = NULL; owned_checked_records_result *ticket_owner = NULL;
  OK(owned_checked_records_new_ticket(session, serial
    , (owned_checked_records_scalar_string_t){"result", 6}, &ticket, &ticket_owner));
  owned_checked_records_claim_for_result_t produced = {0};
  owned_checked_records_result *owner = NULL;
  OK(owned_checked_records_claim_for(session, ticket, &produced, &owner));
  CHECK(produced.has_value && mpz_cmp_ui(produced.value->quota, 0) == 0);
  mpz_srcptr observed = NULL; owned_checked_records_result *serial_owner = NULL;
  OK(owned_checked_records_serial(session, produced.value->holder, &observed, &serial_owner));
  CHECK(mpz_cmp_ui(observed, 20) == 0); release(&serial_owner);
  release(&owner); release(&ticket_owner); mpz_clear(serial);
  OK(owned_checked_records_session_close(&session)); CHECK(session == NULL);
  printf("owned-checked-record-result-only-c:%zu\n", checks); return 0;
}
