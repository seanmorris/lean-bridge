/**
 * Reverse the authenticated zero-payload JavaScript surface milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadJavaScriptHistoryPath
	= "docs/evidence/zero-payload-javascript-source-history-20261021.json";
export const zeroPayloadJavaScriptPredecessor
	= "556bddd612d8562654904920a39b44dc1e569742";
export const zeroPayloadJavaScriptImplementation
	= "5035456fe465a774eaf6597e8659997024c6c7ca";
export const zeroPayloadJavaScriptChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "src/backends/javascript/generate.mjs"
]);
export const zeroPayloadJavaScriptIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/zero-payload-checked-record-source-history-tests.mjs"
	, "tests/helpers/zero-payload-npm-foundation-source-history-tests.mjs"
	, "tests/zero-payload-checked-record-javascript.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadJavaScriptHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadJavaScriptUpdate = (source, update) => {
	assert.ok([...zeroPayloadJavaScriptChangedPaths
		, ...zeroPayloadJavaScriptIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact zero-payload JavaScript milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadJavaScriptSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadJavaScriptChangedPaths
		, ...zeroPayloadJavaScriptIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadJavaScriptUpdate(source, update)
		: source;
};
