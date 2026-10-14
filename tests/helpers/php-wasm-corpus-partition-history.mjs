/**
 * Authenticate PHP-Wasm corpus partition without rewriting prior evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCorpusPartitionHistoryPath = "docs/evidence/php-wasm-corpus-partition-source-history-20261014.json";
export const phpWasmCorpusPartitionPredecessor = "844ae6889866aad54f5a30e9f7b632101af4ac56";
export const phpWasmCorpusPartitionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/owned-php-wasm-ci.test.mjs"
	, "tests/helpers/owned-php-wasm-ci.mjs"
	, "tests/helpers/owned-wasm32-evidence.mjs"
	, "tests/helpers/owned-transfer-c-evidence.mjs"
	, "tests/php-wasm-fin.test.mjs"
	, "tests/helpers/php-wasm-subtype-entry-ci-tests.mjs"
	, "tests/helpers/structural-subtype-ci-workflow.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-registration-history.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion-history.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact current and previous digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const reversePhpWasmCorpusPartitionUpdate = (source, update) => {
	assert.ok(phpWasmCorpusPartitionChangedPaths.includes(update.path));
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
export const beforePhpWasmCorpusPartitionSource = (path, source, expected) => {
	if(typeof source !== "string" || !phpWasmCorpusPartitionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmCorpusPartitionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmCorpusPartitionUpdate(source, update) : source;
};

/**
 * Reconstruct only this partition's exact source pins for earlier support checkpoints.
 *
 * @param inventory - Earlier inventory recomputed with current file hashes.
 */
export const beforePhpWasmCorpusPartitionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(phpWasmCorpusPartitionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
