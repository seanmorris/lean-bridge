/**
 * Reverse the hosted zero-payload browser evidence verifier milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadBrowserEvidenceHistoryPath
	= "docs/evidence/zero-payload-browser-evidence-source-history-20261021.json";
export const zeroPayloadBrowserEvidencePredecessor
	= "cbfc1caba121827ddbd83eecfd7feb7dccd4ebf4";
export const zeroPayloadBrowserEvidenceImplementation
	= "086e1da39f07cf0cce6eada7b30332810337c161";
export const zeroPayloadBrowserEvidenceChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const zeroPayloadBrowserEvidenceIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/zero-payload-checked-record-browser-evidence.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadBrowserEvidenceHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadBrowserEvidenceUpdate = (source, update) => {
	assert.ok([...zeroPayloadBrowserEvidenceChangedPaths
		, ...zeroPayloadBrowserEvidenceIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact browser-evidence verifier milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadBrowserEvidenceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadBrowserEvidenceChangedPaths
			, ...zeroPayloadBrowserEvidenceIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadBrowserEvidenceUpdate(source, update) : source;
};
