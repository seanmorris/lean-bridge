/* Included after the independent carrier oracle in one native translation unit. */
#include <sys/wait.h>

static size_t live_allocations, allocation_attempts, fail_at, allocation_failures;
static void *ledger_allocate(size_t size) {
  if (++allocation_attempts == fail_at) return NULL;
  void *value = calloc(1, size); if (value) ++live_allocations; return value;
}
static void ledger_free(void *value) {
  if (value) { CHECK(live_allocations > 0); --live_allocations; free(value); }
}
#define LB_OWNED_ALLOC ledger_allocate
#define LB_OWNED_FREE ledger_free
#include "owned-leases.h"

static const char ticket_kind[] = "resource:Owned.Ticket";
static void clean(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  CHECK(snapshot.live_identities == 0); CHECK(live_allocations == 0);
}
static void test_ledger(void) {
  lean_object *value = ticket(42), *borrowed = NULL;
  lb_owned_context context = {0}, peer = {0};
  lb_owned_scope scope = {0}, other = {0};
  lb_owned_batch batch = {0}, output = {0};
  uint64_t token = 0, duplicate = 0, stale = 0;
  CHECK(lb_owned_context_init(&context, "not-initialized") == LB_OWNED_RUNTIME);
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_INVALID);
  CHECK(lb_owned_context_init(&peer, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&peer, &scope) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_OK);
  CHECK(!lean_is_exclusive(value));
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &duplicate) == LB_OWNED_OK);
  CHECK(token != 0 && token == duplicate && context.live_owners == 1);
  lb_owned_context copied_context = context;
  CHECK(lb_owned_context_close(&copied_context) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_begin(&copied_context, &other) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_borrow(&scope, "wrong nominal type", token, &borrowed) == LB_OWNED_INVALID);
  CHECK(borrowed == NULL);
  CHECK(lb_owned_scope_borrow(&scope, ticket_kind, token, &borrowed) == LB_OWNED_OK);
  CHECK(borrowed == value);
  CHECK(lb_owned_scope_commit(&scope, &batch) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow(&scope, ticket_kind, token, &borrowed) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &batch) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &batch) == LB_OWNED_INVALID);
  CHECK(!lean_is_exclusive(value)); /* The in-flight input pin still owns it. */
  expect_ticket(F_retainTicket(carry(share(borrowed))), value, 42);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, borrowed, &duplicate) == LB_OWNED_OK);
  CHECK(duplicate == token);
  CHECK(lb_owned_scope_commit(&scope, &output) == LB_OWNED_OK);
  lb_owned_batch copied = output;
  CHECK(lb_owned_batch_release(&context, &copied) == LB_OWNED_INVALID);
  CHECK(lb_owned_batch_release(&peer, &output) == LB_OWNED_INVALID);
  CHECK(lb_owned_batch_release(&context, &output) == LB_OWNED_OK);
  CHECK(lean_is_exclusive(value));
  stale = token;
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  borrowed = NULL;
  CHECK(lb_owned_scope_borrow(&scope, ticket_kind, stale, &borrowed) == LB_OWNED_INVALID);
  CHECK(borrowed == NULL);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_OK);
  CHECK(token != stale);
  CHECK(lb_owned_scope_commit(&scope, &batch) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&peer, &other) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow(&other, ticket_kind, token, &borrowed) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_acquire(&other, ticket_kind, value, &duplicate) == LB_OWNED_OK);
  CHECK(duplicate == token); /* One runtime identity, two independent strong owners. */
  CHECK(lb_owned_scope_commit(&other, &output) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &batch) == LB_OWNED_OK);
  CHECK(context.poisoned == 0 && !lean_is_exclusive(value));
  CHECK(lb_owned_batch_release(&peer, &output) == LB_OWNED_OK);
  CHECK(lean_is_exclusive(value));
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &other) == LB_OWNED_OK);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_ORDER);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_ORDER);
  CHECK(lb_owned_scope_acquire(&other, ticket_kind, value, &token) == LB_OWNED_OK);
  CHECK(lb_owned_scope_abort(&other) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit(&scope, NULL) == LB_OWNED_INVALID);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_INVALID);
  CHECK(lean_is_exclusive(value));
  CHECK(lb_owned_context_close(&peer) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_CLOSED);
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_INVALID);
  lean_dec(value); clean();
}

