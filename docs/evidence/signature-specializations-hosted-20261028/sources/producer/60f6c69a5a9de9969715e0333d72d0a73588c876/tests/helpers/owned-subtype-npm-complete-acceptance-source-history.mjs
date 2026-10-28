/**
 * Authenticate complete Subtype npm acceptance while preserving original evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeNpmCompleteAcceptanceHistoryPath
	= "docs/evidence/owned-subtype-npm-complete-acceptance-source-history-20261025.json";
export const ownedSubtypeNpmCompleteAcceptancePredecessor
	= "34f6bde6410c0c2b95c59fdf0db855c5a1e0085a";
export const ownedSubtypeNpmCompleteAcceptanceImplementation
	= "2ddac7bb50749f067d4c2d0f7825b98c3477fe74";
export const ownedSubtypeNpmCompleteAcceptanceIntegrationBase
	= "2ddac7bb50749f067d4c2d0f7825b98c3477fe74";
export const ownedSubtypeNpmCompleteAcceptanceCommits = Object.freeze([
	"2ddac7bb50749f067d4c2d0f7825b98c3477fe74"
]);
export const ownedSubtypeNpmCompleteAcceptanceChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/owned-checked-record-npm-browser.yml"
	, "docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/owned-checked-record-javascript-evidence-fixture.mjs"
	, "tests/helpers/owned-checked-record-javascript-evidence.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/helpers/owned-subtype-promotion.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
	, "tests/owned-subtype-javascript-packaging.test.mjs"
	, "tests/owned-subtype-retained-packages.test.mjs"
]);
export const ownedSubtypeNpmCompleteAcceptanceImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-subtype-npm-complete-acceptance-20261025.json"
	, "scripts/check-owned-subtype-javascript-ci.mjs"
	, "tests/helpers/owned-javascript-package-evidence.mjs"
	, "tests/helpers/owned-subtype-javascript-evidence.mjs"
	, "tests/owned-subtype-javascript-evidence.test.mjs"
]);
export const ownedSubtypeNpmCompleteAcceptanceImplementationPaths = Object.freeze([
	...ownedSubtypeNpmCompleteAcceptanceChangedPaths
	, ...ownedSubtypeNpmCompleteAcceptanceImplementationAddedPaths
]);
export const ownedSubtypeNpmCompleteAcceptanceIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedSubtypeNpmCompleteAcceptanceNormalizationPaths = Object.freeze([
	...ownedSubtypeNpmCompleteAcceptanceChangedPaths
	, ...ownedSubtypeNpmCompleteAcceptanceIntegrationPaths
]);
export const ownedSubtypeNpmCompleteAcceptanceHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-npm-complete-acceptance-source-history.mjs"
	, "tests/helpers/owned-subtype-npm-complete-acceptance-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-npm-complete-acceptance-source-history.mjs"
]);
export const ownedSubtypeNpmCompleteAcceptanceAddedPaths = Object.freeze([
	...ownedSubtypeNpmCompleteAcceptanceImplementationAddedPaths
	, ...ownedSubtypeNpmCompleteAcceptanceHistoryAddedPaths
]);
export const ownedSubtypeNpmCompleteAcceptancePins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/consumer-matrix.yml"
		, count: 92
		, previousSha256: "7c3ea32b921f4fc19767f5f65e565814936b1c006bf8e412fb543ee3f18fa6e3"
		, currentSha256: "7e9b69e4e08d2f1625d745dc0e1db53db5444c91ef5e1ff20ad0ec0a0d2af2c7"
	})
	, Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "e4ddf05a33b6be9203ab5f189583e71c0ed5f48997aba1599e67b39d7e7ce2fb"
		, currentSha256: "4f9cee69df225f2cc40c666e68a72400b0f81b63e9f2494655ba01f8d98122fc"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeNpmCompleteAcceptanceHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeNpmCompleteAcceptanceUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeNpmCompleteAcceptanceNormalizationPaths
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
 * Remove only the exact Owned Subtype npm complete acceptance.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedSubtypeNpmCompleteAcceptanceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeNpmCompleteAcceptanceNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedSubtypeNpmCompleteAcceptanceUpdate(current, update);
	}
	return current;
};
