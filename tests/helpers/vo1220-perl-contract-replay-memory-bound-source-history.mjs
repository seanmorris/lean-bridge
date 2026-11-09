/**
 * Authenticate the bounded-memory Perl contract replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220PerlContractReplayMemoryBoundHistoryPath
	= "docs/evidence/vo1220-perl-contract-replay-memory-bound-source-history-20261109.json";
export const vo1220PerlContractReplayMemoryBoundPredecessor
	= "39af98acc76410d47c65f0f85baf3c7f443fb6b3";
export const vo1220PerlContractReplayMemoryBoundImplementation
	= "1864d8cd8fcb9e05778b8d3b08f5a62e3f258ce3";
export const vo1220PerlContractReplayMemoryBoundImplementationPaths
	= Object.freeze(["tests/perl-contract-repair-evidence.test.mjs"]);
export const vo1220PerlContractReplayMemoryBoundIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220PerlContractReplayMemoryBoundNormalizationPaths
	= Object.freeze([
		...vo1220PerlContractReplayMemoryBoundImplementationPaths
		, ...vo1220PerlContractReplayMemoryBoundIntegrationPaths
	]);
export const vo1220PerlContractReplayMemoryBoundHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-perl-contract-replay-memory-bound-source-history.mjs"
		, "tests/helpers/vo1220-perl-contract-replay-memory-bound-source-history-tests.mjs"
		, "tests/helpers/vo1220-perl-contract-replay-memory-bound-source-history.mjs"
	]);
export const vo1220PerlContractReplayMemoryBoundBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, packageSemanticChanges: 0, productionCodeChanges: 0
	, recordUpdates: 8, replayedNegativeMutations: 24
	, sealNegativeMutations: 3, cacheIdentityFields: 2
	, boundedDifferenceDiagnostics: true, exactRecordSources: 11
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220PerlContractReplayMemoryBoundHistoryPath, "utf8"
));

/**
 * Require the exact bounded replay implementation.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220PerlContractReplayMemoryBound = sources => {
	for(const path of vo1220PerlContractReplayMemoryBoundImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const test = sources["tests/perl-contract-repair-evidence.test.mjs"];
	assert.match(test, /const historicalSources = new Map\(\);/u);
	assert.match(test, /const key = `\$\{path\}\\0\$\{expected\}`;/u);
	assert.match(test, /sourceAtFinHistoryRecordSource\(/u);
	assert.match(test
		, /sha256\(await historicalSource\(path, hash\)\)/u);
	assert.match(test
		, /await historicalSource\(inventoryPath/u);
	assert.match(test, /reversePerlContractRepair\(\s*inventory, inventoryUpdate\)/u);
	assert.match(test, /const firstJsonDifference = \(actual, expected\) =>/u);
	assert.match(test, /assert\.equal\(difference, undefined, difference\)/u);
	return { ...vo1220PerlContractReplayMemoryBoundBehavior };
};

/**
 * Reverse one authenticated bounded-replay transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220PerlContractReplayMemoryBoundUpdate = (
	source, update
) => {
	assert.ok(vo1220PerlContractReplayMemoryBoundNormalizationPaths
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
 * Remove only this bounded replay repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220PerlContractReplayMemoryBoundSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220PerlContractReplayMemoryBoundNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220PerlContractReplayMemoryBoundUpdate(
				current, update);
	}
	return current;
};
