/**
 * Preserve the native TAP contract repair as one reversible source layer above
 * its independently recorded foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexNativeTapContractHistoryPath
	= "docs/evidence/value-index-native-tap-contract-source-history-20261020.json";
export const valueIndexNativeTapContractPredecessor
	= "a8df14e0ea26ff7e046b3e9843c1541819479f0b";
export const valueIndexNativeTapContractChangedPaths = Object.freeze([
	"tests/checked-record-value-index-native.test.mjs"
	, "tests/helpers/checked-record-value-index-native-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-native-fixture-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexNativeTapContractAddedPaths = Object.freeze([
	"scripts/update-value-index-native-tap-contract-source-history.mjs"
	, "tests/helpers/value-index-native-tap-contract-source-history-tests.mjs"
	, "tests/helpers/value-index-native-tap-contract-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	valueIndexNativeTapContractHistoryPath, "utf8"
));

/**
 * Reverse one exact installed-acceptance transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for one path.
 */
export const reverseValueIndexNativeTapContractUpdate = (source, update) => {
	assert.ok(valueIndexNativeTapContractChangedPaths.includes(update.path), update.path);
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
 * Remove only the native TAP contract repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeValueIndexNativeTapContractSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !valueIndexNativeTapContractChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseValueIndexNativeTapContractUpdate(source, update) : source;
};
