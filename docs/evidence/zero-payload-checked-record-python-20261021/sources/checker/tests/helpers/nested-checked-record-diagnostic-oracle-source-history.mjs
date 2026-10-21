/**
 * Authenticate the nested checked-record diagnostic-oracle correction as one
 * exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordDiagnosticOracleHistoryPath
	= "docs/evidence/nested-checked-record-diagnostic-oracle-source-history-20261017.json";
export const nestedCheckedRecordDiagnosticOraclePredecessor
	= "bd9ebbf14f05a8750364255bf2416890b79d373e";
export const nestedCheckedRecordNativeArchiveHistoricalCommit
	= "d6fe6dfffc8f6b94e11a3110f704ea98634a2c0f";
export const nestedCheckedRecordNativeArchiveHistoricalParent
	= "1e6f4c5983be741f2065cef7e703fe2ffe76d766";
export const nestedCheckedRecordNativeArchiveHistoricalPaths = Object.freeze([
	"tests/nested-checked-records.test.mjs"
]);
export const nestedCheckedRecordDiagnosticOracleChangedPaths = Object.freeze([
	"tests/fixtures/nested-checked-record-consumers/javascript.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/nested-checked-record-foundation.test.mjs"
]);
export const nestedCheckedRecordDiagnosticOracleAddedPaths = Object.freeze([
	"scripts/update-nested-checked-record-diagnostic-oracle-history.mjs"
	, "tests/helpers/nested-checked-record-diagnostic-oracle-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-diagnostic-oracle-source-history.mjs"
]);
export const nestedCheckedRecordDiagnosticOracleUnchangedPaths = Object.freeze([
	"docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	nestedCheckedRecordDiagnosticOracleHistoryPath, "utf8"
));

/**
 * Reverse one exact diagnostic-oracle source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 * @param paths - Closed paths admitted by this transition family.
 */
const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
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
 * Reverse one exact current diagnostic-oracle transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated current transition.
 */
export const reverseNestedCheckedRecordDiagnosticOracleUpdate = (
	source, update
) => reverse(source, update, nestedCheckedRecordDiagnosticOracleChangedPaths);

/**
 * Reverse the exact omitted native-archive transition.
 *
 * @param source - Complete historical source text.
 * @param update - Authenticated historical transition.
 */
export const reverseNestedCheckedRecordNativeArchiveHistoricalUpdate = (
	source, update
) => reverse(source, update, nestedCheckedRecordNativeArchiveHistoricalPaths);

/**
 * Remove only this diagnostic-oracle layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeNestedCheckedRecordDiagnosticOracleSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordDiagnosticOracleChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseNestedCheckedRecordDiagnosticOracleUpdate(source, update)
		: source;
};

/**
 * Remove the exact native-archive entrypoint transition omitted from the
 * original source-history chain.
 *
 * @param path - Repository-relative historical source path.
 * @param source - Complete historical source after newer layers are removed.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeNestedCheckedRecordNativeArchiveHistoricalSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordNativeArchiveHistoricalPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().historicalUpdates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseNestedCheckedRecordNativeArchiveHistoricalUpdate(source, update)
		: source;
};
