#include "owned_aggregates.h"
#include <stdio.h>
#include <stdlib.h>
extern size_t receiver_identity_count(void);
static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) abort(); } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
int main(void) {
  owned_aggregates_session *session = NULL;
  owned_aggregates_result *root = NULL, *kept_owner = NULL, *number_owner = NULL;
  owned_aggregates_ticket_t ticket = NULL, kept = NULL;
  mpz_t input; mpz_init_set_ui(input, 42); mpz_srcptr number = NULL;
  OK(owned_aggregates_session_open(&session));
  OK(owned_aggregates_new_ticket(session, input,
    (owned_aggregates_scalar_string_t){"plain", 5}, &ticket, &root));
  OK(owned_aggregates_retain_ticket(session, ticket, &kept, &kept_owner));
  OK(owned_aggregates_result_release(&root)); CHECK(root == NULL);
  OK(owned_aggregates_serial(session, kept, &number, &number_owner));
  CHECK(mpz_cmp_ui(number, 42) == 0);
  OK(owned_aggregates_result_release(&kept_owner));
  CHECK(mpz_cmp_ui(number, 42) == 0);
  OK(owned_aggregates_session_close(&session)); CHECK(session == NULL);
  CHECK(mpz_cmp_ui(number, 42) == 0);
  OK(owned_aggregates_result_release(&number_owner)); mpz_clear(input);
  CHECK(receiver_identity_count() == 0);
  printf("{\"checks\":%zu,\"identities\":%zu}\n", checks, receiver_identity_count());
  return 0;
}
