/**
 * Typed Python callbacks and closures over the finite native copied graph.
 * Callable identities stay outside the copied payload catalog.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../build/native-callable-graph.mjs";
import { compileNativeCallableGraphPayloads } from "../c/native-callable-graph-payloads.mjs";
import { compileCopiedPythonGraphPackageModel } from "./copied-graph-package.mjs";
import { cIdentifier } from "../c/generate.mjs";

const reserved = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type list tuple str bytes bytearray int float bool object dict set frozenset len range super property staticmethod classmethod isinstance getattr setattr dataclass abs ord chr sum min max enumerate callable BaseException Exception RuntimeError TypeError ValueError MemoryError ImportError LeanBridgeError LeanClosure Some Option Ok Err Result invoke dispatch handle token".split(" "));

/**
 * Bind public Python names and each callback's copied argument/result types.
 *
 * @param ir - Checked pure copied and synchronous callable semantics.
 */
export const compileCallablePythonGraphPackageModel = ir => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const values = compileCopiedPythonGraphPackageModel(payloads.ir);
	const nodes = new Map(values.types.map(node => [node.id, node]));
	const occupied = new Set([...reserved, ...values.exports]);
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name.includes("__") || occupied.has(name))
			throw new TypeError(`Python callable graph name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	const copied = ref => nodes.get(payloads.copy(ref).id);
	const copiedType = (ref, input = false) => {
		const node = copied(ref);
		if(ref.kind !== "named") return node[input ? "inputType" : "publicType"];
		const definition = ir.types.find(type => type.id === ref.id);
		return input && definition.kind === "alias" && node.inputType !== node.publicType
			? `${definition.name} | ${node.inputType}` : definition.name;
	};
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const name = claim(ir.types.find(type => type.id === signature.id).name);
		return [signature.id, { ...signature, index, publicName: name
			, raw: `_Callback${index}`, function: `_CallbackFn${index}`
			, parameters: signature.parameters.map(copied)
			, result: copied(signature.result)
			, callableType: `_Callable[[${signature.parameters.map(ref => copiedType(ref)).join(", ")}], ${copiedType(signature.result, true)}]`
			, closureType: `LeanClosure[[${signature.parameters.map(ref => copiedType(ref, true)).join(", ")}], ${copiedType(signature.result)}]`
			, call: `${values.prefix}_callback_${signature.key}_lease_call`
			, dispose: `${values.prefix}_callback_${signature.key}_lease_dispose` }];
	}));
	const functions = ir.declarations.map((declaration, index) => {
		const publicName = claim(cIdentifier(declaration.name)), seen = new Set();
		const parameters = declaration.parameters.map(parameter => {
			const name = cIdentifier(parameter.name);
			if(reserved.has(name) || seen.has(name))
				throw new TypeError(`Python callable graph parameter name is reserved or duplicated: ${name}`);
			seen.add(name);
			const callback = callbacks.get(parameter.type.id);
			return { name, callback, node: callback ? null : copied(parameter.type)
				, annotation: callback ? callback.publicName : copiedType(parameter.type, true) };
		});
		const callback = callbacks.get(declaration.result.type.id);
		return { index, declaration, publicName, parameters
			, signature: parameters.map(parameter => `${parameter.name}: ${parameter.annotation}`).join(", ")
			, result: { callback, node: callback ? null : copied(declaration.result.type)
				, annotation: callback ? callback.closureType : copiedType(declaration.result.type) }
			, native: `${descriptor.exports.find(entry => entry.bindingId === declaration.id).symbol}_graph` };
	});
	return { ...values, ir, descriptor, payloads, callbacks, functions
		, callableGraph: true
		, layoutSha256: sha256(canonicalJson({ layout: values.layout, descriptor }))
		, exports: ["LeanBridgeError", "LeanClosure", ...values.exports
			, ...[...callbacks.values()].map(callback => callback.publicName)
			, ...functions.map(fn => fn.publicName)] };
};
