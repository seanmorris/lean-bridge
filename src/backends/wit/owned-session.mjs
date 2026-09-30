/**
 * Thread-bound public WIT sessions with independently owned native results.
 * Each active call gets its own store, so host callbacks can reenter safely.
 *
 * @file
 */
import { renderOwnedWitNativeHost } from "./owned-native-host.mjs";

/**
 * Keep Wasmtime handles entirely inside the adapter. A disposable call store
 * owns canonical resources; output conversion retains native identities before
 * that store and its leases are destroyed. Engines and compiled components are
 * session-owned and remain alive until callbacks have unwound.
 *
 * @param model - Authenticated owned WIT graph and native layout.
 * @param componentBytes - Validated Component Model binary for this projection.
 */
export const renderOwnedWitSession = (model, componentBytes) => {
	const nodes = new Map(model.layout.nodes.map(node => [node.id, node]));
	const functions = model.functions.map((fn, index) => ({ ...fn, index
		, native: fn.resource ? model.layout.callbacks.find(item => item.id === fn.resource.id)
			: model.layout.functions.find(item => item.id === fn.declaration.id) }));
	const symbols = new Map(functions.map(fn => [fn.native.id, `ows_dispatch_${fn.index}`]));
	const source = `#define OW_GRAPH_ALLOC(bytes) LB_OWNED_ALLOC(bytes)
#define OW_GRAPH_FREE(pointer) LB_OWNED_FREE(pointer)
${renderOwnedWitNativeHost(model, { inlineNative: true })}
static const uint8_t ows_component_bytes[] = {${[...componentBytes].join(",")}};
typedef struct ows_frame ows_frame;
typedef struct {
  lb_owned_context *native;
  wasm_engine_t *engine;
  wasmtime_component_t *component;
  ows_frame *frames;
  size_t depth;
  bool closing;
} ows_session;
struct ows_frame {
  ows_frame *parent;
  ows_session *session;
  wasmtime_store_t *store;
  wasmtime_component_linker_t *linker;
  wasmtime_component_instance_t instance;
  ow_native_host host;
  ow_native_call call;
};
static inline void ows_session_destroy(ows_session *session) {
  if (session->component) wasmtime_component_delete(session->component);
  if (session->engine) wasm_engine_delete(session->engine);
  LB_OWNED_FREE(session);
}
static inline int ows_session_open(lb_owned_context *native, ows_session **out) {
  int status = lb_owned_ready(native);
  if (status) return status;
  ows_session *session = LB_OWNED_ALLOC(sizeof(*session));
  if (!session) return LB_OWNED_ALLOC_FAILED;
  memset(session, 0, sizeof(*session)); session->native = native;
  wasm_config_t *config = wasm_config_new();
  if (!config) { ows_session_destroy(session); return LB_OWNED_ALLOC_FAILED; }
  wasmtime_config_wasm_component_model_set(config, true);
  session->engine = wasm_engine_new_with_config(config);
  if (!session->engine) { ows_session_destroy(session); return LB_OWNED_ALLOC_FAILED; }
  wasmtime_error_t *error = wasmtime_component_new(session->engine, ows_component_bytes, sizeof(ows_component_bytes), &session->component);
  if (error) { wasmtime_error_delete(error); ows_session_destroy(session); return LB_OWNED_RUNTIME; }
  *out = session; return LB_OWNED_OK;
}
static inline void ows_session_request_close(ows_session *session) {
  session->closing = true;
  for (ows_frame *frame = session->frames; frame; frame = frame->parent) {
    frame->host.closing = true; (void)ow_native_status(&frame->host, LB_OWNED_CLOSED);
  }
}
static inline int ows_frame_end(ows_frame *frame, int status) {
  ows_session *session = frame->session;
  if (frame->host.status && !status) status = frame->host.status;
  /* No canonical identity escapes this frame. Independently retained native
   * results are outside this ledger, so all proxy leases can be rolled back. */
  if (frame->call.host) (void)ow_native_call_end(&frame->call, false);
  if (frame->host.self && !ow_native_host_close(&frame->host) && !status) status = LB_OWNED_RUNTIME;
  if (frame->linker) wasmtime_component_linker_delete(frame->linker);
  if (frame->store) wasmtime_store_delete(frame->store);
  if (session) { session->frames = frame->parent; --session->depth; }
  *frame = (ows_frame){0}; return status;
}
static inline int ows_frame_begin(ows_session *session, ows_frame *frame) {
  int status = lb_owned_ready(session->native);
  if (status) return status;
  if (session->closing) return LB_OWNED_CLOSED;
  if (session->depth == LB_OWNED_SCOPE_LIMIT) return LB_OWNED_LIMIT;
  frame->parent = session->frames; frame->session = session;
  session->frames = frame; ++session->depth;
  frame->store = wasmtime_store_new(session->engine, NULL, NULL);
  if (!frame->store) return ows_frame_end(frame, LB_OWNED_ALLOC_FAILED);
  wasmtime_context_t *context = wasmtime_store_context(frame->store);
  if (!ow_native_host_init(&frame->host, session->native, context))
    return ows_frame_end(frame, frame->host.status ? frame->host.status : LB_OWNED_ALLOC_FAILED);
  frame->linker = wasmtime_component_linker_new(session->engine);
  if (!frame->linker) return ows_frame_end(frame, LB_OWNED_ALLOC_FAILED);
  wasmtime_error_t *error = ow_native_link(&frame->host, frame->linker);
  if (!error) error = wasmtime_component_linker_instantiate(frame->linker, context, session->component, &frame->instance);
  if (error) { wasmtime_error_delete(error); return ows_frame_end(frame, LB_OWNED_RUNTIME); }
  if (!ow_native_call_begin(&frame->host, &frame->call)) return ows_frame_end(frame, LB_OWNED_RUNTIME);
  return LB_OWNED_OK;
}
static inline int ows_invoke(ows_frame *frame, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  wasmtime_context_t *context = frame->host.context;
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&frame->instance,
    context, NULL, ${JSON.stringify(model.exportName)}, ${model.exportName.length});
  if (!api) return LB_OWNED_RUNTIME;
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&frame->instance,
    context, api, name, strlen(name));
  wasmtime_component_export_index_delete(api);
  if (!index) return LB_OWNED_RUNTIME;
  wasmtime_component_func_t function;
  bool found = wasmtime_component_instance_get_func(&frame->instance, context, index, &function);
  wasmtime_component_export_index_delete(index);
  if (!found) return LB_OWNED_RUNTIME;
  wasmtime_error_t *error = wasmtime_component_func_call(&function, context, args, count, out, 1);
  int status = frame->host.status;
  if (error) { wasmtime_error_delete(error); if (!status) status = LB_OWNED_RUNTIME; }
  return status;
}
/* Canonical lowering borrows an owned host proxy. Creating ResourceAny borrows
 * here would require an already-active Component Model call frame. */
static bool ows_write_input(void *data, size_t type, bool borrowed, uint64_t token, wasmtime_component_val_t *out) {
${model.layout.functions.some(fn => fn.transfers?.length) ? "  (void)borrowed;\n  return ow_native_write_identity(data, type, false, token, out);" : "  return borrowed && ow_native_write_identity(data, type, false, token, out);"}
}
/* Only results of this frame's trusted component enter this reader. An own is
 * consumed once, even when several graph references point to its table row. */
static bool ows_read_output(void *data, size_t type, bool borrowed,
    const wasmtime_component_val_t *value, uint64_t *out) {
  ow_native_conversion *conversion = data; ow_native_host *host = conversion->host;
  if (!ow_native_ready(host) || !host->call || host->failure || borrowed
      || !ow_native_type(host, type, value->of.resource) || !wasmtime_component_resource_any_owned(value->of.resource)) return false;
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
    wasmtime_component_resource_host_delete(resource); conversion->reads = read;
    if (tag != host->tags[type]) return false;
  }
  ow_native_entry *entry = ow_native_find(host, read->rep);
  if (!entry || read->type != type || read->borrowed || entry->type != type
      || !lb_owned_find(host->native, ow_native_kinds[type], entry->token)) return false;
  if (out) *out = entry->token;
  return true;
}
static inline int ows_conversion_status(ow_native_conversion *conversion, int invalid) {
  if (conversion->host->status) return conversion->host->status;
  return conversion->scope.memory.failure ? (int)conversion->scope.memory.failure : invalid;
}
${functions.map(({ native, witName, index }) => {
	const result = nodes.get(native.result), parameters = native.parameters.map(id => nodes.get(id));
	return `static inline int ows_dispatch_${index}(ows_session *session,
    ${parameters.map((node, i) => `const ${node.cName} *a${i}, `).join("")}${native.transfers?.length ? "ov_input_transfers *transfer, " : ""}${result.cName} *out, ov_result_owner *owner) {
  ows_frame frame = {0}; int status = ows_frame_begin(session, &frame);
  if (status) return status;
${native.transfers?.length ? "  frame.host.input_transfers = transfer;\n" : ""}\
  ow_native_conversion input, output;
  ow_native_conversion_init(&input, &frame.host); ow_native_conversion_init(&output, &frame.host);
  input.scope.identities.write = ows_write_input; output.scope.identities.read = ows_read_output;
  wasmtime_component_val_t args[${Math.max(1, parameters.length)}] = {{0}}, reply = {0};
  ${result.cName} decoded = {0}, converted = {0}; ov_transaction transaction = {0};
${parameters.map((node, i) => `  if (!ow_encode_${node.index}_${native.transfers?.includes(i) ? "output" : "input"}(a${i}, &input.scope, &args[${i}])) {
    status = ows_conversion_status(&input, LB_OWNED_INVALID); goto done;
  }`).join("\n")}
  status = ows_invoke(&frame, ${JSON.stringify(witName)}, args, ${parameters.length}, &reply);
  if (status) goto done;
  if (!ow_decode_${result.index}_output(&reply, &output.scope, &decoded)) {
    status = ows_conversion_status(&output, OV_RESULT); goto done;
  }
  status = ov_begin(&transaction, session->native, owner, ${JSON.stringify(model.model.component.id)});
  if (!status) {
    lean_object *value = NULL;
    status = ${result.walker}_in(&decoded, 0, 1, &transaction, &value);
    if (!status) status = ${result.walker}_out(&converted, value, 0, &transaction);
  }
  if (!status) status = ov_commit(&transaction, owner);
  else if (transaction.scope.context) status = ov_abort(&transaction, status);
done:
  /* The store may have trapped, and output reads consume resource metadata.
   * Delete boxes only; frame teardown drains the complete native proxy ledger. */
  for (size_t i = 0; i < ${Math.max(1, parameters.length)}; ++i) wasmtime_component_val_delete(&args[i]);
  wasmtime_component_val_delete(&reply);
  ow_native_conversion_close(&output); ow_native_conversion_close(&input);
  status = ows_frame_end(&frame, status);
  if (status) (void)ov_owner_clear(owner); else *out = converted;
  return status;
}
`;
}).join("\n")}`;
	return { source, symbols
		, session: { type: "ows_session", open: "ows_session_open"
			, destroy: "ows_session_destroy"
			, requestClose: "ows_session_request_close" } };
};
