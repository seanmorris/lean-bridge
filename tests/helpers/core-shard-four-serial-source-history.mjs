/**
 * Preserve the exact serial Core shard 4 and shard memory sampler change and
 * its central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreShardFourSerialHistoryPath
	= "docs/evidence/core-shard-four-serial-source-history-20261028.json";
export const coreShardFourSerialPredecessor
	= "1777476c8d177bad41be2be86c8e3298efbf7bfd";
export const coreShardFourSerialImplementation
	= "bbb0aa82a3a24bc6e5b3b57dc5696a037878acf6";
export const coreShardFourSerialCommits = Object.freeze([
	"6080535b421a43f5b595c56580ab3cea33639252"
	, coreShardFourSerialImplementation
]);
export const coreShardFourSerialImplementationPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "docs/type-surface.v1.json"
	, "scripts/run-test-profile.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
]);
export const coreShardFourSerialIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreShardFourSerialNormalizationPaths = Object.freeze([
	...coreShardFourSerialImplementationPaths
	, ...coreShardFourSerialIntegrationPaths
]);
export const coreShardFourSerialAddedPaths = Object.freeze([
	"scripts/update-core-shard-four-serial-source-history.mjs"
	, "tests/helpers/core-shard-four-serial-source-history-tests.mjs"
	, "tests/helpers/core-shard-four-serial-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreShardFourSerialHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreShardFourSerialUpdate = (source, update) => {
	assert.ok(coreShardFourSerialNormalizationPaths.includes(update.path));
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

/**
 * Remove only the recognized shard 4 change and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreShardFourSerialSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreShardFourSerialNormalizationPaths.includes(path))
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
		current = reverseCoreShardFourSerialUpdate(current, update);
	}
	return current;
};
