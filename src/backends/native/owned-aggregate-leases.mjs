/**
 * Private native acquisition ledger for resource-bearing aggregate conversions.
 * Host projections keep these contexts, scopes and batches out of public values.
 *
 * @file
 */
export const ownedAggregateLeaseSource = `
#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include <pthread.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#ifndef LB_OWNED_ALLOC
#define LB_OWNED_ALLOC(size) calloc(1, (size))
#endif
#ifndef LB_OWNED_FREE
#define LB_OWNED_FREE(pointer) free(pointer)
#endif

enum {
  LB_OWNED_OK = 0, LB_OWNED_INVALID = 1, LB_OWNED_LIMIT = 2,
  LB_OWNED_ALLOC_FAILED = 3, LB_OWNED_CLOSED = 4,
  LB_OWNED_THREAD = 5, LB_OWNED_PROCESS = 6, LB_OWNED_RUNTIME = 7,
  LB_OWNED_ORDER = 8, LB_OWNED_RETAINED_LIMIT = 4096,
  LB_OWNED_SCOPE_LIMIT = 64
};

typedef struct lb_owned_context lb_owned_context;
typedef struct lb_owned_scope lb_owned_scope;
typedef struct lb_owned_batch lb_owned_batch;
typedef struct lb_owned_owner {
  struct lb_owned_owner *next;
  const char *kind;
  lean_object *value;
  uint64_t token;
  size_t references;
} lb_owned_owner;
typedef struct lb_owned_entry {
  struct lb_owned_entry *next;
  lb_owned_owner *owner;
} lb_owned_entry;
struct lb_owned_batch {
  lb_owned_batch *next;
  lb_owned_context *context;
  lb_owned_entry *entries;
};
struct lb_owned_scope {
  lb_owned_context *context;
  lb_owned_scope *parent;
  lb_owned_entry *inputs;
  lb_owned_entry *outputs;
  size_t retained;
};
struct lb_owned_context {
  lb_owned_context *self;
  const char *component;
  pid_t process;
  pthread_t thread;
  uint64_t thread_serial;
  uint64_t runtime;
  uint64_t domain;
  lb_owned_owner *owners;
  lb_owned_batch *batches;
  lb_owned_scope *top;
  size_t live_owners;
  size_t scopes;
  int initialized;
  int closing;
  int poisoned;
};

/* A pthread_t can be reused after exit. Serials never wrap or repeat. */
static _Atomic uint64_t lb_owned_next_thread;
static _Thread_local uint64_t lb_owned_thread_serial;
static int lb_owned_identify_thread(void) {
  if (lb_owned_thread_serial) return LB_OWNED_OK;
  uint64_t previous = atomic_load(&lb_owned_next_thread);
  do {
    if (previous == UINT64_MAX) return LB_OWNED_LIMIT;
  } while (!atomic_compare_exchange_weak(&lb_owned_next_thread, &previous, previous + 1));
  lb_owned_thread_serial = previous + 1;
  return LB_OWNED_OK;
}

/* Context and batch storage belongs to the generated host adapter. Component
   and nominal-kind strings are immutable generated constants. A batch may not
   move while registered. Context close defers until the last active scope ends. */
static int lb_owned_affinity(const lb_owned_context *context) {
  if (!context || !context->initialized) return LB_OWNED_CLOSED;
  if (context->self != context) return LB_OWNED_INVALID;
  /* Check the process before entering a mutex inherited across fork. */
  if (context->process != getpid()) return LB_OWNED_PROCESS;
  if (!pthread_equal(context->thread, pthread_self()) || context->thread_serial != lb_owned_thread_serial)
    return LB_OWNED_THREAD;
  return LB_OWNED_OK;
}
static int lb_owned_ready(const lb_owned_context *context) {
  int status = lb_owned_affinity(context);
  if (status) return status;
  if (context->closing || context->poisoned) return LB_OWNED_CLOSED;
  if (!lean_bridge_native_component_ready(context->component)) return LB_OWNED_RUNTIME;
  lean_bridge_native_snapshot snapshot;
  lean_bridge_native_snapshot_read(&snapshot);
  if (snapshot.runtime_instance_id != context->runtime || snapshot.identity_domain_id != context->domain)
    return LB_OWNED_RUNTIME;
  return LB_OWNED_OK;
}
static int lb_owned_context_init(lb_owned_context *context, const char *component) {
  if (!context || !component || !*component) return LB_OWNED_INVALID;
  /* The caller supplies fresh, zero-initialized storage, never a live context. */
  if (context->self || context->initialized || context->owners || context->batches || context->top)
    return LB_OWNED_INVALID;
  int status = lb_owned_identify_thread();
  if (status) return status;
  if (!lean_bridge_native_component_ready(component)) return LB_OWNED_RUNTIME;
  lean_bridge_native_snapshot snapshot;
  lean_bridge_native_snapshot_read(&snapshot);
  *context = (lb_owned_context){0};
  context->self = context;
  context->component = component; context->process = getpid(); context->thread = pthread_self();
  context->thread_serial = lb_owned_thread_serial;
  context->runtime = snapshot.runtime_instance_id; context->domain = snapshot.identity_domain_id;
  context->initialized = 1;
  return LB_OWNED_OK;
}
static lb_owned_owner *lb_owned_find(lb_owned_context *context, const char *kind, uint64_t token) {
  for (lb_owned_owner *owner = context->owners; owner; owner = owner->next)
    if (owner->token == token && strcmp(owner->kind, kind) == 0) return owner;
  return NULL;
}
static void lb_owned_drop(lb_owned_context *context, lb_owned_owner *owner) {
  if (--owner->references) return;
  lb_owned_owner **position = &context->owners;
  while (*position != owner) position = &(*position)->next;
  *position = owner->next;
  /* Other contexts or adapters can still own the same broker identity. */
  if (lean_bridge_native_identity_release(owner->token, owner->kind, owner->value) < 0)
    context->poisoned = 1;
  lean_dec(owner->value); --context->live_owners; LB_OWNED_FREE(owner);
}
static void lb_owned_drop_entries(lb_owned_context *context, lb_owned_entry *entry) {
  while (entry) {
    lb_owned_entry *next = entry->next;
    lb_owned_drop(context, entry->owner); LB_OWNED_FREE(entry); entry = next;
  }
}
static void lb_owned_finish_close(lb_owned_context *context) {
  if (!context->closing || context->top) return;
  while (context->batches) {
    lb_owned_batch *batch = context->batches;
    context->batches = batch->next;
    lb_owned_drop_entries(context, batch->entries);
    *batch = (lb_owned_batch){0};
  }
  context->initialized = 0;
}
static int lb_owned_context_close(lb_owned_context *context) {
  int status = lb_owned_affinity(context);
  if (status) return status;
  context->closing = 1; lb_owned_finish_close(context);
  return LB_OWNED_OK;
}
static int lb_owned_batch_release(lb_owned_context *context, lb_owned_batch *batch) {
  int status = lb_owned_affinity(context);
  if (status) return status;
  lb_owned_batch **position = &context->batches;
  while (*position && *position != batch) position = &(*position)->next;
  /* Check membership before dereferencing an unregistered or already closed batch. */
  if (!*position) return LB_OWNED_INVALID;
  *position = batch->next;
  lb_owned_drop_entries(context, batch->entries); *batch = (lb_owned_batch){0};
  return context->poisoned ? LB_OWNED_RUNTIME : LB_OWNED_OK;
}
static int lb_owned_scope_begin(lb_owned_context *context, lb_owned_scope *scope) {
  int status = lb_owned_ready(context);
  if (status) return status;
  if (!scope || scope->context || scope->parent || scope->inputs || scope->outputs || scope->retained)
    return LB_OWNED_INVALID;
  for (lb_owned_scope *active = context->top; active; active = active->parent)
    if (scope == active) return LB_OWNED_INVALID;
  if (context->scopes == LB_OWNED_SCOPE_LIMIT) return LB_OWNED_LIMIT;
  *scope = (lb_owned_scope){0}; scope->context = context; scope->parent = context->top;
  context->top = scope; ++context->scopes;
  return LB_OWNED_OK;
}
static int lb_owned_scope_ready(lb_owned_scope *scope) {
  if (!scope || !scope->context) return LB_OWNED_INVALID;
  int status = lb_owned_ready(scope->context);
  if (status) return status;
  return scope->context->top == scope ? LB_OWNED_OK : LB_OWNED_ORDER;
}
static int lb_owned_scope_hold(lb_owned_scope *scope, const char *kind, lean_object *value,
    lb_owned_owner *existing, int input, uint64_t *token) {
  int status = lb_owned_scope_ready(scope);
  if (status) return status;
  if (!kind || !*kind || !value || lean_is_scalar(value) || !token) return LB_OWNED_INVALID;
  lb_owned_context *context = scope->context;
  if (scope->retained == LB_OWNED_RETAINED_LIMIT) return LB_OWNED_LIMIT;
  lb_owned_owner *owner = existing;
  if (!owner) for (lb_owned_owner *item = context->owners; item; item = item->next)
    if (item->value == value && strcmp(item->kind, kind) == 0) { owner = item; break; }
  if (owner && owner->references == SIZE_MAX) return LB_OWNED_LIMIT;
  if (!owner && context->live_owners == LB_OWNED_RETAINED_LIMIT) return LB_OWNED_LIMIT;
  lb_owned_entry *entry = (lb_owned_entry *)LB_OWNED_ALLOC(sizeof(*entry));
  if (!entry) return LB_OWNED_ALLOC_FAILED;
  if (!owner) {
    owner = (lb_owned_owner *)LB_OWNED_ALLOC(sizeof(*owner));
    if (!owner) { LB_OWNED_FREE(entry); return LB_OWNED_ALLOC_FAILED; }
    *owner = (lb_owned_owner){0};
    owner->token = lean_bridge_native_identity_acquire(kind, value);
    if (!owner->token) { LB_OWNED_FREE(owner); LB_OWNED_FREE(entry); return LB_OWNED_LIMIT; }
    owner->kind = kind; owner->value = value; lean_inc(value);
    owner->next = context->owners; context->owners = owner; ++context->live_owners;
  }
  ++owner->references; ++scope->retained; entry->owner = owner;
  lb_owned_entry **head = input ? &scope->inputs : &scope->outputs;
  entry->next = *head; *head = entry; *token = owner->token;
  return LB_OWNED_OK;
}
static int lb_owned_scope_acquire(lb_owned_scope *scope, const char *kind, lean_object *value, uint64_t *token) {
  return lb_owned_scope_hold(scope, kind, value, NULL, 0, token);
}
static int lb_owned_scope_borrow(lb_owned_scope *scope, const char *kind, uint64_t token, lean_object **value) {
  int status = lb_owned_scope_ready(scope);
  if (status) return status;
  if (!kind || !*kind || !token || !value) return LB_OWNED_INVALID;
  lb_owned_owner *owner = lb_owned_find(scope->context, kind, token);
  if (!owner) return LB_OWNED_INVALID;
  uint64_t retained = 0;
  status = lb_owned_scope_hold(scope, kind, owner->value, owner, 1, &retained);
  if (!status) *value = owner->value;
  return status;
}
static int lb_owned_scope_abort(lb_owned_scope *scope) {
  if (!scope || !scope->context) return LB_OWNED_INVALID;
  lb_owned_context *context = scope->context;
  int status = lb_owned_affinity(context);
  if (status) return status;
  if (context->top != scope) return LB_OWNED_ORDER;
  lb_owned_drop_entries(context, scope->outputs); lb_owned_drop_entries(context, scope->inputs);
  context->top = scope->parent; --context->scopes; *scope = (lb_owned_scope){0};
  lb_owned_finish_close(context);
  return context->poisoned ? LB_OWNED_RUNTIME : LB_OWNED_OK;
}
static int lb_owned_scope_commit(lb_owned_scope *scope, lb_owned_batch *batch) {
  int status = lb_owned_scope_ready(scope);
  if (status) return status; /* Caller must abort any failed commit. */
  if (!batch) return LB_OWNED_INVALID;
  lb_owned_context *context = scope->context;
  for (lb_owned_batch *active = context->batches; active; active = active->next)
    if (active == batch) return LB_OWNED_INVALID;
  /* Caller supplies zero-initialized output storage, never another context's batch. */
  if (batch->context || batch->entries || batch->next) return LB_OWNED_INVALID;
  batch->context = context; batch->entries = scope->outputs; batch->next = context->batches;
  context->batches = batch; scope->outputs = NULL;
  return lb_owned_scope_abort(scope);
}
`;
