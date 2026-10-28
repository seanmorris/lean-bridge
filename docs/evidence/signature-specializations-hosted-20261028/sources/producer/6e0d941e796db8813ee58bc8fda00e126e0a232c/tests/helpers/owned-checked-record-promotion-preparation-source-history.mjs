/**
 * Authenticate the owned checked-record promotion preparation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordPromotionPreparationHistoryPath
	= "docs/evidence/owned-checked-record-promotion-preparation-source-history-20261024.json";
export const ownedCheckedRecordPromotionPreparationPredecessor
	= "bcb81a101e8d971370e8cfa5dd4c0d5896ee0dd9";
export const ownedCheckedRecordPromotionPreparationImplementation
	= "cbe24fa8171360c844e3ed8ed47399373305982f";
export const ownedCheckedRecordPromotionPreparationIntegrationBase
	= "cbe24fa8171360c844e3ed8ed47399373305982f";
export const ownedCheckedRecordPromotionPreparationCommits = Object.freeze([
	"cbe24fa8171360c844e3ed8ed47399373305982f"
]);
export const ownedCheckedRecordPromotionPreparationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "scripts/generate-type-docs.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedRecordPromotionPreparationImplementationAddedPaths = Object.freeze([
	"scripts/promote-owned-checked-record-evidence.mjs"
	, "tests/helpers/owned-checked-record-documentation.mjs"
	, "tests/helpers/owned-checked-record-promotion-tests.mjs"
	, "tests/helpers/owned-checked-record-promotion.mjs"
]);
export const ownedCheckedRecordPromotionPreparationImplementationPaths = Object.freeze([
	...ownedCheckedRecordPromotionPreparationChangedPaths
	, ...ownedCheckedRecordPromotionPreparationImplementationAddedPaths
]);
export const ownedCheckedRecordPromotionPreparationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedRecordPromotionPreparationNormalizationPaths = Object.freeze([
	...ownedCheckedRecordPromotionPreparationChangedPaths
	, ...ownedCheckedRecordPromotionPreparationIntegrationPaths
]);
export const ownedCheckedRecordPromotionPreparationHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-promotion-preparation-source-history.mjs"
	, "tests/helpers/owned-checked-record-promotion-preparation-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-promotion-preparation-source-history.mjs"
]);
export const ownedCheckedRecordPromotionPreparationAddedPaths = Object.freeze([
	...ownedCheckedRecordPromotionPreparationImplementationAddedPaths
	, ...ownedCheckedRecordPromotionPreparationHistoryAddedPaths
]);
export const ownedCheckedRecordPromotionPreparationPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "3f5ec39ca01c9c0ef813ac2517b503146daa062aad49b608df1e3e1a3d875ae5"
		, currentSha256: "71578018e88495492407855414618749a2f1600dd57c4da6abcd562b2675ef5c"
	})
	, Object.freeze({
		path: "scripts/generate-type-docs.mjs"
		, count: 110
		, previousSha256: "be538dbe92fd5698d7b5e1f3fb3238ffae521e93b009e0a4c78f13c94fd8bbbc"
		, currentSha256: "762e62a004d2807f6f01ce4c9109f7a0fc5b89e36441de0df3db24c8648b0acf"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordPromotionPreparationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedRecordPromotionPreparationUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedRecordPromotionPreparationNormalizationPaths
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact Owned checked-record promotion preparation.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordPromotionPreparationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordPromotionPreparationNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedRecordPromotionPreparationUpdate(current, update);
	}
	return current;
};
