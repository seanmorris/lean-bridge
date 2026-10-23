/**
 * Reverse the exact owned-Subtype WIT resource-name assertion repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeWitResourceRepairHistoryPath
	= "docs/evidence/owned-subtype-wit-resource-repair-source-history-20261023.json";
export const ownedSubtypeWitResourceRepairPredecessor
	= "61bc1e0d998dbf467ddb1fc130159f7f6f1566bb";
export const ownedSubtypeWitResourceRepairImplementation
	= "0df326f300311a8e0a6c7d02af58911debf2bb5b";
export const ownedSubtypeWitResourceRepairImplementationPaths = Object.freeze([
	"tests/owned-subtype-remaining-packaging.test.mjs"
]);
export const ownedSubtypeWitResourceRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const ownedSubtypeWitResourceRepairChangedPaths = Object.freeze([
	...ownedSubtypeWitResourceRepairImplementationPaths
	, ...ownedSubtypeWitResourceRepairIntegrationPaths
]);
export const ownedSubtypeWitResourceRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-wit-resource-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-wit-resource-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-wit-resource-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeWitResourceRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeWitResourceRepairUpdate = (source, update) => {
	assert.ok(ownedSubtypeWitResourceRepairChangedPaths.includes(update.path));
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
 * Remove only the owned-Subtype WIT resource assertion repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeWitResourceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeWitResourceRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedSubtypeWitResourceRepairUpdate(source, update) : source;
};
