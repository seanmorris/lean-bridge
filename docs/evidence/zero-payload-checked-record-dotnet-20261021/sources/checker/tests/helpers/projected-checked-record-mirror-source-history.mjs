/**
 * Reverse the authenticated projected checked-record mirror repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const projectedCheckedRecordMirrorHistoryPath
	= "docs/evidence/projected-checked-record-mirror-source-history-20261021.json";
export const projectedCheckedRecordMirrorPredecessor
	= "7c12bbf6eb5e0e9d1875e9c438f2ed4478e25de3";
export const projectedCheckedRecordMirrorImplementation
	= "953e44fce4f8eb924fec920a168f8b3186995392";
export const projectedCheckedRecordMirrorChangedPaths = Object.freeze([
	"src/build/refinement-mirrors.mjs"
	, "tests/component-refinement-mirrors.test.mjs"
]);
export const projectedCheckedRecordMirrorIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	projectedCheckedRecordMirrorHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseProjectedCheckedRecordMirrorUpdate = (source, update) => {
	assert.ok([...projectedCheckedRecordMirrorChangedPaths
		, ...projectedCheckedRecordMirrorIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact projected-result mirror repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeProjectedCheckedRecordMirrorSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...projectedCheckedRecordMirrorChangedPaths
			, ...projectedCheckedRecordMirrorIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseProjectedCheckedRecordMirrorUpdate(source, update)
		: source;
};
