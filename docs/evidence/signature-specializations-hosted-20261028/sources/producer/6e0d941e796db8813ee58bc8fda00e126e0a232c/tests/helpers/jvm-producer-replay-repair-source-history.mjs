/**
 * Reverse the exact JVM producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const jvmProducerReplayRepairHistoryPath
	= "docs/evidence/jvm-producer-replay-repair-source-history-20261023.json";
export const jvmProducerReplayRepairPredecessor
	= "30ebc230b993a038f1eb59a046d85ed599a3a779";
export const jvmProducerReplayRepairImplementation
	= "b14f59def04ef4d45c72792c026066d840acd4f6";
export const jvmProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/jvm-thread-exit-repair-evidence.mjs"
	, "tests/helpers/owned-jvm-receiver-evidence.mjs"
	, "tests/helpers/owned-jvm-receiver-package-evidence.mjs"
]);
export const jvmProducerReplayRepairImplementationPaths
	= jvmProducerReplayRepairModifiedPaths;
export const jvmProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-jvm-receiver-evidence.test.mjs"
	]);
export const jvmProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...jvmProducerReplayRepairModifiedPaths
		, ...jvmProducerReplayRepairIntegrationPaths
	]);
export const jvmProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-jvm-producer-replay-repair-source-history.mjs"
	, "tests/helpers/jvm-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/jvm-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	jvmProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseJvmProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(jvmProducerReplayRepairNormalizationPaths
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
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact JVM producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeJvmProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !jvmProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseJvmProducerReplayRepairUpdate(source, update)
		: source;
};
