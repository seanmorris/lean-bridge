/**
 * Native leases behind Wasmtime resources, with call-scoped conversion caches.
 * The owning host supplies one store and one affinity-checked native context.
 *
 * @file
 */

/**
 * Keep 64-bit broker identities separate from 32-bit Component Model handles.
 * Every exported own has an independent lease. A failed outer call rolls back
 * every unpublished lease, including results from nested imports.
 *
 * @param model - Owned graph projection with its private native value layout.
 */
export const renderOwnedWitNativeResources = model => `
#define OW_RESOURCE_CAPACITY LB_OWNED_RETAINED_LIMIT
typedef struct ow_native_host ow_native_host;
typedef struct ow_native_call ow_native_call;
typedef struct {
  uint32_t rep;
  size_t type;
  uint64_t token;
  lb_owned_batch lease;
  ow_native_call *pending;
  bool transient;
} ow_native_entry;
struct ow_native_call { ow_native_host *host; ow_native_call *parent; };
struct ow_native_host {
  ow_native_host *self;
  lb_owned_context *native;
  wasmtime_context_t *context;
  ow_native_entry *entries;
  uint32_t tags[OW_TYPES], next_rep;
  size_t live, depth;
  int status;
  ow_native_call *call;
${model.layout.functions.some(fn => fn.transfers?.length) ? "  ov_input_transfers *input_transfers;\n" : ""}\
  bool closing;
  wasmtime_error_t *failure;
};
typedef struct ow_native_read {
  struct ow_native_read *next;
  const wasmtime_component_resource_any_t *handle;
  uint32_t rep;
  size_t type;
  bool borrowed;
} ow_native_read;
typedef struct { ow_native_host *host; ow_scope scope; ow_native_read *reads; } ow_native_conversion;
static _Atomic uint32_t ow_native_next_tag;
static const char *const ow_native_kinds[OW_TYPES] = {
${model.layout.nodes.filter(node => node.identityKind).map(node => `  [${node.index}] = ${JSON.stringify(node.identityKind)},`).join("\n")}
};
static inline bool ow_native_ready(ow_native_host *host) {
  return host && host->self == host && host->native && !host->closing
    && !lb_owned_ready(host->native) && host->context && host->entries;
}
static inline bool ow_native_affinity(ow_native_host *host) {
  return host && host->self == host && host->native && !lb_owned_affinity(host->native);
}
static inline int ow_native_status(ow_native_host *host, int status) {
  if (status && !host->status) host->status = status;
  return host->status;
}
static inline void ow_native_error(ow_native_host *host, wasmtime_error_t *error) {
  if (!error) return;
  (void)ow_native_status(host, LB_OWNED_RUNTIME);
  if (!host->failure) host->failure = error; else wasmtime_error_delete(error);
}
static inline ow_native_entry *ow_native_find(ow_native_host *host, uint32_t rep) {
  for (size_t i = 0; rep && i < OW_RESOURCE_CAPACITY; ++i)
    if (host->entries[i].rep == rep) return &host->entries[i];
  return NULL;
}
static inline bool ow_native_release(ow_native_host *host, ow_native_entry *entry) {
  if (!entry || !entry->rep || !ow_native_affinity(host)) return false;
  int status = lb_owned_batch_release(host->native, &entry->lease);
  if (entry->lease.context) return false;
  *entry = (ow_native_entry){0}; --host->live;
  if (status) ow_native_error(host, wasmtime_error_new("Native resource lease release failed"));
  return !status;
}
static inline bool ow_native_host_init(ow_native_host *host, lb_owned_context *native, wasmtime_context_t *context) {
  if (!host || host->self || host->entries || !context || lb_owned_ready(native)) return false;
  ow_native_entry *entries = LB_OWNED_ALLOC(OW_RESOURCE_CAPACITY * sizeof(*entries));
  if (!entries) { host->status = LB_OWNED_ALLOC_FAILED; return false; }
  memset(entries, 0, OW_RESOURCE_CAPACITY * sizeof(*entries));
  *host = (ow_native_host){.self = host, .native = native, .context = context, .entries = entries};
  for (size_t i = 0; i < OW_TYPES; ++i) if (ow_native_kinds[i]) {
    uint32_t previous = atomic_load(&ow_native_next_tag);
    do {
      if (previous == UINT32_MAX) { LB_OWNED_FREE(entries); *host = (ow_native_host){.status = LB_OWNED_LIMIT}; return false; }
    } while (!atomic_compare_exchange_weak(&ow_native_next_tag, &previous, previous + 1));
    host->tags[i] = previous + 1;
  }
  return true;
}
static inline bool ow_native_call_begin(ow_native_host *host, ow_native_call *call) {
  if (!ow_native_ready(host) || !call || call->host || call->parent || host->depth == LB_OWNED_SCOPE_LIMIT) return false;
  if (!host->call && host->failure) { wasmtime_error_delete(host->failure); host->failure = NULL; }
  if (!host->call) host->status = LB_OWNED_OK;
  if (host->failure) return false;
  *call = (ow_native_call){.host = host, .parent = host->call}; host->call = call; ++host->depth; return true;
}
static inline bool ow_native_call_end(ow_native_call *call, bool success) {
  if (!call || !ow_native_affinity(call->host) || call->host->call != call) return false;
  ow_native_host *host = call->host;
  /* Conversion status reports an atomic, recoverable failure. The caller can
   * still commit unrelated work; Wasmtime errors and close prevent commit. */
  success = success && !host->failure && !host->closing;
  /* Finish fallible temporary cleanup before publishing any pending owner. */
  if (success) for (size_t i = 0; i < OW_RESOURCE_CAPACITY; ++i) {
    ow_native_entry *entry = &host->entries[i];
    if (entry->rep && entry->pending == call && entry->transient && !ow_native_release(host, entry)) success = false;
  }
  for (size_t i = 0; i < OW_RESOURCE_CAPACITY; ++i) {
    ow_native_entry *entry = &host->entries[i];
    if (!entry->rep || entry->pending != call) continue;
    if (!success) {
      if (!ow_native_release(host, entry)) success = false;
    } else entry->pending = call->parent;
  }
  host->call = call->parent; --host->depth; *call = (ow_native_call){0}; return success;
}
/* Close native leases even when a trapped component store cannot drop borrows.
 * Store replacement/destruction belongs to the owning session, after unwind. */
static inline bool ow_native_host_close(ow_native_host *host) {
  if (!ow_native_affinity(host) || host->call) return false;
  host->closing = true;
  bool valid = true;
  for (size_t i = 0; i < OW_RESOURCE_CAPACITY; ++i)
    if (host->entries[i].rep && !ow_native_release(host, &host->entries[i])) valid = false;
  if (host->live) return false;
  LB_OWNED_FREE(host->entries);
  if (host->failure) wasmtime_error_delete(host->failure);
  *host = (ow_native_host){0}; return valid;
}
static inline bool ow_native_type(ow_native_host *host, size_t type, const wasmtime_component_resource_any_t *resource) {
  if (type >= OW_TYPES || !host->tags[type] || !resource) return false;
  wasmtime_component_resource_type_t *actual = wasmtime_component_resource_any_type(resource);
  wasmtime_component_resource_type_t *expected = wasmtime_component_resource_type_new_host(host->tags[type]);
  bool matches = wasmtime_component_resource_type_equal(actual, expected);
  wasmtime_component_resource_type_delete(actual); wasmtime_component_resource_type_delete(expected); return matches;
}
/* Import arguments have already crossed this host's store. Never call this
 * converter on an arbitrary resource from another Wasmtime store. */
static bool ow_native_read_identity(void *data, size_t type, bool borrowed,
    const wasmtime_component_val_t *value, uint64_t *out) {
  ow_native_conversion *conversion = data; ow_native_host *host = conversion->host;
  if (!ow_native_ready(host) || !host->call || host->failure${model.layout.functions.some(fn => fn.transfers?.length) ? "" : " || !borrowed"}
      || !ow_native_type(host, type, value->of.resource) || ${model.layout.functions.some(fn => fn.transfers?.length) ? "wasmtime_component_resource_any_owned(value->of.resource) == borrowed" : "wasmtime_component_resource_any_owned(value->of.resource)"}) return false;
  ow_native_read *read = conversion->reads;
  while (read && read->handle != value->of.resource) read = read->next;
  if (!read) {
    if (!lb_charge(&conversion->scope.memory, 1, sizeof(*read))) return false;
    read = lb_alloc(&conversion->scope.memory, 1, sizeof(*read));
    if (!read) return false;
    wasmtime_component_resource_host_t *resource = NULL;
    wasmtime_error_t *error = wasmtime_component_resource_any_to_host(host->context, value->of.resource, &resource);
    if (error) { ow_native_error(host, error); return false; }
    *read = (ow_native_read){.next = conversion->reads, .handle = value->of.resource,
      .rep = wasmtime_component_resource_host_rep(resource), .type = type,
      .borrowed = !wasmtime_component_resource_host_owned(resource)};
    uint32_t tag = wasmtime_component_resource_host_type(resource);
    wasmtime_component_resource_host_delete(resource);
    conversion->reads = read;
    if (tag != host->tags[type]) return false;
  }
  ow_native_entry *entry = ow_native_find(host, read->rep);
  if (!entry || read->type != type || ${model.layout.functions.some(fn => fn.transfers?.length) ? "read->borrowed != borrowed" : "!read->borrowed"} || entry->type != type
      || !lb_owned_find(host->native, ow_native_kinds[type], entry->token)) return false;
  if (out) *out = entry->token;
  return true;
}
static bool ow_native_write_identity(void *data, size_t type, bool borrowed,
    uint64_t token, wasmtime_component_val_t *out) {
  ow_native_conversion *conversion = data; ow_native_host *host = conversion->host;
  if (!ow_native_ready(host) || !host->call || host->failure || type >= OW_TYPES || !host->tags[type] || !token) return false;
  if (host->live == OW_RESOURCE_CAPACITY || host->next_rep == UINT32_MAX) {
    (void)ow_native_status(host, LB_OWNED_LIMIT); return false;
  }
  ow_native_entry *entry = NULL;
  for (size_t i = 0; i < OW_RESOURCE_CAPACITY; ++i) if (!host->entries[i].rep) { entry = &host->entries[i]; break; }
  if (!entry) return false;
  lb_owned_scope scope = {0}; lean_object *object = NULL; uint64_t retained = 0;
  int status = lb_owned_scope_begin(host->native, &scope);
  if (!status) status = lb_owned_scope_borrow(&scope, ow_native_kinds[type], token, &object);
  if (!status) status = lb_owned_scope_acquire(&scope, ow_native_kinds[type], object, &retained);
  if (!status) status = lb_owned_scope_commit(&scope, &entry->lease);
  if (scope.context) (void)lb_owned_scope_abort(&scope);
  if (status) {
    (void)ow_native_status(host, status);
    if (entry->lease.context) (void)lb_owned_batch_release(host->native, &entry->lease);
    return false;
  }
  entry->rep = ++host->next_rep; entry->type = type; entry->token = retained;
  entry->pending = host->call; entry->transient = borrowed; ++host->live;
  wasmtime_component_resource_host_t *resource = wasmtime_component_resource_host_new(!borrowed, entry->rep, host->tags[type]);
  wasmtime_component_resource_any_t *handle = NULL;
  wasmtime_error_t *error = wasmtime_component_resource_host_to_any(host->context, resource, &handle);
  wasmtime_component_resource_host_delete(resource);
  if (error) { ow_native_error(host, error); (void)ow_native_release(host, entry); return false; }
  *out = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_RESOURCE, .of.resource = handle}; return true;
}
/* Deleting an unpublished ResourceAny box alone does not release its native
 * lease. Extract its trusted host representation, then close that exact lease. */
static void ow_native_discard_identity(void *data, wasmtime_component_resource_any_t *value) {
  ow_native_conversion *conversion = data; ow_native_host *host = conversion->host;
  if (!ow_native_affinity(host)) return;
  wasmtime_component_resource_host_t *resource = NULL;
  wasmtime_error_t *error = wasmtime_component_resource_any_to_host(host->context, value, &resource);
  if (error) { ow_native_error(host, error); return; }
  uint32_t rep = wasmtime_component_resource_host_rep(resource), tag = wasmtime_component_resource_host_type(resource);
  ow_native_entry *entry = ow_native_find(host, rep);
  wasmtime_component_resource_host_delete(resource);
  if (!entry || host->tags[entry->type] != tag || !ow_native_release(host, entry))
    ow_native_error(host, wasmtime_error_new("Unknown or expired native WIT resource during cleanup"));
}
static inline void ow_native_conversion_init(ow_native_conversion *conversion, ow_native_host *host) {
  *conversion = (ow_native_conversion){.host = host, .scope = {
    .memory = {.remaining = OW_BYTES}, .visits = OW_NODES,
    .identities = {.data = conversion, .read = ow_native_read_identity,
      .write = ow_native_write_identity, .discard = ow_native_discard_identity}}};
}
static inline void ow_native_conversion_close(ow_native_conversion *conversion) {
  lb_scope_close(&conversion->scope.memory); conversion->reads = NULL;
}
static wasmtime_error_t *ow_native_resource_drop(void *data, wasmtime_context_t *context, uint32_t rep) {
  ow_native_host *host = data;
  if (!ow_native_affinity(host) || context != host->context) return wasmtime_error_new("Wrong native WIT resource session");
  ow_native_entry *entry = ow_native_find(host, rep);
  if (!entry || !ow_native_release(host, entry)) return wasmtime_error_new("Closed native WIT resource");
  return NULL;
}
`;
