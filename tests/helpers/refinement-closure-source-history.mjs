/**
 * Preserve the exact predecessors of the historical import-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeNominalFinSource } from "./nominal-fin-source-history.mjs";

export const refinementClosureHistoryPath = "docs/evidence/refinement-closure-source-history-20261005.json";
export const refinementClosureChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-jvm-callback-result-runtime-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-runtime-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-sanitizer-evidence.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs"
	, "tests/helpers/owned-wit-callback-result-acceptance.mjs"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance.mjs"
	, "tests/helpers/wit-callback-installed-acceptance-history-tests.mjs"
];
let history;

/**
 * Reverse exact spans only when both complete source identities agree.
 *
 * @param source - Complete current text.
 * @param update - Recorded transition.
 */
export const reverseRefinementClosureUpdate = (source, update) => {
	assert.ok(refinementClosureChangedPaths.includes(update.path));
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
 * Undo only the closure repair before following older refinement transitions.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRefinementClosureSource = (path, source, expected) => {
	source = beforeNominalFinSource(path, source, expected);
	if(typeof source !== "string" || !refinementClosureChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(refinementClosureHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRefinementClosureUpdate(source, update) : source;
};
