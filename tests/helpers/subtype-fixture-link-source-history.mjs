/**
 * Preserve exact source predecessors of the Subtype fixture link repair change (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const subtypeFixtureLinkHistoryPath = "docs/evidence/subtype-fixture-link-source-history-20261008.json";
export const subtypeFixtureLinkChangedPaths = [
	"tests/helpers/reviewed-subtype-fixture.mjs"
	, "tests/helpers/reviewed-subtype-build-tests.mjs"
	, "tests/reviewed-subtype-installed.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/browser-callback-archive-source-history.mjs"
	, "tests/helpers/browser-callback-archive-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseSubtypeFixtureLinkUpdate = (source, update) => {
	assert.ok(subtypeFixtureLinkChangedPaths.includes(update.path));
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
 * Restore the source before #1220, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeSubtypeFixtureLinkSource = (path, source, expected) => {
	if(typeof source !== "string" || !subtypeFixtureLinkChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(subtypeFixtureLinkHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseSubtypeFixtureLinkUpdate(source, update) : source;
};
