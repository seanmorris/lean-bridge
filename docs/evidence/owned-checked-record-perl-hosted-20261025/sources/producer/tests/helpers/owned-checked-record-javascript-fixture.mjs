/**
 * Independent ordinary/reviewed selections for installed JavaScript owned
 * checked-record values, host callbacks and returned Lean closures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	ownedCheckedRecordModule, ownedCheckedRecordReviewedIr
	, ownedCheckedRecordTrees
} from "./owned-checked-record-fixture.mjs";

export const ownedCheckedRecordJavaScriptPackage
	= "@lean-bridge/owned-checked-records";
export const ownedCheckedRecordJavaScriptRoutes = Object.freeze([
	"ordinary-full", "ordinary-result-only"
	, "reviewed-full", "reviewed-result-only"
]);
const module = ownedCheckedRecordModule;
const q = name => `${module}.${name}`;
const named = name => ({ kind: "named", id: `lean:${q(name)}` });
const policy = Object.freeze({ ownership: "lease", disposal: "required"
	, fallback: "queued-finalizer", cycles: "reject" });
const lifetime = scope => ({ scope, anchor: null });
const borrow = (refinement, callable) => ({ ownership: "borrow"
	, lifetime: lifetime("call")
	, ...refinement ? { refinement } : {}
	, ...callable ? { callable } : {} });
const lease = (refinement, callable) => ({ ownership: "lease"
	, lifetime: lifetime("explicit")
	, ...refinement ? { refinement } : {}
	, ...callable ? { callable } : {} });
const callbackFailure = { mode: "declared"
	, errors: ["error:native-callback"], unexpected: "poison-runtime" };

const callbackDefinition = (document, role) => {
	const claim = named("Claim"), host = role === "host";
	const refinements = {
		parameters: [ownedCheckedRecordTrees.claim(host ? null : q("mkClaim"))]
		, result: ownedCheckedRecordTrees.claim(host ? q("mkClaim") : null)
	};
	const signature = { parameters: [claim], result: claim, refinements };
	const name = `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`;
	const template = structuredClone(document.types.find(type =>
		type.name === "Ticket"
	));
	return {
		...template, id: `bridge:${name}`, name, kind: "callback"
		, representation: "identity", mutability: "immutable"
		, resource: null, aggregate: null
		, callable: {
			parameters: [{ name: "arg0", type: claim, ownership: "borrow"
				, lifetime: lifetime("call"), mutability: "immutable"
				, optional: false, default: null }]
			, result: { type: claim, ownership: "lease"
				, lifetime: lifetime("explicit") }
			, effects: ["host-call", "fails"], failure: callbackFailure
			, resultMode: "value", invocation: "many"
			, reentry: "same-agent", selfDisposal: "defer"
		}
		, source: { producer: "corpusReview", declaration: name
			, extensions: { "lean-lang.org/refinements": refinements } }
	};
};

/**
 * Independently authored reviewed contract for one installed API mode.
 *
 * @param root0 - Explicit API-mode selection.
 * @param root0.resultOnly - Retain only Lean-produced checked records.
 */
export const ownedCheckedRecordJavaScriptReviewedIr = ({ resultOnly = false } = {}) => {
	assert.equal(typeof resultOnly, "boolean");
	const document = ownedCheckedRecordReviewedIr({ resultOnly });
	document.component = { id: "owned-checked-records@1.0.0"
		, name: "owned-checked-records", version: "1.0.0" };
	if(resultOnly) return document;
	const declaration = name => document.declarations.find(item =>
		item.name === name
	);
	const claim = declaration("echoClaim"), booking = declaration("echoBooking");
	const host = callbackDefinition(document, "host");
	const closure = callbackDefinition(document, "closure");
	const source = (name, extensions = {}) => ({ producer: "corpusReview"
		, declaration: q(name), extensions });
	const pair = structuredClone(claim);
	Object.assign(pair, { id: `lean:${q("pairClaim")}`, name: "pairClaim"
		, overloadKey: q("pairClaim") });
	pair.parameters = [structuredClone(booking.parameters[0])
		, structuredClone(claim.parameters[0])];
	pair.parameters.forEach((parameter, index) => { parameter.name = `arg${index}`; });
	pair.source = source("pairClaim", { "lean-lang.org/refinements": {
		parameters: [ownedCheckedRecordTrees.booking(q("mkWindow"))
			, ownedCheckedRecordTrees.claim(q("mkClaim"))]
		, result: ownedCheckedRecordTrees.claim(null)
	} });
	const call = structuredClone(claim);
	Object.assign(call, { id: `lean:${q("withClaimCallback")}`
		, name: "withClaimCallback", overloadKey: q("withClaimCallback") });
	call.parameters = [structuredClone(claim.parameters[0]), {
		name: "arg1", type: { kind: "named", id: host.id }
		, ownership: "borrow", lifetime: lifetime("call")
		, mutability: "immutable", optional: false, default: null
	}];
	call.effects = ["allocates", "fails", "host-call", "reads-resource"];
	call.failure = callbackFailure;
	call.source = source("withClaimCallback", {
		"lean-lang.org/refinements": {
			parameters: [ownedCheckedRecordTrees.claim(q("mkClaim")), null]
			, result: ownedCheckedRecordTrees.claim(null)
		}
	});
	const make = structuredClone(declaration("claimFor"));
	Object.assign(make, { id: `lean:${q("claimClosure")}`
		, name: "claimClosure", overloadKey: q("claimClosure") });
	make.parameters = [];
	make.result = { type: { kind: "named", id: closure.id }
		, ownership: "lease", lifetime: lifetime("explicit") };
	make.effects = ["allocates"];
	make.failure = { mode: "none", errors: []
		, unexpected: "poison-runtime" };
	make.source = source("claimClosure");
	document.types = document.types.filter(item =>
		["Ticket", "Window", "Booking", "Claim"].includes(item.name)
	).concat(host, closure);
	document.declarations = ["newTicket", "serial", "echoBooking"
		, "echoClaim", "transferClaim", "claimFor"]
		.map(declaration).concat(pair, call, make);
	document.errors = [{ id: "error:native-callback"
		, name: "NativeCallbackFailure", category: "boundary", payload: null
		, documentation: { summary: "Independent owned checked-record callback failure."
			, details: "" } }];
	return document;
};

