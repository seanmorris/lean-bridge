/**
 * Reverse the terminal hosted-signature completion preparation milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationCompletionPreparationHistoryPath
	= "docs/evidence/signature-specialization-completion-preparation-source-history-20261028.json";
export const signatureSpecializationCompletionPreparationPredecessor
	= "df304731903299d14fde5b16bb2db86942b2a487";
export const signatureSpecializationCompletionPreparationImplementation
	= "928525c2f2438069a974d6694af83877f9e11321";
export const signatureSpecializationCompletionPreparationChangedPaths
	= Object.freeze([
		"src/adoption/test-profiles.mjs"
		, "tests/helpers/signature-specialization-hosted-archive.mjs"
		, "tests/helpers/signature-specialization-hosted-evidence.mjs"
		, "tests/helpers/signature-specialization-hosted-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-hosted-tests.mjs"
		, "tests/test-profiles.test.mjs"
	]);
export const signatureSpecializationCompletionPreparationImplementationAdditions
	= Object.freeze([
		"scripts/promote-signature-specialization-completion.mjs"
		, "tests/helpers/signature-specialization-completion-promotion-tests.mjs"
		, "tests/helpers/signature-specialization-completion-promotion.mjs"
		, "tests/signature-specialization-hosted-evidence.test.mjs"
	]);
export const signatureSpecializationCompletionPreparationNormalizationPaths
	= signatureSpecializationCompletionPreparationChangedPaths;
export const signatureSpecializationCompletionPreparationAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-completion-preparation-source-history.mjs"
		, "tests/helpers/signature-specialization-completion-preparation-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-completion-preparation-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationCompletionPreparationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated preparation transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationCompletionPreparationUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationCompletionPreparationNormalizationPaths
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
 * Remove only the recognized completion-preparation layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationCompletionPreparationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationCompletionPreparationNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationCompletionPreparationUpdate(
			source, update);
};
