/**
 * Authenticate the owned npm source identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedNpmSourceIdentityRepairHistoryPath
	= "docs/evidence/owned-npm-source-identity-repair-source-history-20261024.json";
export const ownedNpmSourceIdentityRepairPredecessor
	= "0be57f78747083ee6d6986418e15a0f9121fd300";
export const ownedNpmSourceIdentityRepairImplementation
	= "16c19ea1c98f6e552ba4370218afe324ef925660";
export const ownedNpmSourceIdentityRepairIntegrationBase
	= "16c19ea1c98f6e552ba4370218afe324ef925660";
export const ownedNpmSourceIdentityRepairCommits = Object.freeze([
	"16c19ea1c98f6e552ba4370218afe324ef925660"
]);
export const ownedNpmSourceIdentityRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "tests/helpers/owned-checked-record-javascript-evidence.mjs"
	, "tests/helpers/owned-checked-record-javascript-evidence-tests.mjs"
	, "tests/owned-checked-record-hosted-archive.test.mjs"
]);
export const ownedNpmSourceIdentityRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-checked-record-javascript-evidence-fixture.mjs"
]);
export const ownedNpmSourceIdentityRepairImplementationPaths = Object.freeze([
	...ownedNpmSourceIdentityRepairChangedPaths
	, ...ownedNpmSourceIdentityRepairImplementationAddedPaths
]);
export const ownedNpmSourceIdentityRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedNpmSourceIdentityRepairNormalizationPaths = Object.freeze([
	...ownedNpmSourceIdentityRepairChangedPaths
	, ...ownedNpmSourceIdentityRepairIntegrationPaths
]);
export const ownedNpmSourceIdentityRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-npm-source-identity-repair-source-history.mjs"
	, "tests/helpers/owned-npm-source-identity-repair-source-history-tests.mjs"
	, "tests/helpers/owned-npm-source-identity-repair-source-history.mjs"
]);
export const ownedNpmSourceIdentityRepairAddedPaths = Object.freeze([
	...ownedNpmSourceIdentityRepairImplementationAddedPaths
	, ...ownedNpmSourceIdentityRepairHistoryAddedPaths
]);
export const ownedNpmSourceIdentityRepairPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "c83070b2b2160ebced563fd46a4e6e849c7690143472954b87d0c936f96a9929"
		, currentSha256: "acd21552e997b7003de081b9764281cf9f101b0a27ff473e77be221647779d96"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedNpmSourceIdentityRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedNpmSourceIdentityRepairUpdate = (
	source, update
) => {
	assert.ok(ownedNpmSourceIdentityRepairNormalizationPaths
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
 * Remove only the exact Owned npm source identity repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedNpmSourceIdentityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedNpmSourceIdentityRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedNpmSourceIdentityRepairUpdate(current, update);
	}
	return current;
};
