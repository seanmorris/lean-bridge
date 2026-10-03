/**
 * Authenticate staged Perl source changes without claiming completed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPerlCallbackHistoryPath = "docs/evidence/owned-perl-callback-result-source-history-20261003.json";
export const ownedPerlCallbackHistorySha256 = "7812c91c8a621252cb8a45ad9580afd7f4a2e4111a1d604b233297c4f3920e2c";
export const ownedPerlCallbackBaseline = "95978558fed7e305833175f36a93a140ff84be9e";
export const ownedPerlCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-jvm-callback-result-source-history-20261002.json"
	, sha256: "5738bc2e884766b3bb05e52cf7ee93659a70a01ef5238898ebb796485086e211"
});
export const ownedPerlCallbackCompletedPredecessor = Object.freeze({
	path: "docs/evidence/owned-jvm-callback-results-20261003.json"
	, sha256: "ce3855e16ac23fed6c437def1c09a9c27c7c3ac54c2d3298141bad60c78d3310"
});
let history;

/** Authenticate the staged ledger and both immutable JVM predecessor records. */
export const readOwnedPerlCallbackHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(ownedPerlCallbackHistoryPath);
		assert.equal(sha256(bytes), ownedPerlCallbackHistorySha256);
		const record = JSON.parse(bytes);
		assert.deepEqual(Object.keys(record).sort(), ["baselineRevision", "completedPredecessor", "kind", "previous", "schemaVersion", "updates"]);
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.kind, "owned-perl-callback-result-source-history");
		assert.equal(record.baselineRevision, ownedPerlCallbackBaseline);
		assert.deepEqual(record.previous, ownedPerlCallbackPrevious);
		assert.deepEqual(record.completedPredecessor, ownedPerlCallbackCompletedPredecessor);
		for(const predecessor of [record.previous, record.completedPredecessor])
			assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		const paths = record.updates.map(update => update.path);
		assert.ok(paths.length > 0);
		assert.deepEqual(paths, [...new Set(paths)].sort());
		history = record;
	}
	return history;
};
export const ownedPerlCallbackChangedPaths = Object.freeze(readOwnedPerlCallbackHistory().updates.map(update => update.path));

/**
 * Reverse only a registered complete source transition with exact ordered spans.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Pinned path, complete identities and ordered reverse spans.
 */
export const reverseOwnedPerlCallbackUpdate = (source, update) => {
	const recorded = readOwnedPerlCallbackHistory().updates.find(item => item.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.equal(update.strategy, "spans");
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current, update.path);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Preserve unknown bytes and stop at a requested intermediate source identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stopping SHA-256.
 */
export const beforeOwnedPerlCallbackResults = (path, source, expected) => {
	const update = readOwnedPerlCallbackHistory().updates.find(item => item.path === path);
	const digest = sha256(source);
	return update && digest !== expected && digest === update.currentSha256
		? reverseOwnedPerlCallbackUpdate(source, update) : source;
};
