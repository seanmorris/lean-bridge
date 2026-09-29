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
 */
export const generateOwnedCppPackage = (ir, { transferredInputs = false } = {}) => {
	const generated = generateOwnedCppCallables(ir, { transferredInputs }), p = generated.c.prefix;
	const transfers = generated.c.functions.some(item => item.transfers?.length);
	const bigint = generated.types.some(node => node.integer);
	const files = {
		[`include/${p}.hpp`]: generated.header
		, [`include/${p}-values.hpp`]: generated.valuesHeader
		, [`include/${p}-conversions.hpp`]: generated.conversionsHeader
		, [`src/${p}.cpp`]: `#include "${p}.hpp"\n`
		, ...bigint ? boostSources() : {}
	};
	const contract = { schemaVersion: transfers ? 2 : 1, language: "c++20"
		, ownership: "checked-result-leases", callbackLifetime: "call"
		, explicitRetention: "retain", callbackFailure: "rethrow-after-cleanup"
		, ...transfers ? { inputTransfers: { schemaVersion: 1
			, arguments: "rvalue-references", consumption: "before-lean-call"
			, validation: "before-consumption", failure: "consumed-after-handoff"
			, aliases: "shared-lease", borrowedInputs: "reject"
			, independentRetains: "preserved" } } : {}
		, headerSha256: sha256(generated.header)
		, valuesSha256: sha256(generated.valuesHeader)
		, conversionsSha256: sha256(generated.conversionsHeader)
		, ...(bigint ? { boost: boostIdentity } : {}) };
	return { ...generated, files, contract };
};
