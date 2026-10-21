/**
 * Authenticate installed JVM value-index acceptance and the hosted native
 * diagnostic repair as one exact reversible milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexJvmNativeRepairHistoryPath
	= "docs/evidence/checked-record-value-index-jvm-native-repair-source-history-20261019.json";
export const checkedRecordValueIndexJvmNativeRepairPredecessor
	= "79359306d2e50a5893affe04cafed95d54166b88";
export const checkedRecordValueIndexJvmNativeRepairDraftParent
	= "22f7329ae14196d1c3539cf3e2fa4cb983aa882e";
export const checkedRecordValueIndexJvmNativeRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-record-value-index-jvm.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/fixtures/checked-record-value-index-native/c.c"
	, "tests/helpers/checked-record-value-index-native-fixture-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexJvmNativeRepairFoundationModifiedPaths
	= Object.freeze([
		"tests/checked-record-value-index-jvm.test.mjs"
		, "tests/fixtures/checked-record-value-index-native/c.c"
		, "tests/helpers/checked-record-value-index-native-fixture-tests.mjs"
	]);
export const checkedRecordValueIndexJvmNativeRepairFoundationAddedPaths
	= Object.freeze([
		".github/workflows/checked-record-value-index-jvm.yml"
		, "scripts/check-checked-record-value-index-jvm-ci.mjs"
		, "scripts/run-checked-record-value-index-jvm-ci.sh"
		, "tests/helpers/checked-record-value-index-jvm-ci-handoff.mjs"
		, "tests/helpers/checked-record-value-index-jvm-ci-policy-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-ci-report.mjs"
		, "tests/helpers/checked-record-value-index-jvm-ci-shell-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-ci-workflow.mjs"
		, "tests/helpers/checked-record-value-index-jvm-installed-static-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-installed-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-package.mjs"
		, "tests/helpers/checked-record-value-index-jvm-probe.mjs"
		, "tests/helpers/checked-record-value-index-jvm-report.mjs"
	]);
export const checkedRecordValueIndexJvmNativeRepairHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-jvm-native-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-jvm-native-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-native-repair-source-history.mjs"
	]);
export const checkedRecordValueIndexJvmNativeRepairAddedPaths = Object.freeze([
	...checkedRecordValueIndexJvmNativeRepairFoundationAddedPaths
	, ...checkedRecordValueIndexJvmNativeRepairHistoryAddedPaths
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexJvmNativeRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact installed-JVM/native-diagnostic transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexJvmNativeRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexJvmNativeRepairChangedPaths.includes(
		update.path
	));
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
 * Remove only the installed-JVM/native-diagnostic milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexJvmNativeRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexJvmNativeRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexJvmNativeRepairUpdate(source, update)
		: source;
};
