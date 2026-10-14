/**
 * Authenticate the nominal WIT promotion without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeBrowserRegistrationSource } from "./nominal-subtype-browser-registration-history.mjs";

export const nominalSubtypeWitPromotionHistoryPath = "docs/evidence/nominal-subtype-wit-promotion-source-history-20261013.json";
export const nominalSubtypeWitPromotionPredecessor = "c48bb1f5d4e5b7d62dd8497df2fcc43c0de83537";
export const nominalSubtypeWitPromotionChangedPaths = [
	"docs/consume/wit-wasi.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-author-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-history.mjs"
	, "tests/helpers/nominal-subtype-wit-tests.mjs"
	, "tests/helpers/structural-subtype-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Restore a complete transition only when both file digests and every span match.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypeWitPromotionUpdate = (source, update) => {
	assert.ok(nominalSubtypeWitPromotionChangedPaths.includes(update.path));
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
export const beforeNominalSubtypeWitPromotionSource = (path, source, expected) => {
	source = beforeNominalSubtypeBrowserRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeWitPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeWitPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeWitPromotionUpdate(source, update) : source;
};

/**
 * Reconstruct validator pins before this milestone for older promotion tests.
 *
 * @param inventory - Recomputed historical inventory with current validator hashes.
 */
export const beforeNominalSubtypeWitPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeWitPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
