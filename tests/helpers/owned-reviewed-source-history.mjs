/**
 * Authenticate the reviewed-v4 transition without changing earlier observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPackage } from "./owned-package-source-history.mjs";

export const ownedReviewedBaseline = "ca016c0a04d9329a861d6a40cd34d95926cbcce4";
export const ownedReviewedHistoryPath = "docs/evidence/owned-reviewed-integration-20260926.json";
export const ownedReviewedExecutionPath = "docs/evidence/owned-reviewed-execution-20260926.json";
export const ownedReviewedChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/evidence/owned-aggregate-metadata-20260926.md"
	, "docs/type-surface.v1.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/analyze/reviewed-source.mjs"
	, "src/build/owned-aggregate-carriers.mjs", "tests/documentation.test.mjs"
	, "tests/helpers/owned-aggregate-native.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-source-history.mjs"
	, "tests/helpers/owned-c-evidence.mjs", "tests/owned-c-evidence.test.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
].sort();
export const ownedReviewedAddedPaths = [
	ownedReviewedExecutionPath, "src/analyze/reviewed-owned-source.mjs"
	, "tests/helpers/owned-reviewed-source-history.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/reviewed-owned-source.test.mjs"
	, "tests/owned-reviewed-evidence.test.mjs"
].sort();
let history;

/**
 * Restore an exact predecessor using ordered, nonoverlapping literal edits.
 *
 * @param source - Complete current file text.
 * @param update - Whole-file digests and authenticated reverse edits.
 */
export const reverseOwnedReviewedUpdate = (source, update) => {
	assert.ok(ownedReviewedChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length);
	const chunks = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		chunks.push(source.slice(end, edit.start), edit.previous);
		end = edit.start + edit.current.length;
	}
	chunks.push(source.slice(end));
	const previous = chunks.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Normalize only an authenticated source identity; unknown drift stays visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact digest at which normalization must stop.
 */
export const beforeOwnedReviewed = (path, source, expected) => {
	source = beforeOwnedPackage(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedReviewedChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedReviewedHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedReviewedUpdate(source, update) : source;
};
