/**
 * Independently describe the public Lean signatures in resource-callables.lean.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const resourceCallableArities = { "Workshop.keepFactory": 1, "Workshop.counterReader": 1, "Workshop.namedCounter": 1 };

/**
 * Append the expected callback and closure signatures before invoking Lean.
 *
 * @param ir - Authored Workshop resource contract.
 */
export const addResourceCallables = ir => {
	const resource = { kind: "named", id: "lean:Workshop.Counter" };
	const word = { kind: "primitive", name: "uint32" }, string = { kind: "primitive", name: "string" };
	const site = (type, result = false) => type.kind === "named"
		? { type, ownership: result ? "lease" : "borrow", lifetime: { scope: result ? "explicit" : "call", anchor: null } }
		: { type, ownership: "copy", lifetime: null };
	const parameter = (type, i) => ({ ...site(type), name: `value${i}`, mutability: "immutable", optional: false, default: null });
	const source = declaration => ({ producer: ir.producers[0].id, declaration, extensions: {} });
	const failure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
	const documentation = ir.documentation;
	ir.errors.push({ id: "error:native-callback", name: "NativeCallbackFailure", category: "boundary", payload: null, documentation });
	const callback = (parameters, result) => {
		const name = `Callback${sha256(canonicalJson({ parameters, result })).slice(0, 20)}`;
		const id = `bridge:${name}`;
		ir.types.push({ ...ir.types[0], id, name, kind: "callback"
			, resource: null, mutability: "immutable", source: source(name)
			, callable: { parameters: parameters.map(parameter)
				, result: site(result, true)
				, effects: ["host-call", "fails"], failure, resultMode: "value"
				, invocation: "many", reentry: "same-agent", selfDisposal: "defer" } });
		return { kind: "named", id };
	};
	const inspect = callback([resource], word), exchange = callback([word, resource], resource);
	const factory = callback([word], resource), named = callback([string], resource);
	const template = ir.declarations[0];
	for(const [name, parameters, result] of [
		["inspectWith", [resource, inspect], word]
		, ["inspectFresh", [word, inspect], word]
		, ["exchangeWith", [word, resource, exchange], word]
		, ["chooseWith", [word, factory], word], ["keepFactory", [factory], factory]
		, ["counterReader", [word], inspect], ["namedCounter", [resource], named]
	]){
		const lean = `Workshop.${name}`, host = parameters.some(type => type.id?.startsWith("bridge:"));
		ir.declarations.push({ ...template, name, id: `lean:${lean}`
			, overloadKey: lean, source: source(lean)
			, parameters: parameters.map(parameter), result: site(result, true)
			, ...(host ? { effects: ["fails", "host-call"], failure } : {}) });
	}
	return ir;
};
