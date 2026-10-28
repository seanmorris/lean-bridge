/**
 * Reverse the central integration of the signature-completion preparation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationCompletionPreparationIntegrationHistoryPath
	= "docs/evidence/signature-specialization-completion-preparation-integration-source-history-20261028.json";
export const signatureSpecializationCompletionPreparationIntegrationPredecessor
	= "32f8edcc7fb16fe5973e55f567d6a5ca914d4571";
export const signatureSpecializationCompletionPreparationIntegrationImplementation
	= "552992a72e4967d99aeed290165ca124ed125f0a";
export const signatureSpecializationCompletionPreparationIntegrationChangedPaths
	= Object.freeze([
		"tests/checked-javascript-partition-10.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const signatureSpecializationCompletionPreparationIntegrationNormalizationPaths
	= signatureSpecializationCompletionPreparationIntegrationChangedPaths;
export const signatureSpecializationCompletionPreparationIntegrationAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-completion-preparation-integration-source-history.mjs"
		, "tests/helpers/signature-specialization-completion-preparation-integration-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-completion-preparation-integration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationCompletionPreparationIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationCompletionPreparationIntegrationUpdate
	= (source, update) => {
		assert.ok(
			signatureSpecializationCompletionPreparationIntegrationNormalizationPaths
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
 * Remove only the recognized central integration layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationCompletionPreparationIntegrationSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !signatureSpecializationCompletionPreparationIntegrationNormalizationPaths
				.includes(path)) return source;
		const digest = sha256(source);
		if(digest === expected) return source;
		const update = record().updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		return update === undefined ? source
			: reverseSignatureSpecializationCompletionPreparationIntegrationUpdate(
				source, update);
	};
