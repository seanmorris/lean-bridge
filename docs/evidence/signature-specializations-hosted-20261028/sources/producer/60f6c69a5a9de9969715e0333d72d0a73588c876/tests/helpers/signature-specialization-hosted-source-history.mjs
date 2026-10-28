/**
 * Reverse the hosted specialization archive/replay source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationHostedHistoryPath
	= "docs/evidence/signature-specialization-hosted-source-history-20261028.json";
export const signatureSpecializationHostedPredecessor
	= "6e0d941e796db8813ee58bc8fda00e126e0a232c";
export const signatureSpecializationHostedImplementation
	= "182518cc7ca7b4463c68d0dcfe720361b50adf67";
export const signatureSpecializationHostedChangedPaths = Object.freeze([
	"tests/helpers/signature-specialization-browser.mjs"
	, "tests/helpers/signature-specialization-php-wasm.mjs"
]);
export const signatureSpecializationHostedImplementationAdditions
	= Object.freeze([
		"scripts/archive-signature-specialization-hosted.mjs"
		, "tests/helpers/signature-specialization-hosted-archive.mjs"
		, "tests/helpers/signature-specialization-hosted-evidence.mjs"
		, "tests/helpers/signature-specialization-hosted-tests.mjs"
	]);
export const signatureSpecializationHostedNormalizationPaths
	= signatureSpecializationHostedChangedPaths;
export const signatureSpecializationHostedAddedPaths = Object.freeze([
	"scripts/update-signature-specialization-hosted-source-history.mjs"
	, "tests/helpers/signature-specialization-hosted-source-history-tests.mjs"
	, "tests/helpers/signature-specialization-hosted-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationHostedHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseSignatureSpecializationHostedUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationHostedNormalizationPaths.includes(
		update.path));
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
 * Remove only the recognized hosted-specialization retention layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationHostedSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationHostedNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationHostedUpdate(source, update);
};
