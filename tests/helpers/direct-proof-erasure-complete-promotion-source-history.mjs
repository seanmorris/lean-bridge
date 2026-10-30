/**
 * Reverse the complete direct proof-erasure publication transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureCompletePromotionHistoryPath
	= "docs/evidence/direct-proof-erasure-complete-promotion-source-history-20261030.json";
export const directProofErasureCompletePromotionPredecessor
	= "0ec3eed0ab4a013e0b7d5f5eb7ad9ce63acf2864";
export const directProofErasureCompletePromotionImplementation
	= "9b6769f57e55e68da32b7da702b7473dafb90a4f";
export const directProofErasureCompletePromotionCommits = Object.freeze([
	directProofErasureCompletePromotionImplementation
]);
export const directProofErasureCompletePromotionChangedPaths = Object.freeze([
	"docs/consume/c.md", "docs/consume/cpp.md", "docs/consume/dotnet.md"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/consume/perl.md", "docs/consume/python.md"
	, "docs/consume/ruby.md", "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md", "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/php.md", "docs/reference/types.md", "docs/type-surface.v1.json"
]);
export const directProofErasureCompletePromotionIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/direct-proof-erasure-complete-documentation-tests.mjs"
		, "tests/helpers/direct-proof-erasure-complete-promotion-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureCompletePromotionHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-complete-promotion-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-complete-promotion-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-complete-promotion-source-history.mjs"
	]);
export const directProofErasureCompletePromotionNormalizationPaths
	= Object.freeze([...new Set([
		...directProofErasureCompletePromotionChangedPaths
		, ...directProofErasureCompletePromotionIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureCompletePromotionHistoryPath, "utf8"));

/**
 * Reverse one exact complete proof-erasure publication transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureCompletePromotionUpdate = (
	source, update
) => {
	assert.ok(directProofErasureCompletePromotionNormalizationPaths
		.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated complete proof-erasure publication.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureCompletePromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureCompletePromotionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureCompletePromotionUpdate(
				current, update);
	}
	return current;
};
