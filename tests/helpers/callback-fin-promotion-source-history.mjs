/**
 * Preserve exact source predecessors of the Callback Fin promotion change (#1445).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinPromotionHistoryPath = "docs/evidence/callback-fin-promotion-source-history-20261008.json";
export const callbackFinPromotionChangedPaths = [
	"docs/type-surface.v1.json"
	, "docs/javascript-typescript.md"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/evidence/refinement-closure-audit-20261007.md"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/copied-graph-repair-source-history.mjs"
	, "tests/helpers/copied-graph-repair-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/checked-record-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinPromotionUpdate = (source, update) => {
	assert.ok(callbackFinPromotionChangedPaths.includes(update.path));
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
 * Restore the source before the callback Fin promotion, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCallbackFinPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !callbackFinPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(callbackFinPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCallbackFinPromotionUpdate(source, update) : source;
};
