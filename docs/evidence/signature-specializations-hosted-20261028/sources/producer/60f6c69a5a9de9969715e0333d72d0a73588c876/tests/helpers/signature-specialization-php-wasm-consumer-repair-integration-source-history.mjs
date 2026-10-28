/**
 * Reverse integration of the PHP-Wasm specialization consumer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationPhpWasmConsumerRepairIntegrationHistoryPath
	= "docs/evidence/signature-specialization-php-wasm-consumer-repair-integration-source-history-20261028.json";
export const signatureSpecializationPhpWasmConsumerRepairIntegrationBase
	= "b0e7fad96796b8334e0595f95d6be333be85af77";
export const signatureSpecializationPhpWasmConsumerRepairIntegrationImplementation
	= "1a3b0346ec501a8ccb2cc106d241a847f4646c1e";
export const signatureSpecializationPhpWasmConsumerRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/checked-javascript-partition-10.test.mjs"
	]);
export const signatureSpecializationPhpWasmConsumerRepairIntegrationNormalizationPaths
	= signatureSpecializationPhpWasmConsumerRepairIntegrationPaths;
export const signatureSpecializationPhpWasmConsumerRepairIntegrationAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-php-wasm-consumer-repair-integration-source-history.mjs"
		, "tests/helpers/signature-specialization-php-wasm-consumer-repair-integration-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-php-wasm-consumer-repair-integration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationPhpWasmConsumerRepairIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact integration transition.
 *
 * @param {string} source - Complete current source.
 * @param {object} update - Recorded transition.
 */
export const reverseSignatureSpecializationPhpWasmConsumerRepairIntegrationUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationPhpWasmConsumerRepairIntegrationPaths
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
 * Remove only this exact integration transition.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeSignatureSpecializationPhpWasmConsumerRepairIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationPhpWasmConsumerRepairIntegrationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationPhpWasmConsumerRepairIntegrationUpdate(
			source, update);
};
