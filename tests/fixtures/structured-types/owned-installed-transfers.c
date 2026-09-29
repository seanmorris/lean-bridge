/* Installed consumer: public C header and ordinary C/GMP APIs only. */
#include "owned_aggregates.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static size_t checks;
#define CHECK(test) do { ++checks; if (!(test)) { \
  fprintf(stderr, "installed transfer check failed at %d: %s\n", __LINE__, #test); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
static void release(owned_aggregates_result **owner) {
  OK(owned_aggregates_result_release(owner)); CHECK(!*owner);
}
static owned_aggregates_ticket_t ticket(owned_aggregates_session *s,
    unsigned serial, owned_aggregates_result **owner) {
  mpz_t n; mpz_init_set_ui(n, serial); owned_aggregates_ticket_t value = NULL;
  OK(owned_aggregates_new_ticket(s, n,
      (owned_aggregates_scalar_string_t){"key\0name", 8}, &value, owner));
  mpz_clear(n); CHECK(value && *owner); return value;
}
static void serial(owned_aggregates_session *s, owned_aggregates_ticket_t value, unsigned expected) {
  owned_aggregates_result *owner = NULL; mpz_srcptr n = NULL;
  OK(owned_aggregates_serial(s, value, &n, &owner));
  CHECK(mpz_cmp_ui(n, expected) == 0); release(&owner);
}
typedef struct {
  mpz_t n; unsigned char bytes[3]; owned_aggregates_ticket_t items[2];
  owned_aggregates_bundle_spare_t spare;
  owned_aggregates_bundle_peers_t peers;
  owned_aggregates_bundle_history_t history;
  owned_aggregates_payload_t payload;
  owned_aggregates_bundle_t bundle;
} sample;
static void sample_init(sample *v, owned_aggregates_ticket_t value) {
  memset(v, 0, sizeof(*v));
  CHECK(mpz_init_set_str(v->n, "-123456789012345678901234567890123456789", 10) == 0);
  v->bytes[0] = 0; v->bytes[1] = 255; v->bytes[2] = 17;
  v->items[0] = value; v->items[1] = value;
  v->spare = (owned_aggregates_bundle_spare_t){true, value};
  v->peers = (owned_aggregates_bundle_peers_t){v->items, 2};
  v->history = (owned_aggregates_bundle_history_t){v->items, 2};
  v->payload = (owned_aggregates_payload_t){v->n, {v->bytes, 3}};
  v->bundle = (owned_aggregates_bundle_t){value, &v->spare, &v->peers, &v->history, &v->payload};
}
static void bundle_check(const owned_aggregates_bundle_t *v) {
  CHECK(v->spare->has_value && v->spare->value == v->primary);
  CHECK(v->peers->length == 2 && v->peers->data[0] == v->primary);
  CHECK(v->history->length == 2 && v->history->data[1] == v->primary);
  CHECK(v->payload->bytes.length == 3 && v->payload->bytes.data[1] == 255);
  mpz_t n; CHECK(mpz_init_set_str(n, "-123456789012345678901234567890123456789", 10) == 0);
  CHECK(mpz_cmp(v->payload->count, n) == 0); mpz_clear(n);
}

#define ROUNDTRIP(type, copy, move, source, verify) do { \
  type owned = {0}, moved = {0}; \
  owned_aggregates_result *input_owner = NULL, *output_owner = NULL; \
  OK(copy(s, source, &owned, &input_owner)); CHECK(input_owner); \
  owned_aggregates_result *stale = input_owner; \
  OK(move(s, &owned, &input_owner, &moved, &output_owner)); \
  CHECK(!input_owner && output_owner); \
  CHECK(owned_aggregates_result_release(&stale) == OWNED_AGGREGATES_INVALID_ARGUMENT); \
  verify; release(&output_owner); \
} while (0)

