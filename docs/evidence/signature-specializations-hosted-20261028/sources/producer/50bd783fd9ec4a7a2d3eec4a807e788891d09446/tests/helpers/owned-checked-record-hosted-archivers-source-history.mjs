/**
 * Reverse the owned checked-record hosted archiver transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordHostedArchiversHistoryPath
	= "docs/evidence/owned-checked-record-hosted-archivers-source-history-20261022.json";
export const ownedCheckedRecordHostedArchiversPredecessor
	= "2c6b6e71f8083e9e1acbcd530272073e966747a9";
export const ownedCheckedRecordHostedArchiversImplementation
	= "cee04d40968486fcc50b47dc7793fe9f3134ed57";
export const ownedCheckedRecordHostedArchiversIntegrationPredecessor
	= "d574277f4e019b1aba9f15059c1fce44e26143e5";
export const ownedCheckedRecordHostedArchiversHistoryParent
	= "778d282ed09bfa49384eb21f3a406b99bd8ef822";
export const ownedCheckedRecordHostedArchiversHistoricalAdditions = Object.freeze([
	"scripts/archive-owned-checked-record-evidence.mjs"
	, "tests/helpers/owned-checked-record-hosted-contracts.mjs"
	, "tests/helpers/owned-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/owned-checked-record-hosted-evidence.mjs"
	, "tests/helpers/owned-checked-record-hosted-output.mjs"
	, "tests/owned-checked-record-hosted-archive.test.mjs"
	, "tests/owned-checked-record-hosted-evidence.test.mjs"
]);
export const ownedCheckedRecordHostedArchiversModifiedPaths
	= Object.freeze(["src/adoption/test-profiles.mjs"]);
export const ownedCheckedRecordHostedArchiversImplementationPaths
	= Object.freeze([
		...ownedCheckedRecordHostedArchiversModifiedPaths
		, ...ownedCheckedRecordHostedArchiversHistoricalAdditions
	]);
export const ownedCheckedRecordHostedArchiversIntegrationPaths
	= Object.freeze([
		"src/adoption/test-profiles.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/owned-checked-record-hosted-output.mjs"
		, "tests/owned-checked-record-hosted-archive.test.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
/**
 * Revision containing the predecessor bytes for one integration update.
 *
 * @param path - Integration path being reconstructed.
 */
export const ownedCheckedRecordHostedArchiversIntegrationBase = path =>
	ownedCheckedRecordHostedArchiversHistoricalAdditions.includes(path)
		? ownedCheckedRecordHostedArchiversHistoryParent
		: ownedCheckedRecordHostedArchiversIntegrationPredecessor;
export const ownedCheckedRecordHostedArchiversChangedPaths
	= Object.freeze([
		...ownedCheckedRecordHostedArchiversModifiedPaths
		, ...ownedCheckedRecordHostedArchiversIntegrationPaths
	]);
export const ownedCheckedRecordHostedArchiversAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-hosted-archivers-source-history.mjs"
	, "tests/helpers/owned-checked-record-hosted-archivers-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-hosted-archivers-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordHostedArchiversHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedRecordHostedArchiversUpdate
	= (source, update) => {
		assert.ok(ownedCheckedRecordHostedArchiversChangedPaths
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
 * Remove only the exact owned checked-record hosted archiver change.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordHostedArchiversSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordHostedArchiversChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const integration = data.integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseOwnedCheckedRecordHostedArchiversUpdate(
			source, integration);
		if(sha256(source) === expected) return source;
	}
	const historical = data.historicalUpdates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return historical
		? reverseOwnedCheckedRecordHostedArchiversUpdate(source, historical)
		: source;
};
