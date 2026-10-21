/**
 * Reverse the stable zero-payload native control-contract milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadNativeControlContractHistoryPath
	= "docs/evidence/zero-payload-native-control-contract-source-history-20261021.json";
export const zeroPayloadNativeControlContractPredecessor
	= "9b31632a3d54e053897032686b030a3b8dd99115";
export const zeroPayloadNativeControlContractImplementation
	= "9730864708aae82d60aa64f49f4fe4bdcd36ba05";
export const zeroPayloadNativeControlContractChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-native-ci-report.mjs"
	, "tests/zero-payload-checked-records.test.mjs"
]);
export const zeroPayloadNativeControlContractIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadNativeControlContractHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseZeroPayloadNativeControlContractUpdate = (
	source, update
) => {
	assert.ok([...zeroPayloadNativeControlContractChangedPaths
		, ...zeroPayloadNativeControlContractIntegrationPaths]
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
 * Remove only this exact zero-payload native control milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadNativeControlContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...zeroPayloadNativeControlContractChangedPaths
		, ...zeroPayloadNativeControlContractIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadNativeControlContractUpdate(source, update)
		: source;
};
