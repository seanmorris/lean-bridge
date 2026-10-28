/**
 * Preserve the JavaScript hosted-run outcome qualification transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordJavaScriptHostedRunOutcomeHistoryPath
	= "docs/evidence/owned-checked-record-javascript-hosted-run-outcome-source-history-20261023.json";
export const ownedCheckedRecordJavaScriptHostedRunOutcomePredecessor
	= "79e6d6839d5a6c8381efb67d0a565f75a35bc4ab";
export const ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation
	= "c0b8d879e842d1707946e684991cb507f1bd5643";
export const ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths
	= Object.freeze([
		"tests/helpers/owned-checked-record-hosted-contracts.mjs"
		, "tests/helpers/owned-checked-record-hosted-evidence.mjs"
		, "tests/owned-checked-record-hosted-archive.test.mjs"
	]);
export const ownedCheckedRecordJavaScriptHostedRunOutcomeImplementationPaths
	= ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths;
export const ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedCheckedRecordJavaScriptHostedRunOutcomeNormalizationPaths
	= Object.freeze([...new Set([
		...ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths
		, ...ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths
	])]);
export const ownedCheckedRecordJavaScriptHostedRunOutcomeAddedPaths
	= Object.freeze([
		"scripts/update-owned-checked-record-javascript-hosted-run-outcome-source-history.mjs"
		, "tests/helpers/owned-checked-record-javascript-hosted-run-outcome-source-history-tests.mjs"
		, "tests/helpers/owned-checked-record-javascript-hosted-run-outcome-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordJavaScriptHostedRunOutcomeHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate
	= (source, update) => {
		assert.ok(ownedCheckedRecordJavaScriptHostedRunOutcomeNormalizationPaths
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
 * Remove one authenticated transition; the central hub owns stop decisions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stop digest, decided by the central hub.
 */
export const beforeOwnedCheckedRecordJavaScriptHostedRunOutcomeSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedCheckedRecordJavaScriptHostedRunOutcomeNormalizationPaths
			.includes(path)) return source;
	const value = record(), digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate(source, update);
};
