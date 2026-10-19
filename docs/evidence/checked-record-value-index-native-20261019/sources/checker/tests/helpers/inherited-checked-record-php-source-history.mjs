/**
 * Authenticate inherited checked-record PHP support as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPhpHistoryPath
	= "docs/evidence/inherited-checked-record-php-source-history-20261018.json";
export const inheritedCheckedRecordPhpPredecessor
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordPhpDraftParent
	= "4268943dc4bdd1f7a8dca256075b75c64594f437";
export const inheritedCheckedRecordPhpChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-checked-record-php-fixture.mjs"
]);
export const inheritedCheckedRecordPhpAddedPaths = Object.freeze([
	".github/workflows/inherited-checked-record-php.yml"
	, "scripts/archive-inherited-checked-record-php-evidence.mjs"
	, "scripts/check-inherited-checked-record-php-ci.mjs"
	, "scripts/run-inherited-checked-record-php-ci.sh"
	, "scripts/update-inherited-checked-record-php-source-history.mjs"
	, "tests/helpers/inherited-checked-record-php-ci-policy-tests.mjs"
	, "tests/helpers/inherited-checked-record-php-ci-report.mjs"
	, "tests/helpers/inherited-checked-record-php-ci-shell-tests.mjs"
	, "tests/helpers/inherited-checked-record-php-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-php-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-php-controls.mjs"
	, "tests/helpers/inherited-checked-record-php-environment-records.mjs"
	, "tests/helpers/inherited-checked-record-php-evidence-sources.mjs"
	, "tests/helpers/inherited-checked-record-php-evidence-tests.mjs"
	, "tests/helpers/inherited-checked-record-php-evidence.mjs"
	, "tests/helpers/inherited-checked-record-php-fixture-tests.mjs"
	, "tests/helpers/inherited-checked-record-php-generators.mjs"
	, "tests/helpers/inherited-checked-record-php-installed-tests.mjs"
	, "tests/helpers/inherited-checked-record-php-model-records.mjs"
	, "tests/helpers/inherited-checked-record-php-model.php"
	, "tests/helpers/inherited-checked-record-php-package-records.mjs"
	, "tests/helpers/inherited-checked-record-php-package.mjs"
	, "tests/helpers/inherited-checked-record-php-provenance.mjs"
	, "tests/helpers/inherited-checked-record-php-report.mjs"
	, "tests/helpers/inherited-checked-record-php-resources.mjs"
	, "tests/helpers/inherited-checked-record-php-source-history.mjs"
	, "tests/helpers/inherited-checked-record-php-tests.mjs"
	, "tests/inherited-checked-record-php-evidence.test.mjs"
	, "tests/inherited-checked-record-php-source-history.test.mjs"
	, "tests/inherited-checked-record-php.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPhpHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record PHP transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPhpUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordPhpChangedPaths.includes(update.path));
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
 * Remove only this PHP layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordPhpSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPhpChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPhpUpdate(source, update)
		: source;
};
