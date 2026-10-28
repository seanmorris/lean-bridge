/**
 * Reverse the explicit JVM/npm producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const jvmNpmProducerRepairHistoryPath
	= "docs/evidence/jvm-npm-producer-repair-source-history-20261024.json";
export const jvmNpmProducerRepairPredecessor
	= "77412d1289348eb2dbec74a6a0c2a28c58f103a6";
export const jvmNpmProducerRepairImplementation
	= "c1e02adf50697346c2e3c1328ecdc69d0fb1c5a5";
export const jvmNpmProducerRepairIntegrationBase
	= "c1e02adf50697346c2e3c1328ecdc69d0fb1c5a5";
export const jvmNpmProducerRepairCommits = Object.freeze([
	"246f857fd9ef5c7f7c26a543ccec0062fbd5fc52"
	, "c1e02adf50697346c2e3c1328ecdc69d0fb1c5a5"
]);
export const jvmNpmProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-javascript-npm-evidence.mjs"
	, "tests/helpers/owned-jvm-call-evidence.mjs"
	, "tests/helpers/owned-jvm-conversion-evidence.mjs"
	, "tests/java-collection-evidence.test.mjs"
	, "tests/kotlin-collection-evidence.test.mjs"
]);
export const jvmNpmProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const jvmNpmProducerRepairNormalizationPaths = Object.freeze([
	...jvmNpmProducerRepairChangedPaths
	, ...jvmNpmProducerRepairIntegrationPaths
]);
export const jvmNpmProducerRepairAddedPaths = Object.freeze([
	"scripts/update-jvm-npm-producer-repair-source-history.mjs"
	, "tests/helpers/jvm-npm-producer-repair-source-history-tests.mjs"
	, "tests/helpers/jvm-npm-producer-repair-source-history.mjs"
	, "tests/helpers/jvm-npm-producer-binding-tests.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	jvmNpmProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseJvmNpmProducerRepairUpdate = (
	source, update
) => {
	assert.ok(jvmNpmProducerRepairNormalizationPaths
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
 * Remove only the exact JVM/npm producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeJvmNpmProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !jvmNpmProducerRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseJvmNpmProducerRepairUpdate(current, update);
	}
	return current;
};
