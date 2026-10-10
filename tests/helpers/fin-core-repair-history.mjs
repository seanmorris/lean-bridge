/**
 * Authenticate Fin Core repair integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finCoreRepairHistoryPath = "docs/evidence/fin-core-repair-source-history-20261010.json";
export const finCoreRepairPredecessor = "4e0291810246eb3c22061bf00a5508e0490adc1a";
export const finCoreRepairChangedPaths = [
	"docs/consume/perl.md"
	, "docs/type-surface.v1.json"
	, "tests/copied-fixture-source-history.test.mjs"
	, "tests/fin-container-edge-integration-history.test.mjs"
	, "tests/fin-dispatch-guides.test.mjs"
	, "tests/helpers/fin-container-edge-ci-history-tests.mjs"
	, "tests/helpers/fin-container-foreign-history-tests.mjs"
	, "tests/helpers/fin-native-hosted-promotion-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-ci-isolation.mjs"
	, "tests/helpers/php-wasm-fin-direct-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-history.mjs"
	, "tests/native-ci-isolation.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseFinCoreRepairUpdate = (source, update) => {
	assert.ok(finCoreRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFinCoreRepairSource = (path, source, expected) => {
	if(typeof source !== "string" || !finCoreRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finCoreRepairHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinCoreRepairUpdate(source, update) : source;
};
