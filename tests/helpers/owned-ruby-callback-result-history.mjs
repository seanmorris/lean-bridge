/**
 * Authenticate Ruby callback-owner changes without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedDotnetCallbackResults } from "./owned-dotnet-callback-result-history.mjs";

export const ownedRubyCallbackHistoryPath = "docs/evidence/owned-ruby-callback-result-source-history-20261002.json";
export const ownedRubyCallbackHistorySha256 = "7aadc1de7e28872aa4ae4da2b22cdc1ba153953dbcaa8fad4761539c64fec588";
export const ownedRubyCallbackBaseline = "0fc33e4fd17f3347d845847f284709208ada1c9e";
let history;
/** Authenticate the complete ledger and its immutable predecessor. */
export const readOwnedRubyCallbackHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(ownedRubyCallbackHistoryPath);
		assert.equal(sha256(bytes), ownedRubyCallbackHistorySha256);
		history = JSON.parse(bytes);
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.kind, "owned-ruby-callback-result-source-history");
		assert.equal(history.baselineRevision, ownedRubyCallbackBaseline);
		assert.deepEqual(history.previous, {
			path: "docs/evidence/owned-python-callback-result-source-history-20261002.json"
			, sha256: "31082b5c541fe8536eef8d416fff51b46ed2bb4befa1d2c397ce048578754c10"
		});
		assert.equal(sha256(readFileSync(history.previous.path)), history.previous.sha256);
		const paths = history.updates.map(update => update.path);
		assert.deepEqual(paths, [...new Set(paths)].sort());
	}
	return history;
};
export const ownedRubyCallbackChangedPaths = Object.freeze(readOwnedRubyCallbackHistory().updates.map(update => update.path));

/**
 * Reverse an exact whole-source transition, never an unrecognized partial edit.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Pinned path, complete identities and ordered reverse edits.
 */
export const reverseOwnedRubyCallbackUpdate = (source, update) => {
	assert.ok(ownedRubyCallbackChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	if(update.strategy === "replacements")
	{
		let previous = source.toString();
		for(const edit of [...update.edits].reverse())
		{
			assert.equal(typeof edit.current, "string"); assert.ok(edit.current.length > 0);
			assert.equal(typeof edit.previous, "string"); assert.notEqual(edit.current, edit.previous);
			assert.ok(Number.isSafeInteger(edit.count) && edit.count > 0);
			assert.equal(previous.split(edit.current).length, edit.count + 1, update.path);
			previous = previous.replaceAll(edit.current, edit.previous);
		}
		assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
	}
	assert.equal(update.strategy, "spans");
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Preserve unknown edits and stop at an explicitly requested intermediate hash.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedRubyCallbackResults = (path, source, expected) => {
	source = beforeOwnedDotnetCallbackResults(path, source, expected);
	const update = readOwnedRubyCallbackHistory().updates.find(item => item.path === path);
	const digest = sha256(source);
	return update && digest !== expected && digest === update.currentSha256
		? reverseOwnedRubyCallbackUpdate(source, update) : source;
};
