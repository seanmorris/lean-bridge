/**
 * Reverse the dependent checked-record Python source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPythonHistoryPath
	= "docs/evidence/dependent-checked-record-python-source-history-20261021.json";
export const dependentCheckedRecordPythonPredecessor
	= "5221f8851e8d5dd5d675d87f7bfd454f7a131781";
export const dependentCheckedRecordPythonImplementation
	= "d425c218f55797036d4d40aa55381c59668cabe5";
export const dependentCheckedRecordPythonChangedPaths = Object.freeze([
	"tests/dependent-checked-record-native-foundation.test.mjs"
]);
export const dependentCheckedRecordPythonIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPythonHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordPythonUpdate = (source, update) => {
	assert.ok([...dependentCheckedRecordPythonChangedPaths
		, ...dependentCheckedRecordPythonIntegrationPaths].includes(update.path));
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
 * Remove only this exact dependent checked-record Python milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordPythonSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordPythonChangedPaths
		, ...dependentCheckedRecordPythonIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordPythonUpdate(source, update) : source;
};
