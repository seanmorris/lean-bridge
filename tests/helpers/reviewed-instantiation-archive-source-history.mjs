/**
 * Preserve main ancestry and explicitly requested reviewed-instantiation producer identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePhpDispatchIntegrationSource } from "./php-dispatch-integration-source-history.mjs";

export const reviewedInstantiationArchiveHistoryPath = "docs/evidence/reviewed-instantiation-archive-source-history-20261008.json";
export const reviewedInstantiationArchivePredecessor = "f38413e8e0e21a716423cbd5a8aabab722830d7b";
export const reviewedInstantiationArchiveChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/reviewed-instantiations.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/browser-generic-promotion-source-history.mjs"
	, "tests/helpers/browser-generic-promotion-source-history-tests.mjs"
];
export const reviewedInstantiationArchiveProducer = "3c2d5800cfcfc08b6506e6ee05af718772b4208e";
export const reviewedInstantiationArchiveProducerPins = {
	"tests/reviewed-instantiations.test.mjs": "d10ef75e9f8e229064b502ea6538030afe38f8ce3770b225055e6de4b065e4d7"
	, "tests/helpers/generic-record-packages.mjs": "175f05e460f8038a30c454b3df42db57a15e52ec9a857d2f86b1f65ffdab0a89"
	, "src/analyze/reviewed-source.mjs": "3379ec688a48a317b8897b877903238cee50408b03cff3d4decb8d6c16d09a79"
};
const registered = path => reviewedInstantiationArchiveChangedPaths.includes(path) || Object.hasOwn(reviewedInstantiationArchiveProducerPins, path);
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedInstantiationArchiveUpdate = (source, update) => {
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
export const beforeReviewedInstantiationArchiveSource = (path, source, expected) => {
	source = beforePhpDispatchIntegrationSource(path, source, expected);
	if(typeof source !== "string" || !registered(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedInstantiationArchiveHistoryPath, "utf8"));
	if(expected && expected === reviewedInstantiationArchiveProducerPins[path])
	{
		assert.equal(record.producerCommit, reviewedInstantiationArchiveProducer);
		const producer = record.producerUpdates.find(item => item.path === path && item.previousSha256 === expected);
		if(producer?.currentSha256 === digest) return reverseReviewedInstantiationArchiveUpdate(source, producer);
	}
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedInstantiationArchiveUpdate(source, update) : source;
};
