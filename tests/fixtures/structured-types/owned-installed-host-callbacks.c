/* Installed consumer: public header only, no producer or test-only runtime API. */
#include "owned_aggregates.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

_Static_assert(OWNED_AGGREGATES_FACTORY_ARGUMENT0_T_REQUIRES_RECOVERY == 1, "factory needs a real resource");
_Static_assert(OWNED_AGGREGATES_CALLBACK_RECORD_ARGUMENT1_T_REQUIRES_RECOVERY == 0, "argument supplies recovery");
_Static_assert(OWNED_AGGREGATES_CONSTRUCT_ARGUMENT1_T_REQUIRES_RECOVERY == 0, "record can be constructed");
static size_t checks;
#define CHECK(test) do { ++checks; if (!(test)) { \
  fprintf(stderr, "installed callback check failed at %s:%d: %s\n", __FILE__, __LINE__, #test); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)

static void release(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(*owner == NULL);
}
static owned_aggregates_ticket_t make_ticket(owned_aggregates_session *session, unsigned serial,
    owned_aggregates_result **owner) {
  mpz_t number; mpz_init_set_ui(number, serial);
  owned_aggregates_ticket_t ticket = NULL;
  OK(owned_aggregates_new_ticket(session, number, (owned_aggregates_scalar_string_t){"A\0B", 3}, &ticket, owner));
  mpz_clear(number); return ticket;
}
static void serial_is(owned_aggregates_session *session, owned_aggregates_ticket_t ticket, unsigned expected) {
  mpz_srcptr number = NULL; owned_aggregates_result *owner = NULL;
  OK(owned_aggregates_serial(session, ticket, &number, &owner));
  CHECK(mpz_cmp_ui(number, expected) == 0); release(&owner);
}
enum { BORROW, REENTER, COPY_LOCAL, FAIL_WITH_OWNER, INVALID_REPLY, NEW_RESOURCE, RELEASE_INPUT, CLOSE_SESSION };
typedef struct {
  unsigned mode, calls;
  owned_aggregates_ticket_t alternate, created;
  owned_aggregates_result **input_owner;
  owned_aggregates_session **session;
} callback_state;

static owned_aggregates_status record(void *context, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  callback_state *state = context; ++state->calls;
  if (state->mode == REENTER || state->mode == FAIL_WITH_OWNER) {
    owned_aggregates_status status = owned_aggregates_echo_record(session, input, out, owner);
    return status ? status : state->mode == FAIL_WITH_OWNER ? OWNED_AGGREGATES_INVALID_ARGUMENT : OWNED_AGGREGATES_OK;
  }
  if (state->mode == COPY_LOCAL) {
    owned_aggregates_bundle_t local = *input; local.primary = state->alternate;
    return owned_aggregates_bundle_t_copy(session, &local, out, owner);
  }
  if (state->mode == NEW_RESOURCE) {
    mpz_t number; mpz_init_set_ui(number, 1000);
    owned_aggregates_result *created_owner = NULL;
    owned_aggregates_status status = owned_aggregates_new_ticket(session, number,
      (owned_aggregates_scalar_string_t){"new", 3}, &state->created, &created_owner);
    mpz_clear(number);
    if (!status) {
      owned_aggregates_bundle_t local = *input; local.primary = state->created;
      status = owned_aggregates_bundle_t_copy(session, &local, out, owner);
    }
    owned_aggregates_status cleanup = owned_aggregates_result_release(&created_owner);
    return status ? status : cleanup;
  }
  *out = *input;
  if (state->mode == INVALID_REPLY) out->primary = NULL;
  if (state->mode == RELEASE_INPUT) return owned_aggregates_result_release(state->input_owner);
  if (state->mode == CLOSE_SESSION) return owned_aggregates_session_close(state->session);
  return OWNED_AGGREGATES_OK;
}
static owned_aggregates_status tree(void *context, owned_aggregates_session *session,
    const owned_aggregates_tree_t *input, owned_aggregates_tree_t *out, owned_aggregates_result **owner) {
  (void)session; (void)owner;
  callback_state *state = context; ++state->calls; *out = *input;
  return state->mode ? OWNED_AGGREGATES_INVALID_ARGUMENT : OWNED_AGGREGATES_OK;
}
static owned_aggregates_status factory(void *context, owned_aggregates_session *session,
    uint8_t unit, owned_aggregates_ticket_t *out, owned_aggregates_result **owner) {
  callback_state *state = context; ++state->calls; CHECK(unit == 0);
  if (state->mode) return OWNED_AGGREGATES_INVALID_ARGUMENT;
  mpz_t number; mpz_init_set_ui(number, 700);
  owned_aggregates_status status = owned_aggregates_new_ticket(session, number,
    (owned_aggregates_scalar_string_t){"factory", 7}, out, owner);
  mpz_clear(number); return status;
}
static owned_aggregates_status construct(void *context, owned_aggregates_session *session,
    owned_aggregates_ticket_t input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  (void)session; (void)input; (void)out; (void)owner;
  callback_state *state = context; ++state->calls;
  return OWNED_AGGREGATES_INVALID_ARGUMENT;
}

int main(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *first_owner = NULL, *second_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t first = make_ticket(session, 42, &first_owner);
  owned_aggregates_ticket_t second = make_ticket(session, 99, &second_owner);
  CHECK(first != second); serial_is(session, first, 42); serial_is(session, second, 99);
  mpz_t count; mpz_init(count);
  CHECK(mpz_set_str(count, "-123456789012345678901234567890123456789012345678901234567890", 10) == 0);
  uint8_t bytes[] = {0, 255, 41, 0, 128};
  owned_aggregates_payload_t payload = {count, {bytes, sizeof(bytes)}};
  owned_aggregates_bundle_spare_t spare = {true, second};
  owned_aggregates_ticket_t peers[] = {first, second}, history[] = {second, first};
  owned_aggregates_bundle_peers_t peer_span = {peers, 2};
  owned_aggregates_bundle_history_t history_span = {history, 2};
  owned_aggregates_bundle_t input = {first, &spare, &peer_span, &history_span, &payload}, out = {0};
  callback_state state = {.alternate = second};
  owned_aggregates_callback_record_argument1_t_host callback = {.call = record, .context = &state};
  for (unsigned iteration = 0; iteration < 20; ++iteration) {
    for (unsigned mode = BORROW; mode <= COPY_LOCAL; ++mode) {
      state.mode = mode; state.calls = 0;
      OK(owned_aggregates_twice(session, &input, &callback, &out, &owner));
      CHECK(state.calls == 2 && owner != NULL);
      CHECK(out.primary == (mode == COPY_LOCAL ? second : first));
      CHECK(out.spare->has_value && out.spare->value == second);
      CHECK(out.peers->length == 2 && out.peers->data[0] == first && out.peers->data[1] == second);
      CHECK(out.history->length == 2 && out.history->data[0] == second && out.history->data[1] == first);
      CHECK(out.payload->count != count && mpz_cmp(out.payload->count, count) == 0);
      CHECK(out.payload->bytes.length == sizeof(bytes) && !memcmp(out.payload->bytes.data, bytes, sizeof(bytes)));
      release(&owner);
    }
  }
  unsigned char saved[sizeof(out)]; memset(&out, 0xa5, sizeof(out)); memcpy(saved, &out, sizeof(out));
  for (unsigned mode = FAIL_WITH_OWNER; mode <= INVALID_REPLY; ++mode) {
    state.mode = mode; state.calls = 0;
    CHECK(owned_aggregates_twice(session, &input, &callback, &out, &owner) ==
      (mode == FAIL_WITH_OWNER ? OWNED_AGGREGATES_CALLBACK_FAILED : OWNED_AGGREGATES_INVALID_ARGUMENT));
    CHECK(state.calls == 1 && owner == NULL && !memcmp(saved, &out, sizeof(out)));
  }
  state.mode = BORROW;
  OK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner)); release(&owner);
  owned_aggregates_callback_record_argument1_t closure = NULL;
  owned_aggregates_result *closure_owner = NULL;
  OK(owned_aggregates_identity_closure(session, 0, &closure, &closure_owner));
  owned_aggregates_callback_record_argument1_t_host existing = {.closure = closure};
  OK(owned_aggregates_callback_record(session, &input, &existing, &out, &owner));
  CHECK(out.primary == first); release(&owner);
  existing.call = record;
  CHECK(owned_aggregates_callback_record(session, &input, &existing, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owner == NULL); release(&closure_owner);
  OK(owned_aggregates_retain_callback(session, &callback, &closure, &closure_owner));
  state.calls = 0;
  CHECK(owned_aggregates_callback_record_argument1_t_call(session, closure, &input, &out, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(state.calls == 0 && owner == NULL); release(&closure_owner);
  owned_aggregates_tree_t leaves[] = {
    {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {first}},
    {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {second}}
  };
  owned_aggregates_tree_branch_children_t children = {leaves, 2};
  owned_aggregates_tree_t branch = {.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children}}, tree_out = {0};
  owned_aggregates_callback_recursive_argument1_t_host recursive = {.call = tree, .context = &state};
  OK(owned_aggregates_callback_recursive(session, &branch, &recursive, &tree_out, &owner));
  CHECK(tree_out.cases.branch.children->length == 2);
  CHECK(tree_out.cases.branch.children->data[0].cases.leaf.ticket == first);
  CHECK(tree_out.cases.branch.children->data[1].cases.leaf.ticket == second); release(&owner);
  state.mode = FAIL_WITH_OWNER;
  CHECK(owned_aggregates_callback_recursive(session, &branch, &recursive, &tree_out, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(owner == NULL);
  owned_aggregates_factory_argument0_t_host maker = {.call = factory, .context = &state};
  owned_aggregates_ticket_t made = NULL; state.calls = 0;
  CHECK(owned_aggregates_factory(session, &maker, &made, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(state.calls == 0 && made == NULL && owner == NULL);
  maker.recovery = &first; state.mode = BORROW;
  OK(owned_aggregates_factory(session, &maker, &made, &owner));
  CHECK(made != first && made != second); serial_is(session, made, 700); release(&owner);
  state.mode = FAIL_WITH_OWNER; made = first;
  CHECK(owned_aggregates_factory(session, &maker, &made, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(made == first && owner == NULL);
  owned_aggregates_construct_argument1_t_host constructor = {.call = construct, .context = &state};
  CHECK(owned_aggregates_construct(session, first, &constructor, &out, &owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(owner == NULL);
  state.mode = NEW_RESOURCE;
  OK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner));
  CHECK(out.primary == state.created && out.primary != first && out.primary != second);
  serial_is(session, out.primary, 1000); release(&owner);
  state.mode = BORROW; state.calls = 0; mpz_t repetitions; mpz_init_set_ui(repetitions, 10000);
  CHECK(owned_aggregates_repeatedly(session, &input, &callback, repetitions, &out, &owner) == OWNED_AGGREGATES_LIMIT);
  CHECK(state.calls > 1 && state.calls < 10000 && owner == NULL); mpz_clear(repetitions);
  OK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner)); release(&owner);
  owned_aggregates_result *temporary_owner = NULL;
  owned_aggregates_ticket_t temporary = make_ticket(session, 2000, &temporary_owner);
  owned_aggregates_bundle_t transient = input; transient.primary = temporary;
  state.mode = RELEASE_INPUT; state.input_owner = &temporary_owner;
  OK(owned_aggregates_callback_record(session, &transient, &callback, &out, &owner));
  CHECK(temporary_owner == NULL && out.primary == temporary); serial_is(session, out.primary, 2000); release(&owner);
  mpz_srcptr absent = NULL;
  CHECK(owned_aggregates_serial(session, temporary, &absent, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(absent == NULL && owner == NULL);
  owned_aggregates_bundle_t retained = {0}; owned_aggregates_result *retained_owner = NULL;
  OK(owned_aggregates_echo_record(session, &input, &retained, &retained_owner));
  state.mode = CLOSE_SESSION; state.session = &session;
  CHECK(owned_aggregates_callback_record(session, &input, &callback, &out, &owner) == OWNED_AGGREGATES_CLOSED);
  CHECK(session == NULL && owner == NULL);
  CHECK(mpz_cmp(retained.payload->count, count) == 0);
  CHECK(retained.payload->bytes.length == sizeof(bytes) && !memcmp(retained.payload->bytes.data, bytes, sizeof(bytes)));
  release(&retained_owner); release(&first_owner); release(&second_owner); mpz_clear(count);
  printf("owned-installed-callbacks:%zu\n", checks);
  return 0;
}
