/**
 * Authenticate changes to shared native and component refinement mirrors while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeJvmPendingExitSource } from "./jvm-pending-exit-history.mjs";

export const componentRefinementMirrorHistoryPath = "docs/evidence/component-refinement-mirror-source-history-20261011.json";
export const componentRefinementMirrorPredecessor = "d667b896c507806d848d39b5053fed7fa8657ee8";
export const componentRefinementMirrorChangedPaths = [
	"docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-author-history.mjs"
	, "tests/native-subtype.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseComponentRefinementMirrorUpdate = (source, update) => {
	assert.ok(componentRefinementMirrorChangedPaths.includes(update.path));
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
 * Preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeComponentRefinementMirrorSource = (path, source, expected) => {
	source = beforeJvmPendingExitSource(path, source, expected);
	if(typeof source !== "string" || !componentRefinementMirrorChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(componentRefinementMirrorHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseComponentRefinementMirrorUpdate(source, update) : source;
};
