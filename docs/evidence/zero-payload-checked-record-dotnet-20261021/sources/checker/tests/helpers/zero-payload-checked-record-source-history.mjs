/**
 * Reverse the authenticated zero-payload checked-record admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadCheckedRecordHistoryPath
	= "docs/evidence/zero-payload-checked-record-source-history-20261021.json";
export const zeroPayloadCheckedRecordPredecessor
	= "0dcfb0379be5af7128d682d319e2d89472b426f3";
export const zeroPayloadCheckedRecordImplementation
	= "f5d94172dfe56f9d565f5b21a976d52563603ec4";
export const zeroPayloadCheckedRecordChangedPaths = Object.freeze([
	"docs/consume/wit-wasi.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-fixture.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const zeroPayloadCheckedRecordIntegrationPaths = Object.freeze([
	"docs/reference/types.md"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadCheckedRecordHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadCheckedRecordUpdate = (source, update) => {
	assert.ok([...zeroPayloadCheckedRecordChangedPaths
		, ...zeroPayloadCheckedRecordIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact zero-payload checked-record milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadCheckedRecordSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadCheckedRecordChangedPaths
		, ...zeroPayloadCheckedRecordIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadCheckedRecordUpdate(source, update)
		: source;
};
