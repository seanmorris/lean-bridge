/**
 * Reverse the exact hosted-signature producer-binding transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationHostedProducerBindingHistoryPath
	= "docs/evidence/signature-specialization-hosted-producer-binding-source-history-20261028.json";
export const signatureSpecializationHostedProducerBindingPredecessor
	= "95c4f736139fd95968793bf3ed69c1e43ab59870";
export const signatureSpecializationHostedProducerBindingImplementation
	= "6c17dc9032d72fac34dca2979ab179948311f9ee";
export const signatureSpecializationHostedProducerBindingPaths = Object.freeze([
	"scripts/archive-signature-specialization-hosted.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/signature-specialization-hosted-archive.mjs"
	, "tests/helpers/signature-specialization-hosted-evidence.mjs"
	, "tests/helpers/signature-specialization-hosted-source-history-tests.mjs"
	, "tests/helpers/signature-specialization-hosted-tests.mjs"
]);
export const signatureSpecializationHostedProducerBindingNormalizationPaths
	= signatureSpecializationHostedProducerBindingPaths;
export const signatureSpecializationHostedProducerBindingAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-hosted-producer-binding-source-history.mjs"
		, "tests/helpers/signature-specialization-hosted-producer-binding-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-hosted-producer-binding-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationHostedProducerBindingHistoryPath, "utf8"));

/**
 * Reverse one exact producer-binding source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseSignatureSpecializationHostedProducerBindingUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationHostedProducerBindingPaths.includes(
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
 * Remove only the exact hosted-signature producer-binding transition.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeSignatureSpecializationHostedProducerBindingSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationHostedProducerBindingPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationHostedProducerBindingUpdate(
			source, update);
};
