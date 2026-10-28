/**
 * Preserve the Core type-surface single-pass milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreTypeSurfaceSinglePassHistoryPath
	= "docs/evidence/core-type-surface-single-pass-source-history-20261027.json";
export const coreTypeSurfaceSinglePassPredecessor
	= "f42912812313b8de525bf9e90e146276389613b5";
export const coreTypeSurfaceSinglePassImplementation
	= "9fc4c5d3ef5d41b274d1a573302b851e244f795e";
export const coreTypeSurfaceSinglePassModifiedPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "config/checked-javascript.json"
	, "docs/type-surface.v1.json"
	, "scripts/core-contract-evidence.mjs"
	, "scripts/materialize-core-contract-evidence.mjs"
	, "src/adoption/type-surface.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/core-contract-evidence-tests.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/structural-subtype-core-ci-tests.mjs"
]);
export const coreTypeSurfaceSinglePassImplementationAdditions
	= Object.freeze([
		"scripts/create-core-type-surface-evidence-receipt.mjs"
		, "src/adoption/type-surface-evidence-receipt.mjs"
	]);
export const coreTypeSurfaceSinglePassImplementationPaths = Object.freeze([
	...coreTypeSurfaceSinglePassModifiedPaths
	, ...coreTypeSurfaceSinglePassImplementationAdditions
]);
export const coreTypeSurfaceSinglePassIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreTypeSurfaceSinglePassNormalizationPaths = Object.freeze([
	...new Set([
		...coreTypeSurfaceSinglePassModifiedPaths
		, ...coreTypeSurfaceSinglePassIntegrationPaths
	])
]);
export const coreTypeSurfaceSinglePassAddedPaths = Object.freeze([
	"scripts/update-core-type-surface-single-pass-source-history.mjs"
	, "tests/helpers/core-type-surface-single-pass-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreTypeSurfaceSinglePassHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreTypeSurfaceSinglePassUpdate = (source, update) => {
	assert.ok(coreTypeSurfaceSinglePassNormalizationPaths
		.includes(update.path));
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
 * Remove only the authenticated Core type-surface single-pass milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreTypeSurfaceSinglePassSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreTypeSurfaceSinglePassNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreTypeSurfaceSinglePassUpdate(current, update);
	}
	return current;
};
