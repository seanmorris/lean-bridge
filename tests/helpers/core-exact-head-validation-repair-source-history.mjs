/**
 * Preserve the exact-head Core validation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreExactHeadValidationRepairHistoryPath
	= "docs/evidence/core-exact-head-validation-repair-source-history-20261027.json";
export const coreExactHeadValidationRepairPredecessor
	= "1c8da2dc78adfec08dcd4e88efce57698219a520";
export const coreExactHeadValidationRepairImplementation
	= "49c966f23a7753c50e3ca3bff5021e1eef3a295b";
export const coreExactHeadValidationRepairImplementationPaths = Object.freeze([
	".github/workflows/owned-checked-record-languages.yml"
	, ".github/workflows/owned-subtype-languages.yml"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
]);
export const coreExactHeadValidationRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreExactHeadValidationRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-exact-head-validation-repair-source-history.mjs"
	, "tests/helpers/core-exact-head-validation-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreExactHeadValidationRepairHistoryPath}`
		, import.meta.url), "utf8"
));

/**
 * List every source whose current bytes participate in this transition.
 */
export const coreExactHeadValidationRepairNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreExactHeadValidationRepairImplementationPaths.includes(path)
	|| coreExactHeadValidationRepairIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreExactHeadValidationRepairUpdate = (source, update) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
 * Remove only the authenticated exact-head validation transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreExactHeadValidationRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreExactHeadValidationRepairUpdate(current, update);
	}
	return current;
};
