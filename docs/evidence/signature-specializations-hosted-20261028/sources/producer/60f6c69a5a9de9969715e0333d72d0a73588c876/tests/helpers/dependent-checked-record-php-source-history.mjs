/**
 * Reverse the dependent checked-record native PHP source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPhpHistoryPath
	= "docs/evidence/dependent-checked-record-php-source-history-20261021.json";
export const dependentCheckedRecordPhpPredecessor
	= "c915d5d5e97df8435742359d2305dd5413638511";
export const dependentCheckedRecordPhpImplementation
	= "e4d0dd347197f3b306c628ac6b9082e719c56039";
export const dependentCheckedRecordPhpChangedPaths = Object.freeze([
	"tests/dependent-checked-record-native-foundation.test.mjs"
]);
export const dependentCheckedRecordPhpIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPhpHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordPhpUpdate = (source, update) => {
	assert.ok([...dependentCheckedRecordPhpChangedPaths
		, ...dependentCheckedRecordPhpIntegrationPaths].includes(update.path));
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
 * Remove only this exact dependent checked-record native PHP milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordPhpSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordPhpChangedPaths
		, ...dependentCheckedRecordPhpIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordPhpUpdate(source, update) : source;
};
