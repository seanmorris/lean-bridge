/**
 * Reverse the authenticated installed JavaScript owned checked-record layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordJavaScriptHistoryPath
	= "docs/evidence/owned-checked-record-javascript-source-history-20261022.json";
export const ownedCheckedRecordJavaScriptEvidencePath
	= "docs/evidence/owned-checked-record-javascript-acceptance-20261022.json";
export const ownedCheckedRecordJavaScriptPredecessor
	= "0618c3a46a56dfae5f0319abe3dcc8ec75061ff4";
export const ownedCheckedRecordJavaScriptImplementation
	= "87a41b9bb331be0f421ffc321a5f28e09d11e2ea";
export const ownedCheckedRecordJavaScriptImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/build/owned-callback-carriers.mjs"
	, "tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/owned-host-callbacks.test.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordJavaScriptRegistrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const ownedCheckedRecordJavaScriptChangedPaths = Object.freeze([
	...ownedCheckedRecordJavaScriptRegistrationPaths
	, ...ownedCheckedRecordJavaScriptImplementationPaths
]);
export const ownedCheckedRecordJavaScriptAddedPaths = Object.freeze([
	ownedCheckedRecordJavaScriptEvidencePath
	, "docs/evidence/owned-checked-record-javascript-acceptance-20261022.md"
	, "scripts/update-owned-checked-record-javascript-source-history.mjs"
	, "tests/helpers/owned-checked-record-javascript-fixture.mjs"
	, "tests/helpers/owned-checked-record-javascript-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-javascript-source-history.mjs"
	, "tests/owned-checked-record-javascript-packaging.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordJavaScriptHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded exact update.
 */
export const reverseOwnedCheckedRecordJavaScriptUpdate = (source, update) => {
	assert.ok(ownedCheckedRecordJavaScriptChangedPaths.includes(update.path));
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
 * Remove only the exact installed JavaScript owned checked-record layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordJavaScriptSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordJavaScriptChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseOwnedCheckedRecordJavaScriptUpdate(source, update)
		: source;
};
