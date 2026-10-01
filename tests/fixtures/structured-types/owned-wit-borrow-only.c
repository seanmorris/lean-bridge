/* Empty results retain lifetime anchors without any consuming declaration. */
#include "owned_aggregates.h"
#include "borrow-copies.h"
#include <stdio.h>
#include <stdlib.h>

static size_t checks, live, attempts, fail_at, failures;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "borrow C check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
#define OK(call) CHECK((call) == OWNED_AGGREGATES_OK)
void *owned_test_allocate(size_t bytes) {
  if (++attempts == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live; return value;
}
void owned_test_free(void *value) { if (value) { CHECK(live > 0); --live; free(value); } }
extern size_t owned_test_identities(void);
static void clean(void) { CHECK(live == 0 && owned_test_identities() == 0); }
static void clear(owned_aggregates_result **owner) { OK(owned_aggregates_result_release(owner)); CHECK(!*owner); }

#define EMPTY(Type, Copy, Call, Verify) do { \
  Type input = {0}, source = {0}, view = {0}, nested = {0}, independent = {0}, out = {0}; \
  owned_aggregates_result *root = NULL, *borrowed = NULL, *descendant = NULL, *kept = NULL, *output = NULL; \
  OK(Copy(session, &input, &source, &root)); \
  OK(Call(session, &source, root, &view, &borrowed)); \
  OK(Call(session, &view, borrowed, &nested, &descendant)); Verify; \
  OK(Copy(session, &nested, &independent, &kept)); \
  OK(owned_aggregates_result_validate(session, borrowed)); clear(&root); \
  CHECK(owned_aggregates_result_validate(session, borrowed) == OWNED_AGGREGATES_CLOSED); \
  CHECK(owned_aggregates_result_validate(session, descendant) == OWNED_AGGREGATES_CLOSED); \
  CHECK(Call(session, &view, borrowed, &out, &output) == OWNED_AGGREGATES_CLOSED && !output); \
  OK(owned_aggregates_result_validate(session, kept)); \
  clear(&borrowed); clear(&descendant); clear(&kept); \
} while (0)

int main(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    OK(owned_aggregates_session_close(&session)); clean(); puts("{\"cold\":true}"); return 0;
  }
  for (unsigned i = 0; i < 16; ++i) {
    EMPTY(owned_aggregates_echo_array_result_t, COPY_ARRAY, owned_aggregates_echo_array, CHECK(view.length == 0));
    EMPTY(owned_aggregates_echo_list_result_t, COPY_LIST, owned_aggregates_echo_list, CHECK(view.length == 0));
    EMPTY(owned_aggregates_echo_option_result_t, COPY_OPTION, owned_aggregates_echo_option, CHECK(!view.has_value));
    EMPTY(owned_aggregates_echo_nested_result_t, COPY_NESTED, owned_aggregates_echo_nested, CHECK(view.length == 0));
  }
  owned_aggregates_echo_array_result_t chain[129] = {{0}}, empty = {0}, rejected = {0};
  owned_aggregates_result *owners[129] = {0}, *rejected_owner = NULL;
  OK(COPY_ARRAY(session, &empty, &chain[0], &owners[0]));
  for (size_t depth = 1; depth <= 128; ++depth) {
    OK(owned_aggregates_echo_array(session, &chain[depth - 1], owners[depth - 1], &chain[depth], &owners[depth]));
    CHECK(!chain[depth].length); OK(owned_aggregates_result_validate(session, owners[depth]));
  }
  CHECK(owned_aggregates_echo_array(session, &chain[128], owners[128], &rejected, &rejected_owner) == OWNED_AGGREGATES_LIMIT);
  CHECK(!rejected_owner); OK(owned_aggregates_result_validate(session, owners[128]));
  clear(&owners[0]);
  for (size_t depth = 128; depth; --depth) {
    CHECK(owned_aggregates_result_validate(session, owners[depth]) == OWNED_AGGREGATES_CLOSED);
    clear(&owners[depth]);
  }
  int complete = 0;
  for (size_t offset = 1; offset < 200 && !complete; ++offset) {
    owned_aggregates_echo_array_result_t input = {0}, source = {0}, out = {0};
    owned_aggregates_result *root = NULL, *owner = NULL;
    OK(COPY_ARRAY(session, &input, &source, &root));
    size_t baseline = live; fail_at = attempts + offset;
    owned_aggregates_status status = owned_aggregates_echo_array(session, &source, root, &out, &owner);
    fail_at = 0;
    if (!status) { complete = 1; CHECK(!out.length); clear(&owner); }
    else { ++failures; CHECK(status == OWNED_AGGREGATES_ALLOCATION_FAILED && !owner && live == baseline); }
    OK(owned_aggregates_result_validate(session, root)); clear(&root);
  }
  CHECK(complete && failures > 0); OK(owned_aggregates_session_close(&session)); clean();
  printf("{\"checks\":%zu,\"live\":%zu,\"identities\":%zu,\"failures\":%zu,\"emptyShapes\":4,\"maximumBorrowDepth\":128}\n",
    checks, live, owned_test_identities(), failures);
  return 0;
}
