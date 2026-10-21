/**
 * Preserve exact predecessors when registering the reviewed Wasm CI and Array archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePerlScalarPromotionSource } from "./perl-scalar-promotion-source-history.mjs";

export const wasmCiArrayHistoryPath = "docs/evidence/wasm-ci-array-source-history-20261009.json";
export const wasmCiArrayPredecessor = "293e047d3fea9e6f5484fe63fc40110a55f1d1de";
export const wasmCiArrayChangedPaths = [
	"docs/type-surface.v1.json"
	, ".github/workflows/consumer-matrix.yml"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/bounded-apt-tests.mjs"
	, "tests/helpers/native-consumer-budget-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/wasm-entry-archive-source-history.mjs"
	, "tests/wasm-entry-archive-history.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWasmCiArrayUpdate = (source, update) => {
	assert.ok(wasmCiArrayChangedPaths.includes(update.path));
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
 * Restore the source before the Wasm CI and Array archive integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWasmCiArraySource = (path, source, expected) => {
	source = beforePerlScalarPromotionSource(path, source, expected);
	if(typeof source !== "string" || !wasmCiArrayChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(wasmCiArrayHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWasmCiArrayUpdate(source, update) : source;
};
