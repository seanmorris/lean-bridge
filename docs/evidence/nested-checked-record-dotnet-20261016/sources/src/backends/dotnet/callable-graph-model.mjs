/**
 * Bind C# callbacks and owned closures to checked finite copied payloads.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../build/native-callable-graph.mjs";
import { compileNativeCallableGraphPayloads } from "../c/native-callable-graph-payloads.mjs";
import { compileCopiedDotnetGraphPackageModel } from "./copied-graph-package.mjs";
import { cIdentifier } from "../c/generate.mjs";

/**
 * Preserve public signatures while sharing the copied-value converter catalog.
 *
 * @param ir - Compiler-checked binding contract and selected declarations.
 */
export const compileCallableDotnetGraphPackageModel = ir => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const generated = compileCopiedDotnetGraphPackageModel(payloads.ir);
	const nodes = new Map(generated.types.map(node => [node.id, { ...node, ...generated.nativeTypes.find(type => type.id === node.id) }]));
	const copy = ref => nodes.get(payloads.copy(ref).id);
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const parameters = signature.parameters.map(copy), result = copy(signature.result);
		const unit = result.ref.kind === "primitive" && result.ref.name === "unit";
		return [signature.id, { ...signature, index, parameters, result, unit
			, publicType: `global::System.${unit ? "Action" : "Func"}<${[...parameters.map(node => node.publicType), ...unit ? [] : [result.publicType]].join(", ")}>`
			, call: `${generated.layout.prefix}_callback_${signature.key}_lease_call`
			, dispose: `${generated.layout.prefix}_callback_${signature.key}_lease_dispose` }];
	}));
	const value = ref => callbacks.has(ref.id) ? { callback: callbacks.get(ref.id) } : { node: copy(ref) };
	const functionNames = new Set("Api Equals GetHashCode GetType ToString ReferenceEquals MemberwiseClone Clone EqualityContract PrintMembers Deconstruct".split(" "));
	const functions = ir.declarations.map((fn, index) => {
		const publicName = cIdentifier(fn.name).split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(publicName) || functionNames.has(publicName)) throw new TypeError("Reserved or duplicate C# function: " + publicName);
		functionNames.add(publicName);
		const parameterNames = fn.parameters.map(site => site.name);
		if(parameterNames.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) || new Set(parameterNames).size !== parameterNames.length)
			throw new TypeError("C# parameters require distinct ASCII identifiers");
		return { index, definition: fn, publicName, parameterNames
			, parameters: fn.parameters.map(site => value(site.type))
			, result: value(fn.result.type)
			, native: descriptor.exports.find(entry => entry.bindingId === fn.id).symbol + "_graph" };
	});
	let remaining = 16 * 1024 * 1024 - generated.source.length - generated.valuesSource.length;
	const text = value => value.callback ? value.callback.publicType : value.node.publicType;
	for(const callback of callbacks.values()) remaining -= 8192 + callback.publicType.length * 24;
	for(const fn of functions) remaining -= 4096 + (fn.parameters.reduce((sum, value) => sum + text(value).length, 0) + text(fn.result).length) * 24;
	if(remaining < 0) throw new TypeError("C# callable source exceeds its 16 MiB generation budget");
	return { ...generated, ir, descriptor, payloads, nodes, callbacks, functions
		, layoutSha256: sha256(canonicalJson({ layout: generated.layout, descriptor })) };
};
