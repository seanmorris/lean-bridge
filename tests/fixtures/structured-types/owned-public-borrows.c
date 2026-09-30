/* Independent public consumer. No Lean headers, native tokens, or owner layout. */
#include "owned_aggregates.h"
#include "borrow-copies.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static size_t checks;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "borrow C check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
#ifndef LEAN_BRIDGE_BORROW_INSTALLED
static size_t live, attempts, fail_at, failures, before_failures, after_failures;
void *owned_test_allocate(size_t bytes) {
  if (++attempts == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live; return value;
}
void owned_test_free(void *value) { if (value) { CHECK(live > 0); --live; free(value); } }
extern size_t owned_test_identities(void);
static void clean(void) { CHECK(live == 0 && owned_test_identities() == 0); }
#else
static void clean(void) { }
#endif
static void clear(owned_aggregates_result **owner) { OK(owned_aggregates_result_release(owner)); CHECK(!*owner); }
static owned_aggregates_ticket_t ticket(owned_aggregates_session *session, unsigned value, owned_aggregates_result **owner) {
  mpz_t number; mpz_init_set_ui(number, value); owned_aggregates_ticket_t result = NULL;
  OK(owned_aggregates_new_ticket(session, number, (owned_aggregates_scalar_string_t){"borrow\0label", 12}, &result, owner));
  mpz_clear(number); return result;
}
static void serial(owned_aggregates_session *session, owned_aggregates_ticket_t value, unsigned expected) {
  owned_aggregates_result *owner = NULL; mpz_srcptr number = NULL;
  OK(owned_aggregates_serial(session, value, &number, &owner));
  CHECK(mpz_cmp_ui(number, expected) == 0); clear(&owner);
}
static void expired(owned_aggregates_session *session, owned_aggregates_ticket_t value) {
  owned_aggregates_result *owner = NULL; mpz_srcptr number = NULL;
  owned_aggregates_status status = owned_aggregates_serial(session, value, &number, &owner);
  CHECK(status == OWNED_AGGREGATES_CLOSED || status == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!number && !owner);
}
static void same(owned_aggregates_session *session, owned_aggregates_ticket_t left, owned_aggregates_ticket_t right) {
  bool equal = false; OK(owned_aggregates_ticket_t_equal(session, left, right, &equal)); CHECK(equal);
}
typedef struct {
  mpz_t number; uint8_t bytes[3]; owned_aggregates_ticket_t items[2];
  owned_aggregates_payload_t payload;
  owned_aggregates_bundle_spare_t spare;
  owned_aggregates_bundle_peers_t peers;
  owned_aggregates_bundle_history_t history;
  owned_aggregates_bundle_t value;
} bundle_input;
static void bundle_init(bundle_input *input, owned_aggregates_ticket_t value) {
  memset(input, 0, sizeof(*input)); mpz_init_set_si(input->number, -1234567);
  input->bytes[0] = 0; input->bytes[1] = 255; input->bytes[2] = 19;
  input->items[0] = value; input->items[1] = value;
  input->payload = (owned_aggregates_payload_t){input->number, {input->bytes, 3}};
  input->spare = (owned_aggregates_bundle_spare_t){true, value};
  input->peers = (owned_aggregates_bundle_peers_t){input->items, 2};
  input->history = (owned_aggregates_bundle_history_t){input->items, 1};
  input->value = (owned_aggregates_bundle_t){value, &input->spare, &input->peers, &input->history, &input->payload};
}
static void bundle_check(owned_aggregates_session *session, const owned_aggregates_bundle_t *value,
    owned_aggregates_ticket_t expected) {
  same(session, value->primary, expected);
  CHECK(value->spare->has_value && value->spare->value == value->primary);
  CHECK(value->peers->length == 2 && value->peers->data[1] == value->primary);
  CHECK(value->history->length == 1 && value->history->data[0] == value->primary);
  CHECK(mpz_cmp_si(value->payload->count, -1234567) == 0);
  CHECK(value->payload->bytes.length == 3 && value->payload->bytes.data[1] == 255);
  serial(session, value->primary, 42);
}

static void resources_and_owners(void) {
  owned_aggregates_session *session = NULL, *foreign = NULL;
  OK(owned_aggregates_session_open(&session)); OK(owned_aggregates_session_open(&foreign));
  owned_aggregates_result *root = NULL, *other = NULL, *view_owner = NULL, *nested_owner = NULL, *retained_owner = NULL;
  owned_aggregates_ticket_t value = ticket(session, 42, &root), another = ticket(session, 99, &other);
  owned_aggregates_ticket_t view = NULL, nested = NULL, retained = NULL;
  CHECK(owned_aggregates_retain_ticket(session, value, other, &view, &view_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!view && !view_owner);
  CHECK(owned_aggregates_retain_ticket(foreign, value, root, &view, &view_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owned_aggregates_retain_ticket(session, value, NULL, &view, &view_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  OK(owned_aggregates_retain_ticket(session, value, root, &view, &view_owner));
  OK(owned_aggregates_result_validate(session, view_owner)); same(session, value, view);
  bool equal = true; OK(owned_aggregates_ticket_t_equal(session, view, another, &equal)); CHECK(!equal);
  OK(owned_aggregates_retain_ticket(session, view, view_owner, &nested, &nested_owner));
  same(session, value, nested);
  OK(owned_aggregates_ticket_t_retain(session, nested, &retained, &retained_owner));
  clear(&view_owner);
  CHECK(owned_aggregates_result_validate(session, nested_owner) == OWNED_AGGREGATES_CLOSED);
  expired(session, nested); expired(session, view); serial(session, retained, 42); serial(session, value, 42);
  equal = false; CHECK(owned_aggregates_ticket_t_equal(session, nested, retained, &equal) == OWNED_AGGREGATES_CLOSED); CHECK(!equal);
  clear(&root); serial(session, retained, 42); clear(&nested_owner); clear(&retained_owner); clear(&other);
  OK(owned_aggregates_session_close(&foreign)); OK(owned_aggregates_session_close(&session)); clean();
}

typedef struct {
  owned_aggregates_session *session;
  owned_aggregates_result *owner;
  owned_aggregates_ticket_t value;
} foreign_call;
static void *wrong_thread(void *raw) {
  foreign_call *call = raw; owned_aggregates_result *output = NULL, *owner = call->owner;
  mpz_srcptr number = NULL;
  CHECK(owned_aggregates_serial(call->session, call->value, &number, &output) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!number && !output);
  CHECK(owned_aggregates_result_validate(call->session, call->owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owned_aggregates_result_release(&owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owner == call->owner); return NULL;
}
static void affinity_and_stale_handles(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *root = NULL, *owner = NULL;
  owned_aggregates_ticket_t value = ticket(session, 42, &root), view = NULL;
  OK(owned_aggregates_retain_ticket(session, value, root, &view, &owner));
  foreign_call call = {session, owner, view}; pthread_t thread;
  CHECK(pthread_create(&thread, NULL, wrong_thread, &call) == 0);
  CHECK(pthread_join(thread, NULL) == 0); serial(session, view, 42);
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) {
    CHECK(owned_aggregates_result_validate(session, owner) == OWNED_AGGREGATES_WRONG_PROCESS);
    CHECK(owned_aggregates_result_release(&owner) == OWNED_AGGREGATES_WRONG_PROCESS);
    CHECK(owner == call.owner); _exit(0);
  }
  int status = 0; CHECK(waitpid(child, &status, 0) == child);
  CHECK(WIFEXITED(status) && WEXITSTATUS(status) == 0);
  owned_aggregates_result *stale = owner; clear(&owner); clear(&root);
  for (unsigned i = 0; i < 64; ++i) {
    value = ticket(session, i, &root);
    CHECK(root != stale && value != view);
    CHECK(owned_aggregates_result_validate(session, stale) == OWNED_AGGREGATES_INVALID_ARGUMENT);
    expired(session, view); serial(session, value, i); clear(&root);
  }
  OK(owned_aggregates_session_close(&session)); clean();
}

#define SHAPE(Type, Copy, Call, Input, Verify) do { \
  Type original = {0}, view = {0}; owned_aggregates_result *source_owner = NULL, *view_owner = NULL; \
  OK(Copy(session, Input, &original, &source_owner)); \
  OK(Call(session, &original, source_owner, &view, &view_owner)); \
  OK(owned_aggregates_result_validate(session, view_owner)); Verify; \
  clear(&source_owner); CHECK(owned_aggregates_result_validate(session, view_owner) == OWNED_AGGREGATES_CLOSED); \
  clear(&view_owner); \
} while (0)
static void shapes(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *root = NULL; owned_aggregates_ticket_t value = ticket(session, 42, &root);
  bundle_input input; bundle_init(&input, value);
  SHAPE(owned_aggregates_bundle_t, owned_aggregates_bundle_t_copy, owned_aggregates_echo_record,
    &input.value, bundle_check(session, &view, value));
  SHAPE(owned_aggregates_bundle_t, owned_aggregates_bundle_t_copy, owned_aggregates_echo_alias,
    &input.value, bundle_check(session, &view, value));
  SHAPE(owned_aggregates_echo_array_result_t, COPY_ARRAY, owned_aggregates_echo_array,
    &input.peers, CHECK(view.length == 2); same(session, view.data[0], value));
  SHAPE(owned_aggregates_echo_list_result_t, COPY_LIST, owned_aggregates_echo_list,
    &input.history, CHECK(view.length == 1); same(session, view.data[0], value));
  SHAPE(owned_aggregates_echo_option_result_t, COPY_OPTION, owned_aggregates_echo_option,
    &input.spare, CHECK(view.has_value); same(session, view.value, value));
  owned_aggregates_echo_option_result_t none = {0};
  SHAPE(owned_aggregates_echo_option_result_t, COPY_OPTION, owned_aggregates_echo_option, &none, CHECK(!view.has_value));
  owned_aggregates_echo_result_argument0_t result = {.is_ok = true, .ok = &input.value};
  SHAPE(owned_aggregates_echo_result_result_t, COPY_RESULT, owned_aggregates_echo_result,
    &result, CHECK(view.is_ok); bundle_check(session, view.ok, value));
  result = (owned_aggregates_echo_result_argument0_t){.is_ok = false, .error = value};
  SHAPE(owned_aggregates_echo_result_result_t, COPY_RESULT, owned_aggregates_echo_result,
    &result, CHECK(!view.is_ok); same(session, view.error, value));
  owned_aggregates_echo_tuple_argument0_snd_t tail = {&input.spare, &input.payload};
  owned_aggregates_echo_tuple_argument0_t tuple = {value, &tail};
  SHAPE(owned_aggregates_echo_tuple_result_t, COPY_TUPLE, owned_aggregates_echo_tuple,
    &tuple, same(session, view.fst, value); CHECK(view.snd->fst->has_value));
  owned_aggregates_choice_t choices[] = {
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_EMPTY},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_ONE, .cases.one = {value}},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_PAIR, .cases.pair = {value, value}},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_MANY, .cases.many = {&input.peers}}
  };
  for (size_t i = 0; i < 4; ++i) {
    SHAPE(owned_aggregates_choice_t, owned_aggregates_choice_t_copy, owned_aggregates_echo_variant,
      &choices[i], CHECK(view.kind == choices[i].kind));
  }
  owned_aggregates_echo_row_argument0_t row = {&input.spare, 1};
  SHAPE(owned_aggregates_echo_row_result_t, COPY_ROW, owned_aggregates_echo_row,
    &row, CHECK(view.length == 1 && view.data[0].has_value); same(session, view.data[0].value, value));
  owned_aggregates_tree_t leaf = {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {value}};
  owned_aggregates_tree_branch_children_t children = {&leaf, 1};
  owned_aggregates_tree_t tree = {.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children}};
  SHAPE(owned_aggregates_tree_t, owned_aggregates_tree_t_copy, owned_aggregates_echo_recursive,
    &tree, CHECK(view.kind == tree.kind); same(session, view.cases.branch.children->data[0].cases.leaf.ticket, value));
  owned_aggregates_echo_nested_argument0_element_element_t nested_option = {true, &result};
  owned_aggregates_echo_nested_argument0_element_t nested_list = {&nested_option, 1};
  owned_aggregates_echo_nested_argument0_t nested = {&nested_list, 1};
  SHAPE(owned_aggregates_echo_nested_result_t, COPY_NESTED, owned_aggregates_echo_nested,
    &nested, CHECK(view.length == 1 && view.data[0].data[0].has_value));
  owned_aggregates_bundle_peers_t peers = {0}; owned_aggregates_bundle_t built = {0}, copied = {0};
  owned_aggregates_result *peers_owner = NULL, *built_owner = NULL, *copied_owner = NULL, *primary_owner = NULL;
  OK(COPY_ARRAY(session, &input.peers, &peers, &peers_owner));
  OK(owned_aggregates_bundle(session, value, &input.spare, &peers, peers_owner, &input.history, &input.payload, &built, &built_owner));
  bundle_check(session, &built, value);
  owned_aggregates_ticket_t primary = NULL;
  OK(owned_aggregates_primary(session, &built, built_owner, &primary, &primary_owner)); same(session, primary, value);
  OK(owned_aggregates_bundle_t_copy(session, &built, &copied, &copied_owner));
  clear(&peers_owner); expired(session, primary); expired(session, built.primary); bundle_check(session, &copied, value);
  clear(&primary_owner); clear(&built_owner); clear(&copied_owner);
  mpz_clear(input.number); clear(&root); OK(owned_aggregates_session_close(&session)); clean();
}

