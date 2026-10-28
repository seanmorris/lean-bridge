/**
 * Preserve the exact owned JVM lazy Kotlin factory transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJvmLazyKotlinFactoryHistoryPath
	= "docs/evidence/owned-jvm-lazy-kotlin-factory-source-history-20261023.json";
export const ownedJvmLazyKotlinFactoryPredecessor
	= "1f03f11561542c44c3ae52edafe957342a9b70d6";
export const ownedJvmLazyKotlinFactoryImplementation
	= "293a6a3234b22c507d60956f7cb9176dee36fb81";
export const ownedJvmLazyKotlinFactoryModifiedPaths
	= Object.freeze([
		"src/backends/jvm/owned-borrows.mjs"
		, "src/backends/jvm/owned-callables.mjs"
		, "src/backends/jvm/owned-calls.mjs"
		, "tests/owned-subtype-remaining-packaging.test.mjs"
	]);
export const ownedJvmLazyKotlinFactoryIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-subtype-hosted-ci.test.mjs"
	]);
export const ownedJvmLazyKotlinFactoryNormalizationPaths
	= Object.freeze([...new Set([
		...ownedJvmLazyKotlinFactoryModifiedPaths
		, ...ownedJvmLazyKotlinFactoryIntegrationPaths
	])]);
export const ownedJvmLazyKotlinFactoryAddedPaths
	= Object.freeze([
		"scripts/update-owned-jvm-lazy-kotlin-factory-source-history.mjs"
		, "tests/helpers/owned-jvm-lazy-kotlin-factory-source-history-tests.mjs"
		, "tests/helpers/owned-jvm-lazy-kotlin-factory-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedJvmLazyKotlinFactoryHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseOwnedJvmLazyKotlinFactoryUpdate = (source, update) => {
	assert.ok(ownedJvmLazyKotlinFactoryNormalizationPaths.includes(update.path));
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
 * Remove one authenticated transition of this layer. A recognized update is
 * always reversed; the central hub decides where an expected historical
 * digest stops and re-enters for any further transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeOwnedJvmLazyKotlinFactorySource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedJvmLazyKotlinFactoryNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedJvmLazyKotlinFactoryUpdate(source, update);
};
