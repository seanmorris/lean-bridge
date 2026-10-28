/**
 * Authenticate the closed Nat, Bool and String checked-record value-index
 * foundation as one exact, reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexFoundationHistoryPath
	= "docs/evidence/checked-record-value-index-foundation-source-history-20261018.json";
export const checkedRecordValueIndexFoundationPredecessor
	= "b44234a9fbb51e8f7537b66e619edc5e0ed76b91";
export const checkedRecordValueIndexFoundationDraftParent
	= "357f1dd3d9c091686736162e9c75668e01ca2583";
export const checkedRecordValueIndexFoundationChangedPaths = Object.freeze([
	"docs/architecture/elaborated-export-metadata.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "src/abi/component-scalars.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-instantiation.mjs"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-fixture.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexFoundationAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-foundation-source-history.mjs"
	, "tests/helpers/checked-record-value-index-foundation-source-history.mjs"
	, "tests/helpers/checked-record-value-index-foundation-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexFoundationHistoryPath, "utf8"
));

/**
 * Reverse one exact checked-record value-index foundation transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexFoundationUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexFoundationChangedPaths.includes(
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
 * Remove only the exact checked-record value-index foundation layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexFoundationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexFoundationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexFoundationUpdate(source, update)
		: source;
};
