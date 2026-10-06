/**
 * Preserve the exact predecessors of the test-profile registration repair (#1420).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const testProfileRegistrationHistoryPath = "docs/evidence/test-profile-registration-source-history-20261006.json";
export const testProfileRegistrationChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/combined-lineage-source-history.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/test-profiles.test.mjs"
];
let history;

/**
 * Reverse exact spans only when both complete source identities agree.
 *
 * @param source - Complete current text.
 * @param update - Recorded transition.
 */
export const reverseTestProfileRegistrationUpdate = (source, update) => {
	assert.ok(testProfileRegistrationChangedPaths.includes(update.path));
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
 * Undo only the test-profile registration repair (#1420) before following older refinement transitions.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeTestProfileRegistrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !testProfileRegistrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(testProfileRegistrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseTestProfileRegistrationUpdate(source, update) : source;
};
