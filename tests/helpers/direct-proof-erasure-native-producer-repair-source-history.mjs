/**
 * Preserve the native proof producer fixes discovered by the hosted matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNativeProducerRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-native-producer-repair-source-history-20261028.json";
export const directProofErasureNativeProducerRepairPredecessor
	= "dcfd6245f1018a52d9a4d1c938a24ddc258e5fbb";
export const directProofErasureNativeProducerRepairImplementation
	= "443596fe5896d148ab0ec2ebb4d82842418f8b1b";
export const directProofErasureNativeProducerRepairCommits = Object.freeze([
	directProofErasureNativeProducerRepairImplementation
]);
export const directProofErasureNativeProducerRepairImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "src/backends/c/native-copied-values.mjs"
		, "tests/helpers/direct-proof-erasure-native-tests.mjs"
		, "tests/helpers/fin-callback-diagnostic-source-history-tests.mjs"
	]);
export const directProofErasureNativeProducerRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureNativeProducerRepairNormalizationPaths
	= Object.freeze([
		...directProofErasureNativeProducerRepairImplementationPaths
		, ...directProofErasureNativeProducerRepairIntegrationPaths
	]);
export const directProofErasureNativeProducerRepairAddedPaths
	= Object.freeze([
		"scripts/update-direct-proof-erasure-native-producer-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-native-producer-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-native-producer-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureNativeProducerRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated producer repair transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and current-side edits.
 */
export const reverseDirectProofErasureNativeProducerRepairUpdate
	= (source, update) => {
		assert.ok(directProofErasureNativeProducerRepairNormalizationPaths
			.includes(update.path));
		assert.equal(sha256(source), update.currentSha256, update.path);
		assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
		let cursor = 0;
		const parts = [];
		for(const edit of update.edits)
		{
			assert.deepEqual(Object.keys(edit).sort()
				, ["current", "previous", "start"]);
			assert.ok(Number.isSafeInteger(edit.start)
				&& edit.start >= cursor && edit.start <= source.length);
			assert.equal(typeof edit.previous, "string");
			assert.equal(typeof edit.current, "string");
			assert.notEqual(edit.previous, edit.current);
			assert.equal(source.slice(edit.start
				, edit.start + edit.current.length), edit.current, update.path);
			parts.push(source.slice(cursor, edit.start), edit.previous);
			cursor = edit.start + edit.current.length;
		}
		parts.push(source.slice(cursor));
		const previous = parts.join("");
		assert.equal(sha256(previous), update.previousSha256, update.path);
		return previous;
	};

/**
 * Remove only this repair and its newest-first central registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureNativeProducerRepairSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !directProofErasureNativeProducerRepairNormalizationPaths
				.includes(path)) return source;
		const value = record();
		const updates = [...value.integrationUpdates, ...value.updates];
		let current = source;
		for(let count = 0; count < updates.length; ++count)
		{
			const digest = sha256(current);
			if(digest === expected) return current;
			const update = updates.find(item =>
				item.path === path && item.currentSha256 === digest);
			if(update === undefined) return current;
			current = reverseDirectProofErasureNativeProducerRepairUpdate(
				current, update);
		}
		return current;
	};
