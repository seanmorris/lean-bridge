/**
 * Reverse integration of the hosted-signature producer-binding history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationHostedProducerBindingIntegrationHistoryPath
	= "docs/evidence/signature-specialization-hosted-producer-binding-integration-source-history-20261028.json";
export const signatureSpecializationHostedProducerBindingIntegrationBase
	= "ea75f85b2ec3f4c78187b821de4a7702e214c90b";
export const signatureSpecializationHostedProducerBindingIntegrationImplementation
	= "623e848cea83ed03c42bf33a8e06cc14645bfa76";
export const signatureSpecializationHostedProducerBindingIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-10.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const signatureSpecializationHostedProducerBindingIntegrationNormalizationPaths
	= signatureSpecializationHostedProducerBindingIntegrationPaths;
export const signatureSpecializationHostedProducerBindingIntegrationAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-hosted-producer-binding-integration-source-history.mjs"
		, "tests/helpers/signature-specialization-hosted-producer-binding-integration-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-hosted-producer-binding-integration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationHostedProducerBindingIntegrationHistoryPath, "utf8"));

/**
 * Reverse one exact integration transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseSignatureSpecializationHostedProducerBindingIntegrationUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationHostedProducerBindingIntegrationPaths
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
 * Remove only this integration transition.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeSignatureSpecializationHostedProducerBindingIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationHostedProducerBindingIntegrationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationHostedProducerBindingIntegrationUpdate(
			source, update);
};
