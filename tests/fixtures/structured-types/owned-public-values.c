/* Independently authored consumer. No Lean header, private layout, token or tag. */
#include "owned_aggregates.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static size_t checks, live, attempts, fail_at, failures;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "public C check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
void *owned_test_allocate(size_t bytes) {
  if (++attempts == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live; return value;
}
void owned_test_free(void *value) { if (value) { CHECK(live > 0); --live; free(value); } }
extern size_t owned_test_identities(void);
extern void owned_test_retire(void);

static void clear(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(*owner == NULL);
}
static owned_aggregates_ticket_t new_ticket(owned_aggregates_session *session, owned_aggregates_result **owner) {
  mpz_t number; mpz_init_set_ui(number, 42);
  owned_aggregates_ticket_t value = NULL;
  OK(owned_aggregates_new_ticket(session, number, (owned_aggregates_scalar_string_t){"ticket\0label", 12}, &value, owner));
  CHECK(value != NULL); mpz_clear(number); return value;
}
static void check_ticket(owned_aggregates_session *session, owned_aggregates_ticket_t value) {
  owned_aggregates_result *owner = NULL; mpz_srcptr number = NULL;
  OK(owned_aggregates_serial(session, value, &number, &owner)); CHECK(mpz_cmp_ui(number, 42) == 0); clear(&owner);
}
typedef struct {
  mpz_t number; uint8_t bytes[3]; owned_aggregates_ticket_t items[2];
  owned_aggregates_payload_t payload;
  owned_aggregates_bundle_spare_t spare;
  owned_aggregates_bundle_peers_t peers;
  owned_aggregates_bundle_history_t history;
  owned_aggregates_bundle_t bundle;
} bundle_input;
static void initialize_bundle(bundle_input *input, owned_aggregates_ticket_t value) {
  memset(input, 0, sizeof(*input));
  mpz_init(input->number); CHECK(mpz_set_str(input->number, "-129127208515966861331", 10) == 0);
  input->bytes[0] = 0; input->bytes[1] = 255; input->bytes[2] = 19;
  input->items[0] = value; input->items[1] = value;
  input->payload = (owned_aggregates_payload_t){ input->number, { input->bytes, 3 } };
  input->spare = (owned_aggregates_bundle_spare_t){ true, value };
  input->peers = (owned_aggregates_bundle_peers_t){ input->items, 2 };
  input->history = (owned_aggregates_bundle_history_t){ input->items, 1 };
  input->bundle = (owned_aggregates_bundle_t){ value, &input->spare, &input->peers, &input->history, &input->payload };
}
static void check_bundle(owned_aggregates_session *session, const owned_aggregates_bundle_t *value, owned_aggregates_ticket_t expected) {
  CHECK(value->primary == expected); CHECK(value->spare->has_value && value->spare->value == expected);
  CHECK(value->peers->length == 2 && value->peers->data[0] == expected && value->peers->data[1] == expected);
  CHECK(value->history->length == 1 && value->history->data[0] == expected);
  mpz_t number; mpz_init(number); CHECK(mpz_set_str(number, "-129127208515966861331", 10) == 0);
  CHECK(mpz_cmp(value->payload->count, number) == 0); mpz_clear(number);
  CHECK(value->payload->bytes.length == 3 && value->payload->bytes.data[0] == 0 && value->payload->bytes.data[1] == 255);
  check_ticket(session, value->primary);
}
static void test_shapes(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t value = new_ticket(session, &ticket_owner), retained = NULL;
  OK(owned_aggregates_ticket_t_retain(session, value, &retained, &owner)); CHECK(retained == value); clear(&owner);
  OK(owned_aggregates_retain_ticket(session, value, &retained, &owner)); CHECK(retained == value); clear(&owner);
  owned_aggregates_scalar_string_t label = {0};
  OK(owned_aggregates_label(session, value, &label, &owner));
  CHECK(label.length == 12 && !memcmp(label.data, "ticket\0label", 12)); clear(&owner);
  bundle_input input; initialize_bundle(&input, value);
  owned_aggregates_bundle_t out = {0};
  OK(owned_aggregates_bundle(session, value, &input.spare, &input.peers, &input.history, &input.payload, &out, &owner));
  check_bundle(session, &out, value); clear(&owner);
  OK(owned_aggregates_echo_record(session, &input.bundle, &out, &owner));
  check_bundle(session, &out, value); CHECK(out.payload->count != input.number && out.payload->bytes.data != input.bytes);
  owned_aggregates_result *copy_owner = NULL; owned_aggregates_payload_t copy = {0};
  OK(owned_aggregates_payload(session, &out, &copy, &copy_owner));
  clear(&owner); CHECK(copy.bytes.data[1] == 255 && mpz_cmp(copy.count, input.number) == 0); clear(&copy_owner);
  OK(owned_aggregates_echo_alias(session, &input.bundle, &out, &owner)); check_bundle(session, &out, value); clear(&owner);
  owned_aggregates_echo_array_result_t array = {0};
  OK(owned_aggregates_echo_array(session, &input.peers, &array, &owner));
  CHECK(array.length == 2 && array.data[0] == value && array.data[1] == value); clear(&owner);
  owned_aggregates_echo_list_result_t list = {0};
  OK(owned_aggregates_echo_list(session, &input.history, &list, &owner)); CHECK(list.length == 1 && list.data[0] == value); clear(&owner);
  owned_aggregates_echo_option_result_t option = {0}, none = {false, value};
  OK(owned_aggregates_echo_option(session, &input.spare, &option, &owner)); CHECK(option.has_value && option.value == value); clear(&owner);
  OK(owned_aggregates_echo_option(session, &none, &option, &owner)); CHECK(!option.has_value && !option.value); clear(&owner);
  owned_aggregates_echo_result_argument0_t result = { .is_ok = true, .ok = &input.bundle }, returned = {0};
  OK(owned_aggregates_echo_result(session, &result, &returned, &owner)); CHECK(returned.is_ok); check_bundle(session, returned.ok, value); clear(&owner);
  result = (owned_aggregates_echo_result_argument0_t){ .is_ok = false, .error = value };
  OK(owned_aggregates_echo_result(session, &result, &returned, &owner)); CHECK(!returned.is_ok && returned.error == value && !returned.ok); clear(&owner);
  owned_aggregates_echo_tuple_argument0_snd_t tail = { &input.spare, &input.payload };
  owned_aggregates_echo_tuple_argument0_t tuple = { value, &tail }, tuple_out = {0};
  OK(owned_aggregates_echo_tuple(session, &tuple, &tuple_out, &owner));
  CHECK(tuple_out.fst == value && tuple_out.snd->fst->value == value && mpz_cmp(tuple_out.snd->snd->count, input.number) == 0); clear(&owner);
  owned_aggregates_choice_t choices[] = {
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_EMPTY },
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_ONE, .cases.one = { value } },
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_PAIR, .cases.pair = { value, value } },
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_MANY, .cases.many = { &input.peers } }
  };
  for (size_t i = 0; i < sizeof(choices) / sizeof(*choices); ++i) {
    owned_aggregates_choice_t choice = {0};
    OK(owned_aggregates_echo_variant(session, &choices[i], &choice, &owner)); CHECK(choice.kind == choices[i].kind);
    if (choice.kind == OWNED_AGGREGATES_CHOICE_T_KIND_ONE) CHECK(choice.cases.one.ticket == value);
    if (choice.kind == OWNED_AGGREGATES_CHOICE_T_KIND_PAIR) CHECK(choice.cases.pair.first == value && choice.cases.pair.second == value);
    if (choice.kind == OWNED_AGGREGATES_CHOICE_T_KIND_MANY) CHECK(choice.cases.many.tickets->length == 2 && choice.cases.many.tickets->data[1] == value);
    clear(&owner);
  }
  owned_aggregates_ticket_row_element_t cells[] = { none, input.spare };
  owned_aggregates_ticket_row_t row = { cells, 2 }, row_out = {0};
  OK(owned_aggregates_echo_row(session, &row, &row_out, &owner));
  CHECK(row_out.length == 2 && !row_out.data[0].has_value && row_out.data[1].value == value); clear(&owner);
  owned_aggregates_echo_nested_argument0_element_element_t nested_option = {true, &result};
  owned_aggregates_echo_nested_argument0_element_t nested_list = { &nested_option, 1 };
  owned_aggregates_echo_nested_argument0_t nested = { &nested_list, 1 }, nested_out = {0};
  OK(owned_aggregates_echo_nested(session, &nested, &nested_out, &owner));
  CHECK(nested_out.data[0].data[0].has_value && nested_out.data[0].data[0].value->error == value); clear(&owner);
  nested.length = 0; nested.data = NULL;
  OK(owned_aggregates_echo_nested(session, &nested, &nested_out, &owner)); CHECK(nested_out.length == 0 && !nested_out.data); clear(&owner);
  /* A child retained through the public API survives all original owners. */
  OK(owned_aggregates_echo_record(session, &input.bundle, &out, &owner));
  owned_aggregates_result *child_owner = NULL;
  OK(owned_aggregates_primary(session, &out, &retained, &child_owner));
  clear(&ticket_owner); clear(&owner); check_ticket(session, retained); clear(&child_owner);
  mpz_srcptr stale_out = NULL;
  CHECK(owned_aggregates_serial(session, retained, &stale_out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!stale_out && !owner); mpz_clear(input.number);
  OK(owned_aggregates_session_close(&session)); CHECK(!session && !live && !owned_test_identities());
}

