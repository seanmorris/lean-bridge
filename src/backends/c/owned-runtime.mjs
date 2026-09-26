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
 */
export const ownedCRuntime = (values, carriers) => {
	const p = values.prefix, limits = values.native.model.limits;
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
typedef struct { oc_block *head; ov_budget *budget; } oc_arena;
typedef struct oc_session oc_session;
typedef struct oc_result {
  struct oc_result *next;
  uint64_t key;
  oc_session *session;
  ov_result_owner native;
  oc_block *blocks;
} oc_result;
struct oc_session {
  oc_session *next;
  uint64_t key;
  lb_owned_context native;
  size_t results, calls;
  int closed;
};
static _Thread_local oc_session *oc_sessions;
static _Thread_local oc_result *oc_results;
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
  if (!session->closed || session->results || session->calls) return;
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
  session->key = lean_bridge_native_identity_acquire(${sessionKind}, session);
  if (!session->key) { lb_owned_context_close(&session->native); LB_OWNED_FREE(session); return (${p}_status)LB_OWNED_LIMIT; }
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
  int status = lb_owned_context_close(&session->native);
  if (status) return (${p}_status)status;
  session->closed = 1; *value = NULL;
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
