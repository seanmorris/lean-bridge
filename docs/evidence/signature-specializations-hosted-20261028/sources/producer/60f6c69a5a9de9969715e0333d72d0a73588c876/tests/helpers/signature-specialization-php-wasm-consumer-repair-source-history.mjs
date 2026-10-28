/**
 * Reverse the exact PHP-Wasm specialization consumer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationPhpWasmConsumerRepairHistoryPath
	= "docs/evidence/signature-specialization-php-wasm-consumer-repair-source-history-20261028.json";
export const signatureSpecializationPhpWasmConsumerRepairPredecessor
	= "5d2776d2ba190114045426128b82d27dab8e6d37";
export const signatureSpecializationPhpWasmConsumerRepairImplementation
	= "d37bcc0c33694dc048cc2bd4ce6843064e0beff2";
export const signatureSpecializationPhpWasmConsumerRepairPaths = Object.freeze([
	"tests/helpers/signature-specialization-php-wasm.mjs"
]);
export const signatureSpecializationPhpWasmConsumerRepairNormalizationPaths
	= signatureSpecializationPhpWasmConsumerRepairPaths;
export const signatureSpecializationPhpWasmConsumerRepairAddedPaths
	= Object.freeze([
		"tests/fixtures/specialization-consumers/php-wasm.php"
		, "scripts/update-signature-specialization-php-wasm-consumer-repair-source-history.mjs"
		, "tests/helpers/signature-specialization-php-wasm-consumer-repair-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-php-wasm-consumer-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationPhpWasmConsumerRepairHistoryPath, "utf8"
));

/**
 * Reverse the exact helper transition.
 *
 * @param {string} source - Complete current source.
 * @param {object} update - Recorded transition.
 */
export const reverseSignatureSpecializationPhpWasmConsumerRepairUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationPhpWasmConsumerRepairPaths.includes(
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
 * Remove only the exact PHP-Wasm consumer repair.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeSignatureSpecializationPhpWasmConsumerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationPhpWasmConsumerRepairPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationPhpWasmConsumerRepairUpdate(
			source, update);
};
