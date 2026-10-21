/**
 * Preserve exact source predecessors of the Native reply refusal coverage (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeBrowserGenericPromotionSource } from "./browser-generic-promotion-source-history.mjs";

export const nativeReplyRefusalHistoryPath = "docs/evidence/native-reply-refusal-source-history-20261008.json";
export const nativeReplyRefusalProducerCommit = "190c8fd76774c1e767b7d03f6b0ec40bebabe9f0";
export const nativeReplyRefusalProducerTestSha256 = "23846d584c6d79a186c5522138aaf2fd90ae87efd4ab20db885d4c65f1601fc5";
export const nativeReplyRefusalChangedPaths = [
	"tests/native-fin-callbacks.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/scalar-fin-source-entry-ci-source-history.mjs"
	, "tests/helpers/scalar-fin-source-entry-ci-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNativeReplyRefusalUpdate = (source, update) => {
	assert.ok(nativeReplyRefusalChangedPaths.includes(update.path));
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
 * Restore the source before the Native reply refusal coverage, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeReplyRefusalSource = (path, source, expected) => {
	source = beforeBrowserGenericPromotionSource(path, source, expected);
	if(typeof source !== "string" || !nativeReplyRefusalChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeReplyRefusalHistoryPath, "utf8"));
	// The executed test predates the archive imports but follows the main predecessor.
	// Only an explicit request for that authenticated identity selects this intermediate.
	if(expected === nativeReplyRefusalProducerTestSha256 && path === "tests/native-fin-callbacks.test.mjs")
	{
		assert.equal(record.producerCommit, nativeReplyRefusalProducerCommit);
		const producer = record.producerUpdates.find(item => item.path === path && item.previousSha256 === expected);
		if(producer?.currentSha256 === digest) return reverseNativeReplyRefusalUpdate(source, producer);
	}
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeReplyRefusalUpdate(source, update) : source;
};
