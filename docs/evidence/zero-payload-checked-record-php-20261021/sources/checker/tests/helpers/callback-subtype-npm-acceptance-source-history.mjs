/**
 * Reverse the authenticated callback Subtype npm acceptance transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeNpmAcceptanceHistoryPath
	= "docs/evidence/callback-subtype-npm-acceptance-source-history-20261020.json";
export const callbackSubtypeNpmAcceptancePredecessor
	= "32cfafd3634cf78f41cf91296ba33b5776ab3e87";
export const callbackSubtypeNpmAcceptanceImplementation
	= "123e30ff24790d211e1df5b81d879568990552ea";
export const callbackSubtypeNpmAcceptanceChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/analyze/reviewed-subtypes.mjs"
	, "tests/callback-subtype-extractor.test.mjs"
	, "tests/callback-subtype-foundation.test.mjs"
	, "tests/fixtures/onboarding/callback-subtypes/CallbackSubtypes.lean"
	, "tests/helpers/callback-subtype-foundation-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-npm-browser-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeNpmAcceptanceHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseCallbackSubtypeNpmAcceptanceUpdate = (source, update) => {
	assert.ok(callbackSubtypeNpmAcceptanceChangedPaths.includes(update.path));
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
 * Remove only this exact callback Subtype npm acceptance transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeNpmAcceptanceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeNpmAcceptanceChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeNpmAcceptanceUpdate(source, update)
		: source;
};
