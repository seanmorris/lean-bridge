/**
 * Reverse the Core historical-contract repair: generated type tables, the
 * checked-record workflow assertion and Wasm-entry archive accounting.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoricalContractRepairHistoryPath
	= "docs/evidence/core-historical-contract-repair-source-history-20261028.json";
export const coreHistoricalContractRepairPredecessor
	= "e97cbb1b10aab1fd471cb57cd97bee66f58d8ee4";
export const coreHistoricalContractRepairImplementation
	= "f51ee14387676aa4bc04f27f8f32407538e97fd0";
export const coreHistoricalContractRepairCommits = Object.freeze([
	"db3aac2ef83bf22183cfd4b129de5212280f5ec2"
	, "f51ee14387676aa4bc04f27f8f32407538e97fd0"
]);
export const coreHistoricalContractRepairChangedPaths = Object.freeze([
	"docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry.mjs"
	, "tests/helpers/wasm-entry-evidence.mjs"
	, "tests/helpers/wasm-entry-supplement.mjs"
	, "tests/wasm-entry-evidence.test.mjs"
]);
export const coreHistoricalContractRepairNormalizationPaths
	= coreHistoricalContractRepairChangedPaths;
export const coreHistoricalContractRepairAddedPaths = Object.freeze([
	"scripts/update-core-historical-contract-repair-source-history.mjs"
	, "tests/helpers/core-historical-contract-repair-source-history-tests.mjs"
	, "tests/helpers/core-historical-contract-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHistoricalContractRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreHistoricalContractRepairUpdate = (source, update) => {
	assert.ok(coreHistoricalContractRepairNormalizationPaths.includes(
		update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeCoreHistoricalContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoricalContractRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreHistoricalContractRepairUpdate(source, update);
};
