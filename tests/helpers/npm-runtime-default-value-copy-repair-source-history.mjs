/**
 * Preserve the exact removal of the stray default-value runtime copy, the milestone reads of the HostNull history
 * test, the pin refresh and the central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const npmRuntimeDefaultValueCopyRepairHistoryPath
	= "docs/evidence/npm-runtime-default-value-copy-repair-source-history-20261029.json";
export const npmRuntimeDefaultValueCopyRepairPredecessor
	= "e5827ccbdb36fbb940accb9c104090dc025f9e6b";
export const npmRuntimeDefaultValueCopyRepairImplementation
	= "f161f81a588f65c965bd437ac73a4fdec9b52d82";
export const npmRuntimeDefaultValueCopyRepairSourceCommit
	= "4aa35765754ff88e337450d60d971e898dc6262c";
export const npmRuntimeDefaultValueCopyRepairCommits = Object.freeze([
	npmRuntimeDefaultValueCopyRepairSourceCommit
	, npmRuntimeDefaultValueCopyRepairImplementation
]);
export const npmRuntimeDefaultValueCopyRepairTypeSurfacePath = "docs/type-surface.v1.json";
export const npmRuntimeDefaultValueCopyRepairPackagePath = "src/release/component-npm-package.mjs";
export const npmRuntimeDefaultValueCopyRepairTestPath = "tests/component-npm-package.test.mjs";
export const npmRuntimeDefaultValueCopyRepairHistoryTestPath
	= "tests/helpers/host-null-javascript-source-history-tests.mjs";
export const npmRuntimeDefaultValueCopyRepairPinCount = 16;
export const npmRuntimeDefaultValueCopyRepairSourcePaths = Object.freeze([
	npmRuntimeDefaultValueCopyRepairPackagePath
	, npmRuntimeDefaultValueCopyRepairTestPath
	, npmRuntimeDefaultValueCopyRepairHistoryTestPath
]);
export const npmRuntimeDefaultValueCopyRepairImplementationPaths = Object.freeze([
	npmRuntimeDefaultValueCopyRepairPackagePath
	, npmRuntimeDefaultValueCopyRepairTestPath
	, npmRuntimeDefaultValueCopyRepairHistoryTestPath
	, npmRuntimeDefaultValueCopyRepairTypeSurfacePath
]);
export const npmRuntimeDefaultValueCopyRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const npmRuntimeDefaultValueCopyRepairNormalizationPaths = Object.freeze([
	...npmRuntimeDefaultValueCopyRepairImplementationPaths
	, ...npmRuntimeDefaultValueCopyRepairIntegrationPaths
]);
export const npmRuntimeDefaultValueCopyRepairAddedPaths = Object.freeze([
	"scripts/update-npm-runtime-default-value-copy-repair-source-history.mjs"
	, "tests/helpers/npm-runtime-default-value-copy-repair-source-history-tests.mjs"
	, "tests/helpers/npm-runtime-default-value-copy-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	npmRuntimeDefaultValueCopyRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and the current-side edits of one change.
 */
export const reverseNpmRuntimeDefaultValueCopyRepairUpdate = (source, update) => {
	assert.ok(npmRuntimeDefaultValueCopyRepairNormalizationPaths.includes(update.path));
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
 * Remove only the recognized default-value copy repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNpmRuntimeDefaultValueCopyRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !npmRuntimeDefaultValueCopyRepairNormalizationPaths.includes(path))
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
		current = reverseNpmRuntimeDefaultValueCopyRepairUpdate(current, update);
	}
	return current;
};
