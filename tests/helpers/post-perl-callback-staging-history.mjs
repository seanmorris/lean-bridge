/**
 * Authenticate post-Perl callback staging without promoting completed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitCallbackRuntimeStaging } from "./wit-callback-runtime-staging-history.mjs";

export const postPerlCallbackHistoryPath = "docs/evidence/post-perl-callback-staging-source-history-20261003.json";
export const postPerlCallbackHistorySha256 = "710955098bb7ee148093d5e7f9c266f27be334d642d6ad06d9020202825850f4";
export const postPerlCallbackBaseline = "1459c08d3a54340b9980dd62dc7145e01efb3280";
export const postPerlCallbackLineage = Object.freeze([
	"68e24c2e0cfc65b5d1c68eb0c9a6ae5feb4f0938"
	, "c2c9f9ad1d2428cfb0f8459860c6d4ed1c806ba9"
	, "b266a7ea404c532469e56219c1859795bbb3fc6e"
	, "8345109d5066d0a95e917520eded18bcd574da85"
]);
export const postPerlCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-perl-callback-result-source-history-20261003.json"
	, sha256: "7812c91c8a621252cb8a45ad9580afd7f4a2e4111a1d604b233297c4f3920e2c"
});
export const postPerlCallbackCompletedPredecessor = Object.freeze({
	path: "docs/evidence/owned-perl-callback-results-20261003.json"
	, sha256: "6844d0cfd72bea211625618e74a65a484bbab1a0d61573da45b05b107387eec7"
});
let history;
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
const freeze = value => {
	if(value && typeof value === "object")
	{
		Object.values(value).forEach(freeze); Object.freeze(value);
	}
	return value;
};

/** Authenticate the staged transition and immutable completed predecessor bytes. */
export const readPostPerlCallbackHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(postPerlCallbackHistoryPath);
		assert.equal(sha256(bytes), postPerlCallbackHistorySha256);
		const record = JSON.parse(bytes);
		keys(record, "schemaVersion kind baselineRevision lineage previous completedPredecessor updates introducedSources");
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.kind, "post-perl-callback-staging-source-history");
		assert.equal(record.baselineRevision, postPerlCallbackBaseline);
		assert.deepEqual(record.lineage, postPerlCallbackLineage);
		assert.deepEqual(record.previous, postPerlCallbackPrevious);
		assert.deepEqual(record.completedPredecessor, postPerlCallbackCompletedPredecessor);
		for(const predecessor of [record.previous, record.completedPredecessor])
			assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		const paths = record.updates.map(update => update.path);
		assert.ok(paths.length > 0); assert.deepEqual(paths, [...new Set(paths)].sort());
		for(const update of record.updates) keys(update, "path currentSha256 previousSha256 strategy edits");
		const introduced = Object.keys(record.introducedSources);
		assert.equal(introduced.length, 8); assert.deepEqual(introduced, [...introduced].sort());
		for(const identity of Object.values(record.introducedSources))
		{
			keys(identity, "currentSha256 integratedSha256");
			assert.match(identity.currentSha256, /^[a-f0-9]{64}$/u);
			assert.equal(identity.currentSha256, identity.integratedSha256);
		}
		history = freeze(record);
	}
	return history;
};
export const postPerlCallbackChangedPaths = Object.freeze(readPostPerlCallbackHistory().updates.map(update => update.path));

/**
 * Reverse one registered complete transition, never partial or unknown bytes.
 *
 * @param source - Complete current bytes or text.
 * @param update - Authenticated path, hashes and ordered reverse spans.
 */
export const reversePostPerlCallbackUpdate = (source, update) => {
	const recorded = readPostPerlCallbackHistory().updates.find(item => item.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.equal(update.strategy, "spans"); assert.ok(update.edits.length > 0);
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		keys(edit, "start current previous");
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
 * Preserve unknown bytes and stop at the requested authenticated source identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stopping SHA-256.
 */
export const beforePostPerlCallbackStaging = (path, source, expected) => {
	source = beforeWitCallbackRuntimeStaging(path, source, expected);
	const update = readPostPerlCallbackHistory().updates.find(item => item.path === path);
	const digest = sha256(source);
	return update && digest !== expected && digest === update.currentSha256
		? reversePostPerlCallbackUpdate(source, update) : source;
};
