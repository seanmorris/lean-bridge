/* Independent installed consumer. Only the shipped public C API is included. */
#include "owned_aggregates.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static size_t checks;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "installed C check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
static void clear(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(*owner == NULL);
}
static owned_aggregates_ticket_t ticket(owned_aggregates_session *session, unsigned serial, owned_aggregates_result **owner) {
  mpz_t number; mpz_init_set_ui(number, serial);
  owned_aggregates_ticket_t value = NULL;
  OK(owned_aggregates_new_ticket(session, number, (owned_aggregates_scalar_string_t){"ticket\0\xce\xbb", 9}, &value, owner));
  CHECK(value != NULL); mpz_clear(number); return value;
}
static void serial(owned_aggregates_session *session, owned_aggregates_ticket_t value, unsigned expected) {
  owned_aggregates_result *owner = NULL; mpz_srcptr number = NULL;
  OK(owned_aggregates_serial(session, value, &number, &owner)); CHECK(mpz_cmp_ui(number, expected) == 0); clear(&owner);
}
static void *foreign_thread(void *raw) {
  owned_aggregates_session *session = raw;
  return (void *)(uintptr_t)owned_aggregates_session_close(&session);
}
static void run(void) {
  owned_aggregates_session *session = NULL, *other = NULL;
  OK(owned_aggregates_session_open(&session)); OK(owned_aggregates_session_open(&other));
  owned_aggregates_result *first_owner = NULL, *second_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t first = ticket(session, 42, &first_owner), second = ticket(session, 99, &second_owner), retained = NULL;
  CHECK(first != second);
  OK(owned_aggregates_ticket_t_retain(session, first, &retained, &owner)); CHECK(retained == first); clear(&owner);
  OK(owned_aggregates_retain_ticket(session, second, &retained, &owner)); CHECK(retained == second); clear(&owner);
  owned_aggregates_scalar_string_t label = {0};
  OK(owned_aggregates_label(session, first, &label, &owner));
  CHECK(label.length == 9 && memcmp(label.data, "ticket\0\xce\xbb", 9) == 0); clear(&owner);
  mpz_t count; mpz_init(count); CHECK(mpz_set_str(count, "-129127208515966861331", 10) == 0);
  uint8_t bytes[] = {0, 255, 19};
  owned_aggregates_payload_t payload = {count, {bytes, 3}};
  owned_aggregates_ticket_t peers[] = {first, second}, history[] = {second, first, first};
  owned_aggregates_bundle_spare_t spare = {true, second}, none = {false, first};
  owned_aggregates_bundle_peers_t peer_span = {peers, 2};
  owned_aggregates_bundle_history_t history_span = {history, 3};
  owned_aggregates_bundle_t input = {first, &spare, &peer_span, &history_span, &payload}, out = {0};
  OK(owned_aggregates_bundle(session, first, &spare, &peer_span, &history_span, &payload, &out, &owner));
  CHECK(out.primary == first && out.spare->value == second); clear(&owner);
  for (size_t i = 0; i < 32; ++i) {
    OK(owned_aggregates_echo_record(session, &input, &out, &owner));
    CHECK(out.primary == first && out.spare->has_value && out.spare->value == second);
    CHECK(out.peers->length == 2 && out.peers->data[0] == first && out.peers->data[1] == second);
    CHECK(out.history->length == 3 && out.history->data[0] == second && out.history->data[1] == first && out.history->data[2] == first);
    CHECK(mpz_cmp(out.payload->count, count) == 0 && out.payload->count != count);
    CHECK(out.payload->bytes.length == 3 && out.payload->bytes.data != bytes && !memcmp(out.payload->bytes.data, bytes, 3));
    clear(&owner);
  }
  OK(owned_aggregates_echo_alias(session, &input, &out, &owner)); CHECK(out.spare->value == second); clear(&owner);
  owned_aggregates_payload_t copied = {0};
  OK(owned_aggregates_payload(session, &input, &copied, &owner)); CHECK(mpz_cmp(copied.count, count) == 0); clear(&owner);
  owned_aggregates_echo_array_result_t array = {0};
  OK(owned_aggregates_echo_array(session, &peer_span, &array, &owner)); CHECK(array.length == 2 && array.data[1] == second); clear(&owner);
  owned_aggregates_bundle_peers_t empty_array = {0};
  OK(owned_aggregates_echo_array(session, &empty_array, &array, &owner)); CHECK(!array.length && !array.data); clear(&owner);
  owned_aggregates_echo_list_result_t list = {0};
  OK(owned_aggregates_echo_list(session, &history_span, &list, &owner)); CHECK(list.length == 3 && list.data[0] == second); clear(&owner);
  owned_aggregates_bundle_history_t empty_list = {0};
  OK(owned_aggregates_echo_list(session, &empty_list, &list, &owner)); CHECK(!list.length && !list.data); clear(&owner);
  owned_aggregates_echo_option_result_t option = {0};
  OK(owned_aggregates_echo_option(session, &spare, &option, &owner)); CHECK(option.has_value && option.value == second); clear(&owner);
  OK(owned_aggregates_echo_option(session, &none, &option, &owner)); CHECK(!option.has_value && !option.value); clear(&owner);
  owned_aggregates_echo_result_argument0_t result = {.is_ok = true, .ok = &input}, result_out = {0};
  OK(owned_aggregates_echo_result(session, &result, &result_out, &owner)); CHECK(result_out.is_ok && result_out.ok->primary == first); clear(&owner);
  result = (owned_aggregates_echo_result_argument0_t){.is_ok = false, .error = second};
  OK(owned_aggregates_echo_result(session, &result, &result_out, &owner)); CHECK(!result_out.is_ok && result_out.error == second && !result_out.ok); clear(&owner);
  owned_aggregates_echo_tuple_argument0_snd_t tail = {&spare, &payload};
  owned_aggregates_echo_tuple_argument0_t tuple = {first, &tail}, tuple_out = {0};
  OK(owned_aggregates_echo_tuple(session, &tuple, &tuple_out, &owner));
  CHECK(tuple_out.fst == first && tuple_out.snd->fst->value == second && mpz_cmp(tuple_out.snd->snd->count, count) == 0); clear(&owner);
  owned_aggregates_choice_t variants[] = {
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_EMPTY},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_ONE, .cases.one = {first}},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_PAIR, .cases.pair = {first, second}},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_MANY, .cases.many = {&peer_span}},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_MANY, .cases.many = {&empty_array}}
  };
  for (size_t i = 0; i < 5; ++i) {
    owned_aggregates_choice_t variant = {0};
    OK(owned_aggregates_echo_variant(session, &variants[i], &variant, &owner)); CHECK(variant.kind == variants[i].kind);
    if (i == 1) CHECK(variant.cases.one.ticket == first);
    if (i == 2) CHECK(variant.cases.pair.first == first && variant.cases.pair.second == second);
    if (i == 3) CHECK(variant.cases.many.tickets->length == 2 && variant.cases.many.tickets->data[1] == second);
    if (i == 4) CHECK(!variant.cases.many.tickets->length);
    clear(&owner);
  }
  owned_aggregates_ticket_row_element_t cells[] = {none, spare};
  owned_aggregates_ticket_row_t row = {cells, 2}, row_out = {0};
  OK(owned_aggregates_echo_row(session, &row, &row_out, &owner));
  CHECK(row_out.length == 2 && !row_out.data[0].has_value && row_out.data[1].value == second); clear(&owner);
  owned_aggregates_echo_nested_argument0_element_element_t nested_items[] = {{false, NULL}, {true, &result}};
  owned_aggregates_echo_nested_argument0_element_t nested_list = {nested_items, 2};
  owned_aggregates_echo_nested_argument0_t nested = {&nested_list, 1}, nested_out = {0};
  OK(owned_aggregates_echo_nested(session, &nested, &nested_out, &owner));
  CHECK(nested_out.length == 1 && nested_out.data[0].length == 2 && !nested_out.data[0].data[0].has_value);
  CHECK(nested_out.data[0].data[1].has_value && nested_out.data[0].data[1].value->error == second); clear(&owner);
  nested.length = 0; nested.data = NULL;
  OK(owned_aggregates_echo_nested(session, &nested, &nested_out, &owner)); CHECK(!nested_out.length && !nested_out.data); clear(&owner);

  owned_aggregates_tree_t chain[65]; owned_aggregates_tree_branch_children_t children[64];
  chain[0] = (owned_aggregates_tree_t){.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {second}};
  for (size_t i = 1; i < 65; ++i) {
    children[i - 1] = (owned_aggregates_tree_branch_children_t){&chain[i - 1], 1};
    chain[i] = (owned_aggregates_tree_t){.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children[i - 1]}};
  }
  owned_aggregates_tree_t tree = {0};
  OK(owned_aggregates_echo_recursive(session, &chain[63], &tree, &owner));
  const owned_aggregates_tree_t *cursor = &tree;
  for (size_t i = 0; i < 63; ++i) { CHECK(cursor->kind == OWNED_AGGREGATES_TREE_T_KIND_BRANCH); cursor = cursor->cases.branch.children->data; }
  CHECK(cursor->kind == OWNED_AGGREGATES_TREE_T_KIND_LEAF && cursor->cases.leaf.ticket == second); clear(&owner);
  CHECK(owned_aggregates_echo_recursive(session, &chain[64], &tree, &owner) == OWNED_AGGREGATES_LIMIT); CHECK(!owner);
  owned_aggregates_tree_branch_children_t cycle = {&tree, 1};
  tree = (owned_aggregates_tree_t){.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&cycle}};
  CHECK(owned_aggregates_echo_recursive(session, &tree, &chain[64], &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT); CHECK(!owner);
  owned_aggregates_result *closure_owner = NULL, *retained_owner = NULL;
  owned_aggregates_make_recursive_result_t closure = NULL, kept = NULL;
  OK(owned_aggregates_make_recursive(session, &chain[2], &closure, &closure_owner));
  OK(owned_aggregates_make_recursive_result_t_retain(session, closure, &kept, &retained_owner));
  CHECK(kept == closure); clear(&closure_owner);
  owned_aggregates_tree_branch_children_t no_children = {0};
  owned_aggregates_tree_t supplied = {.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&no_children}};
  OK(owned_aggregates_make_recursive_result_t_call(session, kept, true, &supplied, &tree, &owner));
  cursor = tree.cases.branch.children->data; cursor = cursor->cases.branch.children->data;
  serial(session, cursor->cases.leaf.ticket, 99); clear(&owner);
  OK(owned_aggregates_make_recursive_result_t_call(session, kept, false, &supplied, &tree, &owner));
  CHECK(!tree.cases.branch.children->length); clear(&owner); clear(&retained_owner);
  CHECK(owned_aggregates_make_recursive_result_t_call(session, kept, false, &supplied, &tree, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  owned_aggregates_make_record_result_t record_closure = NULL;
  OK(owned_aggregates_make_record(session, &input, &record_closure, &closure_owner));
  owned_aggregates_bundle_t alternate = input; alternate.primary = second;
  OK(owned_aggregates_make_record_result_t_call(session, record_closure, true, &alternate, &out, &owner)); CHECK(out.primary == first); clear(&owner);
  OK(owned_aggregates_make_record_result_t_call(session, record_closure, false, &alternate, &out, &owner)); CHECK(out.primary == second); clear(&owner); clear(&closure_owner);

  /* Invalid fields and limits preserve output bytes, then valid calls recover. */
  owned_aggregates_bundle_t broken = input; broken.payload = NULL;
  memset(&out, 0xa5, sizeof(out)); unsigned char saved[sizeof(out)]; memcpy(saved, &out, sizeof(out));
  CHECK(owned_aggregates_echo_record(session, &broken, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!owner && !memcmp(saved, &out, sizeof(out)));
  peer_span.length = SIZE_MAX;
  CHECK(owned_aggregates_echo_record(session, &input, &out, &owner) == OWNED_AGGREGATES_LIMIT);
  CHECK(!owner && !memcmp(saved, &out, sizeof(out))); peer_span.length = 2;
  uint8_t invalid_bool = 2; memcpy(&spare.has_value, &invalid_bool, 1);
  CHECK(owned_aggregates_echo_record(session, &input, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT); spare.has_value = true;
  OK(owned_aggregates_echo_record(session, &input, &out, &owner)); clear(&owner);
  owned_aggregates_choice_t invalid = {.kind = (owned_aggregates_choice_t_kind)999}, variant = {0};
  CHECK(owned_aggregates_echo_variant(session, &invalid, &variant, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT); CHECK(!owner);
  mpz_srcptr number = NULL;
  CHECK(owned_aggregates_serial(other, first, &number, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT); CHECK(!number && !owner);
  OK(owned_aggregates_session_close(&other));
  pthread_t thread; void *thread_status = NULL;
  CHECK(pthread_create(&thread, NULL, foreign_thread, session) == 0); CHECK(pthread_join(thread, &thread_status) == 0);
  CHECK((uintptr_t)thread_status == OWNED_AGGREGATES_INVALID_ARGUMENT);
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) {
    alarm(3); owned_aggregates_session *fresh = NULL;
    CHECK(owned_aggregates_session_open(&fresh) == OWNED_AGGREGATES_WRONG_PROCESS);
    CHECK(owned_aggregates_session_close(&session) == OWNED_AGGREGATES_WRONG_PROCESS);
    CHECK(owned_aggregates_result_release(&first_owner) == OWNED_AGGREGATES_WRONG_PROCESS);
    _exit(0);
  }
  int status = 0; CHECK(waitpid(child, &status, 0) == child && WIFEXITED(status) && WEXITSTATUS(status) == 0);
  OK(owned_aggregates_primary(session, &input, &retained, &owner));
  clear(&first_owner); clear(&second_owner); serial(session, retained, 42);
  owned_aggregates_result *value_owner = NULL;
  OK(owned_aggregates_serial(session, retained, &number, &value_owner));
  clear(&owner);
  mpz_srcptr absent = NULL;
  CHECK(owned_aggregates_serial(session, retained, &absent, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT); CHECK(!owner && !absent);
  owned_aggregates_session *stale = session;
  OK(owned_aggregates_session_close(&session)); CHECK(!session && mpz_cmp_ui(number, 42) == 0);
  CHECK(owned_aggregates_session_close(&stale) == OWNED_AGGREGATES_CLOSED);
  clear(&value_owner);
  CHECK(owned_aggregates_session_close(&stale) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  mpz_clear(count);
}
int main(void) { run(); printf("owned-installed:%zu\n", checks); return 0; }
