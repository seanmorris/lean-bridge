/**
 * Reverse the authenticated remaining-host callback Subtype acceptance gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeRemainingAcceptanceHistoryPath
	= "docs/evidence/callback-subtype-remaining-acceptance-source-history-20261020.json";
export const callbackSubtypeRemainingAcceptancePredecessor
	= "2cb6aeda025b0b0da37671e9048de885a47419e1";
export const callbackSubtypeRemainingAcceptanceImplementation
	= "fcbfe2341859125ac88947796f3d400223ae90cd";
export const callbackSubtypeRemainingAcceptanceChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/jvm/callable-graph-model.mjs"
	, "tests/callback-subtype-native-ci.test.mjs"
	, "tests/helpers/callback-subtype-language-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-remaining-source-history-tests.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeRemainingAcceptanceHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeRemainingAcceptanceUpdate = (
	source, update
) => {
	assert.ok(callbackSubtypeRemainingAcceptanceChangedPaths.includes(update.path));
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
 * Remove only this exact remaining-host acceptance transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeRemainingAcceptanceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeRemainingAcceptanceChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeRemainingAcceptanceUpdate(source, update) : source;
};
