/**
 * Independently reviewed primitive callable signatures and arity decisions.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";

export const callablePrimitives = [["Unit","unit"],["Bool","bool"],["UInt8","uint8"],["UInt16","uint16"],["UInt32","uint32"],["UInt64","uint64"],["Int8","int8"],["Int16","int16"],["Int32","int32"],["Int64","int64"],["Nat","nat"],["Int","int"],["Float32","float32"],["Float","float64"],["String","string"],["Bytes","bytes"],["Char","char"],["USize","usize"],["ISize","isize"]];
const callback = (parameters, result) => ({ callback: { parameters, result } });
export const callableSignatures = callablePrimitives.flatMap(([name, type]) => [
	{ name: `Callables.call${name}`, parameters: [type, callback([type], type)], result: type }
	, { name: `Callables.twice${name}`, parameters: [type, callback([type], type)], result: type }
	, { name: `Callables.make${name}`, parameters: [type], result: callback(["bool", type], type) }
]).concat([{ name: "Callables.wordBits", parameters: [], result: "uint32" }]);
export const callableArities = Object.fromEntries(callablePrimitives.map(([name]) => [`Callables.make${name}`, 1]));

const documentation = () => ({ summary: "Independent primitive callable contract.", details: "" });
const source = declaration => ({ producer: "callableReview", declaration, extensions: {} });

/**
 * Construct a review from explicit signatures without compiler metadata.
 *
 * @param signatures - Independent expected source signatures.
 */
export const callableReviewedIr = (signatures = callableSignatures) => {
	const types = new Map();
	const failure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
	const site = (value, result = false) => ({ type: reference(value)
		, ownership: value.callback ? result ? "lease" : "borrow" : "copy"
		, lifetime: value.callback ? { scope: result ? "explicit" : "call", anchor: null } : null });
	const parameter = (value, index) => ({ name: `value${index}`, ...site(value), mutability: "immutable", optional: false, default: null });
	const reference = value => {
		if(typeof value === "string") return { kind: "primitive", name: value };
		const signature = { parameters: value.callback.parameters.map(reference), result: reference(value.callback.result) };
		const name = `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`;
		const id = `bridge:${name}`;
		types.set(id, { id, name, kind: "callback"
			, representation: "identity", mutability: "immutable"
			, typeParameters: [], fields: [], target: null, resource: null
			, cases: [], host: null
			, callable: { parameters: value.callback.parameters.map(parameter)
				, result: site(value.callback.result, true)
				, effects: ["host-call", "fails"], failure, resultMode: "value"
				, invocation: "many", reentry: "same-agent", selfDisposal: "defer" }
			, documentation: documentation(), source: source(name)
			, assurance: [] });
		return { kind: "named", id };
	};
	const declarations = signatures.map(signature => ({ id: `lean:${signature.name}`
		, name: signature.name.split(".").at(-1), kind: "function", owner: null
		, overloadKey: signature.name
		, typeParameters: [], receiver: null
		, parameters: signature.parameters.map(parameter)
		, result: site(signature.result, true)
		, mutability: "immutable"
		, effects: signature.parameters.some(value => value.callback) ? ["fails", "host-call"] : []
		, failure: signature.parameters.some(value => value.callback) ? failure : { mode: "none", errors: [], unexpected: "poison-runtime" }
		, resultMode: "value", capabilities: [], assurance: []
		, documentation: documentation(), source: source(signature.name) }));
	return { schemaVersion: 3
		, component: { id: "callables@1.0.0", name: "callables", version: "1.0.0" }
		, producers: [{ id: "callableReview", adapter: "independent-callable-contract"
			, adapterVersion: 1
			, tool: "Callable contract review", toolVersion: "1", extensions: {} }]
		, types: [...types.values()], declarations
		, errors: [{ id: "error:native-callback", name: "NativeCallbackFailure", category: "boundary", payload: null, documentation: documentation() }]
		, capabilities: [], assurance: [], documentation: documentation() };
};

/**
 * Capture review bytes separately from the compiler invocation and result.
 *
 * @param document - Independent reviewed contract.
 */
export const callableReviewInput = (document = callableReviewedIr()) => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "callables.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
