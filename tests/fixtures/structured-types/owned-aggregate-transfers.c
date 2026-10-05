/* Independent ownership oracle using freshly compiled Lean resource exports. */
#include "carriers.h"
#include "transfer-bindings.h"
#include "lean_bridge_native_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

static size_t checks, live_allocations, allocations, fail_at;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "transfer check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
static void *tracked_allocate(size_t bytes) {
  if (++allocations == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live_allocations; return value;
}
static void tracked_free(void *value) {
  if (value) { CHECK(live_allocations > 0); --live_allocations; free(value); }
}
#define LB_OWNED_ALLOC tracked_allocate
#define LB_OWNED_FREE tracked_free
#include "owned-transfers.h"

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
  return take(F_NEW(carry(lean_unsigned_to_nat(value)), carry(lean_mk_string("move"))));
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
    lean_object *value, size_t references) {
  lb_owned_scope scope = {0}; uint64_t token = 0;
  CHECK(lb_owned_scope_begin(context, &scope) == LB_OWNED_OK);
  for (size_t i = 0; i < references; ++i)
    CHECK(lb_owned_scope_acquire(&scope, kind, value, &token) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit(&scope, batch) == LB_OWNED_OK);
  return token;
}
static int empty(const lb_owned_batch *batch) {
  return !batch->context && !batch->entries && !batch->next;
}

static void test_atomicity(void) {
  lb_owned_context context = {0}, peer = {0};
  lb_owned_batch a = {0}, b = {0}, retained = {0}, foreign = {0}, output = {0};
  lb_owned_scope scope = {0}, nested = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_context_init(&peer, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *first = ticket(42), *second = ticket(73), *borrowed = NULL;
  uint64_t ta = seed(&context, &a, first, 2), tb = seed(&context, &b, second, 1);
  CHECK(seed(&context, &retained, first, 1) == ta);
  seed(&peer, &foreign, second, 1);
  lean_dec(first); lean_dec(second);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  size_t conversion_allocations = allocations; fail_at = allocations + 1;
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, kind, ta, &borrowed) == LB_OWNED_OK);
  CHECK(borrowed == first && !scope.inputs && scope.retained == 0);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &b, kind, ta, &borrowed) == LB_OWNED_INVALID);
  CHECK(borrowed == first);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, "other-resource", ta, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, kind, 0, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &foreign, kind, tb, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, NULL, kind, ta, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, NULL, ta, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, "", ta, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, kind, ta, NULL) == LB_OWNED_INVALID);
  CHECK(allocations == conversion_allocations); fail_at = 0;
  CHECK(lb_owned_scope_borrow(&scope, kind, ta, &borrowed) == LB_OWNED_OK);
  CHECK(borrowed == first);
  lb_owned_batch before_a = a, before_b = b, copied = b;
  CHECK(lb_owned_scope_transfer_borrow(&scope, &copied, kind, tb, &borrowed) == LB_OWNED_INVALID);
  lb_owned_batch *duplicates[] = {&a, &a}, *stale[] = {&a, &copied};
  lb_owned_batch *outside[] = {&a, &foreign}, *missing[] = {&a, NULL};
  CHECK(lb_owned_scope_transfer_many(&scope, duplicates, 2) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_many(&scope, stale, 2) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_many(&scope, outside, 2) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_many(&scope, missing, 2) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_many(&scope, NULL, 1) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_many(&scope, NULL, LB_OWNED_RETAINED_LIMIT + 1) == LB_OWNED_LIMIT);
  CHECK(lb_owned_scope_transfer_many(&scope, NULL, 0) == LB_OWNED_OK);
  CHECK(memcmp(&a, &before_a, sizeof(a)) == 0 && memcmp(&b, &before_b, sizeof(b)) == 0);
  CHECK(lb_owned_scope_begin(&context, &nested) == LB_OWNED_OK);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, kind, ta, &borrowed) == LB_OWNED_ORDER);
  lb_owned_batch *inputs[] = {&a, &b};
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 2) == LB_OWNED_ORDER);
  CHECK(lb_owned_scope_abort(&nested) == LB_OWNED_OK);
  size_t before = allocations; fail_at = allocations + 1;
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 2) == LB_OWNED_OK);
  CHECK(allocations == before); fail_at = 0;
  CHECK(empty(&a) && empty(&b)); CHECK(scope.retained == 4);
  CHECK(!empty(&retained) && !empty(&foreign));
  CHECK(lb_owned_batch_release(&context, &a) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 2) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, kind, ta, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &retained, kind, ta, &borrowed) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow(&scope, kind, tb, &borrowed) == LB_OWNED_OK);
  expect(first, 42); expect(borrowed, 73);
  lean_object *returned = take(F_RETAIN(carry(share(first))));
  CHECK(returned == first); uint64_t output_token = 0;
  CHECK(lb_owned_scope_acquire(&scope, kind, returned, &output_token) == LB_OWNED_OK);
  CHECK(output_token == ta); lean_dec(returned);
  CHECK(lb_owned_scope_commit(&scope, &output) == LB_OWNED_OK);
  CHECK(empty(&a) && empty(&b));
  CHECK(lb_owned_batch_release(&peer, &foreign) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&peer) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &retained) == LB_OWNED_OK);
  CHECK(context.live_owners == 1); expect(first, 42);
  CHECK(lb_owned_batch_release(&context, &output) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static void test_failure_and_limits(void) {
  lb_owned_context context = {0}; lb_owned_batch a = {0}, b = {0}, none = {0};
  lb_owned_scope scope = {0}; lean_object *value = ticket(19), *borrowed = NULL;
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  uint64_t token = seed(&context, &a, value, LB_OWNED_RETAINED_LIMIT);
  lean_dec(value); CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow(&scope, kind, token, &borrowed) == LB_OWNED_OK);
  lb_owned_batch *inputs[] = {&a};
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 1) == LB_OWNED_LIMIT);
  CHECK(!empty(&a)); CHECK(scope.retained == 1);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK); expect(borrowed, 19);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &a, kind, token, &borrowed) == LB_OWNED_OK);
  expect(borrowed, 19); CHECK(scope.retained == 0 && !scope.inputs);
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 1) == LB_OWNED_OK);
  CHECK(scope.retained == LB_OWNED_RETAINED_LIMIT); CHECK(empty(&a));
  /* A failure after the call boundary still consumes its transferred input. */
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(context.live_owners == 0); clean();
  value = ticket(29); token = seed(&context, &a, value, 2048);
  seed(&context, &b, value, 2049); lean_dec(value);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  lb_owned_batch *combined[] = {&a, &b};
  CHECK(lb_owned_scope_transfer_many(&scope, combined, 2) == LB_OWNED_LIMIT);
  CHECK(!empty(&a) && !empty(&b) && !scope.inputs && scope.retained == 0);
  CHECK(lb_owned_scope_borrow(&scope, kind, token, &borrowed) == LB_OWNED_OK); expect(borrowed, 29);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &a) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &b) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit(&scope, &none) == LB_OWNED_OK);
  CHECK(!empty(&none) && !none.entries);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  lb_owned_batch *zero[] = {&none};
  CHECK(lb_owned_scope_transfer_many(&scope, zero, 1) == LB_OWNED_OK);
  CHECK(empty(&none) && !scope.inputs && scope.retained == 0);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

