/* Independent public C consumer: no Lean headers, private owners, or tokens. */
#include "owned_aggregates.h"
#include "transfer-copies.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static size_t checks, live, attempts, fail_at, before_failures, after_failures;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "transfer C check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
void *owned_test_allocate(size_t bytes) {
  if (++attempts == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live; return value;
}
void owned_test_free(void *value) { if (value) { CHECK(live > 0); --live; free(value); } }
extern size_t owned_test_identities(void);

static void clear(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(!*owner);
}
static owned_aggregates_ticket_t ticket(owned_aggregates_session *session,
    unsigned serial, owned_aggregates_result **owner) {
  mpz_t number; mpz_init_set_ui(number, serial);
  owned_aggregates_ticket_t value = NULL;
  OK(owned_aggregates_new_ticket(session, number,
      (owned_aggregates_scalar_string_t){"ticket\0label", 12}, &value, owner));
  mpz_clear(number); CHECK(value != NULL); return value;
}
static void serial(owned_aggregates_session *session, owned_aggregates_ticket_t value, unsigned expected) {
  mpz_srcptr number = NULL; owned_aggregates_result *owner = NULL;
  OK(owned_aggregates_serial(session, value, &number, &owner));
  CHECK(mpz_cmp_ui(number, expected) == 0); clear(&owner);
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
  input->payload = (owned_aggregates_payload_t){ input->number, {input->bytes, 3} };
  input->spare = (owned_aggregates_bundle_spare_t){ true, value };
  input->peers = (owned_aggregates_bundle_peers_t){ input->items, 2 };
  input->history = (owned_aggregates_bundle_history_t){ input->items, 1 };
  input->value = (owned_aggregates_bundle_t){ value, &input->spare, &input->peers, &input->history, &input->payload };
}
static void bundle_check(const owned_aggregates_bundle_t *value) {
  CHECK(value->spare->has_value && value->spare->value == value->primary);
  CHECK(value->peers->length == 2 && value->peers->data[1] == value->primary);
  CHECK(value->history->length == 1 && value->history->data[0] == value->primary);
  CHECK(mpz_cmp_si(value->payload->count, -1234567) == 0);
  CHECK(value->payload->bytes.length == 3 && value->payload->bytes.data[1] == 255);
}
static void resource_moves(void) {
  owned_aggregates_session *session = NULL, *other = NULL;
  OK(owned_aggregates_session_open(&session)); OK(owned_aggregates_session_open(&other));
  owned_aggregates_result *a = NULL, *b = NULL, *independent = NULL, *out_owner = NULL;
  owned_aggregates_ticket_t first = ticket(session, 42, &a), second = ticket(session, 99, &b);
  owned_aggregates_ticket_t retained = NULL, out = first;
  OK(owned_aggregates_ticket_t_retain(session, first, &retained, &independent));
  owned_aggregates_result *saved_a = a, *saved_b = b;
  CHECK(owned_aggregates_retain_ticket(session, first, &b, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(a == saved_a && b == saved_b && !out_owner && out == first);
  CHECK(owned_aggregates_retain_ticket(other, first, &a, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(a == saved_a && !out_owner);
  CHECK(owned_aggregates_retain_ticket(session, first, NULL, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owned_aggregates_retain_ticket(session, first, &a, &out, &a) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(a == saved_a);
  owned_aggregates_result *overlap = a;
  CHECK(owned_aggregates_retain_ticket(session, first, &overlap,
      (owned_aggregates_ticket_t *)&overlap, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(overlap == a && !out_owner);
  OK(owned_aggregates_retain_ticket(session, first, &a, &out, &out_owner));
  CHECK(!a && out == first && out_owner != saved_a);
  CHECK(owned_aggregates_result_release(&saved_a) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  clear(&out_owner); serial(session, retained, 42); serial(session, second, 99);
  CHECK(owned_aggregates_retain_ticket(session, first, &saved_a, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(saved_a != NULL && out_owner == NULL);
  clear(&independent); clear(&b);
  OK(owned_aggregates_session_close(&other)); OK(owned_aggregates_session_close(&session));
  CHECK(live == 0 && owned_test_identities() == 0);
}
static void empty_and_recursive(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *owner = NULL, *returned_owner = NULL;
  owned_aggregates_echo_option_argument0_t none = {0}, value = {0}, returned = {0};
  OK(COPY_OPTION(session, &none, &value, &owner)); CHECK(owner != NULL);
  owned_aggregates_result *stale = owner;
  OK(owned_aggregates_echo_option(session, &value, &owner, &returned, &returned_owner));
  CHECK(!owner && !returned.has_value && returned_owner);
  CHECK(owned_aggregates_result_release(&stale) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  clear(&returned_owner);
  owned_aggregates_result *ticket_owner = NULL;
  owned_aggregates_ticket_t item = ticket(session, 42, &ticket_owner);
  owned_aggregates_tree_t leaf = { .kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {item} };
  owned_aggregates_tree_branch_children_t children = {&leaf, 1};
  owned_aggregates_tree_t branch = { .kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children} };
  owned_aggregates_tree_t copied = {0}, output = {0};
  OK(owned_aggregates_tree_t_copy(session, &branch, &copied, &owner));
  clear(&ticket_owner); stale = owner;
  children.data = &branch;
  CHECK(owned_aggregates_echo_recursive(session, &branch, &owner, &output, &returned_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owner == stale && !returned_owner);
  children.data = &leaf;
  OK(owned_aggregates_echo_recursive(session, &copied, &owner, &output, &returned_owner));
  CHECK(!owner && output.kind == OWNED_AGGREGATES_TREE_T_KIND_BRANCH);
  serial(session, output.cases.branch.children->data[0].cases.leaf.ticket, 42);
  clear(&returned_owner); OK(owned_aggregates_session_close(&session));
  CHECK(live == 0 && owned_test_identities() == 0);
}
static void multi_owner_and_faults(void) {
  int completed = 0;
  for (size_t offset = 1; offset < 400 && !completed; ++offset) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    owned_aggregates_result *ticket_owner = NULL, *primary_owner = NULL, *peers_owner = NULL, *out_owner = NULL;
    owned_aggregates_ticket_t item = ticket(session, 42, &ticket_owner), primary = NULL;
    bundle_input input; bundle_init(&input, item);
    OK(owned_aggregates_ticket_t_retain(session, item, &primary, &primary_owner));
    owned_aggregates_bundle_peers_t peers = {0};
    OK(COPY_ARRAY(session, &input.peers, &peers, &peers_owner));
    owned_aggregates_result *saved_primary = primary_owner, *saved_peers = peers_owner;
    owned_aggregates_bundle_t out, unchanged; memset(&out, 0xa5, sizeof(out)); unchanged = out;
    if (offset == 1) {
      owned_aggregates_result *duplicate = peers_owner;
      CHECK(owned_aggregates_bundle(session, primary, &duplicate, &input.spare, &peers,
          &peers_owner, &input.history, &input.payload, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
      CHECK(duplicate == saved_peers && peers_owner == saved_peers && primary_owner == saved_primary);
      owned_aggregates_payload_t invalid = input.payload; invalid.count = NULL;
      CHECK(owned_aggregates_bundle(session, primary, &primary_owner, &input.spare, &peers,
          &peers_owner, &input.history, &invalid, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
      CHECK(primary_owner == saved_primary && peers_owner == saved_peers && !out_owner);
      CHECK(memcmp(&out, &unchanged, sizeof(out)) == 0);
    }
    fail_at = attempts + offset;
    owned_aggregates_status status = owned_aggregates_bundle(session, primary, &primary_owner,
        &input.spare, &peers, &peers_owner, &input.history, &input.payload, &out, &out_owner);
    fail_at = 0;
    CHECK((primary_owner == NULL) == (peers_owner == NULL));
    if (!status) {
      completed = 1; CHECK(!primary_owner && !peers_owner && out_owner);
      bundle_check(&out); clear(&out_owner);
    } else {
      CHECK(status == OWNED_AGGREGATES_ALLOCATION_FAILED);
      CHECK(!out_owner && memcmp(&out, &unchanged, sizeof(out)) == 0);
      if (primary_owner) {
        ++before_failures; CHECK(primary_owner == saved_primary && peers_owner == saved_peers);
        serial(session, primary, 42);
      } else {
        ++after_failures;
        CHECK(owned_aggregates_result_release(&saved_primary) == OWNED_AGGREGATES_INVALID_ARGUMENT);
        CHECK(owned_aggregates_result_release(&saved_peers) == OWNED_AGGREGATES_INVALID_ARGUMENT);
      }
    }
    serial(session, item, 42);
    clear(&primary_owner); clear(&peers_owner); clear(&ticket_owner);
    mpz_clear(input.number); OK(owned_aggregates_session_close(&session));
    CHECK(live == 0 && owned_test_identities() == 0);
  }
  CHECK(completed && before_failures > 0 && after_failures > 0);
}
typedef struct {
  owned_aggregates_result **input_owner;
  owned_aggregates_result *stale;
  const owned_aggregates_bundle_t *original;
  unsigned calls, mode;
} callback_context;
static owned_aggregates_status callback(void *raw, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out,
    owned_aggregates_result **owner) {
  callback_context *context = raw; ++context->calls;
  CHECK(*context->input_owner == NULL);
  CHECK(owned_aggregates_result_release(&context->stale) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  /* The handle is consumed now, but its copied payload must outlive reentry. */
  bundle_check(context->original); bundle_check(input); serial(session, input->primary, 42);
  if (context->mode == 1) return OWNED_AGGREGATES_CALLBACK_FAILED;
  if (context->mode == 2) { OK(owned_aggregates_session_close(&session)); *out = *input; return OWNED_AGGREGATES_OK; }
  owned_aggregates_bundle_t nested = {0}; owned_aggregates_result *nested_owner = NULL;
  OK(owned_aggregates_bundle_t_copy(session, input, &nested, &nested_owner));
  OK(owned_aggregates_echo_record(session, &nested, &nested_owner, out, owner));
  CHECK(!nested_owner && *owner); return OWNED_AGGREGATES_OK;
}
static void callback_moves(void) {
  for (unsigned mode = 0; mode < 3; ++mode) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    owned_aggregates_result *ticket_owner = NULL, *input_owner = NULL, *out_owner = NULL;
    owned_aggregates_ticket_t item = ticket(session, 42, &ticket_owner);
    bundle_input input; bundle_init(&input, item);
    owned_aggregates_bundle_t copied = {0}, out, unchanged; memset(&out, 0xa5, sizeof(out)); unchanged = out;
    OK(owned_aggregates_bundle_t_copy(session, &input.value, &copied, &input_owner));
    clear(&ticket_owner);
    callback_context context = {&input_owner, input_owner, &copied, 0, mode};
    owned_aggregates_callback_record_argument1_t_host host = { .call = callback, .context = &context };
    owned_aggregates_status status = owned_aggregates_callback_record(session, &copied,
        &input_owner, &host, &out, &out_owner);
    CHECK(!input_owner && context.calls == 1);
    if (!mode) { OK(status); bundle_check(&out); serial(session, out.primary, 42); clear(&out_owner); }
    else {
      CHECK(status == (mode == 1 ? OWNED_AGGREGATES_CALLBACK_FAILED : OWNED_AGGREGATES_CLOSED));
      CHECK(!out_owner && memcmp(&out, &unchanged, sizeof(out)) == 0);
    }
    mpz_clear(input.number);
    if (mode != 2) OK(owned_aggregates_session_close(&session));
    CHECK(live == 0 && owned_test_identities() == 0);
  }
}
static void captured_move(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *input_owner = NULL, *closure_owner = NULL, *out_owner = NULL;
  owned_aggregates_ticket_t original = ticket(session, 42, &ticket_owner);
  bundle_input input; bundle_init(&input, original);
  owned_aggregates_bundle_t captured = {0};
  OK(owned_aggregates_bundle_t_copy(session, &input.value, &captured, &input_owner));
  clear(&ticket_owner);
  owned_aggregates_make_record_result_t closure = NULL;
  OK(owned_aggregates_make_record(session, &captured, &input_owner, &closure, &closure_owner));
  CHECK(!input_owner && closure && closure_owner); mpz_clear(input.number);
  owned_aggregates_ticket_t replacement = ticket(session, 99, &ticket_owner);
  bundle_init(&input, replacement);
  owned_aggregates_bundle_t out = {0};
  OK(owned_aggregates_make_record_result_t_call(session, closure, true, &input.value, &out, &out_owner));
  bundle_check(&out); serial(session, out.primary, 42);
  clear(&closure_owner); serial(session, out.primary, 42);
  clear(&out_owner); clear(&ticket_owner); mpz_clear(input.number);
  OK(owned_aggregates_session_close(&session)); CHECK(live == 0 && owned_test_identities() == 0);
}
static void closure_move(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *owner = NULL, *retained_owner = NULL, *moved_owner = NULL, *ticket_owner = NULL;
  owned_aggregates_callback_record_argument1_t closure = NULL, retained = NULL, moved = NULL;
  OK(owned_aggregates_new_record_callback(session, &closure, &owner));
  OK(owned_aggregates_callback_record_argument1_t_retain(session, closure, &retained, &retained_owner));
  owned_aggregates_ticket_t item = ticket(session, 42, &ticket_owner);
  owned_aggregates_result *saved = owner, *saved_ticket = ticket_owner;
  CHECK(owned_aggregates_transfer_callback(session, closure, &ticket_owner, &moved, &moved_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owner == saved && ticket_owner == saved_ticket && !moved && !moved_owner);
  OK(owned_aggregates_transfer_callback(session, closure, &owner, &moved, &moved_owner));
  CHECK(!owner); CHECK(moved != NULL && moved_owner != NULL);
  CHECK(owned_aggregates_result_release(&saved) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  bundle_input input; bundle_init(&input, item);
  owned_aggregates_bundle_t out = {0}; owned_aggregates_result *out_owner = NULL;
  /* Lean may eta-expand a returned function. Check its behavior, not equality
     of opaque closure handles, then check the independently retained original. */
  OK(owned_aggregates_callback_record_argument1_t_call(session, moved, &input.value, &out, &out_owner));
  bundle_check(&out); serial(session, out.primary, 42); clear(&out_owner); clear(&moved_owner);
  OK(owned_aggregates_callback_record_argument1_t_call(session, retained, &input.value, &out, &out_owner));
  bundle_check(&out); serial(session, out.primary, 42);
  clear(&out_owner); clear(&retained_owner); clear(&ticket_owner); mpz_clear(input.number);
  OK(owned_aggregates_session_close(&session)); CHECK(live == 0 && owned_test_identities() == 0);
}
static void remaining_shapes(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *input_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t value = ticket(session, 42, &ticket_owner);
  bundle_input input; bundle_init(&input, value);
  owned_aggregates_echo_array_argument0_t array = {0}, array_out = {0};
  OK(COPY_ARRAY(session, &input.peers, &array, &input_owner));
  OK(owned_aggregates_echo_array(session, &array, &input_owner, &array_out, &owner));
  CHECK(!input_owner && array_out.length == 2 && array_out.data[1] == value); clear(&owner);
  owned_aggregates_echo_list_argument0_t list = {0}, list_out = {0};
  OK(COPY_LIST(session, &input.history, &list, &input_owner));
  OK(owned_aggregates_echo_list(session, &list, &input_owner, &list_out, &owner));
  CHECK(!input_owner && list_out.length == 1 && list_out.data[0] == value); clear(&owner);
  owned_aggregates_echo_option_argument0_t option = {0}, option_out = {0};
  OK(COPY_OPTION(session, &input.spare, &option, &input_owner));
  OK(owned_aggregates_echo_option(session, &option, &input_owner, &option_out, &owner));
  CHECK(!input_owner && option_out.has_value && option_out.value == value); clear(&owner);
  for (unsigned branch = 0; branch < 2; ++branch) {
    owned_aggregates_echo_result_argument0_t source = { .is_ok = branch != 0, .ok = &input.value, .error = value };
    owned_aggregates_echo_result_argument0_t result = {0}, result_out = {0};
    OK(COPY_RESULT(session, &source, &result, &input_owner));
    OK(owned_aggregates_echo_result(session, &result, &input_owner, &result_out, &owner));
    CHECK(!input_owner && result_out.is_ok == source.is_ok);
    if (branch) bundle_check(result_out.ok); else CHECK(result_out.error == value);
    clear(&owner);
  }
  owned_aggregates_echo_tuple_argument0_snd_t tail = {&input.spare, &input.payload};
  owned_aggregates_echo_tuple_argument0_t source_tuple = {value, &tail}, tuple = {0}, tuple_out = {0};
  OK(COPY_TUPLE(session, &source_tuple, &tuple, &input_owner));
  OK(owned_aggregates_echo_tuple(session, &tuple, &input_owner, &tuple_out, &owner));
  CHECK(!input_owner && tuple_out.fst == value && tuple_out.snd->fst->value == value);
  CHECK(mpz_cmp(tuple_out.snd->snd->count, input.number) == 0); clear(&owner);
  owned_aggregates_bundle_t record = {0}, record_out = {0};
  OK(owned_aggregates_bundle_t_copy(session, &input.value, &record, &input_owner));
  OK(owned_aggregates_echo_alias(session, &record, &input_owner, &record_out, &owner));
  CHECK(!input_owner); bundle_check(&record_out); clear(&owner);
  owned_aggregates_choice_t choices[] = {
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_EMPTY },
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_ONE, .cases.one = {value} },
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_PAIR, .cases.pair = {value, value} },
    { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_MANY, .cases.many = {&input.peers} }
  };
  for (size_t i = 0; i < sizeof(choices) / sizeof(*choices); ++i) {
    owned_aggregates_choice_t choice = {0}, choice_out = {0};
    OK(owned_aggregates_choice_t_copy(session, &choices[i], &choice, &input_owner));
    OK(owned_aggregates_echo_variant(session, &choice, &input_owner, &choice_out, &owner));
    CHECK(!input_owner && choice_out.kind == choices[i].kind);
    if (i == 1) CHECK(choice_out.cases.one.ticket == value);
    if (i == 2) CHECK(choice_out.cases.pair.second == value);
    if (i == 3) CHECK(choice_out.cases.many.tickets->length == 2);
    clear(&owner);
  }
  owned_aggregates_ticket_row_element_t cells[] = {{false, NULL}, {true, value}};
  owned_aggregates_ticket_row_t source_row = {cells, 2}, row = {0}, row_out = {0};
  OK(COPY_ROW(session, &source_row, &row, &input_owner));
  OK(owned_aggregates_echo_row(session, &row, &input_owner, &row_out, &owner));
  CHECK(!input_owner && row_out.length == 2 && !row_out.data[0].has_value && row_out.data[1].value == value);
  clear(&owner);
  owned_aggregates_echo_nested_argument0_element_element_value_t nested_result = { .is_ok = true, .ok = &input.value };
  owned_aggregates_echo_nested_argument0_element_element_t nested_option = {true, &nested_result};
  owned_aggregates_echo_nested_argument0_element_t nested_list = {&nested_option, 1};
  owned_aggregates_echo_nested_argument0_t nested_source = {&nested_list, 1}, nested = {0}, nested_out = {0};
  OK(COPY_NESTED(session, &nested_source, &nested, &input_owner));
  OK(owned_aggregates_echo_nested(session, &nested, &input_owner, &nested_out, &owner));
  CHECK(!input_owner && nested_out.length == 1 && nested_out.data[0].length == 1);
  bundle_check(nested_out.data[0].data[0].value->ok); clear(&owner);
  clear(&ticket_owner); mpz_clear(input.number);
  OK(owned_aggregates_session_close(&session)); CHECK(live == 0 && owned_test_identities() == 0);
}
static owned_aggregates_status tree_callback(void *raw, owned_aggregates_session *session,
    const owned_aggregates_tree_t *input, owned_aggregates_tree_t *out, owned_aggregates_result **owner) {
  owned_aggregates_result **consumed = raw;
  CHECK(!*consumed && !*owner && input->kind == OWNED_AGGREGATES_TREE_T_KIND_LEAF);
  serial(session, input->cases.leaf.ticket, 42); *out = *input;
  return OWNED_AGGREGATES_OK;
}
static void recursive_callables(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *input_owner = NULL, *out_owner = NULL, *closure_owner = NULL;
  owned_aggregates_ticket_t value = ticket(session, 42, &ticket_owner);
  owned_aggregates_tree_t leaf = { .kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {value} };
  owned_aggregates_tree_t input = {0}, out = {0};
  OK(owned_aggregates_tree_t_copy(session, &leaf, &input, &input_owner));
  owned_aggregates_callback_recursive_argument1_t_host host = { .call = tree_callback, .context = &input_owner };
  OK(owned_aggregates_callback_recursive(session, &input, &input_owner, &host, &out, &out_owner));
  CHECK(!input_owner && out.kind == OWNED_AGGREGATES_TREE_T_KIND_LEAF); serial(session, out.cases.leaf.ticket, 42);
  owned_aggregates_make_recursive_result_t closure = NULL;
  OK(owned_aggregates_make_recursive(session, &out, &out_owner, &closure, &closure_owner));
  CHECK(!out_owner && closure && closure_owner); clear(&ticket_owner);
  value = ticket(session, 99, &ticket_owner); leaf.cases.leaf.ticket = value;
  OK(owned_aggregates_make_recursive_result_t_call(session, closure, true, &leaf, &out, &out_owner));
  CHECK(out.kind == OWNED_AGGREGATES_TREE_T_KIND_LEAF); serial(session, out.cases.leaf.ticket, 42);
  clear(&closure_owner); serial(session, out.cases.leaf.ticket, 42);
  clear(&out_owner); clear(&ticket_owner); OK(owned_aggregates_session_close(&session));
  CHECK(live == 0 && owned_test_identities() == 0);
}
static void whole_owner(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *first_owner = NULL, *second_owner = NULL, *input_owner = NULL, *out_owner = NULL;
  owned_aggregates_ticket_t first = ticket(session, 42, &first_owner), second = ticket(session, 99, &second_owner);
  bundle_input input; bundle_init(&input, first); input.items[1] = second;
  owned_aggregates_bundle_t copied = {0};
  OK(owned_aggregates_bundle_t_copy(session, &input.value, &copied, &input_owner));
  clear(&first_owner); clear(&second_owner);
  owned_aggregates_ticket_t out = NULL;
  OK(owned_aggregates_retain_ticket(session, copied.primary, &input_owner, &out, &out_owner));
  CHECK(!input_owner); serial(session, out, 42);
  mpz_srcptr number = NULL;
  CHECK(owned_aggregates_serial(session, second, &number, &second_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!number && !second_owner); clear(&out_owner); mpz_clear(input.number);
  OK(owned_aggregates_session_close(&session)); CHECK(live == 0 && owned_test_identities() == 0);
}
static void malformed_reply(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *input_owner = NULL, *out_owner = NULL;
  owned_aggregates_ticket_t item = ticket(session, 42, &ticket_owner);
  owned_aggregates_choice_t source = { .kind = OWNED_AGGREGATES_CHOICE_T_KIND_ONE, .cases.one = {item} };
  owned_aggregates_choice_t input = {0}, out, unchanged; memset(&out, 0xa5, sizeof(out)); unchanged = out;
  OK(owned_aggregates_choice_t_copy(session, &source, &input, &input_owner));
  owned_aggregates_result *stale = input_owner;
  CHECK(owned_aggregates_echo_variant(session, &input, &input_owner, &out, &out_owner) == OWNED_AGGREGATES_MALFORMED_RESULT);
  CHECK(!input_owner && !out_owner && !memcmp(&out, &unchanged, sizeof(out)));
  CHECK(owned_aggregates_result_release(&stale) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  mpz_srcptr number = NULL;
  CHECK(owned_aggregates_serial(session, item, &number, &out_owner) == OWNED_AGGREGATES_RUNTIME_UNAVAILABLE);
  CHECK(!number && !out_owner); clear(&ticket_owner); OK(owned_aggregates_session_close(&session));
  CHECK(live == 0 && owned_test_identities() == 0);
}
typedef struct {
  owned_aggregates_session *session;
  owned_aggregates_ticket_t value;
  owned_aggregates_result **owner;
} foreign_call;
static void *wrong_thread(void *raw) {
  foreign_call *call = raw; owned_aggregates_ticket_t out = NULL; owned_aggregates_result *owner = NULL;
  CHECK(owned_aggregates_retain_ticket(call->session, call->value, call->owner,
      &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!out && !owner); return NULL;
}
static void affinity(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *owner = NULL, *out_owner = NULL;
  owned_aggregates_ticket_t value = ticket(session, 42, &owner), out = NULL;
  owned_aggregates_result *original = owner;
  foreign_call call = {session, value, &owner}; pthread_t thread;
  CHECK(!pthread_create(&thread, NULL, wrong_thread, &call)); CHECK(!pthread_join(thread, NULL));
  CHECK(owner == original);
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) {
    owned_aggregates_status status = owned_aggregates_retain_ticket(session, value, &owner, &out, &out_owner);
    _exit(status == OWNED_AGGREGATES_WRONG_PROCESS && owner == original && !out && !out_owner ? 0 : 1);
  }
  int status = 0; CHECK(waitpid(child, &status, 0) == child && WIFEXITED(status) && !WEXITSTATUS(status));
  owned_aggregates_session *stale = session; OK(owned_aggregates_session_close(&session));
  CHECK(owned_aggregates_retain_ticket(stale, value, &owner, &out, &out_owner) == OWNED_AGGREGATES_CLOSED);
  CHECK(owner == original && !out && !out_owner); clear(&owner);
  CHECK(live == 0 && owned_test_identities() == 0);
}
int main(void) {
  if (getenv("LEAN_BRIDGE_OWNED_BAD_REPLY")) { malformed_reply(); puts("{\"badReply\":true}"); return 0; }
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    OK(owned_aggregates_session_close(&session)); puts("{\"cold\":true}"); return 0;
  }
  resource_moves(); empty_and_recursive(); multi_owner_and_faults(); callback_moves(); captured_move();
  closure_move(); remaining_shapes(); recursive_callables(); whole_owner(); affinity();
  printf("{\"checks\":%zu,\"beforeFailures\":%zu,\"afterFailures\":%zu,\"live\":%zu,\"identities\":%zu}\n",
      checks, before_failures, after_failures, live, owned_test_identities());
  return 0;
}
