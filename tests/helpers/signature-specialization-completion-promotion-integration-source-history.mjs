/**
 * Reverse the central integration of signature-completion promotion history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationCompletionPromotionIntegrationHistoryPath
	= "docs/evidence/signature-specialization-completion-promotion-integration-source-history-20261028.json";
export const signatureSpecializationCompletionPromotionIntegrationPredecessor
	= "42d2e4d9c037466d5d04571c8579278fcca426dc";
export const signatureSpecializationCompletionPromotionIntegrationImplementation
	= "a9cbed25c18ecf3401a66498179dc78d4fbdb780";
export const signatureSpecializationCompletionPromotionIntegrationChangedPaths
	= Object.freeze([
		"tests/checked-javascript-partition-10.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const signatureSpecializationCompletionPromotionIntegrationNormalizationPaths
	= signatureSpecializationCompletionPromotionIntegrationChangedPaths;
export const signatureSpecializationCompletionPromotionIntegrationAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-completion-promotion-integration-source-history.mjs"
		, "tests/helpers/signature-specialization-completion-promotion-integration-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-completion-promotion-integration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationCompletionPromotionIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationCompletionPromotionIntegrationUpdate
	= (source, update) => {
		assert.ok(
			signatureSpecializationCompletionPromotionIntegrationNormalizationPaths
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
 * Remove only the recognized central promotion-history integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationCompletionPromotionIntegrationSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !signatureSpecializationCompletionPromotionIntegrationNormalizationPaths
				.includes(path)) return source;
		const digest = sha256(source);
		if(digest === expected) return source;
		const update = record().updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		return update === undefined ? source
			: reverseSignatureSpecializationCompletionPromotionIntegrationUpdate(
				source, update);
	};
