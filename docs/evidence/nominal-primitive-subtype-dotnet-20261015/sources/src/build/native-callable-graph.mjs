/**
 * Native descriptors for finite copied callback payloads and closure carriers.
 * Public identities stay separate from the copied graph. No Wasm frame is part
 * of the compiled native model.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { componentRecordDefinitions } from "../abi/component-records.mjs";
import { componentStructuredCallableAbi, componentStructuredCallableDispatch,
	componentStructuredCallableSignatureText, assertComponentStructuredCallableBindings } from "../abi/component-structured-callables.mjs";
import { componentStructuredCallablePrefix } from "./component-structured-callable-lean.mjs";

/**
 * Bind native callable signatures to every finite copied nominal definition.
 *
 * @param ir - Compiler-authenticated public signatures.
 */
export const createNativeCallableGraphDescriptor = ir => {
	validateBindingIr(ir);
	const types = componentRecordDefinitions({ types: ir.types.filter(type => type.kind !== "callback") }, true);
	const callbacks = ir.types.filter(type => type.kind === "callback").map(type => {
		const signature = { parameters: type.callable.parameters.map(site => site.type), result: type.callable.result.type };
		return { id: type.id, key: sha256(componentStructuredCallableSignatureText(signature, types)).slice(0, 40), ...signature };
	});
	const exports = ir.declarations.map(item => ({ bindingId: item.id
		, symbol: `lean_bridge_${sha256(`${ir.component.id}\0${item.id}`).slice(0, 24)}`
		, parameters: item.parameters.map(site => site.type)
		, result: item.result.type
		, resultMode: item.resultMode }));
	const descriptor = { schemaVersion: 1, types, callbacks, exports };
	assertComponentStructuredCallableBindings(carrier(descriptor), ir);
	return descriptor;
};

const carrier = descriptor => ({ version: componentStructuredCallableAbi
	, dispatch: componentStructuredCallableDispatch
	, types: descriptor.types
	, callbacks: descriptor.callbacks
	, exports: descriptor.exports });

/**
 * Reuse typed carrier generation after authenticating the entire native model.
 * The returned protocol is an internal generator view, not a native wire ABI.
 *
 * @param descriptor - Serialized native copied graph and callable identities.
 * @param ir - Independently authenticated public semantics.
 */
export const nativeCallableGraphCarrierAbi = (descriptor, ir) => {
	if(canonicalJson(descriptor) !== canonicalJson(createNativeCallableGraphDescriptor(ir)))
		throw new TypeError("Native callable graph differs from its public signatures");
	return carrier(descriptor);
};

/**
 * Match every generated Lean callback carrier with its native C prototype.
 *
 * @param abi - Authenticated typed callable carrier view.
 */
export const nativeCallableGraphHeader = abi => {
	const lines = [];
	for(const signature of abi.callbacks)
	{
		const symbol = componentStructuredCallablePrefix(abi, signature);
		const parameters = signature.parameters.map(() => "lean_object *").join(", ");
		lines.push(`lean_object *${symbol}_wrap(size_t);`
			, `lean_object *${symbol}_apply(lean_object *, ${parameters});`
			, `lean_object *${symbol}_invoke(size_t, ${parameters});`);
	}
	for(const item of abi.exports)
		lines.push(`lean_object *${item.symbol}_lean(${Array(Math.max(1, item.parameters.length)).fill("lean_object *").join(", ")});`);
	return lines.join("\n") + "\n";
};

/**
 * Use generation-checked native borrows without assuming Lean closure layouts.
 * Empty carriers propagate failure through the typed Lean recovery branch.
 *
 * @param abi - Authenticated typed callable carrier view.
 */
export const generateNativeCallableGraphTrampolines = abi => {
	const lines = ['#include "component.h"', '#include "lean_bridge_native_runtime.h"'];
	for(const signature of abi.callbacks)
	{
		const symbol = componentStructuredCallablePrefix(abi, signature);
		const names = signature.parameters.map((_, index) => `value${index}`);
		const parameters = names.map(name => `lean_object *${name}`).join(", ");
		const types = names.map(() => "lean_object *").join(", ");
		lines.push(`lean_object *${symbol}_invoke(size_t token, ${parameters}) {`
			, "  lb_native_callback callback = lb_native_callback_lookup(token);"
			, "  if (!callback.invoke) {"
			, ...names.map(name => `    lean_dec(${name});`)
			, "    return lean_alloc_array(0, 0);", "  }"
			, `  return ((lean_object *(*)(void *, ${types}))callback.invoke)(callback.context, ${names.join(", ")});`
			, "}");
	}
	return lines.join("\n") + "\n";
};
