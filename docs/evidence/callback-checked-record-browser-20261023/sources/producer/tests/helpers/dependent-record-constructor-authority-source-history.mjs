/**
 * Reverse the JavaScript dependent checked-record constructor-authority repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentRecordConstructorAuthorityHistoryPath
	= "docs/evidence/dependent-record-constructor-authority-source-history-20261022.json";
export const dependentRecordConstructorAuthorityPredecessor
	= "f5599acc10323f661d186acbf1ad3e6798f9f152";
export const dependentRecordConstructorAuthorityImplementation
	= "cff0d7db2cbc777a48843b3283595529494b3a8a";
export const dependentRecordConstructorAuthorityHistoricalPaths = Object.freeze([
	"src/backends/javascript/copied-validators.mjs"
	, "tests/helpers/dependent-checked-record-browser-tests.mjs"
]);
export const dependentRecordConstructorAuthorityIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const dependentRecordConstructorAuthorityChangedPaths = Object.freeze([
	...dependentRecordConstructorAuthorityHistoricalPaths
	, ...dependentRecordConstructorAuthorityIntegrationPaths
]);
export const dependentRecordConstructorAuthorityAddedPaths = Object.freeze([
	"scripts/update-dependent-record-constructor-authority-source-history.mjs"
	, "tests/helpers/dependent-record-constructor-authority-source-history.mjs"
	, "tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentRecordConstructorAuthorityHistoryPath, "utf8"
));

/**
 * Restore one authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentRecordConstructorAuthorityUpdate = (
	source, update
) => {
	assert.ok(dependentRecordConstructorAuthorityChangedPaths.includes(
		update.path
	));
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
 * Remove only the exact constructor-authority repair and integration layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeDependentRecordConstructorAuthoritySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentRecordConstructorAuthorityChangedPaths.includes(path))
		return source;
	let current = source;
	const updates = [...record().integrationUpdates, ...record().updates];
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDependentRecordConstructorAuthorityUpdate(
			current, update
		);
	}
};
