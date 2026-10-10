/**
 * Bind Perl callbacks to the checked native payload graph.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../build/native-callable-graph.mjs";
import { compileNativeCallableGraphPayloads } from "../c/native-callable-graph-payloads.mjs";
import { generateCopiedPerlGraphConversions } from "./copied-graph-conversions.mjs";
import { projectPerlNames } from "./naming.mjs";

const reserved = new Set("new DESTROY CLONE CLONE_SKIP can isa DOES VERSION import unimport AUTOLOAD BEGIN UNITCHECK CHECK INIT END".split(" "));

/**
 * Compile the finite public namespace and copied callback signatures.
 *
 * @param ir - Compiler-checked binding contract.
 * @param moduleName - Selected CPAN module namespace.
 */
export const compileCallablePerlGraphPackageModel = (ir, moduleName) => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const values = generateCopiedPerlGraphConversions(payloads.ir, moduleName);
	if(ir.component.id.length >= 160) throw new TypeError("Perl graph component identity exceeds its name limit");
	const nodes = new Map(values.types.map(node => [node.id, node]));
	const copy = ref => nodes.get(payloads.copy(ref).id);
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const callback = { ...signature, index
			, parameters: signature.parameters.map(copy), result: copy(signature.result)
			, publicType: `${moduleName}::Closure${signature.key}`
			, call: `${values.layout.prefix}_callback_${signature.key}_lease_call`
			, dispose: `${values.layout.prefix}_callback_${signature.key}_lease_dispose` };
		return [signature.id, callback];
	}));
	const occupied = new Set([`${moduleName}::LeanClosure`, ...[...callbacks.values()].map(cb => cb.publicType)]);
	for(const type of payloads.ir.types)
	{
		const publicType = `${moduleName}::${type.name}`;
		if(occupied.has(publicType)) throw new TypeError(`Reserved Perl callable type ${publicType}`);
	}
	const value = site => {
		const callback = callbacks.get(site.type.id);
		return { callback, node: callback ? null : copy(site.type) };
	};
	const functions = projectPerlNames(moduleName, ir.declarations.map(declaration => ({ ...declaration, name: declaration.source.declaration })))
		.map((declaration, index) => {
			if(!/^[a-z][a-z0-9_]*$/.test(declaration.publicName) || reserved.has(declaration.publicName)) throw new TypeError(`Invalid Perl function ${declaration.publicName}`);
			return { declaration, index, publicName: declaration.publicName
				, parameters: declaration.parameters.map(value)
				, result: value(declaration.result)
				, native: descriptor.exports.find(entry => entry.bindingId === declaration.id).symbol + "_graph" };
		});
	return { ...values, ir, descriptor, payloads, callbacks, functions
		, callableGraph: true
		, layoutSha256: sha256(canonicalJson({ layout: values.layout, descriptor })) };
};
