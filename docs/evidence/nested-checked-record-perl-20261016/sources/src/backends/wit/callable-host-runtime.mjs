/**
 * Persistent callable ownership, ephemeral component resources and trap recovery.
 *
 * @file
 */

/**
 * Render the session registry and checked public entry points.
 *
 * @param model - Validated callable projection.
 * @param componentBytes - Validated embedded component.
 */
export const renderCallableHostRuntime = (model, componentBytes) => {
	const { surface, functions, resources } = model, p = surface.prefix, m = p.toUpperCase();
	const tag = copy => resources.findIndex(resource => resource.index === copy.resourceIndex) + 1;
	const maxArgs = Math.max(1, ...functions.map(fn => fn.parameters.length));
	const prelude = `
#define LB_CAPACITY 1024
#define LB_BUDGET (16u * 1024u * 1024u)
#define LB_MAX_ARGS ${maxArgs}
typedef struct lb_entry lb_entry;
typedef struct lb_frame { struct lb_frame *previous; lb_entry *pending; } lb_frame;
struct lb_entry {
  uint64_t token;
  uint32_t tag;
  unsigned active;
  bool closed;
  ${p}_wasmtime *session;
  ${p}_wasmtime_callback callback;
  void *data, *owned;
  void (*release)(void *);
};
struct ${p}_wasmtime {
  wasm_engine_t *engine;
  wasmtime_component_t *component;
  wasmtime_store_t *store;
  wasmtime_component_linker_t *linker;
  wasmtime_component_instance_t instance;
  pthread_t thread;
  pid_t process;
  unsigned depth, finalizing;
  bool poisoned, closing;
  char first_error[1024];
  lb_frame *frame;
  lb_entry entries[LB_CAPACITY];
};
static const char lb_identity_kind[] = "${p}:wit-callable";
static bool lb_thread(${p}_wasmtime *session) {
  return session && session->process == getpid() && pthread_equal(session->thread, pthread_self()) && !session->finalizing;
}
static void lb_record_text(${p}_wasmtime *session, const char *text, size_t length) {
  if (!session->poisoned) {
    if (length >= sizeof(session->first_error)) length = sizeof(session->first_error) - 1;
    memcpy(session->first_error, text, length); session->first_error[length] = 0;
  }
  session->poisoned = true;
}
static void lb_record_error(${p}_wasmtime *session, wasmtime_error_t *error) {
  if (session->poisoned) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  lb_record_text(session, message.data, message.size); wasm_name_delete(&message);
}
static ${p}_status lb_native_error(${p}_wasmtime *session, ${p}_error *error, const char *fallback) {
  if (!session->poisoned) lb_record_text(session, fallback, strlen(fallback));
  if (error) *error = (${p}_error){${m}_ERROR_UNEXPECTED, session->first_error, strlen(session->first_error)};
  return ${m}_STATUS_DECLARED_ERROR;
}
static lb_entry *lb_entry_find(${p}_wasmtime *session, uint64_t token) {
  for (size_t i = 0; token && i < LB_CAPACITY; ++i)
    if (session->entries[i].token == token && !session->entries[i].closed) return &session->entries[i];
  return NULL;
}
static lb_entry *lb_entry_new(${p}_wasmtime *session, uint32_t tag) {
  for (size_t i = 0; i < LB_CAPACITY; ++i) {
    lb_entry *entry = &session->entries[i];
    if (entry->token) continue;
    uint64_t token = lean_bridge_native_identity_acquire(lb_identity_kind, entry);
    if (!token) return NULL;
    *entry = (lb_entry){.token = token, .tag = tag, .session = session}; return entry;
  }
  return NULL;
}
static void lb_entry_collect(lb_entry *entry) {
  if (!entry->token || !entry->closed || entry->active) return;
  ${p}_wasmtime *session = entry->session;
  void (*release)(void *) = entry->release;
  void *data = entry->owned ? entry->owned : entry->data;
  (void)lean_bridge_native_identity_release(entry->token, lb_identity_kind, entry);
  *entry = (lb_entry){0};
  if (release) { ++session->finalizing; release(data); --session->finalizing; }
}
typedef struct { lb_scope scope; wasmtime_component_val_t value; } lb_result;
static inline void lb_result_release(void *data) {
  lb_result *owner = data;
  lb_scope_close(&owner->scope); wasmtime_component_val_delete(&owner->value); free(owner);
}
/* Proxies never own a persistent lease. A call frame owns unreturned leases;
 * the session owns published tokens. Dropping a proxy cannot close an alias. */
static wasmtime_error_t *lb_proxy_drop(void *data, wasmtime_context_t *context, uint32_t rep) {
  (void)data; (void)context; (void)rep; return NULL;
}
static wasmtime_error_t *lb_proxy(${p}_wasmtime *session, wasmtime_context_t *context,
    lb_entry *entry, wasmtime_component_val_t *out) {
  uint32_t rep = (uint32_t)(entry - session->entries) + 1;
  wasmtime_component_resource_host_t *host = wasmtime_component_resource_host_new(true, rep, entry->tag);
  out->kind = WASMTIME_COMPONENT_RESOURCE;
  wasmtime_error_t *error = wasmtime_component_resource_host_to_any(context, host, &out->of.resource);
  wasmtime_component_resource_host_delete(host);
  if (error) *out = (wasmtime_component_val_t){0};
  return error;
}
static wasmtime_error_t *lb_unwrap(${p}_wasmtime *session, wasmtime_context_t *context,
    const wasmtime_component_val_t *value, uint32_t tag, bool owned, lb_entry **out) {
  if (value->kind != WASMTIME_COMPONENT_RESOURCE || !value->of.resource || wasmtime_component_resource_any_owned(value->of.resource) != owned)
    return wasmtime_error_new("Invalid WIT callable resource ownership");
  wasmtime_component_resource_host_t *host = NULL;
  wasmtime_error_t *error = wasmtime_component_resource_any_to_host(context, value->of.resource, &host);
  if (error) return error;
  uint32_t rep = wasmtime_component_resource_host_rep(host), actual = wasmtime_component_resource_host_type(host);
  wasmtime_component_resource_host_delete(host);
  if (!rep || rep > LB_CAPACITY || actual != tag) return wasmtime_error_new("Invalid WIT callable representation");
  lb_entry *entry = &session->entries[rep - 1];
  if (!entry->token || entry->tag != tag) return wasmtime_error_new("Expired WIT callable resource");
  *out = entry; return NULL;
}
static wasmtime_error_t *lb_borrow(${p}_wasmtime *session, wasmtime_context_t *context,
    const wasmtime_component_val_t *value, uint32_t tag, lb_entry **out) {
  wasmtime_error_t *error = lb_unwrap(session, context, value, tag, false, out);
  if (!error && !(*out)->active) error = wasmtime_error_new("WIT callable has no active borrow");
  return error;
}
`;
	const api = `
static const uint8_t lb_component[] = {${[...componentBytes].join(",")}};
static wasmtime_error_t *lb_link(${p}_wasmtime *session) {
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(session->linker), *host = NULL;
  wasmtime_error_t *error = wasmtime_component_linker_instance_add_instance(root, "${model.importName}", ${model.importName.length}, &host);
  if (!error) {
${resources.map((resource, i) => `    if (!error) {
      wasmtime_component_resource_type_t *type = wasmtime_component_resource_type_new_host(${i + 1});
      error = wasmtime_component_linker_instance_add_resource(host, "${resource.witName}", ${resource.witName.length}, type, lb_proxy_drop, session, NULL);
      wasmtime_component_resource_type_delete(type);
    }`).join("\n")}
${functions.map((fn, i) => `    if (!error) error = wasmtime_component_linker_instance_add_func(host, "${fn.witName}", ${fn.witName.length}, lb_call_${i}, session, NULL);`).join("\n")}
    wasmtime_component_linker_instance_delete(host);
  }
  wasmtime_component_linker_instance_delete(root); return error;
}
wasmtime_error_t *${p}_wasmtime_link(wasmtime_component_linker_t *linker) {
  (void)linker; return wasmtime_error_new("WIT callables require the owning session API");
}
static wasmtime_error_t *lb_refresh(${p}_wasmtime *session) {
  if (session->store) wasmtime_store_delete(session->store);
  session->store = wasmtime_store_new(session->engine, NULL, NULL);
  wasmtime_error_t *error = wasmtime_component_linker_instantiate(session->linker, wasmtime_store_context(session->store), session->component, &session->instance);
  if (error) { wasmtime_store_delete(session->store); session->store = NULL; }
  return error;
}
static void lb_destroy(${p}_wasmtime *session) {
  session->closing = true;
  for (size_t i = 0; i < LB_CAPACITY; ++i) { session->entries[i].closed = true; lb_entry_collect(&session->entries[i]); }
  if (session->linker) wasmtime_component_linker_delete(session->linker);
  if (session->store) wasmtime_store_delete(session->store);
  if (session->component) wasmtime_component_delete(session->component);
  if (session->engine) wasm_engine_delete(session->engine);
  free(session);
}
void ${p}_wasmtime_close(${p}_wasmtime *session) {
  if (!lb_thread(session)) return;
  session->closing = true;
  if (!session->depth) lb_destroy(session);
}
wasmtime_error_t *${p}_wasmtime_open(${p}_wasmtime **out) {
  if (!out) return wasmtime_error_new("Missing session output");
  ${p}_wasmtime *session = calloc(1, sizeof(*session));
  if (!session) return wasmtime_error_new("Cannot allocate Wasmtime session");
  session->thread = pthread_self(); session->process = getpid();
  wasm_config_t *config = wasm_config_new();
  if (!config) { free(session); return wasmtime_error_new("Cannot allocate Wasmtime configuration"); }
  wasmtime_config_wasm_component_model_set(config, true);
  session->engine = wasm_engine_new_with_config(config);
  wasmtime_error_t *error = wasmtime_component_new(session->engine, lb_component, sizeof(lb_component), &session->component);
  if (!error) {
    session->linker = wasmtime_component_linker_new(session->engine);
    error = lb_link(session); if (!error) error = lb_refresh(session);
  }
  if (error) { lb_destroy(session); return error; }
  *out = session; return NULL;
}
wasmtime_error_t *${p}_wasmtime_callback_create(${p}_wasmtime *session, const char *signature,
    ${p}_wasmtime_callback callback, void *data, void (*release)(void *), ${p}_wasmtime_function *out) {
  if (!lb_thread(session) || session->closing || !signature || !callback || !out)
    return wasmtime_error_new("Invalid WIT callback or wrong-thread session");
  uint32_t tag = 0;
${resources.map((resource, i) => `  if (!strcmp(signature, "${resource.witName}")) tag = ${i + 1};`).join("\n")}
  if (!tag) return wasmtime_error_new("Unknown WIT callable signature");
  lb_entry *entry = lb_entry_new(session, tag);
  if (!entry) return wasmtime_error_new("WIT callable capacity exhausted");
  entry->callback = callback; entry->data = data; entry->release = release;
  *out = entry->token; return NULL;
}
wasmtime_error_t *${p}_wasmtime_function_close(${p}_wasmtime *session, ${p}_wasmtime_function *function) {
  if (!lb_thread(session) || session->closing || !function) return wasmtime_error_new("Invalid WIT function close or wrong-thread session");
  if (!*function) return NULL;
  lb_entry *entry = lb_entry_find(session, *function);
  if (!entry) return wasmtime_error_new("Closed or wrong-session WIT callable");
  entry->closed = true; *function = 0; lb_entry_collect(entry); return NULL;
}
static int lb_export(const char *name) {
  if (!name) return -1;
${functions.map((fn, i) => `  if (!strcmp(name, "${fn.witName}")) return ${i};`).join("\n")}
  return -1;
}
static const size_t lb_arities[] = {${functions.map(fn => fn.parameters.length).join(",")}};
static const uint32_t lb_returns[] = {${functions.map(fn => fn.resultCopy.resource ? tag(fn.resultCopy) : 0).join(",")}};
static const bool lb_copied[] = {${functions.map(fn => !fn.resultCopy.resource && !fn.parameters.some(parameter => parameter.copy.resource)).join(",")}};
static bool lb_validate(${p}_wasmtime *session, int function, const ${p}_wasmtime_value *args, lb_entry **entries) {
  lb_scope scope = {.remaining = LB_BUDGET};
  (void)session; (void)args; (void)entries;
  switch (function) {
${functions.map((fn, i) => `  case ${i}: return ${fn.parameters.map((parameter, n) => parameter.copy.resource
	? `((entries[${n}] = lb_entry_find(session, args[${n}].function)) && entries[${n}]->tag == ${tag(parameter.copy)})`
	: `(!args[${n}].function && lb_in_${parameter.copy.index}(&args[${n}].value, &scope, NULL))`).join(" && ") || "true"};`).join("\n")}
  default: return false;
  }
}
wasmtime_error_t *${p}_wasmtime_invoke(${p}_wasmtime *session, const char *name,
    const ${p}_wasmtime_value *args, size_t count, ${p}_wasmtime_value *out) {
  if (!lb_thread(session) || session->closing || !out || (count && !args)) return wasmtime_error_new("Invalid WIT call or wrong-thread session");
  if (session->poisoned && session->depth) return wasmtime_error_new(session->first_error);
  int which = lb_export(name);
  if (which < 0 || count != lb_arities[which]) return wasmtime_error_new("Unknown WIT export or argument count");
  lb_entry *entries[LB_MAX_ARGS] = {0};
  if (!lb_validate(session, which, args, entries)) return wasmtime_error_new("Invalid WIT input, closed/wrong-session callable, signature mismatch or conversion limit");
  if (session->depth == 64) return wasmtime_error_new("WIT callable reentry limit (64)");
  if (!session->depth) { session->poisoned = false; session->first_error[0] = 0; }
  wasmtime_error_t *error = NULL;
  if (!session->store && (error = lb_refresh(session))) return error;
  wasmtime_context_t *context = wasmtime_store_context(session->store);
  lb_frame frame = {.previous = session->frame}; session->frame = &frame; ++session->depth;
  wasmtime_component_val_t values[LB_MAX_ARGS] = {{0}}, result = {0};
  ${p}_wasmtime_value converted = {0};
  for (size_t i = 0; i < count; ++i) if (entries[i]) ++entries[i]->active;
  for (size_t i = 0; i < count; ++i) {
    if (entries[i]) { error = lb_proxy(session, context, entries[i], &values[i]); if (error) goto done; }
    else values[i] = args[i].value; /* Borrow copied inputs, never delete them. */
  }
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&session->instance, context, NULL, "${model.exportName}", ${model.exportName.length});
  if (!api) { error = wasmtime_error_new("Missing WIT API export"); goto done; }
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&session->instance, context, api, name, strlen(name));
  wasmtime_component_export_index_delete(api);
  if (!index) { error = wasmtime_error_new("Missing WIT function export"); goto done; }
  wasmtime_component_func_t function;
  bool found = wasmtime_component_instance_get_func(&session->instance, context, index, &function);
  wasmtime_component_export_index_delete(index);
  if (!found) { error = wasmtime_error_new("WIT export is not a function"); goto done; }
  error = wasmtime_component_func_call(&function, context, values, count, &result, 1);
  if (!error && !session->poisoned && !session->closing) {
    if (lb_returns[which]) {
      lb_entry *entry = NULL;
      error = lb_unwrap(session, context, &result, lb_returns[which], true, &entry);
      if (!error && entry != frame.pending) error = wasmtime_error_new("Unexpected WIT returned callable");
      if (!error) converted.function = entry->token;
    } else { converted.value = result; result = (wasmtime_component_val_t){0}; }
  }
done:
  if (error) { lb_record_error(session, error); wasmtime_error_delete(error); error = NULL; }
  /* A trapped borrow may not be removable. The outermost frame replaces the
   * poisoned store after every active native call has unwound. */
  for (size_t i = 0; i < count; ++i) if (entries[i]) {
    if (values[i].kind == WASMTIME_COMPONENT_RESOURCE && values[i].of.resource) {
      lb_entry *entry = NULL;
      wasmtime_error_t *cleanup = lb_unwrap(session, context, &values[i], entries[i]->tag, true, &entry);
      if (cleanup) { lb_record_error(session, cleanup); wasmtime_error_delete(cleanup); }
      wasmtime_component_val_delete(&values[i]);
    }
    --entries[i]->active; lb_entry_collect(entries[i]);
  }
  wasmtime_component_val_delete(&result);
  if (session->closing && !session->poisoned) lb_record_text(session, "WIT session closed during call", 30);
  if (session->poisoned) {
    wasmtime_component_val_delete(&converted.value);
    error = wasmtime_error_new(session->first_error);
    if (frame.pending) { frame.pending->closed = true; lb_entry_collect(frame.pending); }
  } else { *out = converted; frame.pending = NULL; }
  session->frame = frame.previous; --session->depth;
  if (!session->depth) {
    if (session->closing) lb_destroy(session);
    else if (session->poisoned) {
      wasmtime_error_t *reset = lb_refresh(session); if (reset) wasmtime_error_delete(reset);
      session->poisoned = false;
    }
  }
  return error;
}
wasmtime_error_t *${p}_wasmtime_call(${p}_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  int which = lb_export(name);
  if (!out || (count && !args) || which < 0 || !lb_copied[which] || count != lb_arities[which])
    return wasmtime_error_new("Use the checked WIT invoke API for callable exports");
  ${p}_wasmtime_value values[LB_MAX_ARGS] = {0}, result = {0};
  for (size_t i = 0; i < count; ++i) values[i].value = args[i];
  wasmtime_error_t *error = ${p}_wasmtime_invoke(session, name, values, count, &result);
  if (!error) *out = result.value;
  return error;
}
`;
	return { prelude, api };
};