static void shapes(void) {
  owned_aggregates_session *s = NULL; OK(owned_aggregates_session_open(&s));
  owned_aggregates_result *owner = NULL;
  owned_aggregates_ticket_t value = ticket(s, 42, &owner); sample v; sample_init(&v, value);
  for (unsigned count = 0; count <= 2; count += 2) {
    owned_aggregates_echo_array_argument0_t array = {v.items, count};
    ROUNDTRIP(owned_aggregates_echo_array_argument0_t, COPY_ARRAY, owned_aggregates_echo_array, &array,
        CHECK(moved.length == count); if (count) CHECK(moved.data[1] == value));
    owned_aggregates_echo_list_argument0_t list = {v.items, count};
    ROUNDTRIP(owned_aggregates_echo_list_argument0_t, COPY_LIST, owned_aggregates_echo_list, &list,
        CHECK(moved.length == count); if (count) CHECK(moved.data[1] == value));
  }
  for (unsigned present = 0; present < 2; ++present) {
    owned_aggregates_echo_option_argument0_t option = {present != 0, value};
    ROUNDTRIP(owned_aggregates_echo_option_argument0_t, COPY_OPTION, owned_aggregates_echo_option, &option,
        CHECK(moved.has_value == (present != 0)); if (present) CHECK(moved.value == value));
    owned_aggregates_echo_result_argument0_t result = {.is_ok = present != 0, .ok = &v.bundle, .error = value};
    ROUNDTRIP(owned_aggregates_echo_result_argument0_t, COPY_RESULT, owned_aggregates_echo_result, &result,
        CHECK(moved.is_ok == result.is_ok); if (present) bundle_check(moved.ok); else CHECK(moved.error == value));
  }
  owned_aggregates_echo_tuple_argument0_snd_t tail = {&v.spare, &v.payload};
  owned_aggregates_echo_tuple_argument0_t tuple = {value, &tail};
  ROUNDTRIP(owned_aggregates_echo_tuple_argument0_t, COPY_TUPLE, owned_aggregates_echo_tuple, &tuple,
      CHECK(moved.fst == value && moved.snd->fst->value == value); CHECK(mpz_cmp(moved.snd->snd->count, v.n) == 0));
  ROUNDTRIP(owned_aggregates_bundle_t, owned_aggregates_bundle_t_copy, owned_aggregates_echo_record, &v.bundle,
      bundle_check(&moved));
  ROUNDTRIP(owned_aggregates_bundle_t, owned_aggregates_bundle_t_copy, owned_aggregates_echo_alias, &v.bundle,
      bundle_check(&moved));
  owned_aggregates_choice_t variants[] = {
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_EMPTY},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_ONE, .cases.one = {value}},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_PAIR, .cases.pair = {value, value}},
    {.kind = OWNED_AGGREGATES_CHOICE_T_KIND_MANY, .cases.many = {&v.peers}}
  };
  for (unsigned i = 0; i < 4; ++i)
    ROUNDTRIP(owned_aggregates_choice_t, owned_aggregates_choice_t_copy, owned_aggregates_echo_variant, &variants[i],
        CHECK(moved.kind == variants[i].kind);
        if (i == 1) CHECK(moved.cases.one.ticket == value);
        if (i == 2) CHECK(moved.cases.pair.first == value && moved.cases.pair.second == value);
        if (i == 3) CHECK(moved.cases.many.tickets->length == 2));
  owned_aggregates_ticket_row_element_t cells[] = {{false, NULL}, {true, value}};
  owned_aggregates_ticket_row_t row = {cells, 2};
  ROUNDTRIP(owned_aggregates_ticket_row_t, COPY_ROW, owned_aggregates_echo_row, &row,
      CHECK(moved.length == 2 && !moved.data[0].has_value && moved.data[1].value == value));
  owned_aggregates_echo_nested_argument0_element_element_value_t results[] = {
    {.is_ok = false, .error = value}, {.is_ok = true, .ok = &v.bundle}
  };
  owned_aggregates_echo_nested_argument0_element_element_t options[] = {{false, NULL}, {true, &results[0]}, {true, &results[1]}};
  owned_aggregates_echo_nested_argument0_element_t lists[] = {{options, 3}, {NULL, 0}};
  owned_aggregates_echo_nested_argument0_t nested = {lists, 2};
  ROUNDTRIP(owned_aggregates_echo_nested_argument0_t, COPY_NESTED, owned_aggregates_echo_nested, &nested,
      CHECK(moved.length == 2 && moved.data[0].length == 3 && moved.data[1].length == 0);
      CHECK(!moved.data[0].data[0].has_value && moved.data[0].data[1].value->error == value);
      bundle_check(moved.data[0].data[2].value->ok));
  owned_aggregates_tree_t trees[40]; owned_aggregates_tree_branch_children_t children[39];
  trees[39] = (owned_aggregates_tree_t){.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {value}};
  for (int i = 38; i >= 0; --i) {
    children[i] = (owned_aggregates_tree_branch_children_t){&trees[i + 1], 1};
    trees[i] = (owned_aggregates_tree_t){.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children[i]}};
  }
  ROUNDTRIP(owned_aggregates_tree_t, owned_aggregates_tree_t_copy, owned_aggregates_echo_recursive, &trees[0],
      const owned_aggregates_tree_t *current = &moved;
      for (unsigned i = 0; i < 39; ++i) {
        CHECK(current->kind == OWNED_AGGREGATES_TREE_T_KIND_BRANCH && current->cases.branch.children->length == 1);
        current = &current->cases.branch.children->data[0];
      }
      CHECK(current->kind == OWNED_AGGREGATES_TREE_T_KIND_LEAF && current->cases.leaf.ticket == value));
  mpz_clear(v.n); release(&owner); OK(owned_aggregates_session_close(&s));
}

