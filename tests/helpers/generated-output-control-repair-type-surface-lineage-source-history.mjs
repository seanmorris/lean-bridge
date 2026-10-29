/**
 * Preserve the exact generated-output repair type-surface transition and its
 * newest-first registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const generatedOutputControlRepairTypeSurfaceHistoryPath
	= "docs/evidence/generated-output-control-repair-type-surface-lineage-source-history-20261029.json";
export const generatedOutputControlRepairTypeSurfacePredecessor
	= "bdf458af2e3a3ef22717940f72270cc2e6d6877c";
export const generatedOutputControlRepairTypeSurfacePath = "docs/type-surface.v1.json";
export const generatedOutputControlRepairTypeSurfacePinDefinition
	= "b9c7b30a610dbf39d46a5346e8d655ea975a1dd9";
export const generatedOutputControlRepairTypeSurfacePinRefresh
	= "0b8d29a1936a39cef94ac6174c45860e69c5652e";
export const generatedOutputControlRepairTypeSurfaceAnchorSha256
	= "4a2f092fc89451b1692c3ea546910acb5d6ab793f1f45f928a688e83f8c32865";
export const generatedOutputControlRepairTypeSurfaceTargetSha256
	= "a2e6eb3bd5c2ad19cf1057e0cfdc84ea91ad927f50fb36f2788a0316ef88d57e";
export const generatedOutputControlRepairTypeSurfacePinCount = 17;
export const generatedOutputControlRepairTypeSurfaceIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const generatedOutputControlRepairTypeSurfaceNormalizationPaths = Object.freeze([
	generatedOutputControlRepairTypeSurfacePath
	, ...generatedOutputControlRepairTypeSurfaceIntegrationPaths
]);
export const generatedOutputControlRepairTypeSurfaceAddedPaths = Object.freeze([
	"scripts/update-generated-output-control-repair-type-surface-lineage-source-history.mjs"
	, "tests/helpers/generated-output-control-repair-type-surface-lineage-source-history-tests.mjs"
	, "tests/helpers/generated-output-control-repair-type-surface-lineage-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	generatedOutputControlRepairTypeSurfaceHistoryPath, "utf8"
));

/**
 * Reverse one exact generated-output repair type-surface transition.
 *
 * @param source - Complete later source.
 * @param update - Path, digests and later-side edits of one change.
 */
export const reverseGeneratedOutputControlRepairTypeSurfaceUpdate = (source, update) => {
	assert.ok(generatedOutputControlRepairTypeSurfaceNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

const walk = (path, source, expected, updates) => {
	if(typeof source !== "string"
		|| !generatedOutputControlRepairTypeSurfaceNormalizationPaths.includes(path))
		return source;
	let current = source;
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseGeneratedOutputControlRepairTypeSurfaceUpdate(current, update);
	}
};

/**
 * Remove only this layer's newest-first registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGeneratedOutputControlRepairTypeSurfaceIntegrationSource
	= (path, source, expected) => walk(
		path, source, expected, record().integrationUpdates);

/**
 * Restore the generated-output repair pin refresh.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGeneratedOutputControlRepairTypeSurfaceSource
	= (path, source, expected) => walk(path, source, expected, record().updates);
