/**
 * Public PHP names and private wasm32 layouts for finite callback payloads.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { createNativeCallableGraphDescriptor } from "../../build/native-callable-graph.mjs";
import { compileNativeCallableGraphPayloads } from "../c/native-callable-graph-payloads.mjs";
import { compileCopiedPhpGraphZendModel } from "./copied-graph-zend.mjs";
import { cIdentifier } from "../c/generate.mjs";
import { phpClassName, phpFieldName } from "./copied-names.mjs";

/**
 * Bind every callable site to a copied payload, leaving identities out of values.
 *
 * @param ir - Compiler-checked public Binding IR.
 */
export const compileCallablePhpGraphZendModel = ir => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	if(!descriptor.callbacks.length) throw new TypeError("Callable Zend graphs require a callback signature");
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor, { wordBits: 32 });
	const generated = compileCopiedPhpGraphZendModel(payloads.ir), prefix = generated.layout.prefix;
	const nodes = new Map(generated.types.map(node => [node.id, node]));
	const copy = ref => {
		const node = nodes.get(payloads.copy(ref).id);
		if(!node) throw new TypeError("Missing wasm32 PHP callable payload");
		return node;
	};
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const parameters = signature.parameters.map(copy), result = copy(signature.result);
		const projected = { ...signature, index, parameters, result
			, docType: `callable(${parameters.map(node => node.docType).join(", ")}): ${result.docType}`
			, borrowedType: `${prefix}_callback_${signature.key}`
			, call: `${prefix}_callback_${signature.key}_lease_call`
			, dispose: `${prefix}_callback_${signature.key}_lease_dispose` };
		return [signature.id, projected];
	}));
	const value = ref => callbacks.has(ref.id) ? { callback: callbacks.get(ref.id) } : { node: copy(ref) };
	const names = new Set();
	const functions = ir.declarations.map((declaration, index) => {
		const publicName = phpClassName(cIdentifier(declaration.name));
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(publicName) || names.has(publicName.toLowerCase()))
			throw new TypeError("Reserved or duplicate PHP callable function: " + publicName);
		names.add(publicName.toLowerCase());
		const parameterNames = declaration.parameters.map(site => phpFieldName(site.name, message => { throw new TypeError(message); }));
		if(new Set(parameterNames).size !== parameterNames.length) throw new TypeError("PHP callable parameters require distinct names");
		return { index, declaration, publicName, parameterNames
			, parameters: declaration.parameters.map(site => value(site.type))
			, result: value(declaration.result.type)
			, native: descriptor.exports.find(entry => entry.bindingId === declaration.id).symbol + "_graph" };
	});
	let remaining = 16 * 1024 * 1024 - Object.values(generated.files).reduce((sum, text) => sum + Buffer.byteLength(text), 0);
	for(const callback of callbacks.values()) remaining -= 8192 + callback.docType.length * 24;
	for(const fn of functions) remaining -= 4096 + fn.parameterNames.join("").length * 24;
	if(remaining < 0) throw new TypeError("PHP callable source exceeds its 16 MiB generation budget");
	const identity = hashBindingIr(ir), stem = `lb_${prefix}_graph_${identity.slice(0, 16)}`;
	return { ...generated, ir, descriptor, payloads, nodes, callbacks, functions
		, callableGraph: true, identity, stem, library: `php8.4-${stem}.so`
		, transport: `${generated.namespace}\\Internal\\GraphZend${identity.slice(0, 16)}`
		, layoutSha256: sha256(canonicalJson({ layout: generated.layout, descriptor })) };
};
