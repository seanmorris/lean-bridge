/**
 * Opaque C sessions and result lifetimes over the native ownership ledger.
 * Registry keys never expose storage addresses and are never dereferenced.
 *
 * @file
 */

/**
 * Emit one component's thread-bound public registry and bounded conversion arena.
 * Broker generations reject copied stale handles even when allocation addresses
 * are reused. Closing a session defers its storage until all results are freed.
 *
 * @param values - Validated public C layout.
 * @param carriers - Freshly compiler-authenticated typed Lean carrier symbols.
 * @param transport - Optional internal transport session lifecycle.
 */
export const ownedCRuntime = (values, carriers, transport = null) => {
	const p = values.prefix, limits = values.native.model.limits;
	const anchored = values.anchoredResults === true;
	const component = JSON.stringify(values.native.model.component.id);
	const sessionKind = JSON.stringify(`owned-c-session:${values.native.model.component.id}`);
	const resultKind = JSON.stringify(`owned-c-result:${values.native.model.component.id}`);
	return `
_Static_assert(sizeof(bool) == 1, "owned C values require one-byte bool storage");
typedef struct oc_block {
  struct oc_block *next;
  int integer_initialized;
  mpz_t integer;
  max_align_t alignment;
  unsigned char data[];
} oc_block;
${anchored ? "typedef struct oc_session oc_session;\ntypedef struct oc_view oc_view;\n" : ""}\
typedef struct { oc_block *head; ov_budget *budget;${anchored ? " oc_session *session; lb_owned_batch *view_batch; oc_view **views;" : ""} } oc_arena;
${anchored ? "" : "typedef struct oc_session oc_session;\n"}\
typedef struct oc_result {
  struct oc_result *next;
  uint64_t key;
  oc_session *session;
  ov_result_owner native;
  oc_block *blocks;
${anchored ? "  oc_view *views;\n" : ""}\
} oc_result;
struct oc_session {
  oc_session *next;
  uint64_t key;
  lb_owned_context native;
${transport ? `  ${transport.type} *transport;\n` : ""}  size_t results, calls;
  int closed;
};
static _Thread_local oc_session *oc_sessions;
static _Thread_local oc_result *oc_results;
${anchored ? "static inline int oc_views_clear(oc_view **views);\n" : ""}\
extern lean_object *initialize_${carriers.module}(uint8_t);
static void *oc_initialize(uint8_t builtin) { return initialize_${carriers.module}(builtin); }

static inline void oc_release(oc_block *block) {
  while (block) {
    oc_block *next = block->next;
    if (block->integer_initialized) mpz_clear(block->integer);
    LB_OWNED_FREE(block); block = next;
  }
}
static inline int oc_block_new(oc_arena *arena, size_t count, size_t width, oc_block **out) {
  int status = ov_charge(arena->budget, count, width);
  if (!status) status = ov_charge(arena->budget, 1, sizeof(oc_block));
  if (status) return status;
  oc_block *block = LB_OWNED_ALLOC(sizeof(*block) + count * width);
  if (!block) return LB_OWNED_ALLOC_FAILED;
  memset(block, 0, sizeof(*block) + count * width);
  block->next = arena->head; arena->head = block; *out = block;
  return LB_OWNED_OK;
}
static inline int oc_allocate(oc_arena *arena, size_t count, size_t width, void **out) {
  *out = NULL; if (!count) return LB_OWNED_OK;
  oc_block *block; int status = oc_block_new(arena, count, width, &block);
  if (!status) *out = block->data;
  return status;
}
static inline int oc_integer(oc_arena *arena, const uint32_t *limbs, size_t length, int negative, mpz_srcptr *out) {
  int status = ov_span(arena->budget, limbs, length, sizeof(uint32_t), _Alignof(uint32_t));
  if (status) return status;
  size_t bits = length * 32, count = bits / GMP_NUMB_BITS + (bits % GMP_NUMB_BITS != 0);
  status = ov_charge(arena->budget, count, sizeof(mp_limb_t));
  if (status) return status;
  oc_block *block; status = oc_block_new(arena, 0, 1, &block);
  if (status) return status;
  mpz_init(block->integer); block->integer_initialized = 1;
  if (length) mpz_import(block->integer, length, -1, sizeof(uint32_t), 0, 0, limbs);
  if (negative) mpz_neg(block->integer, block->integer);
  *out = block->integer; return LB_OWNED_OK;
}
static inline oc_session *oc_session_find(const ${p}_session *key) {
  for (oc_session *item = oc_sessions; item; item = item->next)
    if (item->key == (uint64_t)(uintptr_t)key) return item;
  return NULL;
}
static inline int oc_session_get(const ${p}_session *key, oc_session **out) {
  if (!lean_bridge_native_process_valid()) return LB_OWNED_PROCESS;
  oc_session *session = oc_session_find(key);
  if (!session) return LB_OWNED_INVALID;
  if (session->closed) return LB_OWNED_CLOSED;
  int status = lb_owned_ready(&session->native);
  if (!status) *out = session;
  return status;
}
static inline void oc_session_collect(oc_session *session) {
${transport ? `  if (!session->closed || session->calls) return;
  if (session->transport) { ${transport.destroy}(session->transport); session->transport = NULL; }
  if (session->native.initialized) (void)lb_owned_context_close(&session->native);
  if (session->results) return;` : "  if (!session->closed || session->results || session->calls) return;"}
  oc_session **slot = &oc_sessions;
  while (*slot != session) slot = &(*slot)->next;
  *slot = session->next;
  (void)lean_bridge_native_identity_release(session->key, ${sessionKind}, session);
  LB_OWNED_FREE(session);
}
${p}_status ${p}_session_open(${p}_session **out) {
  if (!ov_pointer(out, sizeof(*out), _Alignof(${p}_session *)) || *out) return (${p}_status)LB_OWNED_INVALID;
  if (!lean_bridge_native_process_valid()) return (${p}_status)LB_OWNED_PROCESS;
  if (!lean_bridge_native_component_initialize(${component}, oc_initialize)) return (${p}_status)LB_OWNED_RUNTIME;
  oc_session *session = LB_OWNED_ALLOC(sizeof(*session));
  if (!session) return (${p}_status)LB_OWNED_ALLOC_FAILED;
  memset(session, 0, sizeof(*session));
  int status = lb_owned_context_init(&session->native, ${component});
  if (status) { LB_OWNED_FREE(session); return (${p}_status)status; }
${transport ? `  status = ${transport.open}(&session->native, &session->transport);
  if (status) { lb_owned_context_close(&session->native); LB_OWNED_FREE(session); return (${p}_status)status; }
` : ""}\
  session->key = lean_bridge_native_identity_acquire(${sessionKind}, session);
  if (!session->key) { ${transport ? `${transport.destroy}(session->transport); ` : ""}lb_owned_context_close(&session->native); LB_OWNED_FREE(session); return (${p}_status)LB_OWNED_LIMIT; }
  session->next = oc_sessions; oc_sessions = session;
  *out = (${p}_session *)(uintptr_t)session->key;
  return (${p}_status)LB_OWNED_OK;
}
${p}_status ${p}_session_close(${p}_session **value) {
  if (!ov_pointer(value, sizeof(*value), _Alignof(${p}_session *))) return (${p}_status)LB_OWNED_INVALID;
  if (!lean_bridge_native_process_valid()) return (${p}_status)LB_OWNED_PROCESS;
  if (!*value) return (${p}_status)LB_OWNED_OK;
  oc_session *session = oc_session_find(*value);
  if (!session) return (${p}_status)LB_OWNED_INVALID;
  if (session->closed) return (${p}_status)LB_OWNED_CLOSED;
  int status = ${transport ? "lb_owned_affinity" : "lb_owned_context_close"}(&session->native);
  if (status) return (${p}_status)status;
  session->closed = 1; *value = NULL;
${transport ? `  ${transport.requestClose}(session->transport);\n` : ""}\
  oc_session_collect(session); return (${p}_status)LB_OWNED_OK;
}
${p}_status ${p}_result_release(${p}_result **value) {
  if (!ov_pointer(value, sizeof(*value), _Alignof(${p}_result *))) return (${p}_status)LB_OWNED_INVALID;
  if (!lean_bridge_native_process_valid()) return (${p}_status)LB_OWNED_PROCESS;
  if (!*value) return (${p}_status)LB_OWNED_OK;
  oc_result **slot = &oc_results;
  while (*slot && (*slot)->key != (uint64_t)(uintptr_t)*value) slot = &(*slot)->next;
  if (!*slot) return (${p}_status)LB_OWNED_INVALID;
  oc_result *result = *slot; oc_session *session = result->session;
  int status = ov_owner_clear(&result->native);
  if (!ov_owner_empty(&result->native)) return (${p}_status)status;
${anchored ? "  { int cleanup = oc_views_clear(&result->views); if (!status) status = cleanup; }\n" : ""}\
  *slot = result->next; --session->results;
  if (lean_bridge_native_identity_release(result->key, ${resultKind}, result) < 0 && !status) status = LB_OWNED_RUNTIME;
  oc_release(result->blocks); LB_OWNED_FREE(result); *value = NULL;
  oc_session_collect(session); return (${p}_status)status;
}
static inline int oc_result_begin(oc_session *session, ov_budget *budget, oc_result **out) {
  if (session->calls == LB_OWNED_SCOPE_LIMIT) return LB_OWNED_LIMIT;
  int status = ov_charge(budget, 1, sizeof(oc_result));
  if (status) return status;
  oc_result *result = LB_OWNED_ALLOC(sizeof(*result));
  if (!result) return LB_OWNED_ALLOC_FAILED;
  memset(result, 0, sizeof(*result)); result->session = session;
  ++session->calls; *out = result; return LB_OWNED_OK;
}
static inline int oc_result_finish(oc_result *result, oc_arena *output, int status, ${p}_result **owner) {
  oc_session *session = result->session;
  if (status == OV_RESULT) lean_bridge_native_runtime_retire();
${transport ? "  if (!status && session->closed) status = LB_OWNED_CLOSED;\n" : ""}\
  if (!status) status = lb_owned_ready(&session->native);
  if (!status) {
    result->key = lean_bridge_native_identity_acquire(${resultKind}, result);
    if (!result->key) status = LB_OWNED_LIMIT;
  }
  if (!status) {
    result->blocks = output->head; output->head = NULL;
    result->next = oc_results; oc_results = result; ++session->results;
    *owner = (${p}_result *)(uintptr_t)result->key;
  } else {
${anchored ? "    (void)oc_views_clear(&result->views);\n" : ""}\
    (void)ov_owner_clear(&result->native);
    oc_release(output->head); output->head = NULL; LB_OWNED_FREE(result);
  }
  --session->calls; oc_session_collect(session); return status;
}
static inline ov_budget oc_budget(void) {
  return (ov_budget){ .bytes = ${limits.bytes}, .visits = ${limits.visits} };
}
static inline int oc_outputs(const void *out, size_t bytes, size_t alignment, const void *owner) {
  if (!ov_pointer(out, bytes, alignment) || !ov_pointer(owner, sizeof(void *), _Alignof(void *))) return 0;
  uintptr_t a = (uintptr_t)out, b = (uintptr_t)owner;
  return a < b ? bytes <= b - a : sizeof(void *) <= a - b;
}
`;
};

