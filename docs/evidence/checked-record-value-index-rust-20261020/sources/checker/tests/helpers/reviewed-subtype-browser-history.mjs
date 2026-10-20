/**
 * Authenticate Reviewed browser integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeReviewedSubtypeBrowserCiSource } from "./reviewed-subtype-browser-ci-history.mjs";

export const reviewedSubtypeBrowserHistoryPath = "docs/evidence/reviewed-subtype-browser-source-history-20261010.json";
export const reviewedSubtypeBrowserPredecessor = "c7a78aa4325ccde5ca60ecc2f079093628c83a4a";
export const reviewedSubtypeBrowserChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-subtype-native-promotion-tests.mjs"
	, "tests/helpers/reviewed-subtype-npm-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-history.mjs"
	, "tests/reviewed-subtype-installed.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedSubtypeBrowserUpdate = (source, update) => {
	assert.ok(reviewedSubtypeBrowserChangedPaths.includes(update.path));
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
export const beforeReviewedSubtypeBrowserSource = (path, source, expected) => {
	source = beforeReviewedSubtypeBrowserCiSource(path, source, expected);
	if(typeof source !== "string" || !reviewedSubtypeBrowserChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedSubtypeBrowserHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedSubtypeBrowserUpdate(source, update) : source;
};
