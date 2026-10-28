/**
 * Reverse the exact signature-completion promotion test-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationCompletionPinRepairHistoryPath
	= "docs/evidence/signature-specialization-completion-pin-repair-source-history-20261028.json";
export const signatureSpecializationCompletionPinRepairPredecessor
	= "f117411e09bc8f792ba7ed366e51c6eb65322f87";
export const signatureSpecializationCompletionPinRepairImplementation
	= "377c622034ecbe9aaa4b16cae8b57a7dce220fb6";
export const signatureSpecializationCompletionPinRepairChangedPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const signatureSpecializationCompletionPinRepairNormalizationPaths
	= signatureSpecializationCompletionPinRepairChangedPaths;
export const signatureSpecializationCompletionPinRepairAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-completion-pin-repair-source-history.mjs"
		, "tests/helpers/signature-specialization-completion-pin-repair-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-completion-pin-repair-source-history.mjs"
	]);
export const signatureSpecializationCompletionPinRepairPin = Object.freeze({
	path: "tests/helpers/signature-specialization-completion-promotion-tests.mjs"
	, previousSha256: "78c042aeab54f2ba78d4ef0a4571d56d252d56a4f613178b09c3d34c1f69a310"
	, currentSha256: "41f741e8c80802d17d3982963ffbcf80f2b503f057207310dfd3fd363f68e3db"
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationCompletionPinRepairHistoryPath, "utf8"
));

/**
 * Reverse the exact authenticated inventory transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationCompletionPinRepairUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationCompletionPinRepairNormalizationPaths
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
 * Remove only the recognized one-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationCompletionPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationCompletionPinRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationCompletionPinRepairUpdate(source, update);
};
