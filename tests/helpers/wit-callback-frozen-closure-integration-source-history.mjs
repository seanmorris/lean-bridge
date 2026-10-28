/**
 * Reverse central registration of the WIT callback frozen closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witCallbackFrozenClosureIntegrationHistoryPath
	= "docs/evidence/wit-callback-frozen-closure-integration-source-history-20261028.json";
export const witCallbackFrozenClosureIntegrationBase
	= "e04324030832f0c1eda020f49e23cafd037a7efb";
export const witCallbackFrozenClosureIntegrationImplementation
	= "908ef1ae10c41b71778a2fd0023e8bae7c8dcb62";
export const witCallbackFrozenClosureIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const witCallbackFrozenClosureIntegrationNormalizationPaths
	= witCallbackFrozenClosureIntegrationPaths;
export const witCallbackFrozenClosureIntegrationAddedPaths = Object.freeze([
	"scripts/update-wit-callback-frozen-closure-integration-source-history.mjs"
	, "tests/helpers/wit-callback-frozen-closure-integration-source-history-tests.mjs"
	, "tests/helpers/wit-callback-frozen-closure-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witCallbackFrozenClosureIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one authenticated integration transition.
 *
 * @param {string} source Complete current source text.
 * @param {object} update Recorded transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseWitCallbackFrozenClosureIntegrationUpdate = (
	source, update
) => {
	assert.ok(witCallbackFrozenClosureIntegrationPaths.includes(update.path));
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
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this integration layer.
 *
 * @param {string} path Repository-relative source path.
 * @param {string} source Complete current or historical source.
 * @param {string} [expected] Exact stopping digest.
 * @returns {string} Reversed or unchanged source.
 */
export const beforeWitCallbackFrozenClosureIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !witCallbackFrozenClosureIntegrationPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseWitCallbackFrozenClosureIntegrationUpdate(source, update);
};
