/**
 * Reverse the value-index Rust frozen-generator replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexRustGeneratorReplayRepairHistoryPath
	= "docs/evidence/value-index-rust-generator-replay-repair-source-history-20261023.json";
export const valueIndexRustGeneratorReplayRepairPredecessor
	= "c2c306eb32b4e55191050e3f3fc3ec57697a8029";
export const valueIndexRustGeneratorReplayRepairImplementation
	= "fe53b845d5570558daa2e327a5ef1ec370e057d7";
export const valueIndexRustGeneratorReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/checked-record-value-index-rust-report.mjs"
]);
export const valueIndexRustGeneratorReplayRepairIntegrationPaths = Object.freeze([
	"tests/checked-record-value-index-rust.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexRustGeneratorReplayRepairNormalizationPaths = Object.freeze([
	...valueIndexRustGeneratorReplayRepairChangedPaths
	, ...valueIndexRustGeneratorReplayRepairIntegrationPaths
]);
export const valueIndexRustGeneratorReplayRepairAddedPaths = Object.freeze([
	"scripts/update-value-index-rust-generator-replay-repair-source-history.mjs"
	, "tests/helpers/value-index-rust-generator-replay-repair-source-history-tests.mjs"
	, "tests/helpers/value-index-rust-generator-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	valueIndexRustGeneratorReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseValueIndexRustGeneratorReplayRepairUpdate = (
	source, update
) => {
	assert.ok(valueIndexRustGeneratorReplayRepairNormalizationPaths
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
 * Remove only the exact value-index Rust frozen-generator replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeValueIndexRustGeneratorReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !valueIndexRustGeneratorReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseValueIndexRustGeneratorReplayRepairUpdate(source, update)
		: source;
};
