/**
 * Independent public HostNull contract; exact Lean constructors remain compiler evidence.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const documentation = () => ({ summary: "Explicit host-null contract.", details: "" });
const source = declaration => ({ producer: "hostNullReview", declaration, extensions: {} });
const primitive = name => ({ kind: "primitive", name });
const named = name => ({ kind: "named", id: `lean:HostNullDemo.${name}` });
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const hostNull = type => apply("host-null", type);
const option = type => apply("option", type);
const uint32 = primitive("uint32");
const nullable = hostNull(uint32), nullableOption = hostNull(option(uint32)), optionalNullable = option(hostNull(uint32));
const failure = () => ({ mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" });
const site = (type, result = false) => {
	const callback = type.kind === "named" && type.id.startsWith("bridge:");
	return { type, ownership: callback ? result ? "lease" : "borrow" : "copy"
		, lifetime: callback ? { scope: result ? "explicit" : "call", anchor: null } : null };
};
const parameter = (type, index) => ({
	name: `value${index}`
	, ...site(type)
	, mutability: "immutable", optional: false, default: null });
const callbackSignature = { parameters: [nullable], result: nullableOption };
const callbackId = `bridge:Callback${sha256(canonicalJson(callbackSignature)).slice(0, 20)}`;
const callback = { kind: "named", id: callbackId };
const functionDeclaration = (name, parameters, result, hostCall = false) => ({
	id: `lean:HostNullDemo.${name}`, name, kind: "function", owner: null
	, overloadKey: `HostNullDemo.${name}`, typeParameters: [], receiver: null
	, parameters: parameters.map(parameter), result: site(result, true)
	, mutability: "immutable", effects: hostCall ? ["fails", "host-call"] : []
	, failure: hostCall ? failure() : { mode: "none", errors: [], unexpected: "poison-runtime" }
	, resultMode: "value", capabilities: [], assurance: []
	, documentation: documentation(), source: source(`HostNullDemo.${name}`)
});

export const hostNullProjection = Object.freeze({
	name: "HostNullDemo.HostNull"
	, nullConstructor: "HostNullDemo.HostNull.null"
	, valueConstructor: "HostNullDemo.HostNull.value"
});

export const hostNullArities = Object.freeze({ "HostNullDemo.makeClosure": 1 });

/** Build the reviewed route without exposing private constructor identities in Binding IR. */
export const hostNullReviewedIr = () => ({
	schemaVersion: 3
	, component: { id: "host_null_demo@1.0.0", name: "host_null_demo", version: "1.0.0" }
	, producers: [{ id: "hostNullReview"
		, adapter: "independent-host-null-review"
		, adapterVersion: 1
		, tool: "HostNull contract review", toolVersion: "1", extensions: {} }]
	, types: [
		{ id: "lean:HostNullDemo.Packet"
			, name: "Packet"
			, kind: "record"
			, representation: "copied"
			, mutability: "immutable"
			, typeParameters: []
			, cases: []
			, target: null
			, resource: null
			, callable: null
			, host: null
			, fields: [
				{ name: "direct", type: nullable, mutability: "immutable", documentation: documentation() }
				, { name: "nullableOption", type: nullableOption, mutability: "immutable", documentation: documentation() }
				, { name: "optionalNullable", type: optionalNullable, mutability: "immutable", documentation: documentation() }
			]
			, documentation: documentation()
			, source: source("HostNullDemo.Packet")
			, assurance: [] }
		, { id: callbackId
			, name: callbackId.slice(7)
			, kind: "callback"
			, representation: "identity"
			, mutability: "immutable"
			, typeParameters: []
			, fields: []
			, cases: []
			, target: null
			, resource: null
			, host: null
			, callable: { parameters: callbackSignature.parameters.map(parameter)
				, result: site(callbackSignature.result, true)
				, effects: ["host-call", "fails"]
				, failure: failure()
				, resultMode: "value"
				, invocation: "many"
				, reentry: "same-agent"
				, selfDisposal: "defer" }
			, documentation: documentation()
			, source: source(callbackId.slice(7))
			, assurance: [] }
	]
	, declarations: [
		functionDeclaration("echo", [nullable], nullable)
		, functionDeclaration("nullableOption", [nullableOption], nullableOption)
		, functionDeclaration("optionalNullable", [optionalNullable], optionalNullable)
		, functionDeclaration("packet", [named("Packet")], named("Packet"))
		, functionDeclaration("callHost", [nullable, callback], nullableOption, true)
		, functionDeclaration("makeClosure", [nullableOption], callback)
	]
	, errors: [{ id: "error:native-callback"
		, name: "NativeCallbackFailure"
		, category: "boundary"
		, payload: null, documentation: documentation() }]
	, capabilities: [], assurance: [], documentation: documentation()
});
