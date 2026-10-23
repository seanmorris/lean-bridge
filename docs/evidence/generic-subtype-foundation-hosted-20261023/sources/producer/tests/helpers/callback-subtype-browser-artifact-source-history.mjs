/**
 * Reverse the callback Subtype browser artifact-retention transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeBrowserArtifactHistoryPath
	= "docs/evidence/callback-subtype-browser-artifact-source-history-20261020.json";
export const callbackSubtypeBrowserArtifactPredecessor
	= "fd80f73a1d9ac1d4e006dd98a77dccaad9ae25db";
export const callbackSubtypeBrowserArtifactImplementation
	= "d24b8990a52cda6aa5a2eee38041db9d62a663bf";
export const callbackSubtypeBrowserArtifactChangedPaths = Object.freeze([
	"scripts/check-callback-subtype-browser-ci.mjs"
	, "scripts/run-callback-subtype-browser-ci.sh"
	, "tests/callback-subtype-browser-ci.test.mjs"
	, "tests/callback-subtype-npm-browser.test.mjs"
	, "tests/helpers/callback-subtype-browser-ci-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-browser-ci.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeBrowserArtifactHistoryPath, "utf8"
));

/**
 * Restore one exact updated source after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Recorded update with ordered edits.
 */
export const reverseCallbackSubtypeBrowserArtifactUpdate = (source, update) => {
	assert.ok(callbackSubtypeBrowserArtifactChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
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
 * Remove only this artifact-retention source transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeBrowserArtifactSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeBrowserArtifactChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeBrowserArtifactUpdate(source, update)
		: source;
};
