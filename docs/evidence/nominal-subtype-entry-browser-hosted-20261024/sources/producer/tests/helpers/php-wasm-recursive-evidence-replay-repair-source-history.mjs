/**
 * Preserve the exact PHP-Wasm recursive evidence replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRecursiveEvidenceReplayRepairHistoryPath
	= "docs/evidence/php-wasm-recursive-evidence-replay-repair-source-history-20261023.json";
export const phpWasmRecursiveEvidenceReplayRepairPredecessor
	= "6617e128ad29c16d251bfb951474dca41faeba34";
export const phpWasmRecursiveEvidenceReplayRepairImplementation
	= "2134953f3b315fbd1180968d3ae2d042392863d0";
export const phpWasmRecursiveEvidenceReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/php-wasm-recursive-callable-evidence.mjs"
	, "tests/helpers/php-wasm-recursive-callable-probes.mjs"
	, "tests/helpers/php-wasm-recursive-callable-receipt.mjs"
	, "tests/helpers/php-wasm-recursive-callable-source-history.mjs"
	, "tests/helpers/pre-owned-php-wasm-generators.mjs"
	, "tests/php-wasm-recursive-callable-evidence.test.mjs"
]);
export const phpWasmRecursiveEvidenceReplayRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/wit-recursive-callable-source-history.mjs"
		, "tests/php-wasm-recursive-callable-evidence.test.mjs"
	]);
export const phpWasmRecursiveEvidenceReplayRepairNormalizationPaths
	= Object.freeze([...new Set([
		...phpWasmRecursiveEvidenceReplayRepairModifiedPaths
		, ...phpWasmRecursiveEvidenceReplayRepairIntegrationPaths
	])]);
export const phpWasmRecursiveEvidenceReplayRepairAddedPaths = Object.freeze([
	"scripts/update-php-wasm-recursive-evidence-replay-repair-source-history.mjs"
	, "tests/helpers/php-wasm-recursive-evidence-replay-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-recursive-evidence-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRecursiveEvidenceReplayRepairHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reversePhpWasmRecursiveEvidenceReplayRepairUpdate = (
	source, update
) => {
	assert.ok(phpWasmRecursiveEvidenceReplayRepairNormalizationPaths.includes(
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
 * Reach the requested digest, or reverse one transition when no stop is given.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Exact digest at which reconstruction stops.
 */
export const beforePhpWasmRecursiveEvidenceReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRecursiveEvidenceReplayRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reversePhpWasmRecursiveEvidenceReplayRepairUpdate(current, update);
		if(expected === undefined) return current;
	}
	return current;
};
