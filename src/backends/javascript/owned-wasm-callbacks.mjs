/**
 * Typed Lean-to-JavaScript callbacks over owned wasm32 value layouts.
 * Recovery uses compiler-generated Lean values, never invented resource bits.
 *
 * @file
 */
import { nativeCallbackBroker } from "../native/callback-broker.mjs";

/** Keep generation-safe callback tokens representable by the typed USize carrier. */
export const ownedWasmCallbackBroker = () => {
	const original = "(UINT64_MAX >> 12)";
	if(nativeCallbackBroker.split(original).length !== 2) throw new Error("Native callback generation bound changed");
	return nativeCallbackBroker.replace(original, "(UINTPTR_MAX >> 12)");
};

/**
 * Emit callback functions beside the component's native value adapter. Hooks
 * refer to private checked owner slots and the same existing component context.
 * The generated JS handler is installed by that component's authenticated loader.
 *
 * @param generated - Native adapter with freshly compiled typed host carriers.
 * @param hooks - Private C context and owner-slot functions in that translation unit.
 */
export const generateOwnedWasmCallbacks = (generated, hooks = {}) => {
	const { layout, carriers } = generated;
	if(layout.wordBits !== 32 || !Array.isArray(carriers.hostCallbacks))
		throw new TypeError("Owned JS callbacks require wasm32 typed host carriers");
	const names = { context: "context", open: "owned_open", find: "find_owner", release: "owned_release", ...hooks };
	for(const name of Object.values(names)) if(!/^[A-Za-z_][A-Za-z_0-9]*$/u.test(name)) throw new TypeError("Invalid native callback hook");
	const p = `lbjs_${layout.model.bindingIrSha256.slice(0, 20)}`;
	const key = `leanBridgeOwnedCallbacks_${layout.model.bindingIrSha256}`;
	const nodes = new Map(layout.nodes.map(node => [node.id, node]));
	const symbols = { begin: `${p}_begin`, end: `${p}_end`, valid: `${p}_valid`, live: `${p}_live` };
	const component = JSON.stringify(layout.model.component.id);
	const lines = ["#include <emscripten.h>"
		, `typedef struct { unsigned host, type; uint64_t token; } ${p}_host;`
		, `static ${p}_host ${p}_hosts[4096];`
		, `typedef struct ${p}_frame { struct ${p}_frame *parent; unsigned key, host, type, owner; const uintptr_t *args; void *reply; } ${p}_frame;`
		, `static ${p}_frame *${p}_active; static unsigned ${p}_next;`
		, `EM_JS(int, ${p}_dispatch_js, (unsigned key, unsigned host, unsigned type, unsigned owner, const uintptr_t *args, void *reply), {`
		, `  return Module[${JSON.stringify(key)}].dispatch(key, host, type, owner, args, reply);`
		, "});"
		, `EM_JS(int, ${p}_finish_js, (unsigned key), { return Module[${JSON.stringify(key)}].finish(key); });`
		, `int ${symbols.valid}(unsigned key, unsigned host, unsigned type, unsigned owner, const uintptr_t *args, void *reply) {`
		, `  ${p}_frame *frame = ${p}_active;`
		, "  return frame && frame->key == key && frame->host == host && frame->type == type"
		, "    && frame->owner == owner && frame->args == args && frame->reply == reply;"
		, "}"
		, `int ${symbols.end}(unsigned host) {`
		, `  for (size_t i = 0; i < 4096; ++i) if (${p}_hosts[i].host == host && host) {`
		, `    lb_native_callback_release(${p}_hosts[i].token); ${p}_hosts[i] = (${p}_host){0}; return 0;`
		, "  }"
		, "  return LB_OWNED_INVALID;", "}"
		, `unsigned ${symbols.live}(void) { unsigned count = 0; for (unsigned i = 0; i < 4096; ++i) if (${p}_hosts[i].host) ++count; return count; }`];
	for(const callback of layout.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result);
		const params = callback.parameters.slice(1).map(id => nodes.get(id)), name = `${p}_v${node.index}`;
		const carrier = carriers.hostCallbacks.find(item => item.id === node.id);
		if(!carrier) throw new TypeError("Missing typed host callback carrier");
		lines.push(`static lean_object *${name}_invoke(void *opaque${params.map((_, i) => `, lean_object *a${i}`).join("")}) {`
			, `  ${p}_host *host = opaque; ov_callback_frame *parent = ov_active_callback_frame;`
			, `  int status = !parent || parent->transaction->scope.context != &${names.context} ? OV_CALLBACK : parent->status;`
			, "  ov_transaction arguments = {0}; lean_object *returned = NULL; unsigned owner_key = 0;"
			, `  ${result.cName} reply = {0};`
			, ...params.map((param, i) => `  ${param.cName} value${i} = {0};`)
			, `  uintptr_t pointers[${Math.max(1, params.length)}] = {${params.map((_, i) => `(uintptr_t)&value${i}`).join(", ") || "0"}};`
			, `  if (!status) { owner_key = ${names.open}(); if (!owner_key) status = LB_OWNED_LIMIT; }`
			, `  if (!status) status = ov_begin(&arguments, &${names.context}, ${names.find}(owner_key), ${component});`
			, "  if (!status) arguments.budget = parent->transaction->budget;"
			, ...params.map((param, i) => `  if (!status) { status = ${param.walker}_out(&value${i}, a${i}, 0, &arguments); a${i} = NULL; }`)
			, "  if (arguments.scope.context) parent->transaction->budget = arguments.budget;"
			, `  if (!status) status = ov_commit(&arguments, ${names.find}(owner_key));`
			, "  else if (arguments.scope.context) status = ov_abort(&arguments, status);"
			, `  if (!status && ${p}_next == UINT32_MAX) status = LB_OWNED_LIMIT;`
			, "  if (!status) {"
			, `    ${p}_frame frame = { .parent = ${p}_active, .key = ++${p}_next, .host = host->host, .type = host->type, .owner = owner_key, .args = pointers, .reply = &reply };`
			, `    ${p}_active = &frame;`
			, `    if (${p}_dispatch_js(frame.key, host->host, host->type, owner_key, pointers, &reply)) status = OV_CALLBACK;`
			, "    if (!status) status = lb_owned_scope_ready(&parent->transaction->scope);"
			, `    if (!status) status = ${result.walker}_in(&reply, 0, 1, parent->transaction, &returned);`
			, `    int finished = ${p}_finish_js(frame.key); if (!status && finished) status = OV_CALLBACK;`
			, `    ${p}_active = frame.parent;`, "  }"
			, `  if (owner_key) { int cleanup = ${names.release}(owner_key); if (!status) status = cleanup; }`
			, ...params.map((_, i) => `  if (a${i}) lean_dec(a${i});`)
			, "  if (status) { ov_callback_fail(parent, status); if (returned) lean_dec(returned); return lean_alloc_array(0, 0); }"
			, "  return returned;", "}"
			, `static int ${name}_begin(${p}_host *host, const void *fallback, void *out, ov_result_owner *owner) {`
			, `  if (!ov_pointer(out, sizeof(${node.cName}), _Alignof(${node.cName}))) return LB_OWNED_INVALID;`
			, ...carrier.automaticRecovery ? [] : ["  if (!fallback) return LB_OWNED_INVALID;"]
			, `  host->token = lb_native_callback_register((void (*)(void))${name}_invoke, host);`
			, "  if (!host->token) return LB_OWNED_LIMIT;"
			, "  if (host->token > UINTPTR_MAX) { lb_native_callback_release(host->token); host->token = 0; return LB_OWNED_LIMIT; }"
			, "  ov_transaction transaction = {0}; lean_object *recovery = NULL;"
			, `  int status = ov_begin(&transaction, &${names.context}, owner, ${component});`
			, `  if (!status && fallback) status = ${result.walker}_in(fallback, 0, 1, &transaction, &recovery);`
			, "  if (!status) {"
			, "    if (!recovery) recovery = lean_alloc_array(0, 0);"
			, `    lean_object *closure = ${carrier.symbol}_wrap((size_t)host->token, recovery);`
			, "    if (!ov_carrier(closure)) { lean_dec(closure); status = LB_OWNED_INVALID; }"
			, `    else status = ${node.walker}_out(out, closure, 0, &transaction);`, "  }"
			, "  if (!status) status = ov_commit(&transaction, owner);"
			, "  else if (transaction.scope.context) status = ov_abort(&transaction, status);"
			, "  if (status) { lb_native_callback_release(host->token); host->token = 0; }", "  return status;", "}");
	}
	lines.push(`int ${symbols.begin}(unsigned type, unsigned id, const void *fallback, void *out, unsigned owner_key) {`
		, `  ov_result_owner *owner = ${names.find}(owner_key); if (!owner || !id) return LB_OWNED_INVALID;`
		, `  ${p}_host *host = NULL;`
		, `  for (size_t i = 0; i < 4096; ++i) { if (${p}_hosts[i].host == id) return LB_OWNED_INVALID; if (!host && !${p}_hosts[i].host) host = &${p}_hosts[i]; }`
		, "  if (!host) return LB_OWNED_LIMIT;", `  *host = (${p}_host){ .host = id, .type = type };`
		, "  int status; switch (type) {"
		, ...layout.callbacks.map(callback => {
			const type = nodes.get(callback.id);
			return `  case ${type.index}: status = ${p}_v${type.index}_begin(host, fallback, out, owner); break;`;
		})
		, "  default: status = LB_OWNED_INVALID;", "  }"
		, `  if (status) *host = (${p}_host){0};`, "  return status;", "}");
	return { source: lines.join("\n") + "\n", handlerKey: key, symbols, callbacks: carriers.hostCallbacks };
};
