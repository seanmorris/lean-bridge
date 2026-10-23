/**
 * Reverse the owned checked-record npm/browser package-retention transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordJavaScriptRetentionHistoryPath
	= "docs/evidence/owned-checked-record-javascript-retention-source-history-20261022.json";
export const ownedCheckedRecordJavaScriptRetentionPredecessor
	= "e1e7de539d12105cbde3347b011534544a5e0b41";
export const ownedCheckedRecordJavaScriptRetentionImplementation
	= "2d54ab1d148beac7ce3a211e72a9369f5705e7f6";
const implementationAdditions = Object.freeze([
	"scripts/check-owned-checked-record-javascript-ci.mjs"
	, "tests/helpers/owned-checked-record-javascript-evidence-tests.mjs"
	, "tests/helpers/owned-checked-record-javascript-evidence.mjs"
]);
export const ownedCheckedRecordJavaScriptRetentionModifiedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/owned-checked-record-hosted-archive.test.mjs"
	, "tests/owned-checked-record-javascript-packaging.test.mjs"
]);
export const ownedCheckedRecordJavaScriptRetentionImplementationPaths
	= Object.freeze([
		...ownedCheckedRecordJavaScriptRetentionModifiedPaths
		, ...implementationAdditions
	]);
export const ownedCheckedRecordJavaScriptRetentionIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedCheckedRecordJavaScriptRetentionChangedPaths
	= Object.freeze([
		...ownedCheckedRecordJavaScriptRetentionModifiedPaths
		, ...ownedCheckedRecordJavaScriptRetentionIntegrationPaths
	]);
export const ownedCheckedRecordJavaScriptRetentionAddedPaths = Object.freeze([
	...implementationAdditions
	, "scripts/update-owned-checked-record-javascript-retention-source-history.mjs"
	, "tests/helpers/owned-checked-record-javascript-retention-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-javascript-retention-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordJavaScriptRetentionHistoryPath, "utf8"));

/**
 * Restore one exact npm/browser retention transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseOwnedCheckedRecordJavaScriptRetentionUpdate
	= (source, update) => {
		assert.ok(ownedCheckedRecordJavaScriptRetentionChangedPaths
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
 * Remove only the exact npm/browser retention transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordJavaScriptRetentionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordJavaScriptRetentionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedCheckedRecordJavaScriptRetentionUpdate(source, update)
		: source;
};
