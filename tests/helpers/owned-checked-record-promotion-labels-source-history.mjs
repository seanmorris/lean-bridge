/**
 * Authenticate shared labeled archive validation through matrix promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedPromotionLabelsHistoryPath
	= "docs/evidence/owned-checked-record-promotion-labels-source-history-20261025.json";
export const ownedCheckedPromotionLabelsPredecessor
	= "e4dc4f1530a0d59ddaca7e719c713ad4284243e0";
export const ownedCheckedPromotionLabelsImplementation
	= "2256ce2c23211c96d2a526bd4f78e64760ee1bbf";
export const ownedCheckedPromotionLabelsIntegrationBase
	= "2256ce2c23211c96d2a526bd4f78e64760ee1bbf";
export const ownedCheckedPromotionLabelsCommits = Object.freeze([
	"2256ce2c23211c96d2a526bd4f78e64760ee1bbf"
]);
export const ownedCheckedPromotionLabelsChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "tests/helpers/owned-checked-record-hosted-matrix.mjs"
	, "tests/helpers/owned-checked-record-promotion-tests.mjs"
	, "tests/helpers/owned-checked-record-promotion.mjs"
]);
export const ownedCheckedPromotionLabelsImplementationAddedPaths = Object.freeze([]);
export const ownedCheckedPromotionLabelsImplementationPaths = Object.freeze([
	...ownedCheckedPromotionLabelsChangedPaths
	, ...ownedCheckedPromotionLabelsImplementationAddedPaths
]);
export const ownedCheckedPromotionLabelsIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedPromotionLabelsNormalizationPaths = Object.freeze([
	...ownedCheckedPromotionLabelsChangedPaths
	, ...ownedCheckedPromotionLabelsIntegrationPaths
]);
export const ownedCheckedPromotionLabelsHistoryAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-record-promotion-labels-20261025.json"
	, "scripts/update-owned-checked-record-promotion-labels-source-history.mjs"
	, "tests/helpers/owned-checked-record-promotion-labels-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-promotion-labels-source-history.mjs"
]);
export const ownedCheckedPromotionLabelsAddedPaths = Object.freeze([
	...ownedCheckedPromotionLabelsImplementationAddedPaths
	, ...ownedCheckedPromotionLabelsHistoryAddedPaths
]);
export const ownedCheckedPromotionLabelsPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "729545fe4f30e58e96514a225374a0330a48ccdf7ca7df5cce3560c896cda0d0"
		, currentSha256: "a86b9930713d226b7cb2b8dc6cef6ba67936fdeba3626c427c51b88dd3e964ad"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-hosted-matrix.mjs"
		, count: 11
		, previousSha256: "136b67849a8649d249507613656d8a2373573ab74371e77ef0b46b8fbcbfff1d"
		, currentSha256: "e12472bd8eebeb13f3b98d70395346cf89bd1937ebefe321f78ee1297a985b48"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-promotion-tests.mjs"
		, count: 11
		, previousSha256: "721cb21bb45200b09c15bb225a12e2e18644cacf087e78c26a74c57aee24a3d0"
		, currentSha256: "110f77e526558c4feeb4c3afe844d6f63b5120e9de202e7d2fa5f47d3e052200"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-promotion.mjs"
		, count: 11
		, previousSha256: "be6eb1bc37a315040a9e859ae36773929a1c90a23cca64f9e000463eb7fbe76b"
		, currentSha256: "e22e5b30baa39fb2c2a38542a45aed63fa3de6aff1912f7ed687ec76f82d87da"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedPromotionLabelsHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedPromotionLabelsUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedPromotionLabelsNormalizationPaths
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
 * Reverse only the authenticated promotion-label repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedPromotionLabelsSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedPromotionLabelsNormalizationPaths.includes(path))
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
		current = reverseOwnedCheckedPromotionLabelsUpdate(current, update);
	}
	return current;
};