static void test_recursive_closures(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *owner = NULL, *closure_owner = NULL;
  owned_aggregates_ticket_t value = new_ticket(session, &ticket_owner);
  owned_aggregates_tree_t chain[66]; owned_aggregates_tree_branch_children_t children[65];
  chain[0] = (owned_aggregates_tree_t){ .kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = { value } };
  for (size_t i = 1; i < 66; ++i) {
    children[i - 1] = (owned_aggregates_tree_branch_children_t){ &chain[i - 1], 1 };
    chain[i] = (owned_aggregates_tree_t){ .kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = { &children[i - 1] } };
  }
  owned_aggregates_tree_t out = {0};
  /* Each branch adds a Tree and an Array; the leaf's Ticket adds one more. */
  OK(owned_aggregates_echo_recursive(session, &chain[63], &out, &owner));
  const owned_aggregates_tree_t *current = &out;
  for (size_t i = 0; i < 63; ++i) { CHECK(current->kind == OWNED_AGGREGATES_TREE_T_KIND_BRANCH); current = current->cases.branch.children->data; }
  CHECK(current->kind == OWNED_AGGREGATES_TREE_T_KIND_LEAF && current->cases.leaf.ticket == value); clear(&owner);
  CHECK(owned_aggregates_echo_recursive(session, &chain[64], &out, &owner) == OWNED_AGGREGATES_LIMIT); CHECK(!owner);
  owned_aggregates_tree_branch_children_t cycle = { &out, 1 };
  out = (owned_aggregates_tree_t){ .kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = { &cycle } };
  owned_aggregates_tree_t rejected = {0};
  CHECK(owned_aggregates_echo_recursive(session, &out, &rejected, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT); CHECK(!owner);
  owned_aggregates_make_recursive_result_t closure = NULL, retained = NULL;
  OK(owned_aggregates_make_recursive(session, &chain[2], &closure, &owner));
  OK(owned_aggregates_make_recursive_result_t_retain(session, closure, &retained, &closure_owner));
  CHECK(closure == retained); clear(&owner); clear(&ticket_owner);
  owned_aggregates_tree_branch_children_t empty = {0};
  owned_aggregates_tree_t supplied = { .kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = { &empty } };
  OK(owned_aggregates_make_recursive_result_t_call(session, retained, true, &supplied, &out, &owner));
  current = out.cases.branch.children->data; current = current->cases.branch.children->data;
  check_ticket(session, current->cases.leaf.ticket); clear(&owner);
  OK(owned_aggregates_make_recursive_result_t_call(session, retained, false, &supplied, &out, &owner));
  CHECK(out.cases.branch.children->length == 0); clear(&owner); clear(&closure_owner);
  CHECK(owned_aggregates_make_recursive_result_t_call(session, retained, false, &supplied, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  OK(owned_aggregates_session_close(&session)); CHECK(!live && !owned_test_identities());
}

static void test_faults(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t value = new_ticket(session, &ticket_owner);
  bundle_input input; initialize_bundle(&input, value);
  owned_aggregates_bundle_t out = {0};
  size_t before = attempts;
  OK(owned_aggregates_echo_record(session, &input.bundle, &out, &owner));
  size_t count = attempts - before; clear(&owner);
  for (size_t i = 1; i <= count; ++i) {
    size_t old_live = live, identities = owned_test_identities();
    memset(&out, 0xa5, sizeof(out)); unsigned char saved[sizeof(out)]; memcpy(saved, &out, sizeof(out));
    fail_at = attempts + i;
    CHECK(owned_aggregates_echo_record(session, &input.bundle, &out, &owner) == OWNED_AGGREGATES_ALLOCATION_FAILED);
    fail_at = 0; ++failures;
    CHECK(!memcmp(saved, &out, sizeof(out)) && !owner && live == old_live && identities == owned_test_identities());
  }
  owned_aggregates_make_record_result_t closure = NULL;
  before = attempts; OK(owned_aggregates_make_record(session, &input.bundle, &closure, &owner));
  count = attempts - before; clear(&owner);
  for (size_t i = 1; i <= count; ++i) {
    size_t old_live = live, identities = owned_test_identities(); closure = NULL;
    fail_at = attempts + i;
    CHECK(owned_aggregates_make_record(session, &input.bundle, &closure, &owner) == OWNED_AGGREGATES_ALLOCATION_FAILED);
    fail_at = 0; ++failures;
    CHECK(!closure && !owner && live == old_live && identities == owned_test_identities());
  }
  OK(owned_aggregates_make_record(session, &input.bundle, &closure, &owner));
  owned_aggregates_result *reply = NULL;
  OK(owned_aggregates_make_record_result_t_call(session, closure, false, &input.bundle, &out, &reply));
  check_bundle(session, &out, value); clear(&reply); clear(&owner);
  /* Strict tags and malformed fields reject before accessing inactive children. */
  owned_aggregates_bundle_t broken = input.bundle; broken.payload = NULL;
  CHECK(owned_aggregates_echo_record(session, &broken, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  uint8_t invalid_bool = 2; memcpy(&input.spare.has_value, &invalid_bool, 1);
  CHECK(owned_aggregates_echo_record(session, &input.bundle, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  input.spare.has_value = true;
  owned_aggregates_choice_t choice = {.kind = (owned_aggregates_choice_t_kind)999}, choice_out = {0};
  CHECK(owned_aggregates_echo_variant(session, &choice, &choice_out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  input.peers.length = SIZE_MAX;
  CHECK(owned_aggregates_echo_record(session, &input.bundle, &out, &owner) == OWNED_AGGREGATES_LIMIT);
  input.peers.length = 2;
  CHECK(!owner); clear(&ticket_owner); mpz_clear(input.number);
  OK(owned_aggregates_session_close(&session)); CHECK(!live && !owned_test_identities());
}

static void *foreign_thread(void *raw) {
  owned_aggregates_session *session = raw;
  return (void *)(uintptr_t)owned_aggregates_session_close(&session);
}
static void test_lifetimes(void) {
  owned_aggregates_session *session = NULL, *other = NULL; OK(owned_aggregates_session_open(&session)); OK(owned_aggregates_session_open(&other));
  owned_aggregates_result *ticket_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t value = new_ticket(session, &ticket_owner);
  mpz_srcptr number = NULL;
  CHECK(owned_aggregates_serial(other, value, &number, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT); CHECK(!number && !owner);
  OK(owned_aggregates_session_close(&other));
  pthread_t thread; void *thread_status = NULL;
  CHECK(pthread_create(&thread, NULL, foreign_thread, session) == 0); CHECK(pthread_join(thread, &thread_status) == 0);
  CHECK((uintptr_t)thread_status == OWNED_AGGREGATES_INVALID_ARGUMENT);
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) {
    alarm(3); owned_aggregates_session *fresh = NULL;
    CHECK(owned_aggregates_session_open(&fresh) == OWNED_AGGREGATES_WRONG_PROCESS);
    CHECK(owned_aggregates_session_close(&session) == OWNED_AGGREGATES_WRONG_PROCESS);
    CHECK(owned_aggregates_result_release(&ticket_owner) == OWNED_AGGREGATES_WRONG_PROCESS);
    _exit(0);
  }
  int exit_status = 0; CHECK(waitpid(child, &exit_status, 0) == child && WIFEXITED(exit_status) && WEXITSTATUS(exit_status) == 0);
  OK(owned_aggregates_serial(session, value, &number, &owner));
  owned_aggregates_result *stale_result = owner;
  clear(&owner);
  CHECK(owned_aggregates_result_release(&stale_result) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  OK(owned_aggregates_serial(session, value, &number, &owner));
  CHECK(owned_aggregates_result_release(&stale_result) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  owned_aggregates_session *stale_session = session;
  OK(owned_aggregates_session_close(&session)); CHECK(!session && mpz_cmp_ui(number, 42) == 0);
  owned_aggregates_result *unused = NULL; mpz_srcptr untouched = NULL;
  CHECK(owned_aggregates_serial(stale_session, value, &untouched, &unused) == OWNED_AGGREGATES_CLOSED);
  CHECK(!unused && !untouched);
  clear(&owner); clear(&ticket_owner); CHECK(!live && !owned_test_identities());
  CHECK(owned_aggregates_session_close(&stale_session) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  OK(owned_aggregates_session_open(&session)); value = new_ticket(session, &owner);
  owned_test_retire(); CHECK(owned_aggregates_serial(session, value, &number, &ticket_owner) == OWNED_AGGREGATES_RUNTIME_UNAVAILABLE);
  clear(&owner); OK(owned_aggregates_session_close(&session)); CHECK(!live && !owned_test_identities());
}

static void test_bad_reply(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t ticket = new_ticket(session, &ticket_owner);
  owned_aggregates_choice_t input = { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_ONE, .cases.one = { ticket } }, out;
  memset(&out, 0xa5, sizeof(out)); unsigned char saved[sizeof(out)]; memcpy(saved, &out, sizeof(out));
  size_t baseline = live, identities = owned_test_identities();
  CHECK(owned_aggregates_echo_variant(session, &input, &out, &owner) == OWNED_AGGREGATES_MALFORMED_RESULT);
  CHECK(!owner && baseline == live && identities == owned_test_identities() && !memcmp(saved, &out, sizeof(out)));
  mpz_srcptr number = NULL;
  CHECK(owned_aggregates_serial(session, ticket, &number, &owner) == OWNED_AGGREGATES_RUNTIME_UNAVAILABLE);
  CHECK(!owner && !number); clear(&ticket_owner);
  OK(owned_aggregates_session_close(&session)); CHECK(!live && !owned_test_identities());
}

int main(void) {
  if (getenv("LEAN_BRIDGE_OWNED_BAD_REPLY")) { test_bad_reply(); puts("{\"badReply\":true}"); return 0; }
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session)); OK(owned_aggregates_session_close(&session));
    puts("{\"cold\":true}"); return 0;
  }
  test_shapes(); test_recursive_closures(); test_faults(); test_lifetimes();
  printf("{\"checks\":%zu,\"failures\":%zu,\"live\":%zu,\"identities\":%zu}\n", checks, failures, live, owned_test_identities());
  return 0;
}
