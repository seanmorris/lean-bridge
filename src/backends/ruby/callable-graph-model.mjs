/**
 * Ruby callable signatures over the authenticated finite native payload graph.
 * Callable identities remain outside copied fields and containers.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../build/native-callable-graph.mjs";
import { compileNativeCallableGraphPayloads } from "../c/native-callable-graph-payloads.mjs";
import { compileCopiedRubyGraphPackageModel } from "./copied-graph-package.mjs";
import { compileCopiedRubyGraphLayout } from "./copied-graph-layout.mjs";
import { cIdentifier } from "../c/generate.mjs";

const reserved = new Set("nil true false self super class module def end begin rescue ensure return yield alias and or not if unless while until case when then else elsif for in do break next redo retry undef defined initialize initialize_copy new send public_send method_missing object_id freeze frozen hash eql equal dup clone tap inspect to_s respond_to const_get const_set module_function private_constant deconstruct deconstruct_keys raise".split(" "));

/**
 * Bind public functions and closure signatures to their private native layout.
 *
 * @param ir - Checked copied and synchronous callable Binding IR.
 */
export const compileCallableRubyGraphPackageModel = ir => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const values = { ...compileCopiedRubyGraphPackageModel(payloads.ir), ...compileCopiedRubyGraphLayout(payloads.ir) };
	const nodes = new Map(values.types.map(node => [node.id, node]));
	const copy = ref => nodes.get(payloads.copy(ref).id);
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const callback = { ...signature, index
			, parameters: signature.parameters.map(copy)
			, result: copy(signature.result)
			, call: `${values.prefix}_callback_${signature.key}_lease_call`
			, dispose: `${values.prefix}_callback_${signature.key}_lease_dispose` };
		return [signature.id, callback];
	}));
	const names = new Set();
	const value = site => {
		const callback = callbacks.get(site.type.id);
		return { callback, node: callback ? null : copy(site.type) };
	};
	const functions = ir.declarations.map((declaration, index) => {
		const publicName = cIdentifier(declaration.name);
		if(!/^[a-z][a-z0-9_]*$/.test(publicName) || reserved.has(publicName) || names.has(publicName))
			throw new TypeError(`Reserved or duplicate Ruby function ${publicName}`);
		names.add(publicName);
		return { declaration, index, publicName
			, parameters: declaration.parameters.map(value)
			, result: value(declaration.result)
			, native: descriptor.exports.find(entry => entry.bindingId === declaration.id).symbol + "_graph" };
	});
	return { ...values, ir, descriptor, payloads, callbacks, functions
		, callableGraph: true
		, layoutSha256: sha256(canonicalJson({ layout: values.layout, descriptor })) };
};
