/**
 * Reverse the dependent checked-record C/C++ source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordNativeHistoryPath
	= "docs/evidence/dependent-checked-record-native-source-history-20261021.json";
export const dependentCheckedRecordNativePredecessor
	= "bcf2120e9772b7d642d4bc91cf45fd41e50cec9d";
export const dependentCheckedRecordNativeImplementation
	= "4f071ae1fd72dabc22840cc8803d7661380ab66c";
export const dependentCheckedRecordNativeTests = Object.freeze([
	"dependent-checked-record-browser-foundation"
	, "dependent-checked-record-native-foundation"
]);
export const dependentCheckedRecordNativeChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const dependentCheckedRecordNativeIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordNativeHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordNativeUpdate = (source, update) => {
	assert.ok([...dependentCheckedRecordNativeChangedPaths
		, ...dependentCheckedRecordNativeIntegrationPaths].includes(update.path));
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
 * Remove only this exact dependent checked-record native milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordNativeSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordNativeChangedPaths
		, ...dependentCheckedRecordNativeIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordNativeUpdate(source, update) : source;
};
