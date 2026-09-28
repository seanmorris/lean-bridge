/**
 * Component-local wasm32 entry points for typed owned values and callbacks.
 * The shared broker owns Lean initialization and cross-component identities.
 *
 * @file
 */
import { compileOwnedJavaScriptWasmLayout } from "./owned-wasm-layout.mjs";
import { generateOwnedWasmCallbacks } from "./owned-wasm-callbacks.mjs";
import { ownedWasmControlBytes, ownedWasmControlOperations, ownedWasmControlVersion } from "../../abi/owned-wasm-control.mjs";
import { assertComponentOwnedWasmBindings, componentOwnedWasmAbi } from "../../abi/component-owned-wasm.mjs";

/**
 * Generate one component's private native bindings. Allocation headers retain
 * exact output widths; claims also require membership in the named result owner.
 * No process-global allocation scan or test-only owner table is required.
 *
 * @param generated - Compiler-authenticated native adapter for wasm32.
 */
export const generateOwnedWasmComponent = generated => {
	if(generated?.layout?.wordBits !== 32)
		throw new TypeError("Owned JavaScript components require a wasm32 adapter");
	const native = generated.layout, layout = compileOwnedJavaScriptWasmLayout(native.model.bindingIr);
	if(generated.typesHeader !== layout.native.header || JSON.stringify(native) !== JSON.stringify(layout.native))
		throw new TypeError("Owned JavaScript component layout differs from its binding IR");
	const p = `lbjs_component_${native.model.bindingIrSha256.slice(0, 20)}`;
	const names = ["init", "open", "valid", "release", "claim", "identity"
		, "dispatch", "retain", "close", "live", "results"];
	const symbols = Object.fromEntries(names.map(name => [name, `${p}_${name}`]));
	const context = `${p}_context`, find = `${p}_find`;
	const callbacks = Array.isArray(generated.carriers.hostCallbacks)
		? generateOwnedWasmCallbacks(generated, { context, find, open: symbols.open, release: symbols.release }) : null;
	const component = JSON.stringify(native.model.component.id);
	const types = new Map(native.nodes.map(type => [type.id, type]));
	const identities = native.nodes.filter(type => ["resource", "callback"].includes(type.kind));
	const signatures = [...native.functions, ...native.callbacks];
	const controlSymbol = `${p}_control`, op = ownedWasmControlOperations;
	const privateAbi = Object.freeze({ version: componentOwnedWasmAbi
		, dispatch: "owned-wasm32-control-v1", controlSymbol
		, initializer: `initialize_${generated.carriers.module}`
		, callbackKey: callbacks?.handlerKey ?? null, layout });
	const metadataHash = assertComponentOwnedWasmBindings(privateAbi, native.model.bindingIr);
	const source = `#include <lean/lean.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#ifndef LB_JS_ALLOC_FAIL
#define LB_JS_ALLOC_FAIL() 0
#endif
typedef struct {
  size_t bytes;
  max_align_t alignment;
  unsigned char data[];
} ${p}_allocation;
static size_t ${p}_live_allocations;
static void *${p}_allocate(size_t bytes) {
  if (bytes > SIZE_MAX - sizeof(${p}_allocation) || LB_JS_ALLOC_FAIL()) return NULL;
  ${p}_allocation *allocation = calloc(1, sizeof(*allocation) + bytes);
  if (!allocation) return NULL;
  allocation->bytes = bytes; ++${p}_live_allocations; return allocation->data;
}
static ${p}_allocation *${p}_allocation_of(const void *value) {
  return (${p}_allocation *)((unsigned char *)value - offsetof(${p}_allocation, data));
}
static void ${p}_free(void *value) {
  if (!value) return;
  --${p}_live_allocations; free(${p}_allocation_of(value));
}
#define LB_OWNED_ALLOC ${p}_allocate
#define LB_OWNED_FREE ${p}_free
#include "owned-values-codec.h"
#include "owned-js-layout.h"
extern lean_object *initialize_${generated.carriers.module}(uint8_t);
static lb_owned_context ${context};
typedef struct { ov_result_owner value; unsigned key; } ${p}_owner;
static ${p}_owner ${p}_owners[4096];
static unsigned ${p}_next_owner, ${p}_closed;
static ov_result_owner *${find}(unsigned key) {
  if (!key) return NULL;
  for (size_t i = 0; i < 4096; ++i)
    if (${p}_owners[i].key == key) return &${p}_owners[i].value;
  return NULL;
}
unsigned ${symbols.open}(void) {
  if (lb_owned_ready(&${context}) || ${p}_next_owner == UINT32_MAX) return 0;
  for (size_t i = 0; i < 4096; ++i) if (!${p}_owners[i].key) {
    ${p}_owners[i].key = ++${p}_next_owner; return ${p}_next_owner;
  }
  return 0;
}
int ${symbols.valid}(unsigned key) { return ${find}(key) != NULL; }
int ${symbols.release}(unsigned key) {
  ov_result_owner *owner = ${find}(key); if (!owner) return LB_OWNED_INVALID;
  int status = ov_owner_clear(owner);
  if (!status) for (size_t i = 0; i < 4096; ++i)
    if (${p}_owners[i].key == key) { ${p}_owners[i].key = 0; break; }
  return status;
}
${callbacks?.source ?? ""}
int ${symbols.init}(void) {
  if (${p}_closed) return LB_OWNED_CLOSED;
  if (${context}.initialized) return lb_owned_ready(&${context});
  if (!lean_bridge_native_component_initialize(${component},
      (lean_bridge_native_initializer)initialize_${generated.carriers.module})) return LB_OWNED_RUNTIME;
  return lb_owned_context_init(&${context}, ${component});
}
int ${symbols.dispatch}(unsigned index, const uintptr_t *args, void *out, unsigned key) {
  ov_result_owner *owner = ${find}(key); if (!owner) return LB_OWNED_INVALID;
  switch (index) {
${signatures.map((fn, index) => {
		const params = fn.parameters.map(id => types.get(id)), result = types.get(fn.result);
		const checks = [
			`!ov_pointer(out, sizeof(${result.cName}), _Alignof(${result.cName}))`
			, ...params.length ? [`!ov_pointer(args, ${params.length} * sizeof(*args), _Alignof(uintptr_t))`] : []
		];
		const argumentsText = params.map((type, i) => `(const ${type.cName} *)args[${i}]`);
		return `  case ${index}:
    if (${checks.join(" || ")}) return LB_OWNED_INVALID;
    return ${fn.symbol}(&${context}, ${[...argumentsText, `(${result.cName} *)out`, "owner"].join(", ")});`;
}).join("\n")}
  default: return LB_OWNED_INVALID;
  }
}
int ${symbols.claim}(unsigned key, const void *pointer, size_t bytes) {
  ov_result_owner *owner = ${find}(key); if (!owner) return 0;
  for (ov_allocation *allocation = owner->allocations; allocation; allocation = allocation->next) {
    if (allocation->data != pointer) continue;
    size_t actual = ${p}_allocation_of(allocation)->bytes;
    return actual >= sizeof(*allocation) && actual - sizeof(*allocation) == bytes;
  }
  return 0;
}
int ${symbols.identity}(unsigned key, unsigned type, uint64_t token) {
  ov_result_owner *owner = ${find}(key); if (!owner) return 0;
  const char *kind;
  switch (type) {
${identities.map(type => `  case ${type.index}: kind = ${JSON.stringify(type.identityKind)}; break;`).join("\n")}
  default: return 0;
  }
  for (lb_owned_entry *entry = owner->batch.entries; entry; entry = entry->next)
    if (entry->owner->token == token && !strcmp(entry->owner->kind, kind)) return 1;
  return 0;
}
int ${symbols.retain}(unsigned type, uint64_t token, void *out, unsigned key) {
  ov_result_owner *owner = ${find}(key); if (!owner) return LB_OWNED_INVALID;
  ov_transaction transaction = {0};
  int status = ov_begin(&transaction, &${context}, owner, ${component});
  if (status) return status;
  lean_object *value = NULL;
  switch (type) {
${identities.map(type => `  case ${type.index}: {
    ${type.cName} input = { .token = token };
    if (!ov_pointer(out, sizeof(input), _Alignof(${type.cName}))) { status = LB_OWNED_INVALID; break; }
    status = ${type.walker}_in(&input, 0, 1, &transaction, &value);
    if (!status) status = ${type.walker}_out(out, value, 0, &transaction);
    break;
  }`).join("\n")}
  default: status = LB_OWNED_INVALID;
  }
  return status ? ov_abort(&transaction, status) : ov_commit(&transaction, owner);
}
int ${symbols.close}(void) {
  if (${p}_closed) return LB_OWNED_OK;
  int status = lb_owned_affinity(&${context});
  if (status) return status;
  if (${context}.top${callbacks ? ` || ${callbacks.symbols.live}()` : ""}) return LB_OWNED_ORDER;
  for (size_t i = 0; i < 4096; ++i) if (${p}_owners[i].key) {
    status = ${symbols.release}(${p}_owners[i].key); if (status) return status;
  }
  status = lb_owned_context_close(&${context});
  if (!status) { ${p}_closed = 1; lean_bridge_native_component_detach(${component}); }
  return status;
}
unsigned ${symbols.live}(void) { return ${p}_live_allocations; }
unsigned ${symbols.results}(void) {
  unsigned count = 0;
  for (size_t i = 0; i < 4096; ++i) if (${p}_owners[i].key) ++count;
  return count;
}
typedef struct {
  uint32_t version, bytes, status, operation;
  uint32_t arguments[8];
  uint64_t token;
  uint32_t value, reserved;
} ${p}_control_frame;
_Static_assert(sizeof(${p}_control_frame) == ${ownedWasmControlBytes}, "owned JS control size");
_Static_assert(_Alignof(${p}_control_frame) == 8, "owned JS control alignment");
_Static_assert(offsetof(${p}_control_frame, status) == 8, "owned JS trampoline status");
_Static_assert(offsetof(${p}_control_frame, token) == 48, "owned JS control token");
_Static_assert(offsetof(${p}_control_frame, value) == 56, "owned JS control result");
static const uint32_t ${p}_metadata[8] = {
  ${metadataHash.match(/.{8}/gu).map(word => `UINT32_C(0x${word})`).join(", ")}
};
unsigned ${controlSymbol}(${p}_control_frame *frame) {
  if (!ov_pointer(frame, sizeof(*frame), _Alignof(${p}_control_frame))) return LB_OWNED_INVALID;
  if (frame->version != ${ownedWasmControlVersion} || frame->bytes != sizeof(*frame) || frame->status
      || frame->value || frame->reserved) return frame->status = LB_OWNED_INVALID;
  const uint32_t *a = frame->arguments; int status = 0;
  switch (frame->operation) {
  case ${op.init}: status = ${symbols.init}(); break;
  case ${op.open}: frame->value = ${symbols.open}(); break;
  case ${op.valid}: frame->value = ${symbols.valid}(a[0]); break;
  case ${op.release}: status = ${symbols.release}(a[0]); break;
  case ${op.claim}: frame->value = ${symbols.claim}(a[0], (const void *)a[1], a[2]); break;
  case ${op.identity}: frame->value = ${symbols.identity}(a[0], a[1], frame->token); break;
  case ${op.dispatch}: status = ${symbols.dispatch}(a[0], (const uintptr_t *)a[1], (void *)a[2], a[3]); break;
  case ${op.retain}: status = ${symbols.retain}(a[0], frame->token, (void *)a[1], a[2]); break;
  case ${op.close}: status = ${symbols.close}(); break;
  case ${op.live}: frame->value = ${symbols.live}(); break;
  case ${op.results}: frame->value = ${symbols.results}(); break;
  case ${op.metadata}:
    if (a[0] >= 8) status = LB_OWNED_INVALID;
    else frame->value = ${p}_metadata[a[0]];
    break;
${callbacks ? `  case ${op.callbackBegin}: status = ${callbacks.symbols.begin}(a[0], a[1], (const void *)a[2], (void *)a[3], a[4]); break;
  case ${op.callbackEnd}: status = ${callbacks.symbols.end}(a[0]); break;
  case ${op.callbackValid}: frame->value = ${callbacks.symbols.valid}(a[0], a[1], a[2], a[3], (const uintptr_t *)a[4], (void *)a[5]); break;
  case ${op.callbackLive}: frame->value = ${callbacks.symbols.live}(); break;
` : ""}  default: status = LB_OWNED_INVALID;
  }
  return frame->status = (uint32_t)status;
}
`;
	return Object.freeze({ schemaVersion: 1
		, kind: "owned-javascript-wasm32-component"
		, layout, symbols: Object.freeze(symbols)
		, controlSymbol, callbacks, source, privateAbi, metadataHash });
};
