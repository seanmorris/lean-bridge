/**
 * Authenticate labeled owned checked-record archive paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedArchiveRootsHistoryPath
	= "docs/evidence/owned-checked-record-archive-roots-source-history-20261025.json";
export const ownedCheckedArchiveRootsPredecessor
	= "186a319c7c1a55f8340de7d9db3224b74517c1a5";
export const ownedCheckedArchiveRootsImplementation
	= "54d2f6a4dae47371fed515381a0867929347cb22";
export const ownedCheckedArchiveRootsIntegrationBase
	= "54d2f6a4dae47371fed515381a0867929347cb22";
export const ownedCheckedArchiveRootsCommits = Object.freeze([
	"54d2f6a4dae47371fed515381a0867929347cb22"
]);
export const ownedCheckedArchiveRootsChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "tests/helpers/owned-checked-record-hosted-matrix.mjs"
	, "tests/helpers/owned-checked-record-hosted-matrix-tests.mjs"
]);
export const ownedCheckedArchiveRootsImplementationAddedPaths = Object.freeze([]);
export const ownedCheckedArchiveRootsImplementationPaths = Object.freeze([
	...ownedCheckedArchiveRootsChangedPaths
	, ...ownedCheckedArchiveRootsImplementationAddedPaths
]);
export const ownedCheckedArchiveRootsIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedArchiveRootsNormalizationPaths = Object.freeze([
	...ownedCheckedArchiveRootsChangedPaths
	, ...ownedCheckedArchiveRootsIntegrationPaths
]);
export const ownedCheckedArchiveRootsHistoryAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-record-archive-roots-20261025.json"
	, "scripts/update-owned-checked-record-archive-roots-source-history.mjs"
	, "tests/helpers/owned-checked-record-archive-roots-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-archive-roots-source-history.mjs"
]);
export const ownedCheckedArchiveRootsAddedPaths = Object.freeze([
	...ownedCheckedArchiveRootsImplementationAddedPaths
	, ...ownedCheckedArchiveRootsHistoryAddedPaths
]);
export const ownedCheckedArchiveRootsPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "cab259e552316b78b66f1bfcd53dd58537d04f7216edcce2a1fe40fad74cfc40"
		, currentSha256: "729545fe4f30e58e96514a225374a0330a48ccdf7ca7df5cce3560c896cda0d0"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-hosted-matrix.mjs"
		, count: 11
		, previousSha256: "6e004e92ee882c3d441ef3d252666ff950477e559af2fb4e34b4e89f84c14c94"
		, currentSha256: "136b67849a8649d249507613656d8a2373573ab74371e77ef0b46b8fbcbfff1d"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedArchiveRootsHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedArchiveRootsUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedArchiveRootsNormalizationPaths
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
 * Reverse only the authenticated archive-root repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedArchiveRootsSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedArchiveRootsNormalizationPaths.includes(path))
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
		current = reverseOwnedCheckedArchiveRootsUpdate(current, update);
	}
	return current;
};
