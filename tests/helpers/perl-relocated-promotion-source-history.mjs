/**
 * Preserve exact predecessors when measuring public relocated Perl refinement acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlRelocatedPromotionHistoryPath = "docs/evidence/perl-relocated-promotion-source-history-20261009.json";
export const perlRelocatedPromotionPredecessor = "d6070cb130f63034b0d1a894d5cceebab7fce0a1";
export const perlRelocatedPromotionChangedPaths = [
	"docs/type-surface.v1.json"
	, ".gitattributes"
	, "src/adoption/test-profiles.mjs"
	, "docs/consume/perl.md"
	, "tests/type-surface.test.mjs"
	, "tests/helpers/cpp-fin-dispatch-integration-source-history.mjs"
	, "tests/helpers/cpp-fin-dispatch-integration-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePerlRelocatedPromotionUpdate = (source, update) => {
	assert.ok(perlRelocatedPromotionChangedPaths.includes(update.path));
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
 * Restore the source before Perl refinement promotion, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePerlRelocatedPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !perlRelocatedPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(perlRelocatedPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePerlRelocatedPromotionUpdate(source, update) : source;
};
