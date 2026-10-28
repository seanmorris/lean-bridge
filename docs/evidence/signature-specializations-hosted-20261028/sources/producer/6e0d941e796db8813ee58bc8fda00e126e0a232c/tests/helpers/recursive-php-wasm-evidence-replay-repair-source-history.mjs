/**
 * Restore the recursive PHP-Wasm evidence-replay repair while preserving the
 * immutable producer and aggregate-promotion milestones it makes executable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const recursivePhpWasmEvidenceReplayRepairHistoryPath
	= "docs/evidence/recursive-php-wasm-evidence-replay-repair-source-history-20261022.json";
export const recursivePhpWasmEvidenceReplayRepairPredecessor
	= "387542894c5f8b9767b6ac2151da4d14680160fb";
export const recursivePhpWasmEvidenceReplayRepairImplementation
	= "d574277f4e019b1aba9f15059c1fce44e26143e5";
export const recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor
	= "acc8d9286f5cca56e5c12e0f8b9c0f3850a8bf03";
export const recursivePhpWasmEvidenceReplayRepairHistoricalPaths
	= Object.freeze([
		"tests/helpers/recursive-checked-record-php-wasm-checks.mjs"
		, "tests/helpers/recursive-checked-record-php-wasm-provenance.mjs"
		, "tests/helpers/recursive-checked-record-php-wasm-report.mjs"
		, "tests/helpers/recursive-checked-record-php-wasm-verifier-tests.mjs"
		, "tests/helpers/recursive-checked-record-promotion-source-history-tests.mjs"
	]);
export const recursivePhpWasmEvidenceReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const recursivePhpWasmEvidenceReplayRepairChangedPaths
	= Object.freeze([
		...recursivePhpWasmEvidenceReplayRepairHistoricalPaths
		, ...recursivePhpWasmEvidenceReplayRepairIntegrationPaths
	]);
export const recursivePhpWasmEvidenceReplayRepairAddedPaths = Object.freeze([
	"scripts/update-recursive-php-wasm-evidence-replay-repair-source-history.mjs"
	, "tests/helpers/recursive-php-wasm-evidence-replay-repair-source-history-tests.mjs"
	, "tests/helpers/recursive-php-wasm-evidence-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	recursivePhpWasmEvidenceReplayRepairHistoryPath, "utf8"));

/**
 * Reverse one exact repair transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated update for the same path.
 */
export const reverseRecursivePhpWasmEvidenceReplayRepairUpdate
	= (source, update) => {
		assert.ok(recursivePhpWasmEvidenceReplayRepairChangedPaths
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
				, edit.start + edit.current.length), edit.current);
			parts.push(source.slice(cursor, edit.start), edit.previous);
			cursor = edit.start + edit.current.length;
		}
		parts.push(source.slice(cursor));
		const previous = parts.join("");
		assert.equal(sha256(previous), update.previousSha256, update.path);
		return previous;
	};

/**
 * Remove the exact repair integration and historical implementation layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeRecursivePhpWasmEvidenceReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursivePhpWasmEvidenceReplayRepairChangedPaths.includes(path))
		return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const integration = data.integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseRecursivePhpWasmEvidenceReplayRepairUpdate(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const historical = data.historicalUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return historical
		? reverseRecursivePhpWasmEvidenceReplayRepairUpdate(source, historical)
		: source;
};
