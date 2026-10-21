/**
 * Authenticate inherited checked-record JVM support as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordJvmHistoryPath
	= "docs/evidence/inherited-checked-record-jvm-source-history-20261017.json";
export const inheritedCheckedRecordJvmPredecessor
	= "a242db6fa8ea22425241191d0ff5ec54964629d8";
export const inheritedCheckedRecordJvmDraftParent
	= "1474d502a99ce34080c0a4ce14eff9349c24dc0f";
export const inheritedCheckedRecordJvmChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const inheritedCheckedRecordJvmAddedPaths = Object.freeze([
	".github/workflows/inherited-checked-record-jvm.yml"
	, "scripts/check-inherited-checked-record-jvm-ci.mjs"
	, "scripts/run-inherited-checked-record-jvm-ci.sh"
	, "scripts/update-inherited-checked-record-jvm-source-history.mjs"
	, "tests/fixtures/inherited-checked-record-consumers/java.java"
	, "tests/fixtures/inherited-checked-record-consumers/kotlin.kt"
	, "tests/helpers/inherited-checked-record-jvm-caller-tests.mjs"
	, "tests/helpers/inherited-checked-record-jvm-ci-handoff.mjs"
	, "tests/helpers/inherited-checked-record-jvm-ci-report.mjs"
	, "tests/helpers/inherited-checked-record-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-jvm-consumer-records.mjs"
	, "tests/helpers/inherited-checked-record-jvm-controls.mjs"
	, "tests/helpers/inherited-checked-record-jvm-fixture-tests.mjs"
	, "tests/helpers/inherited-checked-record-jvm-fixture.mjs"
	, "tests/helpers/inherited-checked-record-jvm-generators.mjs"
	, "tests/helpers/inherited-checked-record-jvm-installed-tests.mjs"
	, "tests/helpers/inherited-checked-record-jvm-model-records.mjs"
	, "tests/helpers/inherited-checked-record-jvm-package-records.mjs"
	, "tests/helpers/inherited-checked-record-jvm-package.mjs"
	, "tests/helpers/inherited-checked-record-jvm-probe.mjs"
	, "tests/helpers/inherited-checked-record-jvm-report.mjs"
	, "tests/helpers/inherited-checked-record-jvm-source-history.mjs"
	, "tests/inherited-checked-record-jvm-source-history.test.mjs"
	, "tests/inherited-checked-record-jvm.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordJvmHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record JVM transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordJvmUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordJvmChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
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
 * Remove only this JVM layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordJvmSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordJvmChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordJvmUpdate(source, update)
		: source;
};
