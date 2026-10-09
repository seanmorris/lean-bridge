/**
 * Preserve main ancestry and explicitly requested plain-inheritance producer identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedRecordArchiveHistoryPath = "docs/evidence/inherited-record-archive-source-history-20261008.json";
export const inheritedRecordArchivePredecessor = "237b9cec854ef74f0643f33f97864738e98803df";
export const inheritedRecordArchiveChangedPaths = [
	"tests/generic-inheritance-installed.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/wit-dispatch-integration-source-history.mjs"
	, "tests/helpers/wit-dispatch-integration-source-history-tests.mjs"
];
export const inheritedRecordArchiveProducer = "9dae4d07ea723cd0c04effa7d975af25ae301b88";
export const inheritedRecordArchiveProducerPins = {
	"src/analyze/NativeExports.lean": "d18f80ebfbb7d3ae90cdc4690620a6f37b0f9e4b49c1f9f2425dcd3e9d40669f"
	, "tests/inherited-records.test.mjs": "ab50f3102a87ff2a2ecb76d54ef5cdfbad9bec921afa004a086408177f0a318b"
};
const registered = path => inheritedRecordArchiveChangedPaths.includes(path) || Object.hasOwn(inheritedRecordArchiveProducerPins, path);
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseInheritedRecordArchiveUpdate = (source, update) => {
	assert.ok(registered(update.path));
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
 * Restore the pre-promotion source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeInheritedRecordArchiveSource = (path, source, expected) => {
	if(typeof source !== "string" || !registered(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(inheritedRecordArchiveHistoryPath, "utf8"));
	if(expected && expected === inheritedRecordArchiveProducerPins[path])
	{
		assert.equal(record.producerCommit, inheritedRecordArchiveProducer);
		const producer = record.producerUpdates.find(item => item.path === path && item.previousSha256 === expected);
		if(producer?.currentSha256 === digest) return reverseInheritedRecordArchiveUpdate(source, producer);
	}
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseInheritedRecordArchiveUpdate(source, update) : source;
};
