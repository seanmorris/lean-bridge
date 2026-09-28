/**
 * Bounded Zend aggregate conversion with context-checked opaque identity leaves.
 *
 * @file
 */
import { graphZendSupport } from "./copied-graph-zend-runtime.mjs";
import { ownedZendDescriptorSource } from "./owned-zend-descriptors.mjs";
import { ownedZendOwnershipSource } from "./owned-zend-ownership.mjs";

/**
 * Native ownership codecs precede this source. Callback and downcall emitters
 * use the same walk budget and pin inputs until the entire call has unwound.
 *
 * @param model - Compiler-authenticated wasm32 ownership schema.
 */
export const ownedZendWalkSource = model => `
${graphZendSupport}
${ownedZendOwnershipSource(model)}
static int lgo_identity_input(lb_scope *, unsigned, zval *, uint64_t *);
static int lgo_identity_output(lb_scope *, unsigned, uint64_t, zval *);
${ownedZendDescriptorSource(model)}
typedef struct {
  lg_walk graph;
  lgo_state *state;
  lgo_lease *lease;
  lgo_borrow *borrow;
  lb_owned_scope *inputs;
  int status;
} lgo_walk;
_Static_assert(offsetof(lgo_walk, graph) == 0 && offsetof(lg_walk, scope) == 0,
  "owned Zend identity hooks require the walk's first-field scope");
typedef struct lgo_host lgo_host;
typedef struct {
  lgo_walk walk;
  ov_transaction inputs;
  lgo_host *hosts;
  zval wire;
  int bailout;
} lgo_call;
struct lgo_host {
  lgo_host *next;
  lgo_call *call;
  uint64_t token;
  ov_result_owner owner;
  zval callback;
};
static unsigned lgo_depth;
static int lgo_walk_fail(lgo_walk *walk, int status, const char *message, int type_error) {
  if (!walk->status) walk->status = status;
  return lb_fail(&walk->graph.scope, message, type_error);
}
static int lgo_walk_failure(lgo_walk *walk, int output) {
  unsigned failure = walk->graph.scope.failure;
  int status = failure == 2 ? LB_OWNED_LIMIT : failure == 3 ? LB_OWNED_ALLOC_FAILED
    : output ? OV_RESULT : LB_OWNED_INVALID;
  if (!walk->status) walk->status = status;
  if (walk->status == OV_RESULT) lean_bridge_native_runtime_retire();
  return 0;
}
static int lgo_identity_input(lb_scope *scope, unsigned type, zval *value, uint64_t *token) {
  lgo_walk *walk = (lgo_walk *)scope; lgo_handle *handle = NULL;
  int status = lgo_handle_fetch(value, type, walk->state, &handle);
  lean_object *pinned = NULL;
  if (!status) status = lb_owned_scope_borrow(walk->inputs, lgo_kind(type), handle->token, &pinned);
  if (status) return lgo_walk_fail(walk, status, "Invalid, foreign or expired Lean identity", status == LB_OWNED_INVALID);
  *token = handle->token; return 1;
}
static int lgo_identity_output(lb_scope *scope, unsigned type, uint64_t token, zval *value) {
  lgo_walk *walk = (lgo_walk *)scope;
  int status = lgo_wrap(type, token, walk->borrow ? NULL : walk->lease, walk->borrow, value);
  if (status) return lgo_walk_fail(walk, status, "Malformed or unavailable native Lean identity", 0);
  return 1;
}
static int lgo_to(lgo_walk *walk, unsigned type, zval *value, void *out) {
  if (walk->status || walk->graph.scope.error) return 0;
  return lg_to(&walk->graph, type, value, out) ? 1 : lgo_walk_failure(walk, 0);
}
static int lgo_from(lgo_walk *walk, unsigned type, const void *value, zval *out) {
  if (walk->status || walk->graph.scope.error) return 0;
  return lg_from(&walk->graph, type, value, out) ? 1 : lgo_walk_failure(walk, 1);
}
static int lgo_call_open(lgo_call *call, size_t bytes) {
  call->walk.graph.scope.remaining = 16 * 1024 * 1024 - bytes;
  call->walk.graph.visits = 262144; ZVAL_UNDEF(&call->wire);
  int status = lgo_state_current(&call->walk.state);
  if (!status) status = lgo_lease_new(call->walk.state, &call->walk.lease);
  ov_result_owner empty = {0};
  if (!status) status = ov_begin(&call->inputs, &call->walk.state->native, &empty, ${JSON.stringify(model.layout.model.component.id)});
  call->walk.inputs = &call->inputs.scope;
  return call->walk.status = status;
}
static void lgo_hosts_end(lgo_call *call) {
  // Revoke all broker tokens before dropping any PHP callback reference.
  for (lgo_host *host = call->hosts; host; host = host->next) {
    if (host->token) {
      if (lb_native_callback_wrong_thread(host->token) && !call->walk.status) call->walk.status = LB_OWNED_THREAD;
      lb_native_callback_release(host->token); host->token = 0;
    }
    int status = ov_owner_clear(&host->owner);
    if (!call->walk.status) call->walk.status = status;
  }
  for (lgo_host *host = call->hosts; host; host = host->next)
    lgo_clear_zvals(&host->callback, 1, &call->bailout);
  call->hosts = NULL;
}
static void lgo_call_finish(lgo_call *call, zval *out) {
  lgo_hosts_end(call);
  if (call->inputs.scope.context) call->walk.status = ov_abort(&call->inputs, call->walk.status);
  if (!call->walk.status && !call->walk.graph.scope.error && !call->bailout && !EG(exception)) {
    ZVAL_COPY_VALUE(out, &call->wire); ZVAL_UNDEF(&call->wire);
  }
  lgo_clear_zvals(&call->wire, 1, &call->bailout);
  if (call->walk.lease) { lgo_lease_release(call->walk.lease); call->walk.lease = NULL; }
  lb_scope_clear(&call->walk.graph.scope);
}
static void lgo_error(int status, const char *message, int type_error) {
  if (EG(exception) || (!status && !message)) return;
  if (status == OV_RESULT) lean_bridge_native_runtime_retire();
  if (type_error && status == LB_OWNED_INVALID) zend_type_error("%s", message);
  else zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean ownership call failed", status);
}
`;
