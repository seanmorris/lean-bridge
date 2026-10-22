/**
 * Deterministic C++ owned-value headers and pinned offline dependencies.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { generateOwnedCppCallables } from "./owned-callables.mjs";
import { boostIdentity, boostSources } from "./boost.mjs";

/**
 * Generate the C++ portion of a package over an authenticated shared C adapter.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Consumer capabilities implemented by the caller.
 * @param options.transferredInputs - Enable explicit rvalue input consumption.
 * @param options.anchoredResults - Preserve owner-scoped result values.
 * @param options.receiverExports - Expose receiver methods and property accessors.
 * @param options.callbackResultAnchors - Preserve callback-local result owners.
 * @param options.hostCallbacks - The compiled adapter provides callbacks and copies.
 */
export const generateOwnedCppPackage = (ir, { transferredInputs = false, anchoredResults = false, receiverExports = false, callbackResultAnchors = false, hostCallbacks = true } = {}) => {
	const generated = generateOwnedCppCallables(ir, { transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, hostCallbacks }), p = generated.c.prefix;
	const transfers = generated.c.functions.some(item => item.transfers?.length);
	const anchors = generated.c.functions.some(item => item.anchor !== undefined);
	const callbackAnchors = generated.c.callbacks.filter(item => item.anchor !== undefined);
	const receivers = generated.c.functions.filter(item => item.receiver === 0);
	const bigint = generated.types.some(node => node.integer);
	const files = {
		[`include/${p}.hpp`]: generated.header
		, [`include/${p}-values.hpp`]: generated.valuesHeader
		, [`include/${p}-conversions.hpp`]: generated.conversionsHeader
		, [`src/${p}.cpp`]: `#include "${p}.hpp"\n`
		, ...bigint ? boostSources() : {}
	};
	const contract = { schemaVersion: callbackAnchors.length ? 5 : receivers.length ? 4 : anchors ? 3 : transfers ? 2 : 1
		, language: "c++20"
		, ownership: "checked-result-leases", callbackLifetime: "call"
		, explicitRetention: "retain", callbackFailure: "rethrow-after-cleanup"
		, ...callbackAnchors.length ? { callbackResultAnchors: { schemaVersion: 1
			, values: "checked-whole-result", anchor: "original-argument-owner"
			, parameterNumbering: "callback-local"
			, expiration: "owner-release-or-transfer", descendants: "transitive"
			, emptyValues: "owner-preserved"
			, independentOwnership: "retain-or-copy_value"
			, hostReply: "value-or-whole-owner"
			, hostResultHandoff: "before-callback-frame-expires"
			, signatures: callbackAnchors.map(item => ({ id: item.id, parameter: item.anchor - 1 }))
		} } : {}
		, ...transfers ? { inputTransfers: { schemaVersion: 1
			, arguments: "rvalue-references", consumption: "before-lean-call"
			, validation: "before-consumption", failure: "consumed-after-handoff"
			, aliases: "shared-lease", borrowedInputs: "reject"
			, independentRetains: "preserved" } } : {}
		, ...anchors ? { resultAnchors: { schemaVersion: 1
			, values: "checked-whole-result"
			, anchor: "original-result-owner", expiration: "owner-release-or-transfer"
			, descendants: "transitive", emptyValues: "owner-preserved"
			, aliases: "shared-owner", independentOwnership: "retain-or-copy_value"
			, resourceEquality: "canonical-identity"
			, transfers: "original-owner" } } : {}
		, ...receivers.length ? { receiverExports: { schemaVersion: 1
			, values: "checked-whole-result", members: "snake-case"
			, properties: "zero-argument-methods", consumingReceivers: "rvalue-qualified"
			, exports: receivers.map(item => {
				const declaration = ir.declarations.find(declaration => declaration.id === item.id);
				return { bindingId: item.id, owner: declaration.owner
					, kind: declaration.kind
					, member: item.cName.slice(p.length + 1) };
			})
		} } : {}
		, headerSha256: sha256(generated.header)
		, valuesSha256: sha256(generated.valuesHeader)
		, conversionsSha256: sha256(generated.conversionsHeader)
		, ...(bigint ? { boost: boostIdentity } : {}) };
	return { ...generated, files, contract };
};
