/**
 * Independent structured callable signatures, separate from compiler metadata.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const named = name => ({ kind: "named", id: `lean:Structured.${name}` });
const primitive = name => ({ kind: "primitive", name });
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const string = primitive("string"), unit = primitive("unit");
const rows = apply("array", apply("option", string));
export const structuredCallableShapes = {
	Array: rows
	, List: apply("list", apply("result", apply("tuple", primitive("uint32"), string), string))
	, Option: apply("option", apply("option", unit))
	, Result: apply("result", apply("option", primitive("uint32")), apply("array", string))
	, Tuple: apply("tuple", string, apply("tuple", primitive("bytes"), primitive("nat")))
	, Record: named("Payload"), Variant: named("Packet"), Alias: named("Alias")
	, Recursive: named("Tree")
};
const documentation = () => ({ summary: "Independent structured callable contract.", details: "" });
const source = declaration => ({ producer: "structuredReview", declaration, extensions: {} });
const failure = () => ({ mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" });
const fields = entries => entries.map(([name, type]) => ({ name, type, mutability: "immutable", documentation: documentation() }));
const definitions = () => [
	{ name: "Payload", kind: "record"
		, fields: fields([
			["text", string], ["rows", rows], ["count", primitive("nat")]
			, ["nested", apply("option", apply("result", apply("tuple", primitive("uint64"), unit), string))]
		])
	}
	, { name: "Packet", kind: "variant"
		, cases: [
			{ name: "empty", fields: [], documentation: documentation() }
			, { name: "payload", fields: fields([["label", string], ["rows", rows]]), documentation: documentation() }
			, { name: "counts", fields: fields([["positive", primitive("nat")], ["negative", primitive("int")]]), documentation: documentation() }
		]
	}
	, { name: "Alias", kind: "alias", target: named("Payload") }
	, { name: "Tree", kind: "variant"
		, cases: [
			{ name: "leaf", fields: fields([["value", primitive("nat")]]), documentation: documentation() }
			, { name: "branch", fields: fields([["children", apply("array", named("Tree"))]]), documentation: documentation() }
		]
	}
].map(type => ({ id: `lean:Structured.${type.name}`
	, representation: "copied"
	, mutability: "immutable"
	, typeParameters: []
	, fields: []
	, cases: []
	, target: null
	, resource: null
	, callable: null
	, host: null
	, documentation: documentation()
	, source: source(`Structured.${type.name}`)
	, assurance: [], ...type }));
const callbackTarget = type => type.id === "lean:Structured.Alias" ? named("Payload") : type;

/**
 * Select source exports without silently claiming recursive callback support.
 *
 * @param options - Include recursive payload exports when testing that transport.
 * @param options.recursive - Select finite recursive values in addition to acyclic ones.
 */
export const structuredCallableExports = ({ recursive = false } = {}) => [
	...Object.keys(structuredCallableShapes).filter(name => recursive || name !== "Recursive")
		.flatMap(name => ["call", "twice", "make"].map(action => `Structured.${action}${name}`))
	, "Structured.retainRecord", "Structured.afterFailure"
];
export const structuredCallableArities = Object.fromEntries([
	...Object.keys(structuredCallableShapes).map(name => [`Structured.make${name}`, 1])
	, ["Structured.retainRecord", 1]
]);

/**
 * Build the independently stated review, never from extracted source metadata.
 *
 * @param options - Exact source export selection.
 */
export const structuredCallableReviewedIr = (options = {}) => {
	const types = new Map(definitions().filter(type => options.recursive || type.name !== "Tree").map(type => [type.id, type]));
	const site = (type, result = false) => {
		const callable = types.get(type.id)?.kind === "callback";
		return { type, ownership: callable ? result ? "lease" : "borrow" : "copy"
			, lifetime: callable ? { scope: result ? "explicit" : "call", anchor: null } : null };
	};
	const parameter = (type, index) => ({ name: `value${index}`, ...site(type), mutability: "immutable", optional: false, default: null });
	const callback = (parameters, result) => {
		const signature = { parameters: parameters.map(callbackTarget), result: callbackTarget(result) };
		const name = `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`, id = `bridge:${name}`;
		if(!types.has(id)) types.set(id, { id
			, name
			, kind: "callback"
			, representation: "identity"
			, mutability: "immutable"
			, typeParameters: []
			, fields: []
			, cases: []
			, target: null
			, resource: null
			, host: null
			, callable: { parameters: signature.parameters.map(parameter)
				, result: site(signature.result, true)
				, effects: ["host-call", "fails"], failure: failure(), resultMode: "value"
				, invocation: "many", reentry: "same-agent", selfDisposal: "defer" }
			, documentation: documentation(), source: source(name), assurance: [] });
		return { kind: "named", id };
	};
	const declarations = structuredCallableExports(options).map(name => {
		const short = name.split(".").at(-1), action = short.match(/^(call|twice|make)/)?.[0];
		const value = structuredCallableShapes[short.slice(action?.length ?? 0)] ?? named("Payload");
		const cb = callback([value], value);
		const parameters = action === "make" ? [value] : short === "retainRecord" ? [cb] : [value, cb];
		const result = action === "make" ? callback([primitive("bool"), value], value)
			: short === "retainRecord" ? cb : short === "afterFailure" ? string : value;
		const hostCall = parameters.some(type => types.get(type.id)?.kind === "callback");
		return { id: `lean:${name}`
			, name: short
			, kind: "function"
			, owner: null
			, overloadKey: name
			, typeParameters: []
			, receiver: null
			, parameters: parameters.map(parameter)
			, result: site(result, true)
			, mutability: "immutable", effects: hostCall ? ["fails", "host-call"] : []
			, failure: hostCall ? failure() : { mode: "none", errors: [], unexpected: "poison-runtime" }
			, resultMode: "value"
			, capabilities: []
			, assurance: []
			, documentation: documentation()
			, source: source(name) };
	});
	return { schemaVersion: 3
		, component: { id: "structured@1.0.0", name: "structured", version: "1.0.0" }
		, producers: [{ id: "structuredReview"
			, adapter: "independent-structured-callables"
			, adapterVersion: 1
			, tool: "Structured callable contract review"
			, toolVersion: "1"
			, extensions: {} }]
		, types: [...types.values()], declarations
		, errors: [{ id: "error:native-callback", name: "NativeCallbackFailure", category: "boundary", payload: null, documentation: documentation() }]
		, capabilities: [], assurance: [], documentation: documentation() };
};
