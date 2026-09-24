/**
 * Reverse the measured WIT acceptance changes without discarding source drift.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeCStructuredCallables } from "./c-structured-callable-source-history.mjs";

export const witAcceptancePath = "docs/evidence/wit-recursive-acceptance-20260924.json";
export const witAcceptanceChangedPaths = [
	"docs/consume/wit-wasi.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs", "src/adoption/test-profiles.mjs"
	, "tests/helpers/wit-composition-evidence.mjs"
	, "tests/helpers/wit-composition-source-history.mjs"
	, "tests/native-wit.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
	, "tests/wit-composition-evidence.test.mjs"
].sort();
let history;

const reverse = (source, update) => {
	let result = source;
	for(const edit of update.edits.toReversed())
	{
		if(result.slice(edit.start, edit.start + edit.current.length) !== edit.current) return source;
		result = result.slice(0, edit.start) + edit.previous + result.slice(edit.start + edit.current.length);
	}
	return result;
};

/**
 * Validate both complete files and each literal, nonoverlapping edit.
 *
 * @param source - Complete current source.
 * @param update - Recorded current and predecessor identities and source spans.
 */
export const reverseWitAcceptanceUpdate = (source, update) => {
	assert.ok(witAcceptanceChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		end = edit.start + edit.current.length;
	}
	const previous = reverse(source, update);
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Normalize only documented edits before validating an immutable older receipt.
 *
 * @param path - Repository-relative source path.
 * @param source - Entire file, including any unrelated changes.
 * @param expected - Historical digest at which normalization stops.
 */
export const beforeWitAcceptance = (path, source, expected) => {
	source = beforeCStructuredCallables(path, source, expected);
	if(sha256(source) === expected || !witAcceptanceChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(witAcceptancePath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
