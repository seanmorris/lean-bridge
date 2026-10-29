/**
 * Preserve the exact current-source pin repair that unblocks Core evidence
 * materialization, including the three missing documentation transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreCurrentSourcePinRepairHistoryPath
	= "docs/evidence/core-current-source-pin-repair-source-history-20261029.json";
export const coreCurrentSourcePinRepairPredecessor
	= "ac0147e7542258c76cf481950b3637d1f911f5d0";
export const coreCurrentSourcePinRepairImplementation
	= "44964a1292440002c071d1d514c31334ca483f0a";
export const coreCurrentSourcePinRepairPreparationPath
	= "scripts/generate-type-docs.mjs";
export const coreCurrentSourcePinRepairPreparationCommits = Object.freeze([
	Object.freeze({
		commit: "e90f852b378c0ff7bbe3f7036afe9f14b1a0e55b"
		, previousCommit: "9635c01720e312b08edc622004cb63254e3ceed7"
	})
	, Object.freeze({
		commit: "0829ce62492335397d9cdf0f6437d2c8cbd5aa0a"
		, previousCommit: "f8703624bf3b63289ff3b23fbe50dfb0aad0f151"
	})
	, Object.freeze({
		commit: "581bae94613ca9226a35d69a5e28c4d6ecd403da"
		, previousCommit: "69fa4085a4ac9469e46a2000ef22bab9611e7048"
	})
]);
export const coreCurrentSourcePinRepairCurrentSourcePaths = Object.freeze([
	coreCurrentSourcePinRepairPreparationPath
	, "src/backends/perl/copied-aliases.mjs"
	, "src/backends/python/compounds.mjs"
	, "src/backends/python/copied-conversions.mjs"
	, "src/backends/ruby/copied-conversions.mjs"
]);
export const coreCurrentSourcePinRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const coreCurrentSourcePinRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreCurrentSourcePinRepairNormalizationPaths = Object.freeze([
	coreCurrentSourcePinRepairPreparationPath
	, ...coreCurrentSourcePinRepairImplementationPaths
	, ...coreCurrentSourcePinRepairIntegrationPaths
]);
export const coreCurrentSourcePinRepairAddedPaths = Object.freeze([
	"scripts/update-core-current-source-pin-repair-source-history.mjs"
	, "tests/helpers/core-current-source-pin-repair-source-history-tests.mjs"
	, "tests/helpers/core-current-source-pin-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreCurrentSourcePinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreCurrentSourcePinRepairUpdate = (source, update) => {
	assert.ok(coreCurrentSourcePinRepairNormalizationPaths.includes(update.path));
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

/**
 * Remove only the recognized current-source repair and documentation chain.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreCurrentSourcePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreCurrentSourcePinRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [
		...value.integrationUpdates
		, ...value.implementationUpdates
		, ...value.preparationUpdates.toReversed()
	];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreCurrentSourcePinRepairUpdate(current, update);
	}
	return current;
};
