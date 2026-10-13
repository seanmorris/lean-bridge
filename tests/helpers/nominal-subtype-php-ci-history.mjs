/**
 * Authenticate the required native PHP gate without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypePhpPromotionSource } from "./nominal-subtype-php-promotion-history.mjs";

export const nominalSubtypePhpCiHistoryPath = "docs/evidence/nominal-subtype-php-ci-source-history-20261013.json";
export const nominalSubtypePhpCiPredecessor = "4b42926238294237ce2019a1c79fe3e73db6dd5c";
export const nominalSubtypePhpCiChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/managed-nominal-gate-history.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-tests.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact current and previous digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const reverseNominalSubtypePhpCiUpdate = (source, update) => {
	assert.ok(nominalSubtypePhpCiChangedPaths.includes(update.path));
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
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and stop at the explicitly requested source epoch.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalSubtypePhpCiSource = (path, source, expected) => {
	source = beforeNominalSubtypePhpPromotionSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypePhpCiChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypePhpCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypePhpCiUpdate(source, update) : source;
};
