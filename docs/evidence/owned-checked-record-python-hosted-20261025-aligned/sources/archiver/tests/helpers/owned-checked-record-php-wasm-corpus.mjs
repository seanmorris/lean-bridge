/**
 * Bind PHP-Wasm coverage to the exact caller retained at its producer revision.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const binding = name => `lean:OwnedCheckedRecords.${name}`;
const base = ["newTicket", "serial", "echoBooking", "echoClaim", "transferClaim"
	, "claimFor", "pairClaim", "withClaimCallback", "claimClosure"];
const transfers = entries => Object.freeze(entries.map(([name, parameters]) =>
	Object.freeze({ bindingId: binding(name), parameters: Object.freeze(parameters) })));

export const ownedCheckedRecordPhpWasmCorpora = Object.freeze({
	legacy: Object.freeze({ id: "owned-checked-record-php-wasm-v1"
		, consumerSha256: "587502c1489137797675c9c4ecc7f1d9b12a32f2464d6046ed2f33ee9ce18fdc"
		, exports: Object.freeze(base.map(binding).sort())
		, transfers: transfers([["transferClaim", [0]]]) })
	, mixed: Object.freeze({ id: "owned-checked-record-php-wasm-mixed-v2"
		, consumerSha256: "ca67f744050815ecb10a84867045a9718aed20debeb08888c681bc5c95fd69d3"
		, exports: Object.freeze([...base, "bookingSpan", "claimQuota", "echoGrant"
			, "echoClaims"
			, "transferWithClaimCallback"
			, "transferPairClaim"].map(binding).sort())
		, transfers: transfers([
			["transferClaim", [0]]
			, ["transferWithClaimCallback", [0]]
			, ["transferPairClaim", [0, 1]]
		])
	})
});

/**
 * Unknown caller bytes cannot acquire a known corpus through report fields.
 *
 * @param source - Full caller bytes read from the authenticated producer.
 */
export const ownedCheckedRecordPhpWasmCorpus = source => {
	const digest = sha256(source);
	const corpus = Object.values(ownedCheckedRecordPhpWasmCorpora)
		.find(value => value.consumerSha256 === digest);
	assert.ok(corpus, `Unknown owned checked-record PHP-Wasm consumer: ${digest}`);
	return corpus;
};

/**
 * Check exact bindings and transfer positions, including the unchanged result-only API.
 *
 * @param model - Compiled model retained in an installed observation.
 * @param mode - Full or result-only API mode.
 * @param corpus - Contract selected from authenticated full-caller bytes.
 * @param label - Optional installed route used in diagnostics.
 */
export const assertOwnedCheckedRecordPhpWasmModelCorpus = (model, mode, corpus, label = mode) => {
	assert.ok(Object.values(ownedCheckedRecordPhpWasmCorpora).includes(corpus)
		, "PHP-Wasm corpus must be selected from exact producer source");
	assert.ok(["full", "result-only"].includes(mode), "PHP-Wasm API mode");
	const expected = mode === "full" ? corpus.exports
		: ["newTicket", "serial", "claimFor"].map(binding).sort();
	assert.deepEqual(model.exports.map(item => item.bindingId).toSorted(), expected
		, `${label}: exact PHP-Wasm corpus exports`);
	if(mode === "full")
		assert.deepEqual(model.ownedGraph.inputTransfers.exports.toSorted((a, b) => a.bindingId.localeCompare(b.bindingId))
			, corpus.transfers.toSorted((a, b) => a.bindingId.localeCompare(b.bindingId))
			, `${label}: exact PHP-Wasm transfer bindings and positions`);
	else
	{
		assert.equal(model.ownedGraph.inputTransfers, undefined, `${label}: no transfers`);
		assert.equal(model.ownedGraph.hostCallbacks, undefined, `${label}: no callbacks`);
	}
};