static size_t fault_case(size_t failure) {
  clean(); allocation_attempts = 0; fail_at = failure;
  lb_owned_context context = {0}; lb_owned_scope scope = {0}; lb_owned_batch batch = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  int status = LB_OWNED_OK;
  for (unsigned i = 0; i < 24 && !status; ++i) {
    lean_object *value = ticket(i), *borrowed = NULL;
    uint64_t token = UINT64_MAX, duplicate = 0;
    status = lb_owned_scope_acquire(&scope, ticket_kind, value, &token);
    if (status) CHECK(token == UINT64_MAX);
    if (!status) status = lb_owned_scope_acquire(&scope, ticket_kind, value, &duplicate);
    if (!status) { CHECK(duplicate == token); status = lb_owned_scope_borrow(&scope, ticket_kind, token, &borrowed); }
    if (!status) CHECK(borrowed == value);
    lean_dec(value);
  }
  if (failure) {
    CHECK(status == LB_OWNED_ALLOC_FAILED); ++allocation_failures;
    CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  } else {
    CHECK(status == LB_OWNED_OK);
    CHECK(lb_owned_scope_commit(&scope, &batch) == LB_OWNED_OK);
    CHECK(lb_owned_batch_release(&context, &batch) == LB_OWNED_OK);
  }
  CHECK(context.live_owners == 0 && context.scopes == 0);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  clean(); fail_at = 0; return allocation_attempts;
}

static void test_limits(void) {
  lb_owned_context context = {0}; lb_owned_scope scopes[LB_OWNED_SCOPE_LIMIT + 1] = {{0}};
  lean_object *value = ticket(7); uint64_t token = 0;
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  for (size_t i = 0; i < LB_OWNED_SCOPE_LIMIT; ++i) CHECK(lb_owned_scope_begin(&context, &scopes[i]) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scopes[LB_OWNED_SCOPE_LIMIT]) == LB_OWNED_LIMIT);
  for (size_t i = LB_OWNED_SCOPE_LIMIT; i > 0; --i) CHECK(lb_owned_scope_abort(&scopes[i - 1]) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scopes[0]) == LB_OWNED_OK);
  for (size_t i = 0; i < LB_OWNED_RETAINED_LIMIT; ++i)
    CHECK(lb_owned_scope_acquire(&scopes[0], ticket_kind, value, &token) == LB_OWNED_OK);
  token = UINT64_MAX;
  CHECK(lb_owned_scope_acquire(&scopes[0], ticket_kind, value, &token) == LB_OWNED_LIMIT);
  CHECK(token == UINT64_MAX && context.live_owners == 1);
  CHECK(lb_owned_scope_abort(&scopes[0]) == LB_OWNED_OK);
  CHECK(lean_is_exclusive(value)); lean_dec(value);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static void test_capture_lifetime(void) {
  lb_owned_context context = {0}; lb_owned_scope scope = {0}; lb_owned_batch parent = {0}, child = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  lean_object *item = ticket(42), *aggregate = bundle(item), *value = take(share(aggregate));
  uint64_t parent_token = 0, child_token = 0;
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&scope, "aggregate:Owned.Bundle", value, &parent_token) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit(&scope, &parent) == LB_OWNED_OK);
  lean_dec(value);
  lean_object *closure = F_makeRecord(aggregate);
  CHECK(lb_owned_batch_release(&context, &parent) == LB_OWNED_OK);
  lean_dec(item); /* The closure alone now keeps its captured resources alive. */
  lean_object *supplied = ticket(73);
  aggregate = RECORD_CLOSURE_apply(closure, carry(lean_box(1)), bundle(supplied));
  lean_object *projected = take(F_primary(share(aggregate)));
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, projected, &child_token) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit(&scope, &child) == LB_OWNED_OK);
  lean_dec(aggregate); lean_dec(projected);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_borrow(&scope, ticket_kind, child_token, &value) == LB_OWNED_OK);
  CHECK(lean_is_exclusive(value)); /* One ledger reference, independent of pins. */
  CHECK(lb_owned_batch_release(&context, &child) == LB_OWNED_OK);
  expect_ticket(carry(share(value)), value, 42);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  CHECK(lean_is_exclusive(supplied)); lean_dec(supplied); clean();
}

static void test_broker_capacity(void) {
  uint64_t identities[4096]; unsigned values[4096];
  for (size_t i = 0; i < 4096; ++i) {
    identities[i] = lean_bridge_native_identity_acquire("external-owner", &values[i]);
    CHECK(identities[i] != 0);
  }
  lb_owned_context context = {0}; lb_owned_scope scope = {0};
  lean_object *value = ticket(7); uint64_t token = UINT64_MAX;
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_LIMIT);
  CHECK(token == UINT64_MAX && lean_is_exclusive(value));
  CHECK(live_allocations == 0 && context.live_owners == 0 && scope.retained == 0);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); lean_dec(value);
  for (size_t i = 0; i < 4096; ++i)
    CHECK(lean_bridge_native_identity_release(identities[i], "external-owner", &values[i]) == 1);
  clean();
}

