/**
 * Preserve exact source predecessors of the PHP acceptance shard change (#1450).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpShardHistoryPath = "docs/evidence/php-shard-source-history-20261008.json";
export const phpShardChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-php-wasm-ci.mjs"
	, "tests/helpers/owned-transfer-c-evidence.mjs"
	, "tests/helpers/owned-wasm32-evidence.mjs"
	, "tests/owned-php-wasm-ci.test.mjs"
	, "tests/toolchain-preflight.test.mjs"
	, "tests/helpers/native-ci-isolation.mjs"
	, "tests/helpers/fin-native-batch-promotion-source-history.mjs"
	, "tests/helpers/fin-native-batch-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpShardUpdate = (source, update) => {
	assert.ok(phpShardChangedPaths.includes(update.path));
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
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore the source before #1220, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpShardSource = (path, source, expected) => {
	if(typeof source !== "string" || !phpShardChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpShardHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpShardUpdate(source, update) : source;
};
