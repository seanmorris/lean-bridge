/**
 * Authenticate the nominal Perl promotion without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypePerlPromotionHistoryPath = "docs/evidence/nominal-subtype-perl-promotion-source-history-20261012.json";
export const nominalSubtypePerlPromotionPredecessor = "7c9fbfee9c31b60dc7433ca6945be62e39810754";
export const nominalSubtypePerlPromotionChangedPaths = [
	".github/workflows/perl-consumer.yml"
	, "docs/consume/perl.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/core-contract-repair-history-tests.mjs"
	, "tests/helpers/core-contract-repair-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-author-tests.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/structural-subtype-ci-workflow.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Restore a complete transition only when both file digests and every span match.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypePerlPromotionUpdate = (source, update) => {
	assert.ok(nominalSubtypePerlPromotionChangedPaths.includes(update.path));
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
export const beforeNominalSubtypePerlPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalSubtypePerlPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypePerlPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypePerlPromotionUpdate(source, update) : source;
};
