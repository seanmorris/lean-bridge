/**
 * Preserve the installed WIT acceptance as one reversible source layer above
 * its independently recorded foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexWitAcceptanceHistoryPath
	= "docs/evidence/checked-record-value-index-wit-acceptance-source-history-20261020.json";
export const checkedRecordValueIndexWitAcceptancePredecessor
	= "a23cef183152257e67f438da5c1d9529832da661";
export const checkedRecordValueIndexWitAcceptanceChangedPaths = Object.freeze([
	"tests/checked-record-value-index-wit.test.mjs"
	, "tests/helpers/checked-record-value-index-wit-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexWitAcceptanceAddedPaths = Object.freeze([
	".github/workflows/checked-record-value-index-wit.yml"
	, "scripts/check-checked-record-value-index-wit-ci.mjs"
	, "scripts/run-checked-record-value-index-wit-ci.sh"
	, "scripts/update-checked-record-value-index-wit-acceptance-source-history.mjs"
	, "tests/helpers/checked-record-value-index-wit-acceptance-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-acceptance-source-history.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-handoff-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-report-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-shell-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-workflow.mjs"
	, "tests/helpers/checked-record-value-index-wit-environment-records.mjs"
	, "tests/helpers/checked-record-value-index-wit-handoff.mjs"
	, "tests/helpers/checked-record-value-index-wit-install.mjs"
	, "tests/helpers/checked-record-value-index-wit-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-model-records.mjs"
	, "tests/helpers/checked-record-value-index-wit-package-records.mjs"
	, "tests/helpers/checked-record-value-index-wit-package.mjs"
	, "tests/helpers/checked-record-value-index-wit-report.mjs"
	, "tests/helpers/checked-record-value-index-wit-resources.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexWitAcceptanceHistoryPath, "utf8"
));

/**
 * Reverse one exact installed-acceptance transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for one path.
 */
export const reverseCheckedRecordValueIndexWitAcceptanceUpdate = (source, update) => {
	assert.ok(checkedRecordValueIndexWitAcceptanceChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the installed WIT acceptance layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCheckedRecordValueIndexWitAcceptanceSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexWitAcceptanceChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexWitAcceptanceUpdate(source, update) : source;
};
