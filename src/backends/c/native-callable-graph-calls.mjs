/**
 * Exported graph calls and generation-checked closure leases. This is the
 * private native ABI shared by host projections, not a public C value API.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { componentStructuredCallbackDirection } from "../../abi/component-structured-callables.mjs";
import { nativeCallableGraphCarrierAbi, nativeCallableGraphHeader } from "../../build/native-callable-graph.mjs";
import {
	componentStructuredCallablePrefix, componentStructuredClosureRefusals
} from "../../build/component-structured-callable-lean.mjs";
import { generateNativeCallableGraphBorrows } from "./native-callable-graph-borrows.mjs";
import { nativeGraphRefinementDiagnostics } from "./native-graph-adapters.mjs";

/**
 * Generate checked calls without exposing Lean objects to host adapters.
 * Failed calls leave output slots unchanged. Disposing a lease invalidates its
 * token immediately; an active invocation retains its own Lean reference.
 *
 * @param ir - Compiler-authenticated public semantics.
 * @param descriptor - Exact matching native callback descriptor.
 * @param options - Target initialization and machine-word layout.
 * @param options.initializer - Required checked component initializer.
 * @param options.wordBits - Native pointer width.
 * @param options.finDirections - Recover Fin-only callback roles from exports.
 */
export const generateNativeCallableGraphCalls = (ir, descriptor, {
	initializer, wordBits = 64, finDirections = false
} = {}) => {
	if(typeof initializer !== "string" || !/^initialize_LeanBridgeNative[0-9a-f]{16}$/.test(initializer))
		throw new TypeError("Native callable graph calls require a checked component initializer");
	const abi = nativeCallableGraphCarrierAbi(descriptor, ir);
	const generated = generateNativeCallableGraphBorrows(ir, descriptor, { wordBits, initializer, finDirections });
	const p = generated.layout.prefix, copy = generated.payloads.copy;
	const callbacks = new Map(abi.callbacks.map(signature => [signature.id, signature]));
	const callback = ref => callbacks.get(ref.id);
	const direction = signature => componentStructuredCallbackDirection(abi, signature, finDirections);
	const storesClosures = [...abi.exports, ...abi.callbacks].some(item => callback(item.result));
	const callbackName = signature => `${p}_callback_${signature.key}`;
	const walker = ref => `ng_${sha256(copy(ref).id).slice(0, 20)}`;
	const kind = signature => JSON.stringify(`${ir.component.id}:graph-callback:${signature.key}`);
	const header = ["#pragma once", `#include "${p}-callable-borrows.h"`
		, "#ifdef __cplusplus", 'extern "C" {', "#endif"];
	// A returned closure that refuses a checked argument answers an empty carrier. Only then does
	// its lease call walk the arguments in the closure's own conversion order with the exported
	// per-leaf checks, recording the first refused position for this thread's next read.
	const refusals = componentStructuredClosureRefusals(abi, { finDirections });
	const table = new Map(generated.layout.nodes.map((node, index) => [node.id, { ...node, index }]));
	const labels = signature => signature.parameters.map((_, index) => ir.types
		.find(type => type.id === signature.id)?.callable.parameters[index]?.name ?? `arg${index}`);
	const nodes = signature => signature.parameters.map(ref => callback(ref) ? null : copy(ref).id);
	const sites = refusals?.sites.map(item => ({ ...item, diagnosticParameterNames: labels(item.signature) }));
	const diagnostics = refusals && nativeGraphRefinementDiagnostics({
		abi, exports: [], layout: generated.layout, table
		, walker: id => `ng_${sha256(id).slice(0, 20)}`
		, normalized: { cycles: refusals.cycles, sites }
		, roots: new Map(sites.map(item => [item.bindingId, { parameters: nodes(item.signature) }]))
		, modes: ["ordered"], accessor: `${p}_callable_graph_error`
	});
	// Every shared refusal site has a pass, so a host projection can rely on the shared sites alone.
	if(refusals && refusals.sites.some(item => !diagnostics?.calls.has(item.bindingId)))
		throw new TypeError("A refusing returned closure lacks a native diagnostic pass");
	const refuses = signature => Boolean(diagnostics?.calls.has(signature.id));
	if(diagnostics) header.push(`const char *${p}_callable_graph_error(void);`);
	const lines = ["#include <lean/lean.h>"
		, nativeCallableGraphHeader(abi, { finDirections }), generated.source
		, `
#include <pthread.h>
#include <unistd.h>
typedef struct {
  ng_borrow_frame borrowed;
  uint64_t tokens[32];
  size_t count;
} ng_call_frame;
static _Thread_local ng_call_frame ng_call_frames[64];
static _Thread_local size_t ng_call_depth;
static void ng_call_observe(ng_borrow_frame *borrowed) {
  ng_call_frame *frame = (ng_call_frame *)borrowed;
  if (!ng_ready()) ng_borrow_fail(borrowed, NG_RUNTIME);
  if (lb_native_callback_take_error()) ng_borrow_fail(borrowed, NG_INVALID);
  for (size_t i = 0; i < frame->count; ++i)
    if (lb_native_callback_wrong_thread(frame->tokens[i])) ng_borrow_fail(borrowed, NG_INVALID);
}
static ng_call_frame *ng_call_enter(void) {
  if (ng_call_depth) ng_call_observe(&ng_call_frames[ng_call_depth - 1].borrowed);
  if (ng_call_depth == 64) return NULL;
  ng_call_frame *frame = &ng_call_frames[ng_call_depth++];
  *frame = (ng_call_frame){ .borrowed = {
    .budget = { .bytes = 16u * 1024u * 1024u, .nodes = ${componentRecursiveLimits.valueNodes} },
    .observe = ng_call_observe } };
  return frame;
}
static uint32_t ng_call_leave(ng_call_frame *frame) {
  ng_call_observe(&frame->borrowed);
  for (size_t i = 0; i < frame->count; ++i) lb_native_callback_release(frame->tokens[i]);
  frame->count = 0; --ng_call_depth;
  return frame->borrowed.status;
}
typedef struct {
  uint64_t token;
  lean_object *value;
  const char *kind;
  uint64_t thread;
  pid_t process;
} ng_closure_lease;
static ng_closure_lease ng_closure_leases[4096];
static pthread_mutex_t ng_closure_mutex = PTHREAD_MUTEX_INITIALIZER;
/* pthread_t and TLS addresses can be reused after a thread exits. A lease must
   stay bound to the original thread lifetime, not a recycled OS identifier. */
static uint64_t ng_closure_thread_serial;
static _Thread_local uint64_t ng_closure_thread;
static ${storesClosures ? "" : "inline "}uint64_t ng_closure_store(lean_object *value, const char *kind) {
  uint64_t token = 0;
  pthread_mutex_lock(&ng_closure_mutex);
  if (!ng_closure_thread) {
    if (ng_closure_thread_serial == UINT64_MAX) { pthread_mutex_unlock(&ng_closure_mutex); return 0; }
    ng_closure_thread = ++ng_closure_thread_serial;
  }
  for (size_t i = 0; i < 4096; ++i) {
    ng_closure_lease *slot = &ng_closure_leases[i];
    if (slot->token) continue;
    token = lean_bridge_native_identity_acquire(kind, slot);
    if (token) {
      lean_mark_mt(value);
      *slot = (ng_closure_lease){token, value, kind, ng_closure_thread, getpid()};
    }
    break;
  }
  pthread_mutex_unlock(&ng_closure_mutex);
  return token;
}
static lean_object *ng_closure_borrow(uint64_t token, const char *kind) {
  lean_object *value = NULL;
  pthread_mutex_lock(&ng_closure_mutex);
  for (size_t i = 0; token && i < 4096; ++i) {
    ng_closure_lease *slot = &ng_closure_leases[i];
    if (slot->token == token && !strcmp(slot->kind, kind) && slot->process == getpid()
        && slot->thread == ng_closure_thread) {
      value = slot->value; lean_inc(value); break;
    }
  }
  pthread_mutex_unlock(&ng_closure_mutex);
  return value;
}
static void ng_closure_drop(uint64_t token, const char *kind) {
  lean_object *value = NULL;
  pthread_mutex_lock(&ng_closure_mutex);
  for (size_t i = 0; token && i < 4096; ++i) {
    ng_closure_lease *slot = &ng_closure_leases[i];
    if (slot->token == token && !strcmp(slot->kind, kind) && slot->process == getpid()) {
      value = slot->value;
      (void)lean_bridge_native_identity_release(token, kind, slot);
      *slot = (ng_closure_lease){0}; break;
    }
  }
  pthread_mutex_unlock(&ng_closure_mutex);
  if (value) lean_dec(value);
}
`];
	const argument = (ref, index) => `const ${callback(ref) ? callbackName(callback(ref)) : copy(ref).name} *a${index}`;
	const checked = (signature, index) => diagnostics.calls.get(signature.id)
		.some(pass => pass.checked.some(item => item.index === index));
	const refusal = ({ signature }) => [
		`static uint32_t ng_closure_refusal_${signature.key}(${signature.parameters.map(argument).join(", ")}) {`
		, ...signature.parameters.flatMap((_, index) => checked(signature, index) ? [] : [`  (void)a${index};`])
		, "  uint32_t status;"
		, "  ng_refinement_reset();"
		, ...diagnostics.checks(signature.id)
		, "  return NG_OK;"
		, "}"];
	if(diagnostics) lines.push(diagnostics.support, ...diagnostics.validators
		, ...diagnostics.bounds, ...diagnostics.prototypes, ...diagnostics.helpers
		, ...refusals.sites.filter(item => refuses(item.signature)).flatMap(refusal));
	const render = (name, parameters, resultRef, symbol, lease = null) => {
		const resultCallback = callback(resultRef), result = resultCallback ? null : copy(resultRef);
		const rejectsInput = lease && direction(lease) === "closure"
			|| parameters.some(ref => callback(ref) && direction(callback(ref)) === "host");
		const resultName = resultCallback ? "uint64_t" : result.name;
		const args = parameters.map((ref, index) => `const ${callback(ref) ? callbackName(callback(ref)) : copy(ref).name} *a${index}`);
		const signature = `uint32_t ${name}(${[...lease ? ["uint64_t self"] : [], ...args, `${resultName} *out`].join(", ")})`;
		header.push(signature + ";");
		// With refusing closures present, every call clears the diagnostic on entry and exit, so it
		// is set only between a lease call that located a refusal and the next call or read.
		const refusing = lease !== null && refuses(lease);
		lines.push(signature + " {"
			, ...diagnostics ? ["  ng_refinement_reset();"] : [], ...refusing ? ["  int refused = 0;"] : []
			, `  if (!ng_pointer(out, sizeof(*out), _Alignof(${resultName}))) return NG_INVALID;`
			, ...result?.aggregate ? ["  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;"] : []
			, ...resultCallback ? ["  if (*out) return NG_INVALID;"] : []
			, `  if (!lean_bridge_native_component_initialize(${JSON.stringify(ir.component.id)}, ng_initialize)) return NG_RUNTIME;`
			, "  ng_call_frame *call = ng_call_enter(); if (!call) return NG_LIMIT;"
			, "  ng_borrow_frame *frame = &call->borrowed;"
			, "  ng_arena arena = { .head = NULL, .budget = &frame->budget };"
			, `  ${resultName} result = {0};`
			, "  lean_object *value = NULL;"
			, ...lease ? ["  lean_object *closure = NULL;"] : []
			, ...parameters.flatMap((ref, index) => callback(ref)
				? [`  ng_borrow_${callback(ref).key} host${index} = {0};`, `  uint64_t token${index} = 0;`] : [])
			, "  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(result)));"
			, "  if (frame->status) goto cleanup;");
		parameters.forEach((ref, index) => {
			if(callback(ref)) lines.push(`  if (!ng_pointer(a${index}, sizeof(*a${index}), _Alignof(${callbackName(callback(ref))})) || !a${index}->call${direction(callback(ref)) === "host" ? ` || !a${index}->recovery` : ""}) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }`);
			else lines.push(`  ng_borrow_fail(frame, ${walker(ref)}_check(a${index}, 0, 1, &frame->budget));`
				, "  if (frame->status) goto cleanup;");
		});
		if(lease) lines.push(`  closure = ng_closure_borrow(self, ${kind(lease)});`
			, "  if (!closure) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }");
		parameters.forEach((ref, index) => {
			const signature = callback(ref);
			if(!signature) return;
			lines.push(`  host${index} = (ng_borrow_${signature.key}){${direction(signature) === "host" ? `{ng_recovery_${signature.key}, ng_reject_${signature.key}}, ` : ""}*a${index}, frame};`
				, `  token${index} = lb_native_callback_register((void (*)(void))ng_invoke_${signature.key}, &host${index});`
				, `  if (!token${index}) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }`
				, `  call->tokens[call->count++] = token${index};`);
		});
		const values = parameters.map((ref, index) => callback(ref)
			? `${componentStructuredCallablePrefix(abi, callback(ref))}_wrap((size_t)token${index})`
			: `${walker(ref)}_in(a${index})`);
		lines.push(`  value = ${symbol}(${[...lease ? ["closure"] : [], ...values].join(", ") || "lean_box(0)"});`
			, ...lease ? ["  closure = NULL; /* The typed Lean apply consumed this call's reference. */"] : []
			, "  ng_call_observe(frame);"
			, "  if (frame->status) goto cleanup;");
		if(rejectsInput) lines.push("  if (!lean_is_scalar(value) && lean_is_array(value) && lean_array_size(value) == 0) {"
			, ...refusing ? [`    refused = ng_closure_refusal_${lease.key}(${parameters.map((_, index) => `a${index}`).join(", ")}) == NG_INVALID;`] : []
			, "    lean_dec(value); value = NULL; ng_borrow_fail(frame, NG_INVALID); goto cleanup;"
			, "  }");
		if(resultCallback) lines.push("  if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { ng_borrow_fail(frame, NG_RESULT); goto cleanup; }"
			, `  result = ng_closure_store(value, ${kind(resultCallback)});`
			, "  if (!result) { ng_borrow_fail(frame, NG_ALLOC); goto cleanup; }"
			, "  value = NULL;");
		else lines.push(`  ng_borrow_fail(frame, ${walker(resultRef)}_out(&result, value, 0, &arena));`
			, "  value = NULL; /* The walker consumes its carrier on every path. */");
		lines.push("cleanup:"
			, "  if (value) lean_dec(value);"
			, ...lease ? ["  if (closure) lean_dec(closure);"] : []
			, "  if (frame->status == NG_RESULT) lean_bridge_native_runtime_retire();"
			, "  uint32_t status = ng_call_leave(call);"
			, ...refusing ? ["  if (status != NG_INVALID || !refused) ng_refinement_reset();"] : diagnostics ? ["  ng_refinement_reset();"] : []
			, "  if (status) {"
			, ...resultCallback ? [`    if (result) ng_closure_drop(result, ${kind(resultCallback)});`] : []
			, "    ng_release(arena.head); return status;", "  }"
			, ...result?.aggregate ? ["  result._bridge_owner = arena.head;", "  result._bridge_release = arena.head ? ng_release : NULL;"] : ["  ng_release(arena.head);"]
			, "  *out = result; return NG_OK;", "}");
		return name;
	};
	const calls = abi.exports.map(item => ({ bindingId: item.bindingId
		, name: render(`${item.symbol}_graph`, item.parameters, item.result, `${item.symbol}_lean`)
		, parameters: item.parameters, result: item.result }));
	const closures = abi.callbacks.filter(signature => direction(signature) !== "host").map(signature => {
		const prefix = `${callbackName(signature)}_lease`;
		const call = render(`${prefix}_call`, signature.parameters, signature.result
			, `${componentStructuredCallablePrefix(abi, signature)}_apply`, signature);
		header.push(`void ${prefix}_dispose(uint64_t token);`);
		lines.push(`void ${prefix}_dispose(uint64_t token) { ng_closure_drop(token, ${kind(signature)}); }`);
		return { id: signature.id, call, dispose: `${prefix}_dispose` };
	});
	header.push("#ifdef __cplusplus", "}", "#endif", "");
	return { ...generated
		, borrowsHeader: generated.header
		, header: header.join("\n")
		, calls, closures, source: lines.join("\n") + "\n" };
};
