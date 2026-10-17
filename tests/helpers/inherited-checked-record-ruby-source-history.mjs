/**
 * Authenticate inherited checked-record Ruby support as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordRubyHistoryPath
	= "docs/evidence/inherited-checked-record-ruby-source-history-20261017.json";
export const inheritedCheckedRecordRubyPredecessor
	= "78ecf12b8266c1b591a76deeff1aac7540e5bdfd";
export const inheritedCheckedRecordRubyDraftParent
	= "651f5cbaccf7342f19bad7c9c85dfe66739cb3fa";
export const inheritedCheckedRecordRubyChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const inheritedCheckedRecordRubyAddedPaths = Object.freeze([
	".github/workflows/inherited-checked-record-ruby.yml"
	, "scripts/archive-inherited-checked-record-ruby-evidence.mjs"
	, "scripts/check-inherited-checked-record-ruby-ci.mjs"
	, "scripts/run-inherited-checked-record-ruby-ci.sh"
	, "scripts/update-inherited-checked-record-ruby-source-history.mjs"
	, "tests/fixtures/inherited-checked-record-consumers/ruby.rb"
	, "tests/helpers/inherited-checked-record-ruby-archive.mjs"
	, "tests/helpers/inherited-checked-record-ruby-ci-policy-tests.mjs"
	, "tests/helpers/inherited-checked-record-ruby-ci-report.mjs"
	, "tests/helpers/inherited-checked-record-ruby-ci-shell-tests.mjs"
	, "tests/helpers/inherited-checked-record-ruby-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-ruby-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-ruby-controls-tests.mjs"
	, "tests/helpers/inherited-checked-record-ruby-controls.mjs"
	, "tests/helpers/inherited-checked-record-ruby-environment-records.mjs"
	, "tests/helpers/inherited-checked-record-ruby-evidence-sources.mjs"
	, "tests/helpers/inherited-checked-record-ruby-evidence-tests.mjs"
	, "tests/helpers/inherited-checked-record-ruby-evidence.mjs"
	, "tests/helpers/inherited-checked-record-ruby-fixture-tests.mjs"
	, "tests/helpers/inherited-checked-record-ruby-fixture.mjs"
	, "tests/helpers/inherited-checked-record-ruby-installed-tests.mjs"
	, "tests/helpers/inherited-checked-record-ruby-model-records.mjs"
	, "tests/helpers/inherited-checked-record-ruby-model.rb"
	, "tests/helpers/inherited-checked-record-ruby-package-records.mjs"
	, "tests/helpers/inherited-checked-record-ruby-package.mjs"
	, "tests/helpers/inherited-checked-record-ruby-provenance.mjs"
	, "tests/helpers/inherited-checked-record-ruby-report.mjs"
	, "tests/helpers/inherited-checked-record-ruby-resources.mjs"
	, "tests/helpers/inherited-checked-record-ruby-source-history.mjs"
	, "tests/inherited-checked-record-ruby-evidence.test.mjs"
	, "tests/inherited-checked-record-ruby-source-history.test.mjs"
	, "tests/inherited-checked-record-ruby.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordRubyHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record Ruby transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordRubyUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordRubyChangedPaths.includes(update.path));
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
 * Remove only this Ruby layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordRubySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordRubyChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordRubyUpdate(source, update)
		: source;
};
