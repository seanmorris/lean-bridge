/**
 * Authenticate hosted Subtype npm archives while preserving original evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeNpmHostedHistoryPath
	= "docs/evidence/owned-subtype-npm-hosted-source-history-20261025.json";
export const ownedSubtypeNpmHostedPredecessor
	= "37e485c73fa0bae2c0baac3a434b959293d689f5";
export const ownedSubtypeNpmHostedImplementation
	= "d45cd191867b74c6532a4c2cdeb63b9b27260fe5";
export const ownedSubtypeNpmHostedIntegrationBase
	= "d45cd191867b74c6532a4c2cdeb63b9b27260fe5";
export const ownedSubtypeNpmHostedCommits = Object.freeze([
	"2b9105cc526f637a6af25008cbfc683169a77da0"
	, "d45cd191867b74c6532a4c2cdeb63b9b27260fe5"
]);
export const ownedSubtypeNpmHostedChangedPaths = Object.freeze([
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "scripts/archive-owned-subtype-evidence.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-subtype-hosted-contracts.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence-sources.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence.mjs"
	, "tests/helpers/owned-subtype-hosted-output.mjs"
	, "tests/owned-subtype-hosted-ci.test.mjs"
	, "tests/owned-subtype-javascript-evidence.test.mjs"
]);
export const ownedSubtypeNpmHostedImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-subtype-javascript-evidence-fixture.mjs"
	, "tests/helpers/owned-subtype-javascript-hosted-output.mjs"
	, "tests/owned-subtype-javascript-hosted.test.mjs"
]);
export const ownedSubtypeNpmHostedImplementationPaths = Object.freeze([
	...ownedSubtypeNpmHostedChangedPaths
	, ...ownedSubtypeNpmHostedImplementationAddedPaths
]);
export const ownedSubtypeNpmHostedIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedSubtypeNpmHostedNormalizationPaths = Object.freeze([
	...ownedSubtypeNpmHostedChangedPaths
	, ...ownedSubtypeNpmHostedIntegrationPaths
]);
export const ownedSubtypeNpmHostedHistoryAddedPaths = Object.freeze([
	"docs/evidence/owned-subtype-npm-hosted-20261025.json"
	, "scripts/update-owned-subtype-npm-hosted-source-history.mjs"
	, "tests/helpers/owned-subtype-npm-hosted-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-npm-hosted-source-history.mjs"
]);
export const ownedSubtypeNpmHostedAddedPaths = Object.freeze([
	...ownedSubtypeNpmHostedImplementationAddedPaths
	, ...ownedSubtypeNpmHostedHistoryAddedPaths
]);
export const ownedSubtypeNpmHostedPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "4f9cee69df225f2cc40c666e68a72400b0f81b63e9f2494655ba01f8d98122fc"
		, currentSha256: "1a85cc6972b45ad40a707d7b9932d934ab1fdd0f2c818d70cb2cb9f53d87b8ac"
	})
	, Object.freeze({
		path: "src/adoption/test-profiles.mjs"
		, count: 98
		, previousSha256: "e01087e1dd31c675a739ee26a727a86a864d7d921a2396e9f178fd78199e9fee"
		, currentSha256: "5e0411d2d1cec05cc0171baccde0cf7d01a1a88b6c1cac8ee7b9ca238867fa20"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeNpmHostedHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeNpmHostedUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeNpmHostedNormalizationPaths
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
 * Remove only the exact Owned Subtype npm hosted archive.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedSubtypeNpmHostedSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeNpmHostedNormalizationPaths.includes(path))
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
		current = reverseOwnedSubtypeNpmHostedUpdate(current, update);
	}
	return current;
};
