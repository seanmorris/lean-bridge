/**
 * Reverse the Core memory bound on the owned .NET, Ruby and Python integration
 * verifiers and the inherited checked-record promotion case: authenticated
 * bytes are reused, only the current contracts are read, and predecessor
 * integrations are pinned by receipt hash instead of re-executed in-process.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreMemoryBoundHistoryPath
	= "docs/evidence/core-memory-bound-source-history-20261028.json";
export const coreMemoryBoundPredecessor
	= "e18a9a306853c6a720927d50befc05c11e84044c";
export const coreMemoryBoundImplementation
	= "4f3ed352fbe1efd2251532f3b8497430980c95d6";
export const coreMemoryBoundCommits = Object.freeze([
	"4f3ed352fbe1efd2251532f3b8497430980c95d6"
]);
export const coreMemoryBoundChangedPaths = Object.freeze([
	"tests/helpers/inherited-checked-record-promotion-tests.mjs"
	, "tests/helpers/owned-dotnet-evidence.mjs"
	, "tests/helpers/owned-python-evidence.mjs"
	, "tests/helpers/owned-ruby-evidence.mjs"
]);
export const coreMemoryBoundNormalizationPaths
	= coreMemoryBoundChangedPaths;
export const coreMemoryBoundImplementationAddedPaths = Object.freeze([
	"tests/helpers/type-surface-contracts.mjs"
]);
export const coreMemoryBoundHistoryAddedPaths = Object.freeze([
	"scripts/update-core-memory-bound-source-history.mjs"
	, "tests/helpers/core-memory-bound-source-history-tests.mjs"
	, "tests/helpers/core-memory-bound-source-history.mjs"
]);
export const coreMemoryBoundAddedPaths = Object.freeze([
	...coreMemoryBoundImplementationAddedPaths
	, ...coreMemoryBoundHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreMemoryBoundHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreMemoryBoundUpdate = (source, update) => {
	assert.ok(coreMemoryBoundNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeCoreMemoryBoundSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreMemoryBoundNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreMemoryBoundUpdate(source, update);
};
