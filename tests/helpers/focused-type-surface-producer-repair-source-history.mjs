/**
 * Preserve the focused optional, proof-erasure and HostNull producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const focusedTypeSurfaceProducerRepairHistoryPath
	= "docs/evidence/focused-type-surface-producer-repair-source-history-20261029.json";
export const focusedTypeSurfaceProducerRepairPredecessor
	= "797f5e9940c39a54be8405d9768cdb7a42c8b80a";
export const focusedTypeSurfaceProducerRepairImplementation
	= "860c04ecde630e6d7485d1b54043ae30ad7adf6c";
export const focusedTypeSurfaceProducerRepairImplementationPaths = Object.freeze([
	"nix/component-engine-source-boundary.json"
	, "nix/core-source-boundary.json"
	, "src/build/native-model.mjs"
	, "tests/direct-proof-erasure-language-installed.test.mjs"
	, "tests/direct-proof-erasure-managed-installed.test.mjs"
	, "tests/dotnet-host-null-contract.test.mjs"
	, "tests/helpers/direct-proof-erasure-language-tests.mjs"
	, "tests/helpers/direct-proof-erasure-managed-tests.mjs"
	, "tests/helpers/host-null-managed-installed.mjs"
	, "tests/helpers/optional-parameter-language-tests.mjs"
	, "tests/helpers/optional-parameter-managed-tests.mjs"
	, "tests/native-c-family.test.mjs"
	, "tests/optional-parameter-language-installed.test.mjs"
	, "tests/optional-parameter-managed-installed.test.mjs"
]);
export const focusedTypeSurfaceProducerRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const focusedTypeSurfaceProducerRepairNormalizationPaths = Object.freeze([
	...focusedTypeSurfaceProducerRepairImplementationPaths
	, ...focusedTypeSurfaceProducerRepairIntegrationPaths
]);
export const focusedTypeSurfaceProducerRepairAddedPaths = Object.freeze([
	"scripts/update-focused-type-surface-producer-repair-source-history.mjs"
	, "tests/helpers/focused-type-surface-producer-repair-source-history-tests.mjs"
	, "tests/helpers/focused-type-surface-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	focusedTypeSurfaceProducerRepairHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseFocusedTypeSurfaceProducerRepairUpdate = (source, update) => {
	assert.ok(focusedTypeSurfaceProducerRepairNormalizationPaths
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
 * Remove only this recognized producer repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeFocusedTypeSurfaceProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !focusedTypeSurfaceProducerRepairNormalizationPaths.includes(path))
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
		current = reverseFocusedTypeSurfaceProducerRepairUpdate(current, update);
	}
	return current;
};
