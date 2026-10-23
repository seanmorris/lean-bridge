/**
 * Reverse the authenticated callback checked-record npm and browser adapters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordNpmBrowserHistoryPath
	= "docs/evidence/callback-checked-record-npm-browser-source-history-20261021.json";
export const callbackCheckedRecordNpmBrowserPredecessor
	= "42dc6a79b0677efb7b092f88d1c5b2b778143dae";
export const callbackCheckedRecordNpmBrowserImplementation
	= "39c49b7244bc58d0ad55005938d141cfab2a383d";
export const callbackCheckedRecordNpmBrowserChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/abi/refinements.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-structured-callable-defaults.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "tests/callback-checked-record-extractor.test.mjs"
	, "tests/fixtures/onboarding/callback-checked-records/CallbackCheckedRecords.lean"
	, "tests/helpers/callback-checked-record-fixture.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
/** The hub transition above spans the implementation and its history commit. */
export const callbackCheckedRecordNpmBrowserIntegrationPaths = Object.freeze([]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordNpmBrowserHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseCallbackCheckedRecordNpmBrowserUpdate = (source, update) => {
	assert.ok(callbackCheckedRecordNpmBrowserChangedPaths.includes(update.path));
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
 * Remove only this exact callback checked-record npm/browser lane milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordNpmBrowserSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordNpmBrowserChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackCheckedRecordNpmBrowserUpdate(source, update) : source;
};
