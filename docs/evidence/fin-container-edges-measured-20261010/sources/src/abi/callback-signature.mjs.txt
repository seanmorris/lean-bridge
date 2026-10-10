/**
 * Implements the callback signature module in the ABI subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";

import {
	canonicalizeJsonValue,
	hashBindingIr,
} from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";

/**
 * Reports callback signature generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class CallbackSignatureGenerationError extends Error
{
	/**
   * Initializes the error used to report callback signature generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "CallbackSignatureGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new CallbackSignatureGenerationError(code, message, details);
};

const deepFreeze = value => {
	if(value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
	for(const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
};

const clone = value => structuredClone(value);

const normalizeTypeRef = (typeRef, typeMap, active = new Set()) => {
	if(typeRef.kind === "primitive" || typeRef.kind === "parameter")
	{
		return clone(typeRef);
	}
	if(typeRef.kind === "apply")
	{
		return {
			kind: "apply"
			, constructor: typeRef.constructor
			, arguments: typeRef.arguments.map(argument =>
				normalizeTypeRef(argument, typeMap, active),
			)
		};
	}
	const type = typeMap.get(typeRef.id);
	if(!type) fail("unknown-type", `Callback signature references unknown type ${typeRef.id}`);
	if(active.has(type.id)) return { kind: "recursive", id: type.id };
	const next = new Set(active).add(type.id);
	const common = {
		kind: type.kind
		, id: type.id
		, representation: type.representation
		, mutability: type.mutability
		, typeParameters: type.typeParameters.map(parameter => ({
			id: parameter.id
			, representation: parameter.representation
			, constraints: [...parameter.constraints].sort()
		}))
	};
	if(type.kind === "record")
	{
		return {
			...common,
			fields: type.fields.map(field => ({
				name: field.name
				, type: normalizeTypeRef(field.type, typeMap, next)
				, mutability: field.mutability
			}))
		};
	}
	if(type.kind === "resource")
	{
		return { ...common, kindId: type.resource.kindId };
	}
	if(type.kind === "alias")
	{
		return { ...common, target: normalizeTypeRef(type.target, typeMap, next) };
	}
	return { ...common, callable: normalizeCallable(type.callable, typeMap, next) };
};

const representationOf = (typeRef, typeMap, typeParameters) => {
	if(typeRef.kind === "primitive") return "copied";
	if(typeRef.kind === "named") return typeMap.get(typeRef.id)?.representation;
	if(typeRef.kind === "parameter")
	{
		return typeParameters.get(typeRef.id)?.representation;
	}
	const representations = typeRef.arguments.map(argument =>
		representationOf(argument, typeMap, typeParameters),
	);
	if(representations.includes("identity")) return "identity";
	if(representations.includes("any")) return "any";
	return "copied";
};

const normalizeSite = (site, typeMap, active) => ({
	type: normalizeTypeRef(site.type, typeMap, active)
	, ownership: site.ownership
	, lifetime: clone(site.lifetime)
});

const normalizeCallable = (callable, typeMap, active) => ({
	invocation: callable.invocation
	, reentry: callable.reentry
	, selfDisposal: callable.selfDisposal
	, parameters: callable.parameters.map(parameter => ({
		name: parameter.name
		, ...normalizeSite(parameter, typeMap, active)
		, mutability: parameter.mutability
		, optional: parameter.optional
		, default: clone(parameter.default)
	}))
	, result: normalizeSite(callable.result, typeMap, active)
	, effects: [...callable.effects].sort()
	, failure: {
		mode: callable.failure.mode
		, errors: [...callable.failure.errors].sort()
		, unexpected: callable.failure.unexpected
	}
	, resultMode: callable.resultMode
});

const transportFor = (typeRef, representation, typeMap) => {
	if(representation !== "identity") return "copy-frame";
	if(typeRef.kind === "named" && typeMap.get(typeRef.id)?.kind === "callback")
	{
		return "host-function-handle";
	}
	return "resource-handle";
};

const transitionFor = ownership => {
	if(ownership === "copy") return "copy";
	if(ownership === "borrow") return "borrow-for-call";
	if(ownership === "lease") return "retain-until-explicit-release";
	return "take-ownership";
};

const compileSite = (site, typeMap, typeParameters) => {
	const representation = representationOf(site.type, typeMap, typeParameters);
	return {
		type: clone(site.type)
		, representation
		, ownership: site.ownership
		, lifetime: clone(site.lifetime)
		, transport: transportFor(site.type, representation, typeMap)
		, transition: transitionFor(site.ownership)
		, cleanup: site.ownership === "copy" ? "none" : "deterministic-release"
	};
};

/**
 * Compiles callback signature version 1 into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param typeId - Stable Binding IR identifier of the type to process.
 * @param root0 - Named inputs and dependency overrides used to compile callback signature version 1.
 * @param root0.maxDepth - Maximum permitted nesting depth for callback invocation.
 */
export const compileCallbackSignatureV1 = (ir, typeId, { maxDepth = 64 } = {}) => {
	validateBindingIr(ir);
	if(!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 0xffff)
	{
		fail("invalid-depth-budget", "Callback depth budget must be from 1 through 65535", {
			maxDepth
		});
	}
	const typeMap = new Map(ir.types.map(type => [type.id, type]));
	const type = typeMap.get(typeId);
	if(!type) fail("unknown-callback", `Binding IR has no callback ${typeId}`, { typeId });
	if(type.kind !== "callback" || type.representation !== "identity")
	{
		fail("not-a-callback", `${typeId} is not an identity-bearing callback`, { typeId });
	}
	const basis = {
		abiVersion: 1
		, typeParameters: type.typeParameters.map(parameter => ({
			id: parameter.id
			, representation: parameter.representation
			, constraints: [...parameter.constraints].sort()
		}))
		, callable: normalizeCallable(type.callable, typeMap, new Set([type.id]))
	};
	const digest = createHash("sha256")
    .update(canonicalizeJsonValue(basis, "callbackSignature"), "utf8")
    .digest("hex");
	const typeParameters = new Map(
		type.typeParameters.map(parameter => [parameter.id, parameter]),
	);
	const parameters = type.callable.parameters.map(parameter => ({
		name: parameter.name
		, optional: parameter.optional
		, default: clone(parameter.default)
		, mutability: parameter.mutability,
		...compileSite(parameter, typeMap, typeParameters)
	}));

	return deepFreeze({
		kind: "callback-signature-v1"
		, abiVersion: 1
		, typeId
		, signatureId: `callback-v1:${digest}`
		, bindingIrSha256: hashBindingIr(ir)
		, invocation: type.callable.invocation
		, hostFunction: {
			transport: "generation-safe-handle"
			, identity: "canonical-per-runtime-function"
			, cleanup: "deterministic"
		}
		, wasmTable: {
			adapter: "fixed-signature"
			, reuse: "by-signature-id"
		}
		, reentry: {
			policy: type.callable.reentry
			, agent: "same-agent"
			, frames: "nested-lifo"
			, maxDepth
			, overflow: "reject-before-call"
			, exception: "unwind-to-entry-frame"
		}
		, selfDisposal: type.callable.selfDisposal
		, cleanup: "reverse-capture-order"
		, parameters
		, result: compileSite(type.callable.result, typeMap, typeParameters)
		, resultMode: type.callable.resultMode
		, effects: [...type.callable.effects]
		, failure: clone(type.callable.failure)
	});
};
