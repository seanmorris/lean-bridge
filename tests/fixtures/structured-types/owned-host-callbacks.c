/* Independent caller: only the public header defines values and callbacks. */
#include "owned_aggregates.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
_Static_assert(OWNED_AGGREGATES_FACTORY_ARGUMENT0_T_REQUIRES_RECOVERY == 1, "resource factories need real recovery");
_Static_assert(OWNED_AGGREGATES_CALLBACK_RECORD_ARGUMENT1_T_REQUIRES_RECOVERY == 0, "record arguments are real recovery");

static size_t checks, live, allocations, fail_at, failures;
void *owned_test_allocate(size_t bytes) {
  if (++allocations == fail_at) return NULL;
  void *value = malloc(bytes); if (value) ++live; return value;
}
void owned_test_free(void *value) { if (value) { --live; free(value); } }
extern size_t owned_test_identities(void);
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "host callback check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
static void clear(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(*owner == NULL);
}
typedef struct {
  unsigned calls, mode;
  owned_aggregates_ticket_t alternate;
  owned_aggregates_session **close;
  owned_aggregates_result **release;
  owned_aggregates_ticket_t created;
} state;
static owned_aggregates_status record(void *context, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *value, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  state *current = context; ++current->calls;
  if (current->mode == 1 || current->mode == 3) {
    owned_aggregates_status status = owned_aggregates_echo_record(session, value, out, owner);
    return status ? status : current->mode == 3 ? OWNED_AGGREGATES_INVALID_ARGUMENT : OWNED_AGGREGATES_OK;
  }
  if (current->mode == 2) {
    owned_aggregates_bundle_t changed = *value; changed.primary = current->alternate;
    return owned_aggregates_bundle_t_copy(session, &changed, out, owner);
  }
  if (current->mode == 4) { *out = *value; out->primary = NULL; return OWNED_AGGREGATES_OK; }
  if (current->mode == 5) {
    owned_aggregates_status status = owned_aggregates_session_close(current->close);
    *out = *value; return status;
  }
  if (current->mode == 6) {
    mpz_t serial; mpz_init_set_ui(serial, 1000);
    owned_aggregates_result *ticket_owner = NULL;
    owned_aggregates_status status = owned_aggregates_new_ticket(session, serial,
      (owned_aggregates_scalar_string_t){"callback", 8}, &current->created, &ticket_owner);
    mpz_clear(serial);
    if (!status) {
      owned_aggregates_bundle_t changed = *value; changed.primary = current->created;
      status = owned_aggregates_bundle_t_copy(session, &changed, out, owner);
    }
    owned_aggregates_status cleanup = owned_aggregates_result_release(&ticket_owner);
    return status ? status : cleanup;
  }
  if (current->mode == 7) {
    owned_aggregates_status status = owned_aggregates_result_release(current->release);
    *out = *value; return status;
  }
  *out = *value; return OWNED_AGGREGATES_OK;
}
static owned_aggregates_status tree(void *context, owned_aggregates_session *session,
    const owned_aggregates_tree_t *value, owned_aggregates_tree_t *out, owned_aggregates_result **owner) {
  (void)session; (void)owner; state *current = context; ++current->calls;
  *out = *value; return current->mode ? OWNED_AGGREGATES_INVALID_ARGUMENT : OWNED_AGGREGATES_OK;
}
static owned_aggregates_status factory(void *context, owned_aggregates_session *session,
    uint8_t unit, owned_aggregates_ticket_t *out, owned_aggregates_result **owner) {
  (void)session; (void)owner; CHECK(unit == 0); state *current = context; ++current->calls;
  *out = current->alternate; return current->mode ? OWNED_AGGREGATES_INVALID_ARGUMENT : OWNED_AGGREGATES_OK;
}
static owned_aggregates_status construct(void *context, owned_aggregates_session *session,
    owned_aggregates_ticket_t ticket, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  (void)session; (void)ticket; (void)out; (void)owner; state *current = context; ++current->calls;
  return OWNED_AGGREGATES_INVALID_ARGUMENT;
}
static owned_aggregates_ticket_t ticket(owned_aggregates_session *session, unsigned serial, owned_aggregates_result **owner) {
  mpz_t number; mpz_init_set_ui(number, serial); owned_aggregates_ticket_t value = NULL;
  OK(owned_aggregates_new_ticket(session, number, (owned_aggregates_scalar_string_t){"ticket", 6}, &value, owner));
  mpz_clear(number); return value;
}
int main(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    OK(owned_aggregates_session_close(&session)); puts("{\"cold\":true}"); return 0;
  }
  owned_aggregates_result *first_owner = NULL, *second_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t first = ticket(session, 42, &first_owner), second = ticket(session, 99, &second_owner);
  mpz_t count; mpz_init_set_si(count, -123); uint8_t bytes[] = {0, 255, 41};
  owned_aggregates_payload_t payload = {count, {bytes, 3}};
  owned_aggregates_bundle_spare_t spare = {true, second};
  owned_aggregates_ticket_t peers[] = {first, second}, history[] = {second, first};
  owned_aggregates_bundle_peers_t peer_span = {peers, 2};
  owned_aggregates_bundle_history_t history_span = {history, 2};
  owned_aggregates_bundle_t input = {first, &spare, &peer_span, &history_span, &payload}, out = {0};
  state current = {.alternate = second};
  owned_aggregates_callback_record_argument1_t_host callback = {.call = record, .context = &current};
  size_t baseline = live, identities = owned_test_identities();
  for (unsigned mode = 0; mode < 3; ++mode) {
    current.mode = mode; current.calls = 0;
    OK(owned_aggregates_twice(session, &input, &callback, &out, &owner)); CHECK(current.calls == 2);
    CHECK(out.primary == (mode == 2 ? second : first)); CHECK(out.spare->value == second);
    CHECK(out.peers->length == 2 && out.peers->data[1] == second);
    CHECK(out.history->length == 2 && out.history->data[0] == second);
    CHECK(mpz_cmp(out.payload->count, count) == 0 && out.payload->count != count);
    CHECK(out.payload->bytes.length == 3 && !memcmp(out.payload->bytes.data, bytes, 3));
    clear(&owner); CHECK(live == baseline); CHECK(owned_test_identities() == identities);
  }
  unsigned char saved[sizeof(out)]; memset(&out, 0xa5, sizeof(out)); memcpy(saved, &out, sizeof(out));
  for (unsigned mode = 3; mode <= 4; ++mode) {
    current.mode = mode; current.calls = 0;
    CHECK(owned_aggregates_twice(session, &input, &callback, &out, &owner) ==
      (mode == 3 ? OWNED_AGGREGATES_CALLBACK_FAILED : OWNED_AGGREGATES_INVALID_ARGUMENT));
    CHECK(current.calls == 1); CHECK(!owner && !memcmp(saved, &out, sizeof(out)));
    CHECK(live == baseline); CHECK(owned_test_identities() == identities);
  }
  current.mode = 0;
  OK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner)); clear(&owner);
  owned_aggregates_callback_record_argument1_t existing = NULL;
  owned_aggregates_result *existing_owner = NULL;
  OK(owned_aggregates_identity_closure(session, 0, &existing, &existing_owner));
  owned_aggregates_callback_record_argument1_t_host supplied = {.closure = existing};
  OK(owned_aggregates_callback_record(session, &input, &supplied, &out, &owner));
  CHECK(out.primary == first); clear(&owner);
  supplied.call = record;
  CHECK(owned_aggregates_callback_record(session, &input, &supplied, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  supplied.call = NULL; supplied.context = &current;
  CHECK(owned_aggregates_callback_record(session, &input, &supplied, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  clear(&existing_owner); CHECK(live == baseline);
  /* The returned Lean closure retains a typed recovery, never the host context. */
  owned_aggregates_callback_record_argument1_t escaped = NULL;
  owned_aggregates_result *escaped_owner = NULL;
  OK(owned_aggregates_retain_callback(session, &callback, &escaped, &escaped_owner));
  current.calls = 0;
  CHECK(owned_aggregates_callback_record_argument1_t_call(session, escaped, &input, &out, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(current.calls == 0 && !owner); clear(&escaped_owner); CHECK(live == baseline);
  OK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner)); clear(&owner);
  owned_aggregates_tree_t leaves[] = {
    {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {first}},
    {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {second}}
  };
  owned_aggregates_tree_branch_children_t children = {leaves, 2};
  owned_aggregates_tree_t branch = {.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children}}, tree_out = {0};
  owned_aggregates_callback_recursive_argument1_t_host recursive = {.call = tree, .context = &current};
  OK(owned_aggregates_callback_recursive(session, &branch, &recursive, &tree_out, &owner));
  CHECK(tree_out.cases.branch.children->data[1].cases.leaf.ticket == second); clear(&owner);
  current.mode = 1;
  CHECK(owned_aggregates_callback_recursive(session, &branch, &recursive, &tree_out, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(!owner && live == baseline);
  owned_aggregates_factory_argument0_t_host maker = {.call = factory, .context = &current};
  owned_aggregates_ticket_t made = NULL; current.calls = 0;
  CHECK(owned_aggregates_factory(session, &maker, &made, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(current.calls == 0 && !owner && !made); maker.recovery = &first; current.mode = 0;
  OK(owned_aggregates_factory(session, &maker, &made, &owner)); CHECK(made == second); clear(&owner);
  current.mode = 1; made = first;
  CHECK(owned_aggregates_factory(session, &maker, &made, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(made == first && !owner && live == baseline);
  owned_aggregates_construct_argument1_t_host constructor = {.call = construct, .context = &current};
  CHECK(owned_aggregates_construct(session, first, &constructor, &out, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(!owner && live == baseline);
  current.mode = 6;
  OK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner));
  CHECK(out.primary == current.created && out.primary != first && out.primary != second);
  mpz_srcptr created_serial = NULL; owned_aggregates_result *serial_owner = NULL;
  OK(owned_aggregates_serial(session, out.primary, &created_serial, &serial_owner));
  CHECK(mpz_cmp_ui(created_serial, 1000) == 0); clear(&serial_owner); clear(&owner);
  CHECK(live == baseline && owned_test_identities() == identities);
  current.mode = 0; current.calls = 0; mpz_t repetitions; mpz_init_set_ui(repetitions, 10000);
  CHECK(owned_aggregates_repeatedly(session, &input, &callback, repetitions, &out, &owner) == OWNED_AGGREGATES_LIMIT);
  CHECK(current.calls > 1 && current.calls < 10000 && !owner);
  CHECK(live == baseline && owned_test_identities() == identities); mpz_clear(repetitions);
  /* Fail each bridge allocation. A failed call leaves no partial owner or pins. */
  const unsigned modes[] = {0, 1, 2, 6};
  for (size_t mode = 0; mode < sizeof(modes) / sizeof(modes[0]); ++mode) {
    current.mode = modes[mode]; int finished = 0;
    for (size_t at = 1; at < 1000; ++at) {
      allocations = 0; fail_at = at; memset(&out, 0xa5, sizeof(out)); memcpy(saved, &out, sizeof(out));
      owned_aggregates_status status = owned_aggregates_twice(session, &input, &callback, &out, &owner);
      fail_at = 0;
      if (!status) { clear(&owner); CHECK(at > allocations); finished = 1; break; }
      ++failures; CHECK(status == OWNED_AGGREGATES_ALLOCATION_FAILED || status == OWNED_AGGREGATES_CALLBACK_FAILED);
      CHECK(!owner && !memcmp(saved, &out, sizeof(out))); CHECK(live == baseline); CHECK(owned_test_identities() == identities);
      OK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner)); clear(&owner);
    }
    CHECK(finished); CHECK(live == baseline && owned_test_identities() == identities);
  }
  CHECK(failures > 10);
  owned_aggregates_result *temporary_owner = NULL;
  owned_aggregates_ticket_t temporary = ticket(session, 2000, &temporary_owner);
  owned_aggregates_bundle_t transient = input; transient.primary = temporary;
  current.mode = 7; current.release = &temporary_owner;
  OK(owned_aggregates_callback_record(session, &transient, &callback, &out, &owner));
  CHECK(!temporary_owner && out.primary == temporary);
  OK(owned_aggregates_serial(session, temporary, &created_serial, &serial_owner));
  CHECK(mpz_cmp_ui(created_serial, 2000) == 0); clear(&serial_owner); clear(&owner);
  CHECK(owned_aggregates_serial(session, temporary, &created_serial, &serial_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(live == baseline && owned_test_identities() == identities);
  current.mode = 5; current.close = &session;
  CHECK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner) == OWNED_AGGREGATES_CLOSED);
  CHECK(session == NULL && !owner); clear(&first_owner); clear(&second_owner); mpz_clear(count);
  CHECK(live == 0); CHECK(owned_test_identities() == 0);
  printf("{\"checks\":%zu,\"failures\":%zu,\"live\":%zu,\"identities\":%zu}\n", checks, failures, live, owned_test_identities());
  return 0;
}
