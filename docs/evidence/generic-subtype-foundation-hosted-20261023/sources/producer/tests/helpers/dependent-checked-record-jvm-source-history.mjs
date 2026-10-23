/**
 * Reverse the dependent checked-record JVM source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordJvmHistoryPath
	= "docs/evidence/dependent-checked-record-jvm-source-history-20261021.json";
export const dependentCheckedRecordJvmPredecessor
	= "1a3c423089d21be2fe3a53f9011a25d6cd96b7c1";
export const dependentCheckedRecordJvmImplementation
	= "f87e675dbd798332b47cff49bdc8e7b9c948613c";
export const dependentCheckedRecordJvmChangedPaths = Object.freeze([
	"tests/dependent-checked-record-native-foundation.test.mjs"
]);
export const dependentCheckedRecordJvmIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordJvmHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordJvmUpdate = (source, update) => {
	assert.ok([...dependentCheckedRecordJvmChangedPaths
		, ...dependentCheckedRecordJvmIntegrationPaths].includes(update.path));
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
 * Remove only this exact dependent checked-record JVM milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordJvmSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordJvmChangedPaths
		, ...dependentCheckedRecordJvmIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordJvmUpdate(source, update) : source;
};
