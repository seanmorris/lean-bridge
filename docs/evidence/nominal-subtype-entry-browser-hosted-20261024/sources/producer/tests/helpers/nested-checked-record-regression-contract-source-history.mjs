/**
 * Reverse the nested checked-record regression-contract reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordRegressionContractHistoryPath
	= "docs/evidence/nested-checked-record-regression-contract-source-history-20261021.json";
export const nestedCheckedRecordRegressionContractPredecessor
	= "c2fb9c7b4423501cecea1c44f5ff00f24786df7a";
export const nestedCheckedRecordRegressionContractImplementation
	= "65704924c3435a64d786af1487e8714f0e62a610";
export const nestedCheckedRecordRegressionContractChangedPaths = Object.freeze([
	"tests/nested-checked-record-foundation.test.mjs"
]);
export const nestedCheckedRecordRegressionContractIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nestedCheckedRecordRegressionContractHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseNestedCheckedRecordRegressionContractUpdate = (
	source, update
) => {
	assert.ok([...nestedCheckedRecordRegressionContractChangedPaths
		, ...nestedCheckedRecordRegressionContractIntegrationPaths]
		.includes(update.path));
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
 * Remove only this exact nested checked-record contract milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeNestedCheckedRecordRegressionContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...nestedCheckedRecordRegressionContractChangedPaths
		, ...nestedCheckedRecordRegressionContractIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseNestedCheckedRecordRegressionContractUpdate(source, update)
		: source;
};
