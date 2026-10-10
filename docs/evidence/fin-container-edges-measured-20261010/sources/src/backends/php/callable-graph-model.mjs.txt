/**
 * Typed PHP projections over the shared native recursive callable graph.
 *
 * @file
 */
import { canonicalJson, sha256 } from '../../capsule/node.mjs';
import { createNativeCallableGraphDescriptor } from '../../build/native-callable-graph.mjs';
import { compileNativeCallableGraphPayloads } from '../c/native-callable-graph-payloads.mjs';
import { compileCopiedPhpGraphPackageModel } from './copied-graph-package.mjs';
import { phpClassName, phpFieldName } from './copied-names.mjs';
import { cIdentifier } from '../c/generate.mjs';

/**
 * Bind public PHP names and callback sites to the shared native graph layout.
 *
 * @param ir - Compiler-checked Binding IR.
 */
export const compileCallablePhpGraphPackageModel = ir => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const generated = compileCopiedPhpGraphPackageModel(payloads.ir);
	const nodes = new Map(generated.types.map(node => [node.id, node]));
	const copy = ref => {
		const node = nodes.get(payloads.copy(ref).id);
		if(!node) throw new TypeError('Missing PHP copied callable payload');
		return node;
	};
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const parameters = signature.parameters.map(copy), result = copy(signature.result);
		const projected = {
			...signature
			, index
			, parameters
			, result
			, docType: `callable(${parameters.map(node => node.docType).join(', ')}): ${result.docType}`
			, call: `${generated.prefix}_callback_${signature.key}_lease_call`
			, dispose: `${generated.prefix}_callback_${signature.key}_lease_dispose`
		};
		return [signature.id, projected];
	}));
	const value = ref => callbacks.has(ref.id) ? { callback: callbacks.get(ref.id) } : { node: copy(ref) };
	const names = new Set();
	const functions = ir.declarations.map((declaration, index) => {
		const publicName = phpClassName(cIdentifier(declaration.name));
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(publicName) || names.has(publicName.toLowerCase()))
			throw new TypeError('Reserved or duplicate PHP callable function: ' + publicName);
		names.add(publicName.toLowerCase());
		const parameterNames = declaration.parameters.map(site => phpFieldName(site.name, message => { throw new TypeError(message); }));
		if(new Set(parameterNames).size !== parameterNames.length) throw new TypeError('PHP callable parameters require distinct names');
		return {
			index
			, declaration
			, publicName
			, parameterNames
			, parameters: declaration.parameters.map(site => value(site.type))
			, result: value(declaration.result.type)
			, native: descriptor.exports.find(entry => entry.bindingId === declaration.id).symbol + '_graph'
		};
	});
	let remaining = 16 * 1024 * 1024 - Object.values(generated.files).reduce((sum, text) => sum + Buffer.byteLength(text), 0);
	for(const callback of callbacks.values()) remaining -= 8192 + callback.docType.length * 24;
	for(const fn of functions) remaining -= 4096 + fn.parameterNames.join('').length * 24;
	if(remaining < 0) throw new TypeError('PHP callable source exceeds its 16 MiB generation budget');
	return {
		...generated
		, ir
		, descriptor
		, payloads
		, nodes
		, callbacks
		, functions
		, callableGraph: true
		, layoutSha256: sha256(canonicalJson({ layout: generated.layout, descriptor }))
	};
};
