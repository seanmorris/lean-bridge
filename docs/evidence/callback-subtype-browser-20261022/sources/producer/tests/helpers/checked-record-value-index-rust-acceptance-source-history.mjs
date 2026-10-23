/**
 * Preserve the installed Rust acceptance and Ruby hosted-checker repair as one
 * reversible source layer above their independently recorded foundations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRustAcceptanceHistoryPath
	= "docs/evidence/checked-record-value-index-rust-acceptance-source-history-20261020.json";
export const checkedRecordValueIndexRustAcceptancePredecessor
	= "ea32df252b1786d4163c8a4082c6de0a190e7271";
export const checkedRecordValueIndexRustAcceptanceChangedPaths = Object.freeze([
	"tests/checked-record-value-index-rust.test.mjs"
	, "tests/helpers/checked-record-value-index-ruby-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-ruby-fixture-tests.mjs"
	, "tests/helpers/checked-record-value-index-ruby-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-fixture-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexRustAcceptanceAddedPaths = Object.freeze([
	".github/workflows/checked-record-value-index-rust.yml"
	, "scripts/check-checked-record-value-index-rust-ci.mjs"
	, "scripts/run-checked-record-value-index-rust-ci.sh"
	, "scripts/update-checked-record-value-index-rust-acceptance-source-history.mjs"
	, "tests/helpers/checked-record-value-index-rust-acceptance-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-acceptance-source-history.mjs"
	, "tests/helpers/checked-record-value-index-rust-ci-policy-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-rust-dependency-records.mjs"
	, "tests/helpers/checked-record-value-index-rust-install.mjs"
	, "tests/helpers/checked-record-value-index-rust-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-package.mjs"
	, "tests/helpers/checked-record-value-index-rust-report.mjs"
	, "tests/helpers/checked-record-value-index-rust-resources.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRustAcceptanceHistoryPath, "utf8"
));

/**
 * Reverse one exact installed-acceptance transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for one path.
 */
export const reverseCheckedRecordValueIndexRustAcceptanceUpdate = (source, update) => {
	assert.ok(checkedRecordValueIndexRustAcceptanceChangedPaths.includes(update.path), update.path);
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
 * Remove only the installed Rust acceptance and Ruby checker repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCheckedRecordValueIndexRustAcceptanceSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRustAcceptanceChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexRustAcceptanceUpdate(source, update) : source;
};
