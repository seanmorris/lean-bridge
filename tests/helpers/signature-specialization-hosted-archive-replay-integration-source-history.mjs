/**
 * Reverse the central integration of hosted-signature archive replay history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationHostedArchiveReplayIntegrationHistoryPath
	= "docs/evidence/signature-specialization-hosted-archive-replay-integration-source-history-20261028.json";
export const signatureSpecializationHostedArchiveReplayIntegrationPredecessor
	= "10fd34fd10a1f4b3dc692af129f26f651bedd2be";
export const signatureSpecializationHostedArchiveReplayIntegrationImplementation
	= "c2a06791d0515691557b643a86caa127fdb143da";
export const signatureSpecializationHostedArchiveReplayIntegrationChangedPaths
	= Object.freeze([
		"tests/checked-javascript-partition-10.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const signatureSpecializationHostedArchiveReplayIntegrationNormalizationPaths
	= signatureSpecializationHostedArchiveReplayIntegrationChangedPaths;
export const signatureSpecializationHostedArchiveReplayIntegrationAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-hosted-archive-replay-integration-source-history.mjs"
		, "tests/helpers/signature-specialization-hosted-archive-replay-integration-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-hosted-archive-replay-integration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationHostedArchiveReplayIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationHostedArchiveReplayIntegrationUpdate
	= (source, update) => {
		assert.ok(
			signatureSpecializationHostedArchiveReplayIntegrationNormalizationPaths
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
export const beforeSignatureSpecializationHostedArchiveReplayIntegrationSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !signatureSpecializationHostedArchiveReplayIntegrationNormalizationPaths
				.includes(path)) return source;
		const digest = sha256(source);
		if(digest === expected) return source;
		const update = record().updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		return update === undefined ? source
			: reverseSignatureSpecializationHostedArchiveReplayIntegrationUpdate(
				source, update);
	};
