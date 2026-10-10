/**
 * Call-bounded Zend callback contexts and resource-owned uint64 closure leases.
 *
 * @file
 */

/** No foreign callback context is dereferenced before a live identity lookup. */
export const zendGraphCallState = String.raw`
typedef struct lgc_call lgc_call;
typedef struct lgc_borrow {
  struct lgc_borrow *next, *call_next;
  uintptr_t identity;
  unsigned signature;
  zval *callback;
  lgc_call *call;
} lgc_borrow;
typedef struct lgc_reply {
  struct lgc_reply *next;
  zval arguments[16], value;
} lgc_reply;
struct lgc_call {
  lg_walk walk;
  lgc_borrow *borrows;
  lgc_reply *replies;
  zval wire;
  uint32_t status;
  int bailout;
};
static lgc_borrow *lgc_borrows;
static uintptr_t lgc_next_identity;
static unsigned lgc_depth;

static lgc_borrow *lgc_lookup(void *context, unsigned signature) {
  uintptr_t identity = (uintptr_t)context;
  if (!identity) return NULL;
  for (lgc_borrow *borrow = lgc_borrows; borrow; borrow = borrow->next)
    if (borrow->identity == identity && borrow->signature == signature) return borrow;
  return NULL;
}
static void *lgc_register(lgc_call *call, unsigned signature, zval *callback) {
  if (!zend_is_callable(callback, 0, NULL)) { lb_fail(&call->walk.scope, "Expected a synchronous callable", 1); return NULL; }
  if (lgc_next_identity == UINTPTR_MAX) { lb_fail(&call->walk.scope, "Zend callback context identities exhausted", 0); return NULL; }
  lgc_borrow *borrow = lb_allocate(&call->walk.scope, 1, sizeof(*borrow));
  if (!borrow) return NULL;
  *borrow = (lgc_borrow){ lgc_borrows, call->borrows, ++lgc_next_identity, signature, callback, call };
  lgc_borrows = borrow; call->borrows = borrow;
  return (void *)borrow->identity;
}
static void lgc_unregister(lgc_call *call) {
  for (lgc_borrow *borrow = call->borrows; borrow; borrow = borrow->call_next) {
    lgc_borrow **entry = &lgc_borrows;
    while (*entry && *entry != borrow) entry = &(*entry)->next;
    if (*entry) *entry = borrow->next;
  }
  call->borrows = NULL;
}
static void lgc_clear_zval(lgc_call *call, zval *value) {
  zend_try { zval_ptr_dtor(value); }
  zend_catch { call->bailout = 1; } zend_end_try();
  ZVAL_UNDEF(value);
}
static void lgc_clear(lgc_call *call) {
  lgc_unregister(call);
  // Reply strings and nested buffers must survive the native copy. The frame
  // owns them until the entire downcall, not merely the PHP callback, finishes.
  zend_object *failure = EG(exception);
  if (failure) { GC_ADDREF(failure); zend_clear_exception(); }
  for (lgc_reply *reply = call->replies; reply; reply = reply->next) {
    for (unsigned index = 0; index < 16; ++index) lgc_clear_zval(call, &reply->arguments[index]);
    lgc_clear_zval(call, &reply->value);
  }
  lgc_clear_zval(call, &call->wire);
  lb_scope_clear(&call->walk.scope);
  if (failure) {
    if (EG(exception)) zend_clear_exception();
    // PHP 8.4 exit() uses an internal unwind object, not Throwable. Restore
    // the original engine exception without applying userland throw checks.
    zend_throw_exception_internal(failure);
  }
}
typedef struct { uint64_t token; unsigned signature; } lgc_owned;
static int lgc_owned_type;
`;

/**
 * Emit type-specific closure disposal without exposing identities as PHP ints.
 *
 * @param model - Original signatures and matching wasm32 payloads.
 */
export const zendGraphOwners = model => `
static void lgc_owned_close(lgc_owned *owner) {
  if (!owner || !owner->token) return;
  uint64_t token = owner->token; owner->token = 0;
  switch (owner->signature) {
${[...model.callbacks.values()].map(cb => `    case ${cb.index}: ${cb.dispose}(token); break;`).join("\n")}
  }
}
static void lgc_owned_destroy(zend_resource *resource) {
  lgc_owned *owner = resource->ptr; lgc_owned_close(owner); LB_ZEND_FREE(owner);
}
static int lgc_from(lgc_call *call, unsigned type, const void *input, zval *output) {
  if (lg_from(&call->walk, type, input, output)) return 1;
  if (call->walk.scope.failure == 4) { ${model.layout.prefix}_graph_retire(); call->status = 4; }
  return 0;
}
`;

/**
 * Catch callback bailouts before unwinding through Lean's native stack.
 *
 * @param model - Original signatures and matching wasm32 payloads.
 */
export const zendGraphTrampolines = model => [...model.callbacks.values()].map(cb => `
static uint32_t lgc_callback${cb.index}(void *context, ${[...cb.parameters.map((node, index) => `const ${node.name} *arg${index}`), `${cb.result.name} *output`].join(", ")}) {
  lgc_borrow *borrow = lgc_lookup(context, ${cb.index});
  if (!borrow) return 6;
  lgc_call *call = borrow->call;
  if (EG(exception) || call->bailout || call->status || call->walk.scope.error) return 6;
  if (!lb_readable(&call->walk.scope, output, 1, sizeof(*output), _Alignof(${cb.result.name}))) return 6;
  lgc_reply *reply = lb_allocate(&call->walk.scope, 1, sizeof(*reply));
  if (!reply) return 6;
  reply->next = call->replies; call->replies = reply;
  int success = 0;
  zend_try {
    do {
${cb.parameters.map((node, index) => `      if (!lgc_from(call, ${node.index}, arg${index}, &reply->arguments[${index}])) break;`).join("\n")}
      if (call_user_function(EG(function_table), NULL, borrow->callback, &reply->value, ${cb.parameters.length}, reply->arguments) != SUCCESS || EG(exception)) break;
      if (!lg_to(&call->walk, ${cb.result.index}, &reply->value, output)) break;
      success = 1;
    } while (0);
  } zend_catch { call->bailout = 1; } zend_end_try();
  return success && !call->bailout && !EG(exception) ? 0 : 6;
}
ZEND_BEGIN_ARG_INFO_EX(lgc_close_args${cb.index}, 0, 0, 1)
  ZEND_ARG_INFO(0, token)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgc_close${cb.index}) {
  zval *token; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_RESOURCE(token) ZEND_PARSE_PARAMETERS_END();
  lgc_owned *owner = zend_fetch_resource_ex(token, "Lean graph closure", lgc_owned_type);
  if (!owner) RETURN_THROWS();
  if (owner->signature != ${cb.index}) { zend_type_error("Lean closure signature differs"); RETURN_THROWS(); }
  lgc_owned_close(owner); RETURN_NULL();
}
`).join("\n");