typedef struct { owned_aggregates_result **anchor; unsigned mode, calls; owned_aggregates_ticket_t escaped; } callback_state;
static owned_aggregates_status callback(void *raw, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  callback_state *state = raw; ++state->calls; CHECK(!*owner);
  state->escaped = input->primary; serial(session, input->primary, 42);
  if (state->mode == 1) clear(state->anchor);
  if (state->mode == 2) return OWNED_AGGREGATES_CALLBACK_FAILED;
  if (state->mode == 3) OK(owned_aggregates_session_close(&session));
  *out = *input; return OWNED_AGGREGATES_OK;
}
static owned_aggregates_status tree_callback(void *raw, owned_aggregates_session *session,
    const owned_aggregates_tree_t *input, owned_aggregates_tree_t *out, owned_aggregates_result **owner) {
  (void)raw; CHECK(!*owner); serial(session, input->cases.leaf.ticket, 42); *out = *input; return OWNED_AGGREGATES_OK;
}
static void callbacks_and_closures(void) {
  for (unsigned mode = 0; mode < 4; ++mode) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    owned_aggregates_result *root = NULL, *anchor = NULL, *owner = NULL;
    owned_aggregates_ticket_t value = ticket(session, 42, &root);
    bundle_input input; bundle_init(&input, value);
    owned_aggregates_bundle_t argument = {0}, out, unchanged;
    OK(owned_aggregates_bundle_t_copy(session, &input.value, &argument, &anchor));
    memset(&out, 0xa5, sizeof(out)); unchanged = out;
    callback_state state = {&anchor, mode, 0, NULL};
    owned_aggregates_callback_record_argument1_t_host host = {.call = callback, .context = &state};
    owned_aggregates_status status = owned_aggregates_callback_record(session, &argument, anchor, &host, &out, &owner);
    CHECK(state.calls == 1);
    if (!mode) { OK(status); bundle_check(session, &out, value); clear(&owner); }
    else { CHECK(status != OWNED_AGGREGATES_OK && !owner); CHECK(!memcmp(&out, &unchanged, sizeof(out))); }
    if (mode != 3) expired(session, state.escaped);
    clear(&anchor); clear(&root); mpz_clear(input.number);
    if (mode == 3) session = NULL;
    else OK(owned_aggregates_session_close(&session));
    clean();
  }
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *root = NULL, *anchor = NULL, *closure_owner = NULL, *result_owner = NULL, *kept_owner = NULL;
  owned_aggregates_ticket_t value = ticket(session, 42, &root); bundle_input input; bundle_init(&input, value);
  owned_aggregates_bundle_t argument = {0}, out = {0};
  OK(owned_aggregates_bundle_t_copy(session, &input.value, &argument, &anchor));
  owned_aggregates_make_record_result_t closure = NULL, kept = NULL;
  OK(owned_aggregates_make_record(session, &argument, anchor, &closure, &closure_owner));
  OK(owned_aggregates_make_record_result_t_call(session, closure, true, &argument, &out, &result_owner));
  bundle_check(session, &out, value); clear(&result_owner);
  OK(owned_aggregates_make_record_result_t_retain(session, closure, &kept, &kept_owner));
  clear(&anchor);
  CHECK(owned_aggregates_make_record_result_t_call(session, closure, true, &input.value, &out, &result_owner) == OWNED_AGGREGATES_CLOSED);
  CHECK(!result_owner);
  OK(owned_aggregates_make_record_result_t_call(session, kept, true, &input.value, &out, &result_owner));
  bundle_check(session, &out, value); clear(&result_owner); clear(&closure_owner); clear(&kept_owner);
  owned_aggregates_tree_t leaf = {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {value}}, tree = {0}, returned = {0};
  OK(owned_aggregates_tree_t_copy(session, &leaf, &tree, &anchor));
  owned_aggregates_callback_recursive_argument1_t_host host = {.call = tree_callback};
  OK(owned_aggregates_callback_recursive(session, &tree, anchor, &host, &returned, &result_owner));
  serial(session, returned.cases.leaf.ticket, 42); clear(&result_owner);
  owned_aggregates_make_recursive_result_t tree_closure = NULL;
  OK(owned_aggregates_make_recursive(session, &tree, anchor, &tree_closure, &closure_owner));
  OK(owned_aggregates_make_recursive_result_t_call(session, tree_closure, true, &tree, &returned, &result_owner));
  serial(session, returned.cases.leaf.ticket, 42); clear(&result_owner);
  clear(&anchor); clear(&closure_owner); clear(&root); mpz_clear(input.number);
  OK(owned_aggregates_session_close(&session)); clean();
}

