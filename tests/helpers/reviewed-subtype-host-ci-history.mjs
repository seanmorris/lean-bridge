/**
 * Authenticate Reviewed native Subtype CI workflow integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeMavenPrerequisiteSource } from "./maven-prerequisite-history.mjs";

export const reviewedSubtypeHostCiHistoryPath = "docs/evidence/reviewed-subtype-host-ci-source-history-20261010.json";
export const reviewedSubtypeHostCiPredecessor = "33f1db0daaff269627dcdbb684a4e1a9f164729f";
export const reviewedSubtypeHostCiChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-subtype-entry-ci-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report-history.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report-tests.mjs"
	, "tests/helpers/reviewed-subtype-native-promotion-tests.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedSubtypeHostCiUpdate = (source, update) => {
	assert.ok(reviewedSubtypeHostCiChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeReviewedSubtypeHostCiSource = (path, source, expected) => {
	source = beforeMavenPrerequisiteSource(path, source, expected);
	if(typeof source !== "string" || !reviewedSubtypeHostCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedSubtypeHostCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedSubtypeHostCiUpdate(source, update) : source;
};
