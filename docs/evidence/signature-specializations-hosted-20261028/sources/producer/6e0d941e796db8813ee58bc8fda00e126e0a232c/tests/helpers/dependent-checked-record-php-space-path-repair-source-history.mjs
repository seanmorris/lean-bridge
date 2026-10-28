/**
 * Reverse the dependent checked-record native PHP space-path repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPhpSpacePathRepairHistoryPath
	= "docs/evidence/dependent-checked-record-php-space-path-repair-source-history-20261022.json";
export const dependentCheckedRecordPhpSpacePathRepairPredecessor
	= "0f64af672343756b05f54f1debe24550770f715d";
export const dependentCheckedRecordPhpSpacePathRepairImplementation
	= "f03735645237400bef3a1ec23c87ebc142880941";
export const dependentCheckedRecordPhpSpacePathRepairIntegrationBase
	= "f03735645237400bef3a1ec23c87ebc142880941";
export const dependentCheckedRecordPhpSpacePathRepairChangedPaths = Object.freeze([
	"tests/fin-container-edge-php-closure.test.mjs"
	, "tests/helpers/brick-math.mjs"
	, "tests/helpers/fin-container-edge-php-closure.mjs"
]);
export const dependentCheckedRecordPhpSpacePathRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPhpSpacePathRepairHistoryPath, "utf8"));

/**
 * Restore one exact source transition after authenticating its endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordPhpSpacePathRepairUpdate = (source, update) => {
	assert.ok([...dependentCheckedRecordPhpSpacePathRepairChangedPaths
		, ...dependentCheckedRecordPhpSpacePathRepairIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact native PHP Composer space-path repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordPhpSpacePathRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...dependentCheckedRecordPhpSpacePathRepairChangedPaths
			, ...dependentCheckedRecordPhpSpacePathRepairIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.updates, ...value.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentCheckedRecordPhpSpacePathRepairUpdate(source, update)
		: source;
};
