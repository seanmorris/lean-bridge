/**
 * Reuse native identity and callback registries in the existing browser heap.
 * The browser runtime remains the sole owner of initialization and retirement.
 *
 * @file
 */
import { brokerHeader, brokerSource } from "../native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../native/callback-broker.mjs";
import { ownedWasmCallbackBroker } from "./owned-wasm-callbacks.mjs";

const replaceOnce = (source, before, after) => {
	if(source.split(before).length !== 2) throw new Error("Owned Wasm broker source boundary changed");
	return source.replace(before, after);
};
const replaceSection = (source, start, end, replacement) => {
	const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
	if(first < 0 || last < 0 || source.indexOf(start, first + start.length) >= 0)
		throw new Error("Owned Wasm broker function boundary changed");
	return source.slice(0, first) + replacement + source.slice(last);
};

/** Keep platform-independent identities; delegate every runtime transition. */
export const generateOwnedWasmBroker = () => {
	let source = brokerSource;
	source = replaceOnce(source, "extern lean_object *initialize_Init(uint8_t builtin);\nextern void lean_initialize_runtime_module(void);", `
extern uint32_t bridge_lean_runtime_init(void);
extern uint32_t bridge_lean_runtime_status(void);
extern uint32_t bridge_lean_runtime_init_runs(void);
extern void bridge_lean_runtime_retire(void);
extern uint32_t bridge_lean_runtime_component_initialize(lean_object *(*)(uint8_t));
static const char owned_runtime_identity_anchor;
`);
	source = replaceOnce(source, "static uint32_t runtime_state = LEAN_BRIDGE_RUNTIME_COLD;\nstatic uint32_t runtime_init_runs = 0;\n", "");
	source = replaceSection(source, "__attribute__((destructor))\nstatic void lean_bridge_native_process_shutdown(void)", "static uint64_t hash_text", "/* The browser runtime owns the single finalizer. */\n\n");
	source = replaceSection(source, "LEAN_BRIDGE_NATIVE_API int lean_bridge_native_component_initialize(", "LEAN_BRIDGE_NATIVE_API void lean_bridge_native_component_detach", `LEAN_BRIDGE_NATIVE_API int lean_bridge_native_component_initialize(
    const char *component_id, lean_bridge_native_initializer initializer
) {
  if (!lean_bridge_native_process_valid() || !component_id || !initializer) return 0;
  if (!bridge_lean_runtime_init()) return 0;
  pthread_mutex_lock(&runtime_mutex);
  if (bridge_lean_runtime_status() != LEAN_BRIDGE_RUNTIME_READY) {
    pthread_mutex_unlock(&runtime_mutex); return 0;
  }
  lean_bridge_component_slot *component = component_find(component_id);
  if (component && component->state == LEAN_BRIDGE_RUNTIME_READY) {
    if (!component->attached) { component->attached = true; attached_components++; }
    pthread_mutex_unlock(&runtime_mutex); return 1;
  }
  if (component && component->state != LEAN_BRIDGE_RUNTIME_COLD) {
    pthread_mutex_unlock(&runtime_mutex); return 0;
  }
  if (!component) component = component_reserve(component_id);
  if (!component) { pthread_mutex_unlock(&runtime_mutex); return 0; }
  component->state = LEAN_BRIDGE_RUNTIME_INITIALIZING;
  component_init_runs++;
  if (!bridge_lean_runtime_component_initialize((lean_object *(*)(uint8_t))initializer)) {
    component->state = LEAN_BRIDGE_RUNTIME_FAILED;
    pthread_mutex_unlock(&runtime_mutex); return 0;
  }
  component->state = LEAN_BRIDGE_RUNTIME_READY;
  component->attached = true; attached_components++;
  pthread_mutex_unlock(&runtime_mutex); return 1;
}

`);
	source = replaceSection(source, "LEAN_BRIDGE_NATIVE_API void lean_bridge_native_runtime_retire(void)", "LEAN_BRIDGE_NATIVE_API uint64_t lean_bridge_native_identity_acquire", `LEAN_BRIDGE_NATIVE_API void lean_bridge_native_runtime_retire(void) {
  if (lean_bridge_native_process_valid()) bridge_lean_runtime_retire();
}

`);
	source = replaceOnce(source, "opaque_process_id(&runtime_state,", "opaque_process_id(&owned_runtime_identity_anchor,");
	source += ownedWasmCallbackBroker();
	// Do not substitute the identically named snapshot fields after their dot.
	source = source.replace(/(?<!\.)\bruntime_state\b/gu, "bridge_lean_runtime_status()");
	source = source.replace(/(?<!\.)\bruntime_init_runs\b/gu, "bridge_lean_runtime_init_runs()");
	source += `
uint32_t bridge_owned_runtime_abi(void) { return 1; }
uint32_t bridge_owned_runtime_can_shutdown(void) {
  if (attached_components || live_identities) return 0;
  for (size_t i = 0; i < 4096; ++i) if (callback_slots[i].callback.invoke) return 0;
  return 1;
}
uint32_t bridge_owned_runtime_components(void) { return attached_components; }
uint32_t bridge_owned_runtime_identities(void) { return live_identities; }
uint32_t bridge_owned_runtime_component_initializations(void) { return component_init_runs; }
`;
	const header = replaceOnce(brokerHeader, "#ifdef __cplusplus\n}", `${nativeCallbackHeader}\n#ifdef __cplusplus\n}`);
	const exports = [...header.matchAll(/\b(lean_bridge_native_\w+|lb_native_callback_\w+)\s*\(/gu)].map(match => match[1]);
	exports.push("bridge_owned_runtime_abi", "bridge_owned_runtime_can_shutdown"
		, "bridge_owned_runtime_components", "bridge_owned_runtime_identities"
		, "bridge_owned_runtime_component_initializations");
	// The generated side-module codecs call these libc functions directly.
	const supportExports = ["malloc", "calloc", "free", "getpid", "pthread_self"
		, "pthread_equal", "strcmp", "memcpy", "memset"];
	return Object.freeze({ header, source, exports: Object.freeze(exports)
		, supportExports: Object.freeze(supportExports) });
};
