/**
 * Independently authored reviews of the ReviewedCallbacks fixture (VO #1445). R1 covers the
 * directions every target admits; R2 adds a host-produced bounded reply that only npm admits.
 * Callback identities follow the compiler's signature rule, with refinements only when bounded.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { callbackSemanticSignature } from "../../src/analyze/callback-signature.mjs";

const module = "ReviewedCallbacks";
const doc = summary => ({ summary, details: "" });
const nat = { kind: "primitive", name: "nat" };
const fin = bound => ({ kind: "fin", bound: String(bound) });
const array = element => ({ kind: "apply", constructor: "array", arguments: [element] });
const list = element => ({ kind: "apply", constructor: "list", arguments: [element] });
const tile = { kind: "named", id: `lean:${module}.Tile` };
const site = type => ({ type, ownership: "copy", lifetime: null });
const parameter = (type, index) => ({ name: `arg${index}`, ...site(type), mutability: "immutable", optional: false, default: null });
const failure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };

/**
 * One callback definition, named by the compiler's rule.
 *
 * @param parameters - Parameter type references.
 * @param result - Result type reference.
 * @param refinements - Bounds, or undefined when the callback has none.
 */
const callback = (parameters, result, refinements) => {
	const callable = {
		parameters: parameters.map(parameter)
		, result: site(result)
		, effects: ["host-call", "fails"]
		, failure
		, resultMode: "value"
		, invocation: "many"
		, reentry: "same-agent"
		, selfDisposal: "defer"
	};
	const name = `Callback${sha256(canonicalJson({ ...callbackSemanticSignature(callable), ...refinements ? { refinements } : {} })).slice(0, 20)}`;
	const extensions = refinements ? { "lean-lang.org/refinements": refinements } : {};
	return {
		id: `bridge:${name}`
		, name
		, kind: "callback"
		, representation: "identity"
		, mutability: "immutable"
		, typeParameters: []
		, fields: []
		, target: null
		, resource: null
		, callable
		, cases: []
		, host: null
		, documentation: doc("Checked Lean callback.")
		, source: { producer: "review", declaration: name, extensions }
		, assurance: []
	};
};

/** The callbacks each export uses, by role. */
const callbacks = () => ({
	scaler: callback([nat], nat, { parameters: [fin(10)], result: null })
	, counter: callback([nat], nat, { parameters: [null], result: fin(10) })
	, visit: callback([nat], nat, { parameters: [fin(5)], result: null })
	, digits: callback([array(nat)], nat, { parameters: [{ kind: "array", arguments: [fin(3)] }], result: null })
	, tiles: callback([list(tile)], nat)
	, tileMaker: callback([nat], tile)
	, apply: callback([nat], nat)
	, three: callback([nat], nat, { parameters: [fin(3)], result: fin(3) }) });

/**
 * One exported function.
 *
 * @param name - Short Lean name.
 * @param parameters - Parameter sites.
 * @param result - Result site.
 * @param refinements - Scalar bounds of the declaration's own sites, if any.
 */
const declaration = (name, parameters, result, refinements) => {
	const host = parameters.some(item => item.ownership === "borrow");
	const extensions = refinements ? { "lean-lang.org/refinements": refinements } : {};
	return {
		id: `lean:${module}.${name}`
		, name
		, kind: "function"
		, owner: null
		, overloadKey: `${module}.${name}`
		, typeParameters: []
		, receiver: null
		, parameters: parameters.map((item, index) => ({ name: `arg${index}`, ...item, mutability: "immutable", optional: false, default: null }))
		, result
		, mutability: "immutable"
		, effects: host ? ["fails", "host-call"] : []
		, failure: host ? failure : { mode: "none", errors: [], unexpected: "poison-runtime" }
		, resultMode: "value"
		, capabilities: []
		, assurance: []
		, documentation: doc(`Call ${module}.${name}.`)
		, source: { producer: "review", declaration: `${module}.${name}`, extensions }
	};
};
const named = definition => ({ kind: "named", id: definition.id });
const leased = definition => ({ type: named(definition), ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
const borrowed = definition => ({ type: named(definition), ownership: "borrow", lifetime: { scope: "call", anchor: null } });

/**
 * Describe R1, or R2 with the npm-only host reply, before Lean runs.
 *
 * @param options - Review selection.
 * @param options.hostReply - Include the host-produced bounded reply.
 */
export const reviewedCallbackFinReview = ({ hostReply = false } = {}) => {
	const used = callbacks();
	const unit = { kind: "primitive", name: "unit" };
	const declarations = [
		declaration("scaler", [site(nat)], leased(used.scaler))
		, declaration("counter", [site(nat)], leased(used.counter))
		, declaration("visit", [borrowed(used.visit)], site(nat))
		, declaration("digits", [site(unit)], leased(used.digits))
		, declaration("tiles", [site(unit)], leased(used.tiles))
		, declaration("tileMaker", [site(nat)], leased(used.tileMaker))
		, declaration("apply", [borrowed(used.apply), site(nat)], site(nat))
		, ...hostReply ? [declaration("three", [borrowed(used.three), site(nat)], site(nat), { parameters: [null, fin(3)], result: fin(3) })] : []];
	const field = name => ({ name, type: nat, mutability: "immutable", documentation: doc(name) });
	const tileDefinition = {
		id: `lean:${module}.Tile`
		, name: "Tile"
		, kind: "record"
		, representation: "copied"
		, mutability: "immutable"
		, typeParameters: []
		, fields: [field("digit"), field("count")]
		, target: null
		, resource: null
		, callable: null
		, cases: []
		, host: null
		, documentation: doc("A tile.")
		, source: { producer: "review", declaration: `${module}.Tile`, extensions: { "lean-lang.org/nominal-refinements": { kind: "record", fields: [fin(5), null] } } }
		, assurance: []
	};
	const names = new Set(declarations.flatMap(item => [...item.parameters, item.result]).map(item => item.type.id).filter(Boolean));
	return {
		schemaVersion: 3
		, component: { id: "reviewedcallbacks@1.0.0", name: "reviewedcallbacks", version: "1.0.0" }
		, producers: [{ id: "review", adapter: "independent-callback-review", adapterVersion: 1, tool: "Callback contract review", toolVersion: "1", extensions: {} }]
		, types: [tileDefinition, ...Object.values(used).filter(item => names.has(item.id))]
		, declarations
		, errors: [{ id: "error:native-callback", name: "NativeCallbackFailure", category: "boundary", payload: null, documentation: doc("A host callback failed.") }]
		, capabilities: []
		, assurance: []
		, documentation: doc("Independent callback contract.")
	};
};

/** Exports of R1, and those whose returned closures fix an arity of one. */
export const reviewedCallbackFinExports = Object.freeze(["scaler", "counter", "visit", "digits", "tiles", "tileMaker", "apply"].map(name => `${module}.${name}`));
export const reviewedCallbackFinArities = Object.freeze(Object.fromEntries(["scaler", "counter", "digits", "tiles", "tileMaker"].map(name => [`${module}.${name}`, 1])));
