/**
 * Adapt the established callable session to bounded recursive value conversion.
 * Checked replacements preserve copied-only and acyclic generated host bytes.
 *
 * @file
 */
import { renderCallableHostRuntime } from "./callable-host-runtime.mjs";

/**
 * Resolve every component export to original native graph types and signatures.
 *
 * @param model - Recursive callable WIT model.
 */
export const witGraphCallableFunctions = model => model.wire.functions.map(wire => {
	if(!wire.resource) return { ...model.functions.find(fn => fn.wire === wire), wire };
	const callback = model.callbacks.get(wire.resource.type.id);
	return { wire, callback, parameters: [callback, ...callback.parameters], result: callback.result };
});

const replace = (source, before, after) => {
	if(source.split(before).length !== 2) throw new Error("WIT callable session changed; review recursive session integration");
	return source.replace(before, after);
};
const replaceSection = (source, begin, end, value) => {
	if(source.split(begin).length !== 2 || source.split(end).length !== 2 || source.indexOf(end) <= source.indexOf(begin))
		throw new Error("WIT callable session changed; review recursive section integration");
	return source.slice(0, source.indexOf(begin)) + value + source.slice(source.indexOf(end));
};

/**
 * Keep generation-checked resources and trap recovery, with graph preflight.
 *
 * @param model - Recursive callable WIT model.
 * @param componentBytes - Validated compiled component bytes.
 */
export const renderWitGraphCallableSession = (model, componentBytes) => {
	const p = model.prefix, functions = witGraphCallableFunctions(model);
	let { prelude, api } = renderCallableHostRuntime(model.wire, componentBytes);
	prelude = replaceSection(prelude, `static ${p}_status lb_native_error(`, "static lb_entry *lb_entry_find(", "");
	prelude = replace(prelude, "typedef struct lb_frame { struct lb_frame *previous; lb_entry *pending; } lb_frame;",
		`typedef struct lb_frame { struct lb_frame *previous, *thread_previous; ${p}_wasmtime *session; lb_entry *pending; } lb_frame;
static _Thread_local lb_frame *lb_active_frame;
static _Thread_local uint64_t lb_thread_serial;
static uint64_t lb_thread_counter;
static pthread_mutex_t lb_thread_mutex = PTHREAD_MUTEX_INITIALIZER;
static uint64_t lb_thread_identity(void) {
  if (!lb_thread_serial) {
    pthread_mutex_lock(&lb_thread_mutex);
    if (lb_thread_counter != UINT64_MAX) lb_thread_serial = ++lb_thread_counter;
    pthread_mutex_unlock(&lb_thread_mutex);
  }
  return lb_thread_serial;
}`);
	prelude = replace(prelude, "  pthread_t thread;", "  pthread_t thread;\n  uint64_t thread_serial;");
	prelude = replace(prelude, "session->process == getpid() && pthread_equal(session->thread, pthread_self())",
		"session->process == getpid() && session->thread_serial == lb_thread_identity() && pthread_equal(session->thread, pthread_self())");
	prelude += `
/* Validate a callback context against active frames before dereferencing it.
 * A stale, foreign, wrong-thread or wrong-signature context owns no borrow. */
static lb_entry *lb_graph_callback_entry(void *raw, uint32_t tag) {
  uintptr_t address = (uintptr_t)raw;
  for (lb_frame *frame = lb_active_frame; frame; frame = frame->thread_previous) {
    ${p}_wasmtime *session = frame->session;
    uintptr_t first = (uintptr_t)&session->entries[0];
    if (address < first || address - first >= sizeof(session->entries) || (address - first) % sizeof(lb_entry)) continue;
    lb_entry *entry = raw;
    if (entry->session == session && entry->active && entry->token && entry->tag == tag && lb_thread(session)) return entry;
  }
  return NULL;
}
`;
	const validation = `static bool lb_validate(${p}_wasmtime *session, int function, const ${p}_wasmtime_value *args, lb_entry **entries) {
  lb_graph_scope scope = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  bool valid = false;
  (void)session; (void)args; (void)entries;
  switch (function) {
${functions.map((fn, i) => `  case ${i}: valid = ${fn.parameters.map((node, n) => node.kind === "callback"
	? `((entries[${n}] = lb_entry_find(session, args[${n}].function)) && entries[${n}]->tag == ${model.wire.resources.indexOf(node.resource) + 1})`
	: `(!args[${n}].function && lb_graph_decode_${node.index}(&args[${n}].value, &scope, NULL))`).join(" && ") || "true"}; break;`).join("\n")}
  default: break;
  }
  lb_scope_close(&scope.memory); return valid;
}
`;
	api = replaceSection(api, `static bool lb_validate(${p}_wasmtime *session`, `wasmtime_error_t *${p}_wasmtime_invoke(`, validation);
	api = replace(api, '  if (!out) return wasmtime_error_new("Missing session output");',
		`  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(${p}_wasmtime *)) || *out) return wasmtime_error_new("Session output requires a fresh initialized slot");
  if (${p}_graph_initialize()) return wasmtime_error_new("Lean runtime is unavailable");`);
	api = replace(api, "!signature || !callback || !out)",
		`!signature || !callback || !lb_buffer(out, 1, sizeof(*out), _Alignof(${p}_wasmtime_function)) || *out)`);
	api = replace(api, "session->closing || !function) return wasmtime_error_new",
		`session->closing || !lb_buffer(function, 1, sizeof(*function), _Alignof(${p}_wasmtime_function))) return wasmtime_error_new`);
	api = replace(api, "  uint32_t tag = 0;",
		`  if (!${p}_graph_ready()) return wasmtime_error_new("Lean runtime is unavailable");\n  uint32_t tag = 0;`);
	api = replace(api, "  session->thread = pthread_self(); session->process = getpid();",
		"  session->thread = pthread_self(); session->process = getpid(); session->thread_serial = lb_thread_identity();\n  if (!session->thread_serial) { free(session); return wasmtime_error_new(\"WIT thread identities exhausted\"); }");
	api = replace(api, '  if (which < 0 || count != lb_arities[which]) return wasmtime_error_new("Unknown WIT export or argument count");',
		`  if (which < 0 || count != lb_arities[which]) return wasmtime_error_new("Unknown WIT export or argument count");
  if (!lb_buffer(args, count, sizeof(*args), _Alignof(${p}_wasmtime_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(${p}_wasmtime_value))) return wasmtime_error_new("Invalid WIT argument storage");`);
	api = replace(api, "  lb_frame frame = {.previous = session->frame}; session->frame = &frame; ++session->depth;",
		"  lb_frame frame = {.previous = session->frame, .thread_previous = lb_active_frame, .session = session}; session->frame = &frame; lb_active_frame = &frame; ++session->depth;");
	api = replace(api, "  session->frame = frame.previous; --session->depth;",
		"  session->frame = frame.previous; lb_active_frame = frame.thread_previous; --session->depth;");
	api = replace(api, `  ${p}_wasmtime_value values[LB_MAX_ARGS] = {0}, result = {0};`,
		`  if (!lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("Invalid WIT copied argument storage");
  ${p}_wasmtime_value values[LB_MAX_ARGS] = {0}, result = {0};`);
	return { prelude, api };
};