typedef struct {
  lb_owned_scope *scope; lb_owned_batch *batch; uint64_t token;
  int status, borrow_status;
} thread_call;
static void *wrong_thread(void *raw) {
  thread_call *call = raw;
  call->status = lb_owned_scope_transfer_many(call->scope, &call->batch, 1);
  lean_object *borrowed = NULL;
  call->borrow_status = lb_owned_scope_transfer_borrow(call->scope, call->batch, kind, call->token, &borrowed);
  return NULL;
}
static void test_affinity_and_close(void) {
  lb_owned_context context = {0}; lb_owned_scope scope = {0}; lb_owned_batch batch = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *value = ticket(91); uint64_t token = seed(&context, &batch, value, 1); lean_dec(value);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  thread_call call = {&scope, &batch, token, -1, -1}; pthread_t thread;
  CHECK(pthread_create(&thread, NULL, wrong_thread, &call) == 0);
  CHECK(pthread_join(thread, NULL) == 0); CHECK(call.status == LB_OWNED_THREAD);
  CHECK(call.borrow_status == LB_OWNED_THREAD);
  uint64_t serial = context.thread_serial; context.thread_serial = serial + 1;
  lb_owned_batch *inputs[] = {&batch};
  lean_object *borrowed = NULL;
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 1) == LB_OWNED_THREAD);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &batch, kind, token, &borrowed) == LB_OWNED_THREAD);
  context.thread_serial = serial;
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) {
    int status = lb_owned_scope_transfer_many(&scope, inputs, 1);
    int borrow_status = lb_owned_scope_transfer_borrow(&scope, &batch, kind, token, &borrowed);
    _exit(status == LB_OWNED_PROCESS && borrow_status == LB_OWNED_PROCESS && !empty(&batch) ? 0 : 1);
  }
  int result; CHECK(waitpid(child, &result, 0) == child);
  CHECK(WIFEXITED(result) && WEXITSTATUS(result) == 0);
  CHECK(!empty(&batch)); expect(value, 91);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  CHECK(lb_owned_scope_transfer_many(&scope, inputs, 1) == LB_OWNED_CLOSED);
  CHECK(lb_owned_scope_transfer_borrow(&scope, &batch, kind, token, &borrowed) == LB_OWNED_CLOSED);
  CHECK(!empty(&batch));
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(empty(&batch)); clean();
}

int main(void) {
  CHECK(lean_bridge_native_component_initialize(COMPONENT_ID, initialize_component));
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { puts("{\"cold\":true}"); return 0; }
  test_atomicity(); test_failure_and_limits(); test_affinity_and_close();
  printf("{\"checks\":%zu,\"liveAllocations\":%zu,\"allocations\":%zu}\n", checks, live_allocations, allocations);
  return 0;
}
