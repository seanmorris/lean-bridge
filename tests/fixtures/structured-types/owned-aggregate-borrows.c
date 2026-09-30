/* Owner-specific lifetime oracle against real Lean values and the shared broker. */
#include "carriers.h"
#include "borrow-bindings.h"
#include "lean_bridge_native_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

static size_t checks, live_allocations, allocations, fail_at;
static void (*before_free_hook)(void);
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "borrow check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
static void *tracked_allocate(size_t bytes) {
  if (++allocations == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live_allocations; return value;
}
static void tracked_free(void *value) {
  if (value) {
    if (before_free_hook) { void (*hook)(void) = before_free_hook; before_free_hook = NULL; hook(); }
    CHECK(live_allocations > 0); --live_allocations; free(value);
  }
}
#define LB_OWNED_ALLOC tracked_allocate
#define LB_OWNED_FREE tracked_free
#include "owned-borrows.h"

static const char kind[] = "resource:Owned.Ticket";
extern lean_object *COMPONENT_INITIALIZER(uint8_t);
static void *initialize_component(uint8_t builtin) { return COMPONENT_INITIALIZER(builtin); }
static lean_object *share(lean_object *value) { lean_inc(value); return value; }
static lean_object *carry(lean_object *value) { return lean_array_push(lean_alloc_array(0, 0), value); }
static lean_object *take(lean_object *value) {
  CHECK(lean_is_array(value) && lean_array_size(value) == 1);
  lean_object *child = share(lean_array_get_core(value, 0)); lean_dec(value); return child;
}
static lean_object *ticket(unsigned value) {
  return take(F_NEW(carry(lean_unsigned_to_nat(value)), carry(lean_mk_string("borrow"))));
}
static void expect(lean_object *value, unsigned expected) {
  lean_object *number = take(F_SERIAL(carry(share(value))));
  CHECK(lean_nat_eq(number, lean_unsigned_to_nat(expected))); lean_dec(number);
}
static void clean(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  CHECK(snapshot.live_identities == 0); CHECK(live_allocations == 0);
}
static uint64_t seed(lb_owned_context *context, lb_owned_batch *batch,
    lean_object *value, lb_owned_batch *anchor) {
  lb_owned_scope scope = {0}; uint64_t token = 0;
  CHECK(lb_owned_scope_begin(context, &scope) == LB_OWNED_OK);
  if (value) CHECK(lb_owned_scope_acquire(&scope, kind, value, &token) == LB_OWNED_OK);
  CHECK((anchor ? lb_owned_scope_commit_borrow(&scope, batch, anchor, anchor->generation)
    : lb_owned_scope_commit(&scope, batch)) == LB_OWNED_OK);
  CHECK(batch->generation != 0); return token;
}

static void test_owner_identity(void) {
  lb_owned_context context = {0};
  lb_owned_batch root = {0}, child = {0}, descendant = {0}, sibling = {0}, retained = {0};
  lb_owned_scope scope = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *first = ticket(42), *second = ticket(73), *third = ticket(91);
  uint64_t first_token = seed(&context, &root, first, NULL), root_generation = root.generation;
  uint64_t second_token = seed(&context, &child, second, &root);
  uint64_t third_token = seed(&context, &descendant, third, &child);
  CHECK(seed(&context, &sibling, second, &root) == second_token);
  CHECK(root.children == &sibling && sibling.sibling == &child && child.previous_sibling == &sibling);
  CHECK(descendant.parent == &child && descendant.depth == 2);
  lean_dec(first); lean_dec(second); lean_dec(third);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  lean_object *borrowed = NULL;
  CHECK(lb_owned_scope_borrow_anchored(&scope, &child, child.generation, kind, second_token, &borrowed) == LB_OWNED_OK);
  expect(borrowed, 73); uint64_t retained_token = 0;
  CHECK(lb_owned_scope_acquire(&scope, kind, borrowed, &retained_token) == LB_OWNED_OK);
  CHECK(retained_token == second_token);
  CHECK(lb_owned_scope_commit(&scope, &retained) == LB_OWNED_OK);
  CHECK(retained.parent == NULL && !retained.borrowed);
  size_t before = allocations; fail_at = before + 1;
  CHECK(lb_owned_batch_release(&context, &child) == LB_OWNED_OK);
  CHECK(allocations == before); fail_at = 0;
  CHECK(descendant.expired && !descendant.entries && !descendant.parent);
  CHECK(!sibling.expired && sibling.parent == &root && root.children == &sibling);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  borrowed = (lean_object *)(uintptr_t)1;
  CHECK(lb_owned_scope_borrow_anchored(&scope, &descendant, descendant.generation, kind, third_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(borrowed == (lean_object *)(uintptr_t)1);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &sibling, sibling.generation, kind, second_token, &borrowed) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &root, root_generation, kind, second_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &sibling, sibling.generation, "other", second_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &sibling, sibling.generation, NULL, second_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &sibling, sibling.generation, kind, 0, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &sibling, sibling.generation, kind, second_token, NULL) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, (lb_owned_batch *)(uintptr_t)1, 1, kind, second_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &root) == LB_OWNED_OK);
  CHECK(sibling.expired && !sibling.entries && context.live_owners == 1);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &sibling, sibling.generation, kind, second_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &retained, retained.generation, kind, second_token, &borrowed) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow(&scope, kind, second_token, &borrowed) == LB_OWNED_OK);
  expect(borrowed, 73);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  /* Reusing the original owner's address must not revive any old view. */
  CHECK(seed(&context, &root, borrowed, NULL) == second_token);
  CHECK(root.generation > root_generation);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &root, root_generation, kind, second_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &root, root.generation, kind, first_token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &root, root.generation, kind, second_token, &borrowed) == LB_OWNED_OK);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &root) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &descendant) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &sibling) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &retained) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static void test_reentry_and_transfer(void) {
  lb_owned_context context = {0}; lb_owned_batch root = {0}, child = {0}, descendant = {0}, output = {0};
  lb_owned_scope outer = {0}, nested = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *value = ticket(55), *borrowed = NULL;
  uint64_t token = seed(&context, &root, value, NULL);
  seed(&context, &child, value, &root); seed(&context, &descendant, value, &child); lean_dec(value);
  CHECK(lb_owned_scope_begin(&context, &outer) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow_anchored(&outer, &descendant, descendant.generation, kind, token, &borrowed) == LB_OWNED_OK);
  CHECK(outer.inputs && !outer.outputs);
  lb_owned_batch *bad[] = {&root, &child};
  CHECK(lb_owned_scope_transfer_many(&outer, bad, 2) == LB_OWNED_INVALID);
  CHECK(root.entries && child.entries && !child.expired);
  CHECK(lb_owned_scope_transfer_borrow(&outer, &child, kind, token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_begin(&context, &nested) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow_anchored(&outer, &child, child.generation, kind, token, &borrowed) == LB_OWNED_ORDER);
  lb_owned_batch *inputs[] = {&root}; size_t before = allocations; fail_at = before + 1;
  CHECK(lb_owned_scope_transfer_many(&nested, inputs, 1) == LB_OWNED_OK);
  CHECK(allocations == before); fail_at = 0;
  CHECK(nested.retained == 3);
  size_t input_count = 0;
  for (lb_owned_entry *entry = nested.inputs; entry; entry = entry->next) ++input_count;
  CHECK(input_count == 3);
  CHECK(!root.context && child.expired && descendant.expired);
  CHECK(lb_owned_scope_borrow_anchored(&nested, &descendant, descendant.generation, kind, token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_abort(&nested) == LB_OWNED_OK);
  /* The outer call's argument remains live, but cannot publish a view of the
     now-consumed owner. Its failed commit leaves cleanup to the active scope. */
  expect(borrowed, 55);
  uint64_t same = 0; CHECK(lb_owned_scope_acquire(&outer, kind, borrowed, &same) == LB_OWNED_OK);
  CHECK(same == token);
  CHECK(lb_owned_scope_commit_borrow(&outer, &output, &descendant, descendant.generation) == LB_OWNED_INVALID);
  CHECK(!output.context && !output.generation && outer.context == &context);
  CHECK(lb_owned_scope_abort(&outer) == LB_OWNED_OK);
  CHECK(context.live_owners == 0);
  CHECK(lb_owned_batch_release(&context, &child) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &descendant) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static void test_empty_depth_and_foreign(void) {
  lb_owned_context context = {0}, peer = {0};
  lb_owned_batch chain[LB_OWNED_BORROW_DEPTH + 1] = {0}, failed = {0}, foreign = {0};
  lb_owned_scope scope = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_context_init(&peer, COMPONENT_ID) == LB_OWNED_OK);
  seed(&context, &chain[0], NULL, NULL); seed(&peer, &foreign, NULL, NULL);
  for (size_t i = 1; i <= LB_OWNED_BORROW_DEPTH; ++i) {
    seed(&context, &chain[i], NULL, &chain[i - 1]); CHECK(chain[i].depth == i);
  }
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit_borrow(&scope, &failed, &chain[LB_OWNED_BORROW_DEPTH], chain[LB_OWNED_BORROW_DEPTH].generation) == LB_OWNED_LIMIT);
  CHECK(lb_owned_scope_commit_borrow(&scope, &failed, &foreign, foreign.generation) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_commit_borrow(&scope, &failed, NULL, 0) == LB_OWNED_INVALID);
  lb_owned_batch copied = chain[0];
  CHECK(lb_owned_scope_commit_borrow(&scope, &failed, &copied, copied.generation) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_commit_borrow(&scope, &failed, &chain[0], 0) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  size_t before = allocations; fail_at = before + 1;
  CHECK(lb_owned_batch_release(&context, &chain[0]) == LB_OWNED_OK);
  CHECK(allocations == before); fail_at = 0;
  for (size_t i = 1; i <= LB_OWNED_BORROW_DEPTH; ++i) {
    CHECK(chain[i].expired && !chain[i].parent && !chain[i].children);
    CHECK(lb_owned_batch_release(&context, &chain[i]) == LB_OWNED_OK);
  }
  /* Address reuse across a whole context reinitialization also stays stale. */
  seed(&context, &chain[0], NULL, NULL); uint64_t old = chain[0].generation;
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  context = (lb_owned_context){0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  seed(&context, &chain[0], NULL, NULL); CHECK(chain[0].generation > old);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit_borrow(&scope, &failed, &chain[0], old) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&peer) == LB_OWNED_OK); clean();
}

static void test_allocation_failures(void) {
  for (size_t failure = 1; failure <= 2; ++failure) {
    lb_owned_context context = {0}; lb_owned_batch root = {0}, output = {0}; lb_owned_scope scope = {0};
    CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
    lean_object *first = ticket(32), *second = ticket(64), *borrowed = NULL;
    uint64_t token = seed(&context, &root, first, NULL); lean_dec(first);
    CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
    uint64_t other = 0; fail_at = allocations + failure;
    CHECK(lb_owned_scope_acquire(&scope, kind, second, &other) == LB_OWNED_ALLOC_FAILED);
    CHECK(!other && !scope.outputs && context.live_owners == 1);
    fail_at = 0; lean_dec(second);
    CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
    CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
    fail_at = allocations + 1;
    CHECK(lb_owned_scope_borrow_anchored(&scope, &root, root.generation, kind, token, &borrowed) == LB_OWNED_ALLOC_FAILED);
    CHECK(!borrowed && !scope.inputs && scope.retained == 0); fail_at = 0;
    CHECK(lb_owned_scope_borrow_anchored(&scope, &root, root.generation, kind, token, &borrowed) == LB_OWNED_OK);
    expect(borrowed, 32);
    CHECK(lb_owned_scope_acquire(&scope, kind, borrowed, &other) == LB_OWNED_OK);
    size_t before = allocations; fail_at = before + 1;
    CHECK(lb_owned_scope_commit_borrow(&scope, &output, &root, root.generation) == LB_OWNED_OK);
    CHECK(allocations == before); fail_at = 0;
    CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
  }
}

static void test_transfer_tree_limit(void) {
  lb_owned_context context = {0}; lb_owned_batch root = {0}, child = {0}; lb_owned_scope scope = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *value = ticket(17); uint64_t token = seed(&context, &root, value, NULL);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  for (size_t i = 0; i < LB_OWNED_RETAINED_LIMIT; ++i)
    CHECK(lb_owned_scope_acquire(&scope, kind, value, &token) == LB_OWNED_OK);
  lean_dec(value);
  CHECK(lb_owned_scope_commit_borrow(&scope, &child, &root, root.generation) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  lb_owned_batch *inputs[] = {&root};
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 1) == LB_OWNED_LIMIT);
  CHECK(root.context == &context && root.children == &child && child.parent == &root);
  CHECK(!child.expired && child.entries && !scope.inputs && scope.retained == 0);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static lb_owned_context *reentry_context;
static lb_owned_batch *reentry_child;
static uint64_t reentry_token;
static size_t reentry_checks;
static void disposal_reentry(void) {
  lb_owned_scope scope = {0}; lean_object *value = NULL;
  ++reentry_checks;
  CHECK(!reentry_child->expired); /* This sibling still awaits its cleanup. */
  CHECK(lb_owned_scope_begin(reentry_context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow_anchored(&scope, reentry_child, reentry_child->generation,
    kind, reentry_token, &value) == LB_OWNED_INVALID);
  CHECK(!value && !scope.inputs);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
}
static void test_disposal_reentry(void) {
  lb_owned_context context = {0}; lb_owned_batch root = {0}, first = {0}, second = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *a = ticket(41), *b = ticket(61), *c = ticket(81);
  seed(&context, &root, a, NULL);
  reentry_token = seed(&context, &first, b, &root);
  seed(&context, &second, c, &root);
  lean_dec(a); lean_dec(b); lean_dec(c);
  reentry_context = &context; reentry_child = &first; before_free_hook = disposal_reentry;
  CHECK(lb_owned_batch_release(&context, &root) == LB_OWNED_OK);
  CHECK(reentry_checks == 1 && !before_free_hook);
  CHECK(first.expired && second.expired && context.live_owners == 0);
  CHECK(lb_owned_batch_release(&context, &first) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &second) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

typedef struct { lb_owned_scope *scope; lb_owned_batch *batch; uint64_t token; int status; } thread_call;
static void *wrong_thread(void *raw) {
  thread_call *call = raw; lean_object *value = NULL;
  call->status = lb_owned_scope_borrow_anchored(call->scope, call->batch, call->batch->generation, kind, call->token, &value);
  return NULL;
}
static void test_affinity_and_close(void) {
  lb_owned_context context = {0}; lb_owned_batch root = {0}, child = {0}; lb_owned_scope scope = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *value = ticket(81), *borrowed = NULL;
  uint64_t token = seed(&context, &root, value, NULL); seed(&context, &child, value, &root); lean_dec(value);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  thread_call call = {&scope, &child, token, -1}; pthread_t thread;
  CHECK(pthread_create(&thread, NULL, wrong_thread, &call) == 0);
  CHECK(pthread_join(thread, NULL) == 0); CHECK(call.status == LB_OWNED_THREAD);
  pid_t process = fork(); CHECK(process >= 0);
  if (!process) {
    int status = lb_owned_scope_borrow_anchored(&scope, &child, child.generation, kind, token, &borrowed);
    _exit(status == LB_OWNED_PROCESS ? 0 : 1);
  }
  int result; CHECK(waitpid(process, &result, 0) == process);
  CHECK(WIFEXITED(result) && WEXITSTATUS(result) == 0);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &child, child.generation, kind, token, &borrowed) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow_anchored(&scope, &child, child.generation, kind, token, &borrowed) == LB_OWNED_CLOSED);
  expect(borrowed, 81);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(!root.context && !child.context); clean();
}

static void test_generation_exhaustion(void) {
  lb_owned_context context = {0}; lb_owned_scope scope = {0}; lb_owned_batch root = {0}, failed = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  seed(&context, &root, NULL, NULL);
  atomic_store(&lb_owned_next_batch_generation, UINT64_MAX);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit_borrow(&scope, &failed, &root, root.generation) == LB_OWNED_LIMIT);
  CHECK(!failed.context && !failed.generation && !root.children);
  CHECK(lb_owned_scope_commit(&scope, &failed) == LB_OWNED_LIMIT);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

int main(void) {
  CHECK(lean_bridge_native_component_initialize(COMPONENT_ID, initialize_component));
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { puts("{\"cold\":true}"); return 0; }
  test_owner_identity(); test_reentry_and_transfer(); test_empty_depth_and_foreign();
  test_allocation_failures(); test_transfer_tree_limit(); test_disposal_reentry();
  test_affinity_and_close(); test_generation_exhaustion();
  printf("{\"checks\":%zu,\"liveAllocations\":%zu,\"allocations\":%zu}\n", checks, live_allocations, allocations);
  return 0;
}
