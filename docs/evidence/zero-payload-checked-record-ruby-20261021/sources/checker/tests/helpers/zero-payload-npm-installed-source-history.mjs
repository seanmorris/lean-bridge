/**
 * Reverse the authenticated zero-payload installed npm milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadNpmInstalledHistoryPath
	= "docs/evidence/zero-payload-npm-installed-source-history-20261021.json";
export const zeroPayloadNpmInstalledPredecessor
	= "319891d4d6b9c693d443dfa4a899adab6418db1f";
export const zeroPayloadNpmInstalledImplementation
	= "e84d8a3ba9e074560156684f3afb360865f9479c";
export const zeroPayloadNpmInstalledChangedPaths = Object.freeze([
	"tests/fixtures/zero-payload-checked-record-browser/javascript.mjs"
	, "tests/helpers/zero-payload-checked-record-browser-fixture.mjs"
	, "tests/helpers/zero-payload-javascript-source-history-tests.mjs"
	, "tests/zero-payload-checked-record-javascript.test.mjs"
]);
export const zeroPayloadNpmInstalledIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadNpmInstalledHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadNpmInstalledUpdate = (source, update) => {
	assert.ok([...zeroPayloadNpmInstalledChangedPaths
		, ...zeroPayloadNpmInstalledIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload installed npm milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadNpmInstalledSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadNpmInstalledChangedPaths
		, ...zeroPayloadNpmInstalledIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadNpmInstalledUpdate(source, update)
		: source;
};
