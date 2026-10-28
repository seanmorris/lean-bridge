/**
 * Reverse the checker repair committed with the hosted signature archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationHostedArchiveReplayHistoryPath
	= "docs/evidence/signature-specialization-hosted-archive-replay-source-history-20261028.json";
export const signatureSpecializationHostedArchiveReplayPredecessor
	= "54d51f40c8f9441779aff1cea7b0a808dd84f1f4";
export const signatureSpecializationHostedArchiveReplayImplementation
	= "6f505c1b130dffa19a68d2539cf7c80259da44e3";
export const signatureSpecializationHostedArchiveReplayRoot
	= "docs/evidence/signature-specializations-hosted-20261028";
export const signatureSpecializationHostedArchiveReplayChangedPaths
	= Object.freeze([
		"tests/helpers/signature-specialization-completion-promotion.mjs"
		, "tests/helpers/signature-specialization-hosted-evidence.mjs"
	]);
export const signatureSpecializationHostedArchiveReplayNormalizationPaths
	= signatureSpecializationHostedArchiveReplayChangedPaths;
export const signatureSpecializationHostedArchiveReplayAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-hosted-archive-replay-source-history.mjs"
		, "tests/helpers/signature-specialization-hosted-archive-replay-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-hosted-archive-replay-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationHostedArchiveReplayHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated archive-replay transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationHostedArchiveReplayUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationHostedArchiveReplayNormalizationPaths
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
 * Remove only the checker repair committed beside the immutable archive.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationHostedArchiveReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationHostedArchiveReplayNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationHostedArchiveReplayUpdate(source, update);
};
