/**
 * Reverse the authenticated executable owned-refinement carrier transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedRefinementCarriersHistoryPath
	= "docs/evidence/owned-refinement-carriers-source-history-20261020.json";
export const ownedRefinementCarriersPredecessor
	= "526e9642f0facd00a4b6dc49dedb585471cf8a38";
export const ownedRefinementCarriersImplementation
	= "bcb5ff2e62a02d99df0b27a73e2adf82eac5e240";
export const ownedRefinementCarriersChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "package.json"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/build/owned-aggregate-carriers.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-refinement-model-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-analysis-source-history-tests.mjs"
	, "tests/owned-aggregate-model.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedRefinementCarriersHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedRefinementCarriersUpdate = (source, update) => {
	assert.ok(ownedRefinementCarriersChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact executable owned-refinement transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedRefinementCarriersSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedRefinementCarriersChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseOwnedRefinementCarriersUpdate(source, update) : source;
};
