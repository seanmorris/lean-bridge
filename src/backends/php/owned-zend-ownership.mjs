/**
 * Zend resources own native result leases or expiring callback borrow scopes.
 *
 * @file
 */

/**
 * Emit context-affine identity storage without exposing native tokens to PHP.
 * The containing extension supplies lgo_initialize and calls lgo_shutdown from
 * RSHUTDOWN. Native codec declarations precede this source.
 *
 * @param model - Finite wasm32 ownership model and nominal identity kinds.
 */
export const ownedZendOwnershipSource = model => {
	const transfers = model.functions.some(fn => fn.transfers?.length);
	return `
#include <Zend/zend_exceptions.h>
#include <Zend/zend_fibers.h>

typedef struct lgo_state lgo_state;
typedef struct lgo_lease lgo_lease;
typedef struct lgo_borrow lgo_borrow;${transfers ? "\ntypedef struct lgo_input_group lgo_input_group;" : ""}
struct lgo_state {
  lb_owned_context native;
  lgo_lease *leases;
  size_t references;
  int closing;
};
struct lgo_lease {
  lgo_state *state;
  lgo_lease *next;
  ov_result_owner owner;
  size_t references;
  int pending, clearing;${transfers ? "\n  lgo_input_group *input_move;\n  int published, consumed;" : ""}
};
struct lgo_borrow {
  lgo_state *state;
  lb_owned_scope *scope;
  size_t references;
  int active;
};
typedef struct {
  lgo_lease *lease;
  lgo_borrow *borrow;
  uint64_t token;
  unsigned type;
} lgo_handle;
static lgo_state *lgo_current;
static int lgo_resource_type;
static int lgo_initialize(void);
static const char *const lgo_kinds[] = {
${model.types.map(node => `  ${node.identity ? JSON.stringify(node.identityKind) : "NULL"},`).join("\n")}
};
static const char *lgo_kind(unsigned type) {
  return type < sizeof(lgo_kinds) / sizeof(lgo_kinds[0]) ? lgo_kinds[type] : NULL;
}
static int lgo_main(void) {
  return EG(current_fiber_context) == EG(main_fiber_context);
}
static int lgo_affinity(lgo_state *state) {
  if (!state || state->native.self != &state->native) return LB_OWNED_INVALID;
  if (state->native.process != getpid()) return LB_OWNED_PROCESS;
  if (!lgo_main() || !pthread_equal(state->native.thread, pthread_self())
      || state->native.thread_serial != lb_owned_thread_serial) return LB_OWNED_THREAD;
  return LB_OWNED_OK;
}
static int lgo_state_retain(lgo_state *state) {
  if (!state || !state->references) return LB_OWNED_INVALID;
  if (state->references == SIZE_MAX) return LB_OWNED_LIMIT;
  ++state->references; return LB_OWNED_OK;
}
static void lgo_state_release(lgo_state *state) {
  if (!state || !state->references || --state->references) return;
  if (!state->closing || state->leases || state->native.top || state->native.initialized) {
    state->references = 1; lean_bridge_native_runtime_retire(); return;
  }
  LB_ZEND_FREE(state);
}
static int lgo_ready(lgo_state *state) {
  int status = lgo_affinity(state);
  if (status) return status;
  return state->closing ? LB_OWNED_CLOSED : lb_owned_ready(&state->native);
}
static void lgo_lease_destroy(lgo_lease *lease) {
  lgo_state *state = lease->state;
  lgo_lease **position = &state->leases;
  while (*position && *position != lease) position = &(*position)->next;
  if (!*position || lease->references || !ov_owner_empty(&lease->owner)) {
    lean_bridge_native_runtime_retire(); return;
  }
  *position = lease->next; LB_ZEND_FREE(lease); lgo_state_release(state);
}
static int lgo_drain(lgo_state *state) {
  int status = lgo_affinity(state);
  if (status) return status;
  status = lgo_state_retain(state); if (status) return status;
  int failure = LB_OWNED_OK;
  for (lgo_lease *lease = state->leases, *next; lease; lease = next) {
    next = lease->next;
    if (!lease->pending || lease->references || lease->clearing) continue;
    lease->clearing = 1;
    int released = ov_owner_clear(&lease->owner); lease->clearing = 0;
    if (!failure) failure = released;
    if (ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  }
  lgo_state_release(state); return failure;
}
static void lgo_lease_release(lgo_lease *lease) {
  if (!lease || !lease->references || --lease->references) return;
  lease->pending = 1;
  // Destruction in a Fiber cannot enter Lean. The next main-context entry
  // drains this registered lease. After shutdown only empty C storage remains.
  if (lease->state->closing && ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  else if (lgo_main()) (void)lgo_drain(lease->state);
}
static int lgo_lease_retain(lgo_lease *lease) {
  if (!lease || !lease->references || lease->pending || lease->clearing) return LB_OWNED_CLOSED;
  if (lease->references == SIZE_MAX) return LB_OWNED_LIMIT;
  ++lease->references; return LB_OWNED_OK;
}
static int lgo_lease_new(lgo_state *state, lgo_lease **out) {
  *out = NULL; int status = lgo_ready(state); if (status) return status;
  status = lgo_drain(state); if (status) return status;
  lgo_lease *lease = LB_ZEND_CALLOC(1, sizeof(*lease));
  if (!lease) return LB_OWNED_ALLOC_FAILED;
  status = lgo_state_retain(state);
  if (status) { LB_ZEND_FREE(lease); return status; }
  lease->state = state; lease->references = 1;
  lease->next = state->leases; state->leases = lease; *out = lease;
  return LB_OWNED_OK;
}
static int lgo_state_current(lgo_state **out) {
  *out = NULL;
  if (!lgo_main()) return LB_OWNED_THREAD;
  if (!lgo_current) {
    int status = lgo_initialize(); if (status) return status;
    lgo_state *state = LB_ZEND_CALLOC(1, sizeof(*state));
    if (!state) return LB_OWNED_ALLOC_FAILED;
    status = lb_owned_context_init(&state->native, ${JSON.stringify(model.layout.model.component.id)});
    if (status) { LB_ZEND_FREE(state); return status; }
    state->references = 1; lgo_current = state;
  }
  int status = lgo_ready(lgo_current);
  if (!status) status = lgo_drain(lgo_current);
  if (!status) *out = lgo_current;
  return status;
}
static int lgo_state_close(lgo_state *state) {
  int status = lgo_affinity(state); if (status) return status;
  status = lgo_state_retain(state); if (status) return status;
  if (!state->closing) {
    state->closing = 1; status = lb_owned_context_close(&state->native);
  }
  // Closing invalidates all views. Clear native buffers now, even if PHP still
  // holds wrappers that will be destroyed after extension RSHUTDOWN.
  for (lgo_lease *lease = state->leases, *next; lease; lease = next) {
    next = lease->next;
    int released = ov_owner_clear(&lease->owner);
    if (!status) status = released;
    if (!lease->references && ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  }
  lgo_state_release(state); return status;
}
static int lgo_shutdown(void) {
  lgo_state *state = lgo_current;
  if (!state) return LB_OWNED_OK;
  int status = lgo_state_close(state);
  // Never release a live context after an affinity failure.
  if (!state->closing) return status;
  lgo_current = NULL; lgo_state_release(state); return status;
}
static int lgo_scope_live(lgo_borrow *borrow) {
  if (!borrow || !borrow->active || !borrow->scope || !borrow->references) return LB_OWNED_CLOSED;
  int status = lgo_ready(borrow->state); if (status) return status;
  for (lb_owned_scope *scope = borrow->state->native.top; scope; scope = scope->parent)
    if (scope == borrow->scope) return LB_OWNED_OK;
  return LB_OWNED_CLOSED;
}
static void lgo_borrow_release(lgo_borrow *borrow) {
  if (!borrow || !borrow->references || --borrow->references) return;
  lgo_state *state = borrow->state; LB_ZEND_FREE(borrow); lgo_state_release(state);
}
static int lgo_borrow_new(lgo_state *state, lb_owned_scope *scope, lgo_borrow **out) {
  *out = NULL; int status = lgo_ready(state); if (status) return status;
  int found = 0;
  for (lb_owned_scope *active = state->native.top; active; active = active->parent)
    if (active == scope) { found = 1; break; }
  if (!found) return LB_OWNED_ORDER;
  lgo_borrow *borrow = LB_ZEND_CALLOC(1, sizeof(*borrow));
  if (!borrow) return LB_OWNED_ALLOC_FAILED;
  status = lgo_state_retain(state);
  if (status) { LB_ZEND_FREE(borrow); return status; }
  borrow->state = state; borrow->scope = scope; borrow->active = 1; borrow->references = 1;
  *out = borrow; return LB_OWNED_OK;
}
static void lgo_borrow_expire(lgo_borrow *borrow) {
  if (borrow) { borrow->active = 0; borrow->scope = NULL; }
}
static void lgo_borrow_end(lgo_borrow **slot) {
  lgo_borrow *borrow = *slot; *slot = NULL;
  if (!borrow) return;
  lgo_borrow_expire(borrow); lgo_borrow_release(borrow);
}
static int lgo_entries_contain(lb_owned_entry *entries, unsigned type, uint64_t token) {
  const char *kind = lgo_kind(type); if (!kind || !token) return 0;
  for (lb_owned_entry *entry = entries; entry; entry = entry->next)
    if (entry->owner->token == token && !strcmp(entry->owner->kind, kind)) return 1;
  return 0;
}
static int lgo_handle_check(lgo_handle *handle) {
  if (!handle || !handle->token || (!handle->lease && !handle->borrow)) return LB_OWNED_CLOSED;
  if (!lgo_kind(handle->type) || (handle->lease && handle->borrow)) return LB_OWNED_INVALID;
  if (handle->lease) {
    lgo_lease *lease = handle->lease;
    int status = lgo_ready(lease->state); if (status) return status;
    if (!lease->references || lease->pending || lease->clearing${transfers ? " || lease->consumed" : ""}) return LB_OWNED_CLOSED;
    if (lease->owner.batch.context != &lease->state->native
        || !lgo_entries_contain(lease->owner.batch.entries, handle->type, handle->token)) return LB_OWNED_INVALID;
  } else {
    int status = lgo_scope_live(handle->borrow); if (status) return status;
    lb_owned_scope *scope = handle->borrow->scope;
    if (!lgo_entries_contain(scope->inputs, handle->type, handle->token)
        && !lgo_entries_contain(scope->outputs, handle->type, handle->token)) return LB_OWNED_INVALID;
  }
  return LB_OWNED_OK;
}
static lgo_state *lgo_handle_state(lgo_handle *handle) {
  return handle->lease ? handle->lease->state : handle->borrow ? handle->borrow->state : NULL;
}
static int lgo_handle_fetch(zval *value, unsigned type, lgo_state *state, lgo_handle **out) {
  *out = NULL; ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_RESOURCE || Z_RES_P(value)->type != lgo_resource_type || !Z_RES_P(value)->ptr)
    return LB_OWNED_INVALID;
  lgo_handle *handle = Z_RES_P(value)->ptr;
  int status = lgo_handle_check(handle); if (status) return status;
  if (handle->type != type || (state && lgo_handle_state(handle) != state)) return LB_OWNED_INVALID;
  *out = handle; return LB_OWNED_OK;
}
static void lgo_handle_release(lgo_handle *handle) {
  lgo_lease *lease = handle->lease; lgo_borrow *borrow = handle->borrow;
  handle->lease = NULL; handle->borrow = NULL; handle->token = 0;
  if (lease) lgo_lease_release(lease);
  if (borrow) lgo_borrow_release(borrow);
}
static int lgo_handle_close(lgo_handle *handle) {
  if (!handle || !handle->token) return LB_OWNED_OK;
  int status = lgo_affinity(lgo_handle_state(handle)); if (status) return status;
  lgo_handle_release(handle); return LB_OWNED_OK;
}
static void lgo_resource_destroy(zend_resource *resource) {
  lgo_handle *handle = resource->ptr;
  if (!handle) return;
  resource->ptr = NULL; lgo_handle_release(handle); LB_ZEND_FREE(handle);
}
static int lgo_wrap(unsigned type, uint64_t token, lgo_lease *lease, lgo_borrow *borrow, zval *out) {
  lgo_handle candidate = { .lease = lease, .borrow = borrow, .token = token, .type = type };
  int status = lgo_handle_check(&candidate);
  if (status) return status == LB_OWNED_INVALID || status == LB_OWNED_CLOSED ? OV_RESULT : status;
  lgo_handle *handle = LB_ZEND_CALLOC(1, sizeof(*handle));
  if (!handle) return LB_OWNED_ALLOC_FAILED;
  if (lease) status = lgo_lease_retain(lease);
  else if (borrow->references == SIZE_MAX) status = LB_OWNED_LIMIT;
  else ++borrow->references;
  if (status) { LB_ZEND_FREE(handle); return status; }
  *handle = candidate;
  zend_try { ZVAL_RES(out, zend_register_resource(handle, lgo_resource_type)); }
  zend_catch { lgo_handle_release(handle); LB_ZEND_FREE(handle); zend_bailout(); }
  zend_end_try();
  return LB_OWNED_OK;
}
static int lgo_handle_retain(lgo_handle *handle, zval *out) {
  int status = lgo_handle_check(handle); if (status) return status;
  lgo_state *state = lgo_handle_state(handle); lgo_lease *lease = NULL;
  status = lgo_lease_new(state, &lease); if (status) return status;
  ov_transaction transaction = {0}; uint64_t token = 0; lean_object *value = NULL;
  status = ov_begin(&transaction, &state->native, &lease->owner, ${JSON.stringify(model.layout.model.component.id)});
  if (!status) status = lb_owned_scope_borrow(&transaction.scope, lgo_kind(handle->type), handle->token, &value);
  if (!status) status = lb_owned_scope_acquire(&transaction.scope, lgo_kind(handle->type), value, &token);
  if (!status) status = ov_commit(&transaction, &lease->owner);
  else if (transaction.scope.context) status = ov_abort(&transaction, status);
  if (!status) {
    zend_try { status = lgo_wrap(handle->type, token, lease, NULL, out); }
    zend_catch { lgo_lease_release(lease); zend_bailout(); }
    zend_end_try();
  }
${transfers ? "  if (!status) lease->published = 1;\n" : ""}  lgo_lease_release(lease); return status;
}
static void lgo_clear_zvals(zval *values, size_t count, int *bailout) {
  zend_object *volatile failure = EG(exception);
  if (failure) { GC_ADDREF(failure); zend_clear_exception(); }
  for (size_t index = 0; index < count; ++index) {
    zend_try { zval_ptr_dtor(values + index); }
    zend_catch { *bailout = 1; } zend_end_try();
    ZVAL_UNDEF(values + index);
    if (EG(exception)) {
      if (!failure) { failure = EG(exception); GC_ADDREF(failure); }
      zend_clear_exception();
    }
  }
  // PHP 8.4 exit uses an internal unwind object, not a userland Throwable.
  if (failure) zend_throw_exception_internal(failure);
}
static int lgo_borrow_finish(lgo_borrow **borrow, ov_transaction *transaction,
    zval *values, size_t count, int status, int *bailout) {
  // Invalidate views before any PHP destructor runs, but keep the frame's state
  // reference until its native scope has unwound. A callback can close every
  // owning wrapper and the current context while that scope is still active.
  lgo_borrow_expire(*borrow);
  lgo_clear_zvals(values, count, bailout);
  if (transaction->scope.context) status = ov_abort(transaction, status);
  lgo_borrow_end(borrow); return status;
}
`;
};