static void mixed_transfers(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *root = NULL, *other = NULL, *view_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t value = ticket(session, 42, &root), consumed = ticket(session, 99, &other), view = NULL, out = NULL;
  OK(owned_aggregates_retain_ticket(session, value, root, &view, &view_owner));
  owned_aggregates_result *saved = root;
  CHECK(owned_aggregates_mixed_ticket(session, value, root, value, &root, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(root == saved && !out && !owner);
  CHECK(owned_aggregates_mixed_ticket(session, view, view_owner, value, &root, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(root == saved && !out && !owner);
  saved = view_owner;
  CHECK(owned_aggregates_transfer_ticket(session, view, &view_owner, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(view_owner == saved && !out && !owner);
  OK(owned_aggregates_mixed_ticket(session, value, root, consumed, &other, &out, &owner));
  CHECK(!other); serial(session, out, 99);
  owned_aggregates_result *replacement_owner = NULL; owned_aggregates_ticket_t replacement = NULL;
  OK(owned_aggregates_transfer_ticket(session, value, &root, &replacement, &replacement_owner));
  CHECK(!root); serial(session, replacement, 42); expired(session, out); expired(session, view);
  clear(&owner); clear(&view_owner); clear(&replacement_owner);
  OK(owned_aggregates_session_close(&session)); clean();
}

#ifndef LEAN_BRIDGE_BORROW_INSTALLED
static void allocation_failures(void) {
  int complete = 0;
  for (size_t offset = 1; offset < 200 && !complete; ++offset) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    owned_aggregates_result *root = NULL, *owner = NULL;
    owned_aggregates_ticket_t value = ticket(session, 42, &root), out = value;
    size_t baseline = live; fail_at = attempts + offset;
    owned_aggregates_status status = owned_aggregates_retain_ticket(session, value, root, &out, &owner);
    fail_at = 0;
    if (!status) { complete = 1; same(session, out, value); clear(&owner); }
    else { ++failures; CHECK(status == OWNED_AGGREGATES_ALLOCATION_FAILED && out == value && !owner); CHECK(live == baseline); }
    serial(session, value, 42); clear(&root); OK(owned_aggregates_session_close(&session)); clean();
  }
  CHECK(complete && failures > 0); complete = 0;
  for (size_t offset = 1; offset < 200 && !complete; ++offset) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    owned_aggregates_result *root = NULL, *consumed_owner = NULL, *owner = NULL;
    owned_aggregates_ticket_t value = ticket(session, 42, &root), consumed = ticket(session, 99, &consumed_owner), out = value;
    fail_at = attempts + offset;
    owned_aggregates_status status = owned_aggregates_mixed_ticket(session, value, root, consumed, &consumed_owner, &out, &owner);
    fail_at = 0;
    if (!status) { complete = 1; CHECK(!consumed_owner); serial(session, out, 99); clear(&owner); }
    else {
      CHECK(status == OWNED_AGGREGATES_ALLOCATION_FAILED && out == value && !owner);
      if (consumed_owner) { ++before_failures; serial(session, consumed, 99); }
      else ++after_failures;
    }
    serial(session, value, 42); clear(&consumed_owner); clear(&root);
    OK(owned_aggregates_session_close(&session)); clean();
  }
  CHECK(complete && before_failures > 0 && after_failures > 0);
}
#endif

int main(void) {
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    OK(owned_aggregates_session_close(&session)); clean(); puts("{\"cold\":true}"); return 0;
  }
  resources_and_owners(); affinity_and_stale_handles(); shapes();
  callbacks_and_closures(); mixed_transfers();
#ifndef LEAN_BRIDGE_BORROW_INSTALLED
  allocation_failures();
  printf("{\"checks\":%zu,\"live\":%zu,\"identities\":%zu,\"failures\":%zu,\"beforeFailures\":%zu,\"afterFailures\":%zu}\n",
    checks, live, owned_test_identities(), failures, before_failures, after_failures);
#else
  printf("owned-borrows-installed:%zu\n", checks);
#endif
  return 0;
}
