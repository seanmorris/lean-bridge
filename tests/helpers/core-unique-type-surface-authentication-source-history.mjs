/**
 * Preserve the Core unique type-surface authentication optimization.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreUniqueTypeSurfaceAuthenticationHistoryPath
	= "docs/evidence/core-unique-type-surface-authentication-source-history-20261027.json";
export const coreUniqueTypeSurfaceAuthenticationPredecessor
	= "59ef6ad6eb136c914361e4de62b0b0c19c3f3d24";
export const coreUniqueTypeSurfaceAuthenticationImplementation
	= "01571d3efec8e1cb94b63d4c4fa988e338f3b468";
export const coreUniqueTypeSurfaceAuthenticationImplementationPaths
	= Object.freeze([
		"src/adoption/type-surface-evidence-receipt.mjs"
		, "src/adoption/type-surface.mjs"
		, "tests/helpers/core-contract-evidence-tests.mjs"
	]);
export const coreUniqueTypeSurfaceAuthenticationIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreUniqueTypeSurfaceAuthenticationNormalizationPaths
	= Object.freeze([
		...coreUniqueTypeSurfaceAuthenticationImplementationPaths
		, ...coreUniqueTypeSurfaceAuthenticationIntegrationPaths
	]);
export const coreUniqueTypeSurfaceAuthenticationAddedPaths = Object.freeze([
	"scripts/update-core-unique-type-surface-authentication-source-history.mjs"
	, "tests/helpers/core-unique-type-surface-authentication-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreUniqueTypeSurfaceAuthenticationHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreUniqueTypeSurfaceAuthenticationUpdate = (
	source, update
) => {
	assert.ok(coreUniqueTypeSurfaceAuthenticationNormalizationPaths.includes(
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
 * Remove only the authenticated unique-file optimization.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreUniqueTypeSurfaceAuthenticationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreUniqueTypeSurfaceAuthenticationNormalizationPaths.includes(path))
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
		current = reverseCoreUniqueTypeSurfaceAuthenticationUpdate(
			current, update
		);
	}
	return current;
};
