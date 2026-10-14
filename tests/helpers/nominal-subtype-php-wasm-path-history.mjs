/**
 * Authenticate PHP-Wasm report path and CI comparison repair without rewriting prior evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypePhpWasmPathHistoryPath = "docs/evidence/nominal-subtype-php-wasm-path-source-history-20261014.json";
export const nominalSubtypePhpWasmPathPredecessor = "d4dd322f1e61c52a6505fbaa9294ee3d19cc0a33";
export const nominalSubtypePhpWasmPathChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-corpus-partition-history.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-report.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion-history-tests.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact current and previous digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const reverseNominalSubtypePhpWasmPathUpdate = (source, update) => {
	assert.ok(nominalSubtypePhpWasmPathChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and stop at the explicitly requested source epoch.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalSubtypePhpWasmPathSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalSubtypePhpWasmPathChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypePhpWasmPathHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypePhpWasmPathUpdate(source, update) : source;
};

/**
 * Reconstruct only this repair's exact source pins for earlier support checkpoints.
 *
 * @param inventory - Earlier inventory recomputed with current file hashes.
 */
export const beforeNominalSubtypePhpWasmPathPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalSubtypePhpWasmPathHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
