/* Installed public C API only. No native handles, test hooks, or Lean compiler. */
#include "owned_aggregates.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "installed callback result check failed at %d: %s\n", __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
static void clear(owned_aggregates_result **owner) { OK(owned_aggregates_result_release(owner)); CHECK(!*owner); }
static owned_aggregates_ticket_t ticket(owned_aggregates_session *session, unsigned value, owned_aggregates_result **owner) {
  mpz_t number; mpz_init_set_ui(number, value); owned_aggregates_ticket_t result = NULL;
  OK(owned_aggregates_new_ticket(session, number, (owned_aggregates_scalar_string_t){"callback", 8}, &result, owner));
  mpz_clear(number); return result;
}
static void serial(owned_aggregates_session *session, owned_aggregates_ticket_t value, unsigned expected) {
  mpz_srcptr number = NULL; owned_aggregates_result *owner = NULL;
  OK(owned_aggregates_serial(session, value, &number, &owner));
  CHECK(mpz_cmp_ui(number, expected) == 0); clear(&owner);
}
static void expired(owned_aggregates_session *session, owned_aggregates_ticket_t value) {
  mpz_srcptr number = NULL; owned_aggregates_result *owner = NULL;
  owned_aggregates_status status = owned_aggregates_serial(session, value, &number, &owner);
  CHECK(status == OWNED_AGGREGATES_CLOSED || status == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!number && !owner);
}
typedef struct { unsigned mode, calls; owned_aggregates_ticket_t escaped; } callback_state;
static owned_aggregates_status borrow_record(void *context, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  callback_state *state = context; ++state->calls;
  owned_aggregates_ticket_t previous = state->escaped; state->escaped = input->primary;
  if (state->mode == 1) return owned_aggregates_echo_record(session, input, out, owner);
  *out = *input;
  if (state->mode == 2) return OWNED_AGGREGATES_INVALID_ARGUMENT;
  if (state->mode == 3) out->primary = previous;
  return OWNED_AGGREGATES_OK;
}
static owned_aggregates_status borrow_tree(void *context, owned_aggregates_session *session,
    const owned_aggregates_tree_t *input, owned_aggregates_tree_t *out, owned_aggregates_result **owner) {
  (void)session; (void)owner; callback_state *state = context; ++state->calls;
  state->escaped = input->cases.branch.children->data[0].cases.leaf.ticket;
  *out = *input; return OWNED_AGGREGATES_OK;
}

