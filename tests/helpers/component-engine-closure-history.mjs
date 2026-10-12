/**
 * Authenticate the component engine closure repair without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypePerlRegistrationSource } from "./nominal-subtype-perl-registration-history.mjs";

export const componentEngineClosureHistoryPath = "docs/evidence/component-engine-closure-source-history-20261012.json";
export const componentEngineClosurePredecessor = "3bff1f0340a57870ca94cb851d750fd5c5d5f18e";
export const componentEngineClosureChangedPaths = [
	".github/workflows/checked-record-browser.yml"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "tests/engine-execution-request.test.mjs"
	, "tests/helpers/checked-record-browser-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-browser-ci-workflow.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-history.mjs"
];
let history;

/**
 * Restore a complete transition only when both file digests and every span match.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseComponentEngineClosureUpdate = (source, update) => {
	assert.ok(componentEngineClosureChangedPaths.includes(update.path));
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
 * Keep unknown edits and honor exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeComponentEngineClosureSource = (path, source, expected) => {
	source = beforeNominalSubtypePerlRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !componentEngineClosureChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(componentEngineClosureHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseComponentEngineClosureUpdate(source, update) : source;
};
