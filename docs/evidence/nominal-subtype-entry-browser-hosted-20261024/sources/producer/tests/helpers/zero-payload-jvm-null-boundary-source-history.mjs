/**
 * Reverse the zero-payload JVM public-carrier null-boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadJvmNullBoundaryHistoryPath
	= "docs/evidence/zero-payload-jvm-null-boundary-source-history-20261021.json";
export const zeroPayloadJvmNullBoundaryPredecessor
	= "7fe7c5d805361495603c26a32f7a9a3a5dea02a0";
export const zeroPayloadJvmNullBoundaryImplementation
	= "9a9f04c2b019695d66912d4647ef6e813a552e92";
export const zeroPayloadJvmNullBoundaryChangedPaths = Object.freeze([
	"src/backends/jvm/copied-kotlin.mjs"
	, "src/backends/jvm/copied-model.mjs"
	, "src/backends/jvm/copied-values.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-fixture-tests.mjs"
	, "tests/jvm-kotlin-contract.test.mjs"
	, "docs/type-surface.v1.json"
]);
export const zeroPayloadJvmNullBoundaryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/zero-payload-checked-record-jvm.test.mjs"
]);
export const zeroPayloadJvmNullBoundaryHistoricalPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadJvmNullBoundaryHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact JVM null-boundary repair.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadJvmNullBoundaryUpdate = (source, update) => {
	assert.ok([...zeroPayloadJvmNullBoundaryChangedPaths
		, ...zeroPayloadJvmNullBoundaryIntegrationPaths
		, ...zeroPayloadJvmNullBoundaryHistoricalPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this JVM public-carrier repair from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadJvmNullBoundarySource = (
	path, source, expected
) => {
	const paths = [...zeroPayloadJvmNullBoundaryChangedPaths
		, ...zeroPayloadJvmNullBoundaryIntegrationPaths
		, ...zeroPayloadJvmNullBoundaryHistoricalPaths];
	if(typeof source !== "string" || !paths.includes(path))
		return source;
	let current = source;
	const updates = [...record().updates, ...record().integrationUpdates
		, ...record().historicalTransitions.flatMap(item => item.updates)];
	const seen = new Set();
	while(sha256(current) !== expected)
	{
		const digest = sha256(current);
		assert.ok(!seen.has(digest), `Cyclic JVM null-boundary history at ${digest}`);
		seen.add(digest);
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) break;
		current = reverseZeroPayloadJvmNullBoundaryUpdate(current, update);
	}
	return current;
};
