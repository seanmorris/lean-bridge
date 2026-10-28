/**
 * Preserve the exact Core shard-five and shard-eight repair range and its
 * central registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreShardFiveEightRepairHistoryPath
	= "docs/evidence/core-shard-five-eight-repair-source-history-20261028.json";
export const coreShardFiveEightRepairPredecessor
	= "f311acff4ab598b6332155a209a10ba8620719ee";
export const coreShardFiveEightRepairImplementation
	= "2be00a8568c794cbaa605a0436f25644cac4d8de";
export const coreShardFiveEightRepairCommits = Object.freeze([
	"924a767eb2856e1f1b011c432d800c00bae5fe8b"
	, "15d7802cb54993d7c510c8b1d7b8d75dc674a3e2"
	, coreShardFiveEightRepairImplementation
]);
export const coreShardFiveEightRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/native-specialization-closure.mjs"
	, "tests/helpers/owned-ruby-evidence.mjs"
	, "tests/owned-perl-borrow-evidence.test.mjs"
	, "tests/owned-rust-transfer-evidence.test.mjs"
	, "tests/perl-scalar-promotion.test.mjs"
	, "tests/php-nix-boundary-repair-evidence.test.mjs"
	, "tests/structured-docs-ci-evidence.test.mjs"
	, "tests/type-surface.test.mjs"
]);
export const coreShardFiveEightRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreShardFiveEightRepairNormalizationPaths = Object.freeze([
	...coreShardFiveEightRepairImplementationPaths
	, ...coreShardFiveEightRepairIntegrationPaths
]);
export const coreShardFiveEightRepairAddedPaths = Object.freeze([
	"scripts/update-core-shard-five-eight-repair-source-history.mjs"
	, "tests/helpers/core-shard-five-eight-repair-source-history-tests.mjs"
	, "tests/helpers/core-shard-five-eight-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreShardFiveEightRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreShardFiveEightRepairUpdate = (source, update) => {
	assert.ok(coreShardFiveEightRepairNormalizationPaths.includes(update.path));
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
 * Remove only the recognized shard repair range and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreShardFiveEightRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreShardFiveEightRepairNormalizationPaths.includes(path))
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
		current = reverseCoreShardFiveEightRepairUpdate(current, update);
	}
	return current;
};
