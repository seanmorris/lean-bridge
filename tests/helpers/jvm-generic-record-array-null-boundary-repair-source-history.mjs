/**
 * Preserve the JVM generic-record Array null-boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const jvmGenericRecordArrayNullBoundaryRepairHistoryPath
	= "docs/evidence/jvm-generic-record-array-null-boundary-repair-source-history-20261102.json";
export const jvmGenericRecordArrayNullBoundaryRepairPredecessor
	= "852e4c750aa0cb853b530b5d17236fb96ec3907b";
export const jvmGenericRecordArrayNullBoundaryRepairImplementation
	= "8062b1f94907d0540c76468ca6a66ca2e5b3e311";
export const jvmGenericRecordArrayNullBoundaryRepairImplementationPaths
	= Object.freeze([
		"tests/fixtures/generic-record-array-consumers/java.java"
		, "tests/generic-record-arrays.test.mjs"
		, "tests/helpers/generic-record-arrays.mjs"
	]);
export const jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const jvmGenericRecordArrayNullBoundaryRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-jvm-generic-record-array-null-boundary-repair-source-history.mjs"
		, "tests/helpers/jvm-generic-record-array-null-boundary-repair-source-history-tests.mjs"
		, "tests/helpers/jvm-generic-record-array-null-boundary-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${jvmGenericRecordArrayNullBoundaryRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const jvmGenericRecordArrayNullBoundaryRepairNormalizationPaths
	= Object.freeze([...new Set([
		...jvmGenericRecordArrayNullBoundaryRepairImplementationPaths
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths)
	])].sort());
const allowedPath = path =>
	jvmGenericRecordArrayNullBoundaryRepairImplementationPaths.includes(path)
	|| jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths.includes(path);

/**
 * Require the repaired constructor-boundary test without weakening null checks.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertJvmGenericRecordArrayNullBoundaryRepair = sources => {
	for(const path of jvmGenericRecordArrayNullBoundaryRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const fixture = sources[
		"tests/fixtures/generic-record-array-consumers/java.java"];
	assert.match(fixture, /final int failedPosition = position;/u);
	assert.match(fixture
		, /arrayRaises[.]test\(NullPointerException[.]class, \(\) -> nullField\[failedPosition\] = new NatBox\(null, n\(0\)\)\)/u);
	assert.match(fixture, /nullField\[failedPosition\] == beforeNullField/u);
	assert.doesNotMatch(fixture
		, /brokenRows\[[^\]]+\]\[position\] = new NatBox\(null/u);
	const helper = sources["tests/helpers/generic-record-arrays.mjs"];
	assert.match(helper, /java: Object[.]freeze\(\{ checks: 1071/u);
	assert.match(helper
		, /NatBox constructor null field at 0[.][.]2 refused before assignment/u);
	const contract = sources["tests/generic-record-arrays.test.mjs"];
	assert.match(contract
		, /Generated records reject required null fields at construction/u);
	assert.match(contract
		, /assert[.]doesNotMatch\(fragment, \/brokenRows/u);
	return { javaArrayChecks: 1071, changedSupportCells: 0
		, runtimeSemanticChanges: 0 };
};

/**
 * Reverse one authenticated null-boundary repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseJvmGenericRecordArrayNullBoundaryRepairUpdate = (
	source, update
) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only the authenticated JVM Array null-boundary transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeJvmGenericRecordArrayNullBoundaryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !jvmGenericRecordArrayNullBoundaryRepairNormalizationPaths
			.includes(path)
		|| !existsSync(historyUrl)) return source;
	let current = source;
	for(const update of [
		...record().integrationUpdates, ...record().updates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		if(update.path === path && update.currentSha256 === sha256(current))
			current = reverseJvmGenericRecordArrayNullBoundaryRepairUpdate(
				current, update);
	}
	return current;
};
