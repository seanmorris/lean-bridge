/**
 * Authenticate the CI partition while preserving every earlier support claim.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nativeConsumerPartitionHistoryPath = "docs/evidence/native-consumer-partition-source-history-20261013.json";
export const nativeConsumerPartitionPredecessor = "3fc6a085155dea5266ded890d9f16a0976e33ae6";
export const nativeConsumerPartitionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-observation-split-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-promotion-history.mjs"
	, "tests/helpers/owned-borrow-evidence.mjs"
	, "tests/helpers/owned-cpp-borrow-evidence.mjs"
	, "tests/helpers/owned-cpp-receiver-ci.mjs"
	, "tests/helpers/owned-receiver-ci.mjs"
	, "tests/helpers/reviewed-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/reviewed-subtype-native-promotion-tests.mjs"
	, "tests/native-ci-isolation.test.mjs"
];
let history;

/**
 * Restore only exact full-source identities and non-overlapping reviewed spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNativeConsumerPartitionUpdate = (source, update) => {
	assert.ok(nativeConsumerPartitionChangedPaths.includes(update.path));
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
 * Preserve unknown edits and honor the requested intermediate stopping identity.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNativeConsumerPartitionSource = (path, source, expected) => {
	if(typeof source !== "string" || !nativeConsumerPartitionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeConsumerPartitionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeConsumerPartitionUpdate(source, update) : source;
};