static void atomic_moves(void) {
  owned_aggregates_session *s = NULL, *other = NULL;
  OK(owned_aggregates_session_open(&s)); OK(owned_aggregates_session_open(&other));
  owned_aggregates_result *a = NULL, *b = NULL, *independent = NULL, *out_owner = NULL;
  owned_aggregates_ticket_t first = ticket(s, 42, &a), second = ticket(s, 99, &b), retained = NULL, out = NULL;
  OK(owned_aggregates_ticket_t_retain(s, first, &retained, &independent));
  owned_aggregates_result *saved = a, *saved_b = b;
  CHECK(owned_aggregates_retain_ticket(s, first, &b, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(a == saved && b == saved_b && !out && !out_owner);
  CHECK(owned_aggregates_retain_ticket(other, first, &a, &out, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owned_aggregates_retain_ticket(s, first, &a, &out, &a) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(a == saved && !out);
  OK(owned_aggregates_retain_ticket(s, first, &a, &out, &out_owner)); CHECK(!a && out == first);
  CHECK(owned_aggregates_result_release(&saved) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  release(&out_owner); serial(s, retained, 42); release(&independent);
  sample v; sample_init(&v, second);
  owned_aggregates_bundle_t copied = {0}, result = {0};
  OK(owned_aggregates_bundle_t_copy(s, &v.bundle, &copied, &a));
  saved = a; saved_b = b;
  CHECK(owned_aggregates_bundle(s, second, &a, &v.spare, &v.peers, &a, &v.history,
      &v.payload, &result, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(a == saved && !out_owner);
  owned_aggregates_payload_t bad = v.payload; bad.count = NULL;
  CHECK(owned_aggregates_bundle(s, second, &b, &v.spare, &v.peers, &a, &v.history,
      &bad, &result, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(a == saved && b == saved_b && !out_owner);
  OK(owned_aggregates_bundle(s, second, &b, &v.spare, &v.peers, &a, &v.history,
      &v.payload, &result, &out_owner));
  CHECK(!a && !b); bundle_check(&result); serial(s, result.primary, 99); release(&out_owner);
  mpz_clear(v.n); OK(owned_aggregates_session_close(&other)); OK(owned_aggregates_session_close(&s));
}

typedef struct {
  owned_aggregates_result **slot, *stale;
  const owned_aggregates_bundle_t *original;
  unsigned calls, mode;
} callback_state;
static owned_aggregates_status callback(void *raw, owned_aggregates_session *s,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  callback_state *state = raw; ++state->calls; CHECK(!*state->slot);
  CHECK(owned_aggregates_result_release(&state->stale) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  bundle_check(state->original); bundle_check(input);
  if (state->mode == 1) return OWNED_AGGREGATES_CALLBACK_FAILED;
  if (state->mode == 2) { OK(owned_aggregates_session_close(&s)); *out = *input; return OWNED_AGGREGATES_OK; }
  owned_aggregates_bundle_t nested = {0}; owned_aggregates_result *input_owner = NULL;
  OK(owned_aggregates_bundle_t_copy(s, input, &nested, &input_owner));
  OK(owned_aggregates_echo_record(s, &nested, &input_owner, out, owner)); CHECK(!input_owner);
  return OWNED_AGGREGATES_OK;
}
static void callbacks(void) {
  for (unsigned mode = 0; mode < 3; ++mode) {
    owned_aggregates_session *s = NULL; OK(owned_aggregates_session_open(&s));
    owned_aggregates_result *owner = NULL, *input_owner = NULL, *output_owner = NULL;
    sample v; sample_init(&v, ticket(s, 42, &owner));
    owned_aggregates_bundle_t input = {0}, out, unchanged; memset(&out, 0xa5, sizeof(out)); unchanged = out;
    OK(owned_aggregates_bundle_t_copy(s, &v.bundle, &input, &input_owner)); release(&owner);
    callback_state state = {&input_owner, input_owner, &input, 0, mode};
    owned_aggregates_callback_record_argument1_t_host host = {.call = callback, .context = &state};
    owned_aggregates_status status = owned_aggregates_callback_record(s, &input, &input_owner, &host, &out, &output_owner);
    CHECK(!input_owner && state.calls == 1);
    if (!mode) { OK(status); bundle_check(&out); serial(s, out.primary, 42); release(&output_owner); }
    else { CHECK(status == (mode == 1 ? OWNED_AGGREGATES_CALLBACK_FAILED : OWNED_AGGREGATES_CLOSED)); CHECK(!output_owner && !memcmp(&out, &unchanged, sizeof(out))); }
    mpz_clear(v.n); if (mode != 2) OK(owned_aggregates_session_close(&s));
  }
}
static owned_aggregates_status tree_callback(void *raw, owned_aggregates_session *s,
    const owned_aggregates_tree_t *input, owned_aggregates_tree_t *out, owned_aggregates_result **owner) {
  (void)s; (void)owner; CHECK(!*(owned_aggregates_result **)raw); *out = *input; return OWNED_AGGREGATES_OK;
}
static void closures(void) {
  owned_aggregates_session *s = NULL; OK(owned_aggregates_session_open(&s));
  owned_aggregates_result *ticket_owner = NULL, *owner = NULL, *closure_owner = NULL, *out_owner = NULL;
  sample v; sample_init(&v, ticket(s, 42, &ticket_owner));
  owned_aggregates_bundle_t input = {0}, out = {0};
  OK(owned_aggregates_bundle_t_copy(s, &v.bundle, &input, &owner));
  owned_aggregates_make_record_result_t closure = NULL;
  OK(owned_aggregates_make_record(s, &input, &owner, &closure, &closure_owner)); CHECK(!owner);
  OK(owned_aggregates_make_record_result_t_call(s, closure, true, &v.bundle, &out, &out_owner));
  release(&closure_owner); bundle_check(&out); serial(s, out.primary, 42); release(&out_owner);
  owned_aggregates_callback_record_argument1_t original = NULL, moved = NULL, retained = NULL;
  owned_aggregates_result *independent = NULL;
  OK(owned_aggregates_new_record_callback(s, &original, &owner));
  OK(owned_aggregates_callback_record_argument1_t_retain(s, original, &retained, &independent));
  OK(owned_aggregates_transfer_callback(s, original, &owner, &moved, &closure_owner)); CHECK(!owner);
  OK(owned_aggregates_callback_record_argument1_t_call(s, moved, &v.bundle, &out, &out_owner));
  bundle_check(&out); release(&out_owner); release(&closure_owner);
  OK(owned_aggregates_callback_record_argument1_t_call(s, retained, &v.bundle, &out, &out_owner));
  bundle_check(&out); release(&out_owner); release(&independent);
  owned_aggregates_tree_t leaf = {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {v.bundle.primary}}, copied = {0}, result = {0};
  OK(owned_aggregates_tree_t_copy(s, &leaf, &copied, &owner));
  owned_aggregates_callback_recursive_argument1_t_host host = {.call = tree_callback, .context = &owner};
  OK(owned_aggregates_callback_recursive(s, &copied, &owner, &host, &result, &out_owner)); CHECK(!owner);
  owned_aggregates_make_recursive_result_t recursive = NULL;
  OK(owned_aggregates_make_recursive(s, &result, &out_owner, &recursive, &closure_owner)); CHECK(!out_owner);
  OK(owned_aggregates_make_recursive_result_t_call(s, recursive, true, &leaf, &result, &out_owner));
  release(&closure_owner); CHECK(result.kind == OWNED_AGGREGATES_TREE_T_KIND_LEAF);
  serial(s, result.cases.leaf.ticket, 42); release(&out_owner);
  mpz_clear(v.n); release(&ticket_owner); OK(owned_aggregates_session_close(&s));
}

typedef struct {
  owned_aggregates_session *session; owned_aggregates_ticket_t value;
  owned_aggregates_result **owner; int rejected;
} thread_input;
static void *wrong_thread(void *raw) {
  thread_input *v = raw; owned_aggregates_ticket_t out = NULL; owned_aggregates_result *owner = NULL;
  v->rejected = owned_aggregates_retain_ticket(v->session, v->value, v->owner, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT && !out && !owner;
  return NULL;
}
static void invalid_and_affinity(void) {
  owned_aggregates_session *s = NULL; OK(owned_aggregates_session_open(&s));
  owned_aggregates_result *owner = NULL, *tree_owner = NULL, *out_owner = NULL;
  owned_aggregates_ticket_t value = ticket(s, 42, &owner), out = NULL;
  owned_aggregates_result *saved = owner;
  thread_input data = {s, value, &owner, 0}; pthread_t thread;
  CHECK(!pthread_create(&thread, NULL, wrong_thread, &data)); CHECK(!pthread_join(thread, NULL));
  CHECK(data.rejected && owner == saved);
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) _exit(owned_aggregates_retain_ticket(s, value, &owner, &out, &out_owner) == OWNED_AGGREGATES_WRONG_PROCESS && owner == saved && !out && !out_owner ? 0 : 1);
  int status = 0; CHECK(waitpid(child, &status, 0) == child && WIFEXITED(status) && !WEXITSTATUS(status));
  owned_aggregates_tree_t leaf = {.kind = OWNED_AGGREGATES_TREE_T_KIND_LEAF, .cases.leaf = {value}}, copied = {0}, result = {0};
  OK(owned_aggregates_tree_t_copy(s, &leaf, &copied, &tree_owner));
  owned_aggregates_tree_branch_children_t children = {&leaf, 1};
  leaf = (owned_aggregates_tree_t){.kind = OWNED_AGGREGATES_TREE_T_KIND_BRANCH, .cases.branch = {&children}};
  saved = tree_owner;
  CHECK(owned_aggregates_echo_recursive(s, &leaf, &tree_owner, &result, &out_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(tree_owner == saved && !out_owner);
  OK(owned_aggregates_echo_recursive(s, &copied, &tree_owner, &result, &out_owner)); CHECK(!tree_owner);
  serial(s, result.cases.leaf.ticket, 42); release(&out_owner);
  owned_aggregates_session *closed = s; OK(owned_aggregates_session_close(&s)); saved = owner;
  CHECK(owned_aggregates_retain_ticket(closed, value, &owner, &out, &out_owner) == OWNED_AGGREGATES_CLOSED);
  CHECK(owner == saved && !out && !out_owner); release(&owner);
}
int main(void) {
  shapes(); atomic_moves(); callbacks(); closures(); invalid_and_affinity();
  printf("owned-transfers-installed:%zu\n", checks); return 0;
}
