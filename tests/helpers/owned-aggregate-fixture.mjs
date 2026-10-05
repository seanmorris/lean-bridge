/**
 * Independently stated resource-bearing shapes and ownership decisions.
 * This contract is not compiler or installed-package evidence.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const documentation = { summary: "Independent owned aggregate contract.", details: "" };
const primitive = name => ({ kind: "primitive", name });
const named = name => ({ kind: "named", id: `lean:Owned.${name}` });
const applied = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
const policy = () => ({ ownership: "lease", disposal: "required", fallback: "queued-finalizer", cycles: "reject" });
const source = declaration => ({ producer: "corpusReview", declaration, extensions: {} });
const definition = (name, kind, representation, properties = {}) => ({
	id: named(name).id, name, kind, representation, mutability: "immutable"
	, typeParameters: [], fields: [], target: null, resource: null, callable: null
	, cases: [], host: null
	, aggregate: representation === "owned" && kind !== "alias" ? policy() : null
	, documentation, source: source(`Owned.${name}`), assurance: [], ...properties
});

/** Describe the real Lean fixture without importing source extraction or layouts. */
export const ownedAggregateReviewedIr = () => {
	const ticket = named("Ticket"), payload = named("Payload"), bundle = named("Bundle"), tree = named("Tree");
	const array = applied("array", ticket), list = applied("list", ticket), option = applied("option", ticket);
	const result = applied("result", bundle, ticket);
	const tuple = applied("tuple", ticket, applied("tuple", option, payload));
	const types = [
		definition("Ticket", "resource", "identity", {
			mutability: "read"
			, resource: { kindId: "resource:Owned.Ticket", disposal: "required"
				, fallback: "queued-finalizer", cycles: "explicit-cut" }
		})
		, definition("Payload", "record", "copied", { fields: [field("count", primitive("int")), field("bytes", primitive("bytes"))] })
		, definition("Bundle", "record", "owned", { fields: [
			field("primary", ticket), field("spare", option), field("peers", array)
			, field("history", list), field("payload", payload)
		] })
		, definition("Choice", "variant", "owned", { cases: [
			{ name: "empty", fields: [], documentation }
			, { name: "one", fields: [field("ticket", ticket)], documentation }
			, { name: "pair", fields: [field("first", ticket), field("second", ticket)], documentation }
			, { name: "many", fields: [field("tickets", array)], documentation }
		] })
		, definition("Tree", "variant", "owned", { cases: [
			{ name: "leaf", fields: [field("ticket", ticket)], documentation }
			, { name: "branch", fields: [field("children", applied("array", tree))], documentation }
		] })
		, definition("TicketRow", "alias", "owned", { target: applied("array", option) })
		, definition("BundleAlias", "alias", "owned", { target: bundle })
	];
	const isCopied = ref => ref.kind === "primitive" || ref.id === payload.id;
	const site = (type, result = false) => ({ type
		, ownership: isCopied(type) ? "copy" : result ? "lease" : "borrow"
		, lifetime: isCopied(type) ? null : { scope: result ? "explicit" : "call", anchor: null }
	});
	const parameter = (type, index) => ({ name: `arg${index}`, ...site(type), mutability: "immutable", optional: false, default: null });
	const callbackFailure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
	const callable = (parameters, result) => {
		const name = `Callback${sha256(canonicalJson({ parameters, result })).slice(0, 20)}`;
		const id = `bridge:${name}`;
		types.push({ ...definition(name, "callback", "identity"), id
			, source: source(name)
			, callable: { parameters: parameters.map(parameter)
				, result: site(result, true)
				, effects: ["host-call", "fails"], failure: callbackFailure
				, resultMode: "value", invocation: "many"
				, reentry: "same-agent", selfDisposal: "defer" } });
		return { kind: "named", id };
	};
	const recordCallback = callable([bundle], bundle), treeCallback = callable([tree], tree);
	const recordClosure = callable([primitive("bool"), bundle], bundle), treeClosure = callable([primitive("bool"), tree], tree);
	const signatures = [
		["newTicket", [primitive("nat"), primitive("string")], ticket]
		, ["serial", [ticket], primitive("nat")]
		, ["label", [ticket], primitive("string")]
		, ["retainTicket", [ticket], ticket]
		, ["bundle", [ticket, option, array, list, payload], bundle]
		, ["primary", [bundle], ticket], ["payload", [bundle], payload]
		, ["echoArray", [array], array], ["echoList", [list], list]
		, ["echoOption", [option], option], ["echoResult", [result], result]
		, ["echoTuple", [tuple], tuple], ["echoRecord", [bundle], bundle]
		, ["echoVariant", [named("Choice")], named("Choice")]
		, ["echoAlias", [named("BundleAlias")], named("BundleAlias")]
		, ["echoRow", [named("TicketRow")], named("TicketRow")]
		, ["echoRecursive", [tree], tree]
		, ["echoNested", [applied("array", applied("list", applied("option", result)))], applied("array", applied("list", applied("option", result))) ]
		, ["callbackRecord", [bundle, recordCallback], bundle]
		, ["callbackRecursive", [tree, treeCallback], tree]
		, ["makeRecord", [bundle], recordClosure]
		, ["makeRecursive", [tree], treeClosure]
	];
	const ir = corpusReviewedIr({ id: "owned-aggregates" }, [{ name: "Owned.answer", parameters: [], result: "uint32" }]);
	ir.schemaVersion = 4; ir.aggregatePolicy = policy(); ir.types = types;
	const template = ir.declarations[0];
	ir.declarations = signatures.map(([name, parameters, result]) => {
		const invokes = parameters.some(ref => ref.id === recordCallback.id || ref.id === treeCallback.id);
		return { ...template, id: `lean:Owned.${name}`, name
			, overloadKey: `Owned.${name}`
			, parameters: parameters.map(parameter), result: site(result, true)
			, effects: [...(parameters.some(ref => !isCopied(ref)) ? ["reads-resource"] : [])
				, ...(!isCopied(result) ? ["allocates"] : [])
				, ...(invokes ? ["host-call", "fails"] : [])]
			, failure: invokes ? callbackFailure : template.failure
			, source: source(`Owned.${name}`)
		};
	});
	ir.errors = [{ id: "error:native-callback", name: "NativeCallbackFailure", category: "boundary", payload: null, documentation }];
	return ir;
};
