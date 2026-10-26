/**
 * Preserve the exact WIT acceptance stop boundary transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witAcceptanceStopBoundaryHistoryPath
	= "docs/evidence/wit-acceptance-stop-boundary-source-history-20261023.json";
export const witAcceptanceStopBoundaryPredecessor
	= "b329d7416f8aa6f67ca3a86d5ecabb814e428bc4";
export const witAcceptanceStopBoundaryImplementation
	= "20c1141f93abee6dd5d22ddf9819ccb0c9ca2cbf";
export const witAcceptanceStopBoundaryModifiedPaths
	= Object.freeze([
		"tests/wit-recursive-acceptance.test.mjs"
	]);
export const witAcceptanceStopBoundaryIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/wit-recursive-callable-faults.test.mjs"
	]);
export const witAcceptanceStopBoundaryNormalizationPaths
	= Object.freeze([...new Set([
		...witAcceptanceStopBoundaryModifiedPaths
		, ...witAcceptanceStopBoundaryIntegrationPaths
	])]);
export const witAcceptanceStopBoundaryAddedPaths
	= Object.freeze([
		"scripts/update-wit-acceptance-stop-boundary-source-history.mjs"
		, "tests/helpers/wit-acceptance-stop-boundary-source-history-tests.mjs"
		, "tests/helpers/wit-acceptance-stop-boundary-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witAcceptanceStopBoundaryHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseWitAcceptanceStopBoundaryUpdate = (source, update) => {
	assert.ok(witAcceptanceStopBoundaryNormalizationPaths.includes(update.path));
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
 * Remove one authenticated transition of this layer. A recognized update is
 * always reversed; the central hub decides where an expected historical
 * digest stops and re-enters for any further transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeWitAcceptanceStopBoundarySource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !witAcceptanceStopBoundaryNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseWitAcceptanceStopBoundaryUpdate(source, update);
};