const booking = ownedCheckedRecordTrees.booking(q("mkWindow"));
const claim = ownedCheckedRecordTrees.claim(q("mkClaim"));
const projectedClaim = ownedCheckedRecordTrees.claim(null);
const hostCallable = { parameters: [borrow()], result: lease(claim) };
const closureCallable = { parameters: [borrow(claim)], result: lease() };

/**
 * Exact ordinary author decisions, or the reviewed route's source-only selection.
 *
 * @param route - Ordinary extraction or an independently reviewed contract.
 * @param root0 - Explicit API-mode selection.
 * @param root0.resultOnly - Retain only Lean-produced checked records.
 */
export const ownedCheckedRecordJavaScriptConfiguration = (route, { resultOnly = false } = {}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.equal(typeof resultOnly, "boolean");
	const packageName = resultOnly
		? `${ownedCheckedRecordJavaScriptPackage}-result-only`
		: ownedCheckedRecordJavaScriptPackage;
	const base = { schemaVersion: 1, modules: [module]
		, targets: { npm: { name: packageName, version: "1.0.0" } } };
	if(route === "reviewed") return base;
	if(resultOnly) return {
		...base
		, package: { description: "Lean-produced owned proof-erased checked records." }
		, resources: [q("Ticket")]
		, ownedAggregates: { ...policy }
		, exports: ["newTicket", "serial", "claimFor"].map(q)
	};
	return {
		...base
		, package: { description: "Owned proof-erased checked records." }
		, resources: [q("Ticket")]
		, ownedAggregates: { ...policy }
		, exports: ["newTicket", "serial", "echoBooking", "echoClaim"
			, "transferClaim", "claimFor", "pairClaim"
			, "withClaimCallback", "claimClosure"].map(q)
		, arities: { [q("claimClosure")]: 0 }
		, contracts: {
			[q("echoBooking")]: { parameters: [borrow(booking)]
				, result: lease() }
			, [q("echoClaim")]: { parameters: [borrow(claim)]
				, result: lease() }
			, [q("transferClaim")]: {
				parameters: [{ ...borrow(claim), ownership: "transfer" }]
				, result: lease()
			}
			, [q("pairClaim")]: { parameters: [borrow(booking), borrow(claim)]
				, result: lease() }
			, [q("withClaimCallback")]: {
				parameters: [borrow(claim), borrow(undefined, hostCallable)]
				, result: lease() }
			, [q("claimClosure")]: {
				result: lease(undefined, closureCallable)
			}
		}
	};
};

/**
 * Exact independent author route and API mode for installed acceptance.
 *
 * @param route - One closed ordinary/reviewed and full/result-only route.
 */
export const ownedCheckedRecordJavaScriptSelection = route => {
	assert.ok(ownedCheckedRecordJavaScriptRoutes.includes(route));
	const authorRoute = route.startsWith("reviewed-") ? "reviewed" : "ordinary";
	const resultOnly = route.endsWith("result-only");
	return Object.freeze({ route, authorRoute, resultOnly
		, mode: resultOnly ? "result-only" : "full"
		, configuration: ownedCheckedRecordJavaScriptConfiguration(
			authorRoute, { resultOnly }
		)
		, reviewedIr: ownedCheckedRecordJavaScriptReviewedIr({ resultOnly }) });
};

/** Expected callback directions remain explicit in the fixture audit. */
export const ownedCheckedRecordJavaScriptDirections = Object.freeze({
	hostParameter: projectedClaim, hostResult: claim
	, closureParameter: claim, closureResult: projectedClaim
});
