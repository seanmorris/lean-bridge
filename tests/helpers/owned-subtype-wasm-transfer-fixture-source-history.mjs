/**
 * Preserve the exact Owned Subtype wasm transfer fixture transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeWasmTransferFixtureHistoryPath
	= "docs/evidence/owned-subtype-wasm-transfer-fixture-source-history-20261023.json";
export const ownedSubtypeWasmTransferFixturePredecessor
	= "9388829d67ef174bff56f51b37c84a12072ff34e";
export const ownedSubtypeWasmTransferFixtureImplementation
	= "3913bfcd32c51e2c5ce040fed6cff5b4b30eb87c";
export const ownedSubtypeWasmTransferFixtureModifiedPaths
	= Object.freeze([
		"tests/owned-javascript-wasm-native.test.mjs"
	]);
export const ownedSubtypeWasmTransferFixtureIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-aggregate-model.test.mjs"
	]);
export const ownedSubtypeWasmTransferFixtureNormalizationPaths
	= Object.freeze([...new Set([
		...ownedSubtypeWasmTransferFixtureModifiedPaths
		, ...ownedSubtypeWasmTransferFixtureIntegrationPaths
	])]);
export const ownedSubtypeWasmTransferFixtureAddedPaths
	= Object.freeze([
		"scripts/update-owned-subtype-wasm-transfer-fixture-source-history.mjs"
		, "tests/helpers/owned-subtype-wasm-transfer-fixture-source-history-tests.mjs"
		, "tests/helpers/owned-subtype-wasm-transfer-fixture-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeWasmTransferFixtureHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseOwnedSubtypeWasmTransferFixtureUpdate = (source, update) => {
	assert.ok(ownedSubtypeWasmTransferFixtureNormalizationPaths.includes(update.path));
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
 * Remove one authenticated transition of this layer. A recognized update is
 * always reversed; the central hub decides where an expected historical
 * digest stops and re-enters for any further transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeOwnedSubtypeWasmTransferFixtureSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedSubtypeWasmTransferFixtureNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedSubtypeWasmTransferFixtureUpdate(source, update);
};
