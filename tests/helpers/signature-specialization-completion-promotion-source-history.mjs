/**
 * Reverse the exact hosted-signature type-surface promotion transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationCompletionPromotionHistoryPath
	= "docs/evidence/signature-specialization-completion-promotion-source-history-20261028.json";
export const signatureSpecializationCompletionPromotionPredecessor
	= "08eaffa3d21f35420bab8adebe5d3a7e5d2c539f";
export const signatureSpecializationCompletionPromotionImplementation
	= "49ecaee78f50e164876b358752fa8a3c7d5d086e";
export const signatureSpecializationCompletionPromotionCommits = Object.freeze([
	"6a426bb25e938dad5f5f5829160eaf262d4df482"
	, "6e64cd47e5f108600e84e9787c4b36c1c4707990"
	, "49ecaee78f50e164876b358752fa8a3c7d5d086e"
]);
export const signatureSpecializationCompletionPromotionChangedPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "scripts/promote-signature-specialization-completion.mjs"
		, "tests/helpers/signature-specialization-completion-promotion-tests.mjs"
	]);
export const signatureSpecializationCompletionPromotionNormalizationPaths
	= signatureSpecializationCompletionPromotionChangedPaths;
export const signatureSpecializationCompletionPromotionAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-completion-promotion-source-history.mjs"
		, "tests/helpers/signature-specialization-completion-promotion-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-completion-promotion-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationCompletionPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated promotion transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationCompletionPromotionUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationCompletionPromotionNormalizationPaths
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Remove only the recognized completion promotion transaction.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationCompletionPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationCompletionPromotionNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationCompletionPromotionUpdate(source, update);
};
