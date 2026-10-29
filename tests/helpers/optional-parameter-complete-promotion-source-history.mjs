/**
 * Reverse the complete optional-parameter publication transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterCompletePromotionHistoryPath
	= "docs/evidence/optional-parameter-complete-promotion-source-history-20261029.json";
export const optionalParameterCompletePromotionPredecessor
	= "aac41e6c1481fa41b1e52fd0c26a29e793d2af73";
export const optionalParameterCompletePromotionImplementation
	= "38225030ee885669084ddfac7fef49983594fd49";
export const optionalParameterCompletePromotionCommits = Object.freeze([
	"37c5307ad3b6693e1086d10b231f02bf91c629ad"
	, "37138af84cc98f9aafebc3e34b9772fb327cb7be"
	, "8d6e2bb3e7af5b51f64878af5462ea4ab90aa4d1"
	, "869a65592aba4fc40d453194437519b2e1e4b557"
	, "15e06bcead66893719a13ad0b0418e469b96369f"
	, "98f2e1c174881e9d9afb7c05e03a8ea7d67b0e02"
	, "38225030ee885669084ddfac7fef49983594fd49"
]);
export const optionalParameterCompletePromotionChangedPaths = Object.freeze([
	"docs/consume/c.md", "docs/consume/cpp.md", "docs/consume/dotnet.md"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/consume/perl.md", "docs/consume/python.md"
	, "docs/consume/ruby.md", "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md", "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/php.md", "docs/type-surface.v1.json"
	, "scripts/promote-optional-parameter-complete.mjs"
	, "tests/helpers/optional-parameter-complete-promotion-transaction-tests.mjs"
	, "tests/helpers/type-surface-promotion-io-tests.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
]);
export const optionalParameterCompletePromotionIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const optionalParameterCompletePromotionHistoryAdditions = Object.freeze([
	"scripts/update-optional-parameter-complete-promotion-source-history.mjs"
	, "tests/helpers/optional-parameter-complete-promotion-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-complete-promotion-source-history.mjs"
]);
export const optionalParameterCompletePromotionCurrentSourcePaths = Object.freeze([
	"docs/php.md", "docs/consume/dotnet.md", "docs/consume/java.md"
	, "docs/consume/kotlin.md", "docs/consume/ruby.md"
	, "docs/consume/perl.md", "docs/consume/python.md"
	, "docs/consume/rust.md", "docs/consume/c.md", "docs/consume/cpp.md"
	, "docs/consume/wit-wasi.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
]);
export const optionalParameterCompletePromotionNormalizationPaths
	= Object.freeze([...new Set([
		...optionalParameterCompletePromotionChangedPaths
		, ...optionalParameterCompletePromotionIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	optionalParameterCompletePromotionHistoryPath, "utf8"));

/**
 * Reverse one exact publication transition.
 *
 * @param source - Complete current source.
 * @param update - Exact reversible transition.
 */
export const reverseOptionalParameterCompletePromotionUpdate = (
	source, update
) => {
	assert.ok(optionalParameterCompletePromotionNormalizationPaths
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
 * Remove only the recognized complete optional publication transaction.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOptionalParameterCompletePromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterCompletePromotionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterCompletePromotionUpdate(
				current, update);
	}
	return current;
};
