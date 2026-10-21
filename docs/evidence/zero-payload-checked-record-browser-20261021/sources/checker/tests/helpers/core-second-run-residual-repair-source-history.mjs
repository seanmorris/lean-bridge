/**
 * Authenticate the two residual repairs found by the second complete hosted
 * Core run as one exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreSecondRunResidualRepairHistoryPath
	= "docs/evidence/core-second-run-residual-repair-source-history-20261019.json";
export const coreSecondRunResidualRepairPredecessor
	= "02f3c3c5d0b28f4836a59a40e0f23be8edaf401e";
export const coreSecondRunResidualRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/fixtures/recursive-checked-record-consumers/php-native.php"
	, "tests/helpers/checked-record-value-index-native-controls.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-recursive-callable-regression.mjs"
]);
export const coreSecondRunResidualRepairAddedPaths = Object.freeze([
	"scripts/update-core-second-run-residual-repair-source-history.mjs"
	, "tests/helpers/core-second-run-residual-repair-source-history-tests.mjs"
	, "tests/helpers/core-second-run-residual-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	coreSecondRunResidualRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact residual-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCoreSecondRunResidualRepairUpdate = (source, update) => {
	assert.ok(coreSecondRunResidualRepairChangedPaths.includes(update.path));
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
 * Remove only the exact second residual-repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreSecondRunResidualRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreSecondRunResidualRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCoreSecondRunResidualRepairUpdate(source, update)
		: source;
};
