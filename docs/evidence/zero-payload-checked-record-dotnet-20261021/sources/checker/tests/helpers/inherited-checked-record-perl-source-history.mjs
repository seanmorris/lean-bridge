/**
 * Authenticate inherited checked-record Perl support as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPerlHistoryPath
	= "docs/evidence/inherited-checked-record-perl-source-history-20261018.json";
export const inheritedCheckedRecordPerlPredecessor
	= "3b25f500c6cb9301df3e69b4d1890d777e65314f";
export const inheritedCheckedRecordPerlDraftParent
	= "36216f36fd559d736b81ae68ff8bd7040fa0e495";
export const inheritedCheckedRecordPerlChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const inheritedCheckedRecordPerlAddedPaths = Object.freeze([
	".github/workflows/inherited-checked-record-perl.yml"
	, "scripts/archive-inherited-checked-record-perl-evidence.mjs"
	, "scripts/check-inherited-checked-record-perl-ci.mjs"
	, "scripts/run-inherited-checked-record-perl-ci.sh"
	, "scripts/update-inherited-checked-record-perl-source-history.mjs"
	, "tests/fixtures/inherited-checked-record-consumers/perl.pl"
	, "tests/helpers/inherited-checked-record-perl-ci-report-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-ci-report.mjs"
	, "tests/helpers/inherited-checked-record-perl-ci-shell-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-perl-controls-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-controls.mjs"
	, "tests/helpers/inherited-checked-record-perl-evidence-sources-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-evidence-sources.mjs"
	, "tests/helpers/inherited-checked-record-perl-evidence-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-evidence.mjs"
	, "tests/helpers/inherited-checked-record-perl-fixture-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-fixture.mjs"
	, "tests/helpers/inherited-checked-record-perl-install.mjs"
	, "tests/helpers/inherited-checked-record-perl-installed-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-model.pl"
	, "tests/helpers/inherited-checked-record-perl-provenance.mjs"
	, "tests/helpers/inherited-checked-record-perl-records.mjs"
	, "tests/helpers/inherited-checked-record-perl-source-history.mjs"
	, "tests/inherited-checked-record-perl-evidence.test.mjs"
	, "tests/inherited-checked-record-perl-source-history.test.mjs"
	, "tests/inherited-checked-record-perl.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPerlHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record Perl transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPerlUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordPerlChangedPaths.includes(update.path));
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
 * Remove only this Perl layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordPerlSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPerlChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPerlUpdate(source, update)
		: source;
};
