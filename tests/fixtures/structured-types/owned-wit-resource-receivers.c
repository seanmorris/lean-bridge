/* Independent public C consumer, with no Lean or Wasmtime headers. */
#include "owned_aggregates.h"
#include <stdio.h>
#include <stdlib.h>

static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) { \
  fprintf(stderr, "WIT receiver check failed at line %d: %s\n", __LINE__, #value); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
#ifndef RECEIVER_INSTALLED
static size_t live;
void *owned_test_allocate(size_t bytes) { void *value = calloc(1, bytes); if (value) ++live; return value; }
void owned_test_free(void *value) { if (value) { CHECK(live > 0); --live; free(value); } }
extern size_t owned_test_identities(void);
extern size_t owned_test_component_calls(void);
extern size_t owned_test_native_imports(void);
extern size_t owned_test_lean_calls(void);
extern size_t owned_test_exports(void);
#endif
static void clear(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(!*owner);
}
static void serial(owned_aggregates_session *session, owned_aggregates_ticket_t ticket) {
  owned_aggregates_result *owner = NULL; mpz_srcptr number = NULL;
  OK(owned_aggregates_serial(session, ticket, &number, &owner));
  CHECK(mpz_cmp_ui(number, 42) == 0); clear(&owner);
}
#if RECEIVER_CALLBACKS
static unsigned callback_calls;
static owned_aggregates_status identity(void *context, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out,
    owned_aggregates_result **owner) {
  CHECK(context == &callback_calls && !*owner); ++callback_calls;
  serial(session, input->primary);
  CHECK(input->peers->length == 0 && input->history->length == 0);
  CHECK(mpz_cmp_ui(input->payload->count, 42) == 0);
  *out = *input; return OWNED_AGGREGATES_OK;
}
static void callables(owned_aggregates_session *session, owned_aggregates_ticket_t ticket) {
  mpz_t count; mpz_init_set_ui(count, 42);
  const uint8_t bytes[] = {0, 255};
  owned_aggregates_payload_t payload = {count, {bytes, 2}};
  owned_aggregates_bundle_spare_t spare = {false, NULL};
  owned_aggregates_bundle_peers_t peers = {NULL, 0};
  owned_aggregates_bundle_history_t history = {NULL, 0};
  owned_aggregates_bundle_t input = {ticket, &spare, &peers, &history, &payload};
  owned_aggregates_bundle_t record = {0}, reply = {0}, returned = {0}, moved = {0};
  owned_aggregates_result *root = NULL, *reply_owner = NULL, *closure_owner = NULL;
  owned_aggregates_result *returned_owner = NULL, *primary_owner = NULL, *moved_owner = NULL;
  owned_aggregates_ticket_t primary = NULL;
  OK(owned_aggregates_echo_record(session, &input, &record, &root));
  OK(owned_aggregates_primary(session, &record, &primary, &primary_owner));
  owned_aggregates_callback_record_argument1_t_host host = {.call = identity, .context = &callback_calls};
  OK(owned_aggregates_callback_record(session, &record, &host, &reply, &reply_owner));
  CHECK(callback_calls == 1);
  owned_aggregates_make_record_result_t closure = NULL;
  OK(owned_aggregates_make_record(session, &record, &closure, &closure_owner));
  clear(&root); serial(session, reply.primary); serial(session, primary);
  OK(owned_aggregates_make_record_result_t_call(session, closure, true, &input, &returned, &returned_owner));
  clear(&closure_owner); serial(session, returned.primary);
  OK(owned_aggregates_move_record(session, &returned, &returned_owner, &host, &moved, &moved_owner));
  CHECK(!returned_owner && callback_calls == 2); serial(session, moved.primary);
  clear(&moved_owner); clear(&primary_owner); clear(&reply_owner); mpz_clear(count);
}
#endif
int main(void) {
#ifndef RECEIVER_INSTALLED
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    owned_aggregates_session *cold = NULL;
    OK(owned_aggregates_session_open(&cold)); OK(owned_aggregates_session_close(&cold));
    CHECK(!cold && live == 0 && owned_test_identities() == 0);
    puts("{\"cold\":true}"); return 0;
  }
#endif
  owned_aggregates_session *session = NULL, *foreign = NULL;
  owned_aggregates_result *root = NULL, *kept_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t ticket = NULL, kept = NULL;
  mpz_t input; mpz_init_set_ui(input, 42);
  OK(owned_aggregates_session_open(&session));
  OK(owned_aggregates_session_open(&foreign));
  OK(owned_aggregates_new_ticket(session, input,
    (owned_aggregates_scalar_string_t){"receiver", 8}, &ticket, &root));
  OK(owned_aggregates_retain_ticket(session, ticket, &kept, &kept_owner));
  clear(&root); serial(session, kept);
  mpz_srcptr number = NULL;
  CHECK(owned_aggregates_serial(foreign, kept, &number, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!number && !owner);
#if RECEIVER_CALLBACKS
  callables(session, kept);
#else
  uint8_t unit = 99;
  OK(owned_aggregates_ping_ticket(session, kept, &unit, &owner)); CHECK(unit == 0); clear(&owner);
#endif
#if RECEIVER_CONSUMING
  owned_aggregates_ticket_t moved = NULL;
  owned_aggregates_result *stale_owner = kept_owner;
  OK(owned_aggregates_transfer_ticket(session, kept, &kept_owner, &moved, &owner));
  CHECK(!kept_owner); serial(session, moved);
  CHECK(owned_aggregates_result_release(&stale_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  /* C resource handles denote canonical identity, not a particular owner.
     Releasing the moved result removes its final independent lease. */
  clear(&owner);
  owned_aggregates_result *failed_owner = NULL;
  owned_aggregates_status status = owned_aggregates_serial(session, kept, &number, &failed_owner);
  CHECK(status == OWNED_AGGREGATES_INVALID_ARGUMENT || status == OWNED_AGGREGATES_CLOSED);
  CHECK(!number && !failed_owner);
#else
  clear(&kept_owner);
#endif
  OK(owned_aggregates_session_close(&foreign));
  OK(owned_aggregates_session_close(&session)); CHECK(!session && !foreign);
  mpz_clear(input);
#ifndef RECEIVER_INSTALLED
  CHECK(live == 0 && owned_test_identities() == 0);
  printf("{\"checks\":%zu,\"live\":%zu,\"identities\":%zu,\"componentCalls\":%zu,\"nativeImports\":%zu,\"leanCalls\":%zu,\"exports\":%zu}\n",
    checks, live, owned_test_identities(), owned_test_component_calls(),
    owned_test_native_imports(), owned_test_lean_calls(), owned_test_exports());
#else
  printf("owned-receivers-installed:%zu\n", checks);
#endif
  return 0;
}
