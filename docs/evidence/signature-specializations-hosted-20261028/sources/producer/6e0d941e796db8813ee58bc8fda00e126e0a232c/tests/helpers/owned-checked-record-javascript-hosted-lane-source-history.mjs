/**
 * Preserve the exact owned checked-record JavaScript hosted-lane transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordJavaScriptHostedLaneHistoryPath
	= "docs/evidence/owned-checked-record-javascript-hosted-lane-source-history-20261023.json";
export const ownedCheckedRecordJavaScriptHostedLanePredecessor
	= "835d260a26dfd6bcbd577b47955a138accf21c7e";
export const ownedCheckedRecordJavaScriptHostedLaneImplementation
	= "5b7a9e373cb01a680d8dd35f239425177aedd1ed";
export const ownedCheckedRecordJavaScriptHostedLaneModifiedPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "tests/helpers/owned-checked-record-hosted-contracts.mjs"
		, "tests/helpers/owned-checked-record-hosted-evidence-sources.mjs"
		, "tests/helpers/owned-checked-record-hosted-evidence.mjs"
		, "tests/helpers/owned-checked-record-hosted-output.mjs"
		, "tests/helpers/owned-javascript-wasm-ci.mjs"
		, "tests/owned-checked-record-hosted-archive.test.mjs"
		, "tests/owned-javascript-wasm-ci.test.mjs"
	]);
export const ownedCheckedRecordJavaScriptHostedLaneImplementationPaths
	= ownedCheckedRecordJavaScriptHostedLaneModifiedPaths;
export const ownedCheckedRecordJavaScriptHostedLaneIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedCheckedRecordJavaScriptHostedLaneNormalizationPaths
	= Object.freeze([...new Set([
		...ownedCheckedRecordJavaScriptHostedLaneModifiedPaths
		, ...ownedCheckedRecordJavaScriptHostedLaneIntegrationPaths
	])]);
export const ownedCheckedRecordJavaScriptHostedLaneAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-javascript-hosted-lane-source-history.mjs"
	, "tests/helpers/owned-checked-record-javascript-hosted-lane-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-javascript-hosted-lane-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordJavaScriptHostedLaneHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate
	= (source, update) => {
		assert.ok(ownedCheckedRecordJavaScriptHostedLaneNormalizationPaths
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
 * Remove one authenticated transition. The central hub owns stop decisions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stop digest, decided by the central hub.
 */
export const beforeOwnedCheckedRecordJavaScriptHostedLaneSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedCheckedRecordJavaScriptHostedLaneNormalizationPaths.includes(path))
		return source;
	const value = record(), digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate(source, update);
};
