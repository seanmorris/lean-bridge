/**
 * Reversible authored-source probes for the two admitted owned refinement families.
 * Generated transport entries remain compiler-derived by the owned selector.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";

export const phpWasmOwnedRefinementEntryFamilies = Object.freeze([
	"owned-subtype", "owned-checked-record"
]);

const definitions = Object.freeze({
	"owned-subtype": Object.freeze({
		path: "tests/fixtures/onboarding/owned-subtypes/Owned.lean"
		, namespace: "Owned", prefix: "lb_owned_entry_subtype"
		, constructors: Object.freeze(["checkedCount", "checkedCountAlternate"])
		, sources: Object.freeze([
			"newTicket", "echoRecord", "echoRecordAlternate", "transferRecord"
		])
	})
	, "owned-checked-record": Object.freeze({
		path: "tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"
		, namespace: "OwnedCheckedRecords", prefix: "lb_owned_entry_checked_record"
		, constructors: Object.freeze(["mkWindow", "mkClaim", "checkedPositive", "mkGrant"])
		, sources: Object.freeze([
			"newTicket"
			, "echoBooking"
			, "echoClaim"
			, "transferClaim"
			, "echoGrant"
			, "pairClaim"
		])
	})
});

/**
 * Return one closed authored marker definition without reading mutable source bytes.
 *
 * @param family - One explicit #1825 owned refinement family.
 */
export const phpWasmOwnedRefinementEntrySourceDefinition = family => {
	assert.ok(phpWasmOwnedRefinementEntryFamilies.includes(family));
	return structuredClone(definitions[family]);
};

/**
 * Instrument one disposable owned fixture while retaining exact restoration data.
 *
 * @param family - One explicit #1825 owned refinement family.
 */
export const phpWasmOwnedRefinementEntrySourceFixture = async family => {
	const fixture = phpWasmOwnedRefinementEntrySourceDefinition(family);
	const original = await readFile(fixture.path, "utf8");
	return { family, path: fixture.path
		, ...phpWasmRefinementEntrySource(original, fixture) };
};
