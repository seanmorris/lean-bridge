/**
 * Reverse the complete dependent-signature publication transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureCompletePromotionHistoryPath
	= "docs/evidence/dependent-signature-complete-promotion-source-history-20261029.json";
export const dependentSignatureCompletePromotionPredecessor
	= "9cefee70dcf7a393d34b237eafc9f1533719fcac";
export const dependentSignatureCompletePromotionImplementation
	= "3eafd36b791cb640f2c1348c949cbbde8cab0670";
export const dependentSignatureCompletePromotionCommits = Object.freeze([
	dependentSignatureCompletePromotionImplementation
]);
export const dependentSignatureCompletePromotionChangedPaths = Object.freeze([
	"docs/consume/c.md", "docs/consume/cpp.md", "docs/consume/dotnet.md"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/consume/perl.md", "docs/consume/python.md"
	, "docs/consume/ruby.md", "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md", "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/php.md", "docs/type-surface.v1.json"
]);
export const dependentSignatureCompletePromotionIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-10.test.mjs"
		, "tests/dependent-signature-complete-promotion.test.mjs"
		, "tests/helpers/dependent-signature-complete-documentation-tests.mjs"
		, "tests/helpers/dependent-signature-complete-promotion-tests.mjs"
		, "tests/helpers/dependent-signature-completion-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/proof-core-local-join-source-history-tests.mjs"
	]);
export const dependentSignatureCompletePromotionHistoryAdditions
	= Object.freeze([
		"scripts/update-dependent-signature-complete-promotion-source-history.mjs"
		, "tests/helpers/dependent-signature-complete-promotion-source-history-tests.mjs"
		, "tests/helpers/dependent-signature-complete-promotion-source-history.mjs"
	]);
export const dependentSignatureCompletePromotionGuidePaths = Object.freeze(
	dependentSignatureCompletePromotionChangedPaths.filter(path =>
		path !== "docs/type-surface.v1.json")
);
export const dependentSignatureCompletePromotionNormalizationPaths
	= Object.freeze([...new Set([
		...dependentSignatureCompletePromotionChangedPaths
		, ...dependentSignatureCompletePromotionIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentSignatureCompletePromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact publication transition.
 *
 * @param source - Complete current source.
 * @param update - Exact reversible transition.
 */
export const reverseDependentSignatureCompletePromotionUpdate = (
	source, update
) => {
	assert.ok(dependentSignatureCompletePromotionNormalizationPaths
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
 * Remove only the recognized complete dependent-signature publication.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentSignatureCompletePromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentSignatureCompletePromotionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentSignatureCompletePromotionUpdate(
				current, update);
	}
	return current;
};
