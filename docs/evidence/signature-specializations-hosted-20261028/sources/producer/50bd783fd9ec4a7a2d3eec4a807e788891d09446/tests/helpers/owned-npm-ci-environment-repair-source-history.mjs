/**
 * Authenticate portable owned npm CI paths, log retention and exact live pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedNpmCiEnvironmentRepairHistoryPath
	= "docs/evidence/owned-npm-ci-environment-repair-source-history-20261024.json";
export const ownedNpmCiEnvironmentRepairPredecessor
	= "19a7bb147c84023dd0bb9603d808cef57f27f7cd";
export const ownedNpmCiEnvironmentRepairImplementation
	= "8bd1fc399109b157914c6d04ba3655f964f30db3";
export const ownedNpmCiEnvironmentRepairIntegrationBase
	= "8bd1fc399109b157914c6d04ba3655f964f30db3";
export const ownedNpmCiEnvironmentRepairCommits = Object.freeze([
	"8bd1fc399109b157914c6d04ba3655f964f30db3"
]);
export const ownedNpmCiEnvironmentRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, ".github/workflows/consumer-matrix.yml"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/owned-checked-record-javascript-packaging.test.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
]);
export const ownedNpmCiEnvironmentRepairImplementationAddedPaths = Object.freeze([]);
export const ownedNpmCiEnvironmentRepairImplementationPaths = Object.freeze([
	...ownedNpmCiEnvironmentRepairChangedPaths
	, ...ownedNpmCiEnvironmentRepairImplementationAddedPaths
]);
export const ownedNpmCiEnvironmentRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedNpmCiEnvironmentRepairNormalizationPaths = Object.freeze([
	...ownedNpmCiEnvironmentRepairChangedPaths
	, ...ownedNpmCiEnvironmentRepairIntegrationPaths
]);
export const ownedNpmCiEnvironmentRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-npm-ci-environment-repair-source-history.mjs"
	, "tests/helpers/owned-npm-ci-environment-repair-source-history-tests.mjs"
	, "tests/helpers/owned-npm-ci-environment-repair-source-history.mjs"
]);
export const ownedNpmCiEnvironmentRepairAddedPaths = Object.freeze([
	...ownedNpmCiEnvironmentRepairImplementationAddedPaths
	, ...ownedNpmCiEnvironmentRepairHistoryAddedPaths
]);
export const ownedNpmCiEnvironmentRepairPins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/consumer-matrix.yml"
		, count: 92
		, previousSha256: "2abf9dda4c8125e4083e186ab76ba36edfaaf886c5ad150300da758758876a2d"
		, currentSha256: "0f6003f09e04290081de9e09c52952b54a18b89253f17a843e14ce75e2734381"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedNpmCiEnvironmentRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedNpmCiEnvironmentRepairUpdate = (
	source, update
) => {
	assert.ok(ownedNpmCiEnvironmentRepairNormalizationPaths
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
 * Remove only the exact Owned npm CI environment repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedNpmCiEnvironmentRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedNpmCiEnvironmentRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedNpmCiEnvironmentRepairUpdate(current, update);
	}
	return current;
};