typedef struct { lb_owned_context *context; lb_owned_batch *batch; int status; } affinity_probe;
static void *wrong_thread(void *argument) {
  affinity_probe *probe = argument; lb_owned_scope scope = {0};
  probe->status = lb_owned_scope_begin(probe->context, &scope);
  if (probe->status == LB_OWNED_THREAD) probe->status = lb_owned_batch_release(probe->context, probe->batch);
  return NULL;
}
static void *thread_generation(void *argument) {
  affinity_probe *probe = argument;
  if (!probe->context->initialized) {
    probe->status = lb_owned_context_init(probe->context, COMPONENT_ID);
    return NULL;
  }
  lb_owned_context fresh = {0};
  probe->status = lb_owned_context_init(&fresh, COMPONENT_ID);
  if (probe->status) return NULL;
  /* Force OS identifier reuse regardless of the platform's scheduling policy. */
  probe->context->thread = pthread_self();
  probe->status = lb_owned_ready(probe->context);
  if (fresh.thread_serial == probe->context->thread_serial) probe->status = LB_OWNED_INVALID;
  if (lb_owned_context_close(&fresh) != LB_OWNED_OK) probe->status = LB_OWNED_INVALID;
  return NULL;
}
static void *thread_exhaustion(void *argument) {
  affinity_probe *probe = argument; lb_owned_context context = {0};
  probe->status = lb_owned_context_init(&context, COMPONENT_ID); return NULL;
}
static void test_thread_generations(void) {
  lb_owned_context stale = {0}; affinity_probe probe = { &stale, NULL, -1 }; pthread_t thread;
  CHECK(pthread_create(&thread, NULL, thread_generation, &probe) == 0);
  CHECK(pthread_join(thread, NULL) == 0 && probe.status == LB_OWNED_OK);
  CHECK(pthread_create(&thread, NULL, thread_generation, &probe) == 0);
  CHECK(pthread_join(thread, NULL) == 0 && probe.status == LB_OWNED_THREAD);
  uint64_t saved = atomic_load(&lb_owned_next_thread);
  atomic_store(&lb_owned_next_thread, UINT64_MAX);
  CHECK(pthread_create(&thread, NULL, thread_exhaustion, &probe) == 0);
  CHECK(pthread_join(thread, NULL) == 0 && probe.status == LB_OWNED_LIMIT);
  atomic_store(&lb_owned_next_thread, saved); clean();
}
static void test_affinity_and_close(void) {
  lb_owned_context context = {0}; lb_owned_scope scope = {0}, nested = {0}; lb_owned_batch batch = {0};
  uint64_t token = 0; lean_object *value = ticket(7);
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit(&scope, &batch) == LB_OWNED_OK);
  affinity_probe probe = { &context, &batch, 0 }; pthread_t thread;
  CHECK(pthread_create(&thread, NULL, wrong_thread, &probe) == 0);
  CHECK(pthread_join(thread, NULL) == 0 && probe.status == LB_OWNED_THREAD);
  pid_t child = fork(); CHECK(child >= 0);
  if (child == 0) {
    int status = lb_owned_scope_begin(&context, &scope);
    _exit(status == LB_OWNED_PROCESS && lb_owned_batch_release(&context, &batch) == LB_OWNED_PROCESS ? 0 : 1);
  }
  int status = 0; CHECK(waitpid(child, &status, 0) == child && WIFEXITED(status) && WEXITSTATUS(status) == 0);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &nested) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&nested, ticket_kind, value, &token) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  CHECK(context.initialized && !lean_is_exclusive(value));
  CHECK(lb_owned_scope_commit(&nested, &batch) == LB_OWNED_CLOSED);
  CHECK(lb_owned_scope_abort(&nested) == LB_OWNED_OK);
  CHECK(context.initialized);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(!context.initialized && batch.context == NULL && lean_is_exclusive(value));
  lean_dec(value); clean();
}

static void test_retirement(void) {
  lb_owned_context context = {0}; lb_owned_scope scope = {0}; lb_owned_batch batch = {0};
  lean_object *value = ticket(7); uint64_t token = 0;
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_OK);
  CHECK(lb_owned_scope_commit(&scope, &batch) == LB_OWNED_OK);
  CHECK(lb_owned_scope_begin(&context, &scope) == LB_OWNED_OK);
  CHECK(lb_owned_scope_acquire(&scope, ticket_kind, value, &token) == LB_OWNED_OK);
  lean_bridge_native_runtime_retire();
  CHECK(lb_owned_scope_commit(&scope, &batch) == LB_OWNED_RUNTIME);
  CHECK(lb_owned_scope_abort(&scope) == LB_OWNED_OK);
  CHECK(lb_owned_batch_release(&context, &batch) == LB_OWNED_OK);
  CHECK(lean_is_exclusive(value)); lean_dec(value);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

int main(void) {
  CHECK(lean_bridge_native_component_initialize(COMPONENT_ID, initialize_component));
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { puts("{\"cold\":true}"); return 0; }
  test_ledger(); test_carriers(); test_capture_lifetime(); test_limits(); test_affinity_and_close();
  test_broker_capacity(); test_thread_generations();
  size_t attempts = fault_case(0);
  for (size_t failure = 1; failure <= attempts; ++failure) fault_case(failure);
  CHECK(allocation_failures == attempts);
  test_retirement();
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  printf("{\"checks\":%u,\"exports\":22,\"depth\":128,\"allocationFailures\":%zu,\"liveAllocations\":%zu,\"liveIdentities\":%u}\n",
    checks, allocation_failures, live_allocations, snapshot.live_identities);
  return 0;
}
