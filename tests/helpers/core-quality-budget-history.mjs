/**
 * Authenticate the exact Core quality workflow budget transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreQualityBudgetHistoryPath = "docs/evidence/core-quality-budget-source-history-20261015.json";
export const coreQualityBudgetPredecessor = "4313ba1622c92196188ebcb536d05d7317990ffe";
export const coreQualityBudgetChangedPaths = [
	".github/workflows/quality.yml"
	, "docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-promotion-history.mjs"
];
let history;

/**
 * Reverse only a complete transition with exact before and after identities.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseCoreQualityBudgetUpdate = (source, update) => {
	assert.ok(coreQualityBudgetChangedPaths.includes(update.path));
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
 * Preserve unknown edits and stop at an explicitly requested source identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeCoreQualityBudgetSource = (path, source, expected) => {
	if(typeof source !== "string" || !coreQualityBudgetChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(coreQualityBudgetHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCoreQualityBudgetUpdate(source, update) : source;
};
