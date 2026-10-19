/**
 * Authenticate inherited checked-record Python support as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPythonHistoryPath
	= "docs/evidence/inherited-checked-record-python-source-history-20261017.json";
export const inheritedCheckedRecordPythonPredecessor
	= "501a922eada6102d8343bdccbde16abe77220e01";
export const inheritedCheckedRecordPythonDraftParent
	= "9806148d5b62be9b2c1bde2f5793be032ea63574";
export const inheritedCheckedRecordPythonChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const inheritedCheckedRecordPythonAddedPaths = Object.freeze([
	".github/workflows/inherited-checked-record-python.yml"
	, "scripts/archive-inherited-checked-record-python-evidence.mjs"
	, "scripts/check-inherited-checked-record-python-ci.mjs"
	, "scripts/run-inherited-checked-record-python-ci.sh"
	, "scripts/update-inherited-checked-record-python-source-history.mjs"
	, "tests/fixtures/inherited-checked-record-consumers/python.py"
	, "tests/helpers/inherited-checked-record-python-ci-policy-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-ci-report.mjs"
	, "tests/helpers/inherited-checked-record-python-ci-shell-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-python-controls-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-controls.mjs"
	, "tests/helpers/inherited-checked-record-python-environment-records.mjs"
	, "tests/helpers/inherited-checked-record-python-evidence-sources.mjs"
	, "tests/helpers/inherited-checked-record-python-evidence-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-evidence.mjs"
	, "tests/helpers/inherited-checked-record-python-fixture-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-fixture.mjs"
	, "tests/helpers/inherited-checked-record-python-handoff-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-handoff.mjs"
	, "tests/helpers/inherited-checked-record-python-install.mjs"
	, "tests/helpers/inherited-checked-record-python-installed-tests.mjs"
	, "tests/helpers/inherited-checked-record-python-model-records.mjs"
	, "tests/helpers/inherited-checked-record-python-model.py"
	, "tests/helpers/inherited-checked-record-python-package-records.mjs"
	, "tests/helpers/inherited-checked-record-python-provenance.mjs"
	, "tests/helpers/inherited-checked-record-python-report.mjs"
	, "tests/helpers/inherited-checked-record-python-resources.mjs"
	, "tests/helpers/inherited-checked-record-python-source-history.mjs"
	, "tests/helpers/inherited-checked-record-python-wheel.mjs"
	, "tests/inherited-checked-record-python-evidence.test.mjs"
	, "tests/inherited-checked-record-python-source-history.test.mjs"
	, "tests/inherited-checked-record-python.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPythonHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record Python transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPythonUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordPythonChangedPaths.includes(update.path));
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
 * Remove only this Python layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordPythonSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPythonChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPythonUpdate(source, update)
		: source;
};
