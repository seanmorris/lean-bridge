/**
 * Preserve exact source predecessors of the Reviewed Fin admission change (#1438).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeRefinementHistoryCacheSource } from "./refinement-history-cache-source-history.mjs";

export const reviewedFinHistoryPath = "docs/evidence/reviewed-fin-source-history-20261007.json";
export const reviewedFinChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/analyze/reviewed-source.mjs"
	, "src/build/native-model.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/generic-records-source-history-tests.mjs"
	, "tests/helpers/generic-records-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
	, "tests/native-fin.test.mjs"
	, "tests/reviewed-source.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedFinUpdate = (source, update) => {
	assert.ok(reviewedFinChangedPaths.includes(update.path));
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
 * Restore the source before #1438, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeReviewedFinSource = (path, source, expected) => {
	source = beforeRefinementHistoryCacheSource(path, source, expected);
	if(typeof source !== "string" || !reviewedFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedFinUpdate(source, update) : source;
};