int main(void) {
  owned_aggregates_session *session = NULL, *foreign = NULL;
  OK(owned_aggregates_session_open(&session)); OK(owned_aggregates_session_open(&foreign));
  owned_aggregates_result *first_owner = NULL, *second_owner = NULL;
  owned_aggregates_ticket_t first = ticket(session, 42, &first_owner), second = ticket(session, 99, &second_owner);
  mpz_t number; mpz_init_set_si(number, -123); uint8_t bytes[] = {0, 255, 42};
  owned_aggregates_payload_t payload = {number, {bytes, 3}};
  owned_aggregates_bundle_spare_t spare = {0};
  owned_aggregates_bundle_peers_t peers = {0};
  owned_aggregates_bundle_history_t history = {0};
  owned_aggregates_bundle_t input = {first, &spare, &peers, &history, &payload}, captured = {0}, supplied = {0};
  owned_aggregates_result *captured_owner = NULL, *supplied_owner = NULL, *closure_owner = NULL, *leased_owner = NULL;
  OK(owned_aggregates_echo_record(session, &input, &captured, &captured_owner));
  input.primary = second; OK(owned_aggregates_echo_record(session, &input, &supplied, &supplied_owner));
  owned_aggregates_make_record_result_t closure = NULL;
  owned_aggregates_make_leased_record_result_t leased = NULL;
  OK(owned_aggregates_make_record(session, &captured, &closure, &closure_owner));
  OK(owned_aggregates_make_leased_record(session, &captured, &leased, &leased_owner));
  owned_aggregates_bundle_t view = {0}, nested = {0}, copied = {0}, independent = {0};
  owned_aggregates_result *owner = NULL, *nested_owner = NULL, *copy_owner = NULL, *independent_owner = NULL;
  CHECK(owned_aggregates_make_record_result_t_call(session, closure, false, &supplied, NULL, &view, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!owner && !view.primary);
  CHECK(owned_aggregates_make_record_result_t_call(session, closure, false, &supplied, captured_owner, &view, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!owner && !view.primary);
  CHECK(owned_aggregates_make_record_result_t_call(foreign, closure, false, &supplied, supplied_owner, &view, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!owner && !view.primary);
  /* Captured data still expires with the selected argument, not its capture. */
  OK(owned_aggregates_make_record_result_t_call(session, closure, true, &supplied, supplied_owner, &view, &owner));
  OK(owned_aggregates_result_validate(session, owner)); serial(session, view.primary, 42);
  CHECK(mpz_cmp_si(view.payload->count, -123) == 0 && view.payload->bytes.data[1] == 255);
  OK(owned_aggregates_make_record_result_t_call(session, closure, false, &view, owner, &nested, &nested_owner));
  OK(owned_aggregates_echo_record(session, &nested, &copied, &copy_owner));
  OK(owned_aggregates_make_leased_record_result_t_call(session, leased, false, &supplied, &independent, &independent_owner));
  clear(&captured_owner); clear(&closure_owner); clear(&leased_owner); serial(session, nested.primary, 42);
  clear(&supplied_owner);
  CHECK(owned_aggregates_result_validate(session, owner) == OWNED_AGGREGATES_CLOSED);
  CHECK(owned_aggregates_result_validate(session, nested_owner) == OWNED_AGGREGATES_CLOSED);
  expired(session, view.primary); expired(session, nested.primary);
  serial(session, copied.primary, 42); serial(session, independent.primary, 99);
  serial(session, first, 42); serial(session, second, 99);
  clear(&owner); clear(&nested_owner); clear(&copy_owner); clear(&independent_owner);
  /* Empty recursive values have owners even though they contain no resources. */
  owned_aggregates_tree_branch_children_t children = {0};
  owned_aggregates_tree_t empty = {.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children}};
  owned_aggregates_tree_t tree = {0}, tree_view = {0}, tree_nested = {0};
  owned_aggregates_make_recursive_result_t tree_closure = NULL;
  OK(owned_aggregates_echo_recursive(session, &empty, &tree, &supplied_owner));
  OK(owned_aggregates_make_recursive(session, &tree, &tree_closure, &closure_owner));
  OK(owned_aggregates_make_recursive_result_t_call(session, tree_closure, false, &tree, supplied_owner, &tree_view, &owner));
  CHECK(tree_view.cases.branch.children->length == 0);
  OK(owned_aggregates_make_recursive_result_t_call(session, tree_closure, false, &tree_view, owner, &tree_nested, &nested_owner));
  clear(&owner); CHECK(owned_aggregates_result_validate(session, nested_owner) == OWNED_AGGREGATES_CLOSED);
  clear(&nested_owner); clear(&closure_owner); clear(&supplied_owner);
  input.primary = first; OK(owned_aggregates_echo_record(session, &input, &supplied, &supplied_owner));
  callback_state state = {0};
  owned_aggregates_callback_record_argument1_t_host callback = {.call = borrow_record, .context = &state};
  for (unsigned mode = 0; mode < 4; ++mode) {
    state.mode = mode;
    unsigned char saved[sizeof(view)]; memset(&view, 0xa5, sizeof(view)); memcpy(saved, &view, sizeof(view));
    owned_aggregates_status status = owned_aggregates_callback_record(session, &supplied, &callback, &view, &owner);
    if (mode < 2) { CHECK(status == OWNED_AGGREGATES_OK); serial(session, view.primary, 42); clear(&owner); }
    else { CHECK(status == (mode == 2 ? OWNED_AGGREGATES_CALLBACK_FAILED : OWNED_AGGREGATES_INVALID_ARGUMENT)); CHECK(!owner && !memcmp(saved, &view, sizeof(view))); }
    expired(session, state.escaped);
  }
  CHECK(state.calls == 4);
  state.mode = 0; OK(owned_aggregates_callback_record(session, &supplied, &callback, &view, &owner));
  serial(session, view.primary, 42); clear(&owner);
  owned_aggregates_tree_t leaf = {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {first}};
  owned_aggregates_tree_branch_children_t nonempty = {&leaf, 1};
  owned_aggregates_tree_t branch = {.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&nonempty}};
  callback_state tree_state = {0};
  owned_aggregates_callback_recursive_argument1_t_host recursive = {.call = borrow_tree, .context = &tree_state};
  OK(owned_aggregates_callback_recursive(session, &branch, &recursive, &tree_view, &owner));
  CHECK(tree_state.calls == 1); serial(session, tree_view.cases.branch.children->data[0].cases.leaf.ticket, 42);
  expired(session, tree_state.escaped); clear(&owner);
  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);
  mpz_clear(number); OK(owned_aggregates_session_close(&foreign)); OK(owned_aggregates_session_close(&session));
  CHECK(!session && !foreign);
  printf("callback-results-installed:%zu\n", checks);
  return 0;
}