/**
 * Emit owner-specific borrowed identities and canonical resource comparison.
 * The C handle is a broker generation, never a dereferenced storage pointer.
 *
 * @param values - Checked C projection with anchored-result support.
 */
export const ownedCBorrowRuntime = values => {
	const p = values.prefix;
	const viewKind = JSON.stringify(`owned-c-borrow:${values.native.model.component.id}`);
	return `
struct oc_view {
  oc_view *next, *owned_next;
  oc_session *session;
  const lb_owned_batch *batch;
  const char *kind;
  uint64_t key, token, generation;
};
static _Thread_local oc_view *oc_views;
static inline int oc_views_clear(oc_view **views) {
  int status = LB_OWNED_OK;
  while (*views) {
    oc_view *view = *views; *views = view->owned_next;
    oc_view **position = &oc_views;
    while (*position && *position != view) position = &(*position)->next;
    if (!*position) return LB_OWNED_INVALID;
    *position = view->next;
    if (lean_bridge_native_identity_release(view->key, ${viewKind}, view) < 0) status = LB_OWNED_RUNTIME;
  }
  return status;
}
static inline int oc_anchor_prepare(oc_session *session, const ${p}_result *key, ov_input_anchor *anchor) {
  oc_result *owner = oc_results;
  while (owner && owner->key != (uint64_t)(uintptr_t)key) owner = owner->next;
  if (!owner || owner->session != session) return LB_OWNED_INVALID;
  lb_owned_batch *batch = &owner->native.batch;
  if (!lb_owned_batch_find(&session->native, batch, batch->generation)) return LB_OWNED_CLOSED;
  *anchor = (ov_input_anchor){ batch, batch->generation }; return LB_OWNED_OK;
}
${p}_status ${p}_result_validate(${p}_session *key, ${p}_result *owner) {
  oc_session *session = NULL; int status = oc_session_get(key, &session);
  ov_input_anchor anchor = {0};
  if (!status) status = oc_anchor_prepare(session, owner, &anchor);
  return (${p}_status)status;
}
static inline int oc_identity_to(oc_arena *arena, const char *kind, uint64_t key, uint64_t *out) {
  if (!arena->session) return LB_OWNED_INVALID;
  int status = lb_owned_ready(&arena->session->native);
  if (status) return status;
  for (oc_view *view = oc_views; view; view = view->next) {
    if (view->key != key) continue;
    if (view->session != arena->session || strcmp(view->kind, kind)) return LB_OWNED_INVALID;
    lb_owned_batch *batch = lb_owned_batch_find(&arena->session->native, view->batch, view->generation);
    if (!batch) return LB_OWNED_CLOSED;
    for (lb_owned_entry *entry = batch->entries; entry; entry = entry->next)
      if (entry->owner->token == view->token && !strcmp(entry->owner->kind, kind)) {
        *out = view->token; return LB_OWNED_OK;
      }
    return LB_OWNED_INVALID;
  }
  if (!lb_owned_find(&arena->session->native, kind, key)) return LB_OWNED_INVALID;
  *out = key; return LB_OWNED_OK;
}
static inline int oc_identity_from(oc_arena *arena, const char *kind, uint64_t token, uint64_t *out) {
  if (!arena->view_batch) { *out = token; return LB_OWNED_OK; }
  if (!arena->session || !arena->views) return OV_RESULT;
  if (!lb_owned_batch_find(&arena->session->native, arena->view_batch, arena->view_batch->generation)) return LB_OWNED_CLOSED;
  for (oc_view *view = *arena->views; view; view = view->owned_next)
    if (view->token == token && !strcmp(view->kind, kind)) { *out = view->key; return LB_OWNED_OK; }
  void *storage = NULL; int status = oc_allocate(arena, 1, sizeof(oc_view), &storage);
  if (status) return status;
  oc_view *view = storage;
  view->session = arena->session; view->batch = arena->view_batch;
  view->generation = arena->view_batch->generation; view->kind = kind; view->token = token;
  view->key = lean_bridge_native_identity_acquire(${viewKind}, view);
  if (!view->key) return LB_OWNED_LIMIT;
  view->next = oc_views; oc_views = view;
  view->owned_next = *arena->views; *arena->views = view;
  *out = view->key; return LB_OWNED_OK;
}
`;
};
