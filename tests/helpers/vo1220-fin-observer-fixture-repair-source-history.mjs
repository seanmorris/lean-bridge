/**
 * Authenticate the current Fin observer fixture repair exposed by hosted Core.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220FinObserverFixtureRepairHistoryPath
	= "docs/evidence/vo1220-fin-observer-fixture-repair-source-history-20261109.json";
export const vo1220FinObserverFixtureRepairPredecessor
	= "16f009557062127c683c45d002cc5c43b301f5d7";
export const vo1220FinObserverFixtureRepairImplementation
	= "d20d3e0515f31f283dc6716bf58d3bf3f68fae14";
export const vo1220FinObserverFixtureRepairImplementationPaths
	= Object.freeze(["tests/fin-container-entry-ci.test.mjs"]);
export const vo1220FinObserverFixtureRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220FinObserverFixtureRepairNormalizationPaths
	= Object.freeze([
		...vo1220FinObserverFixtureRepairImplementationPaths
		, ...vo1220FinObserverFixtureRepairIntegrationPaths
	]);
export const vo1220FinObserverFixtureRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-fin-observer-fixture-repair-source-history.mjs"
		, "tests/helpers/vo1220-fin-observer-fixture-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-fin-observer-fixture-repair-source-history.mjs"
	]);
export const vo1220FinObserverFixtureRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, measurementSemanticChanges: 0, testContractChanges: 1
	, currentSourcePaths: 0, refreshedPins: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220FinObserverFixtureRepairHistoryPath, "utf8"
));

/**
 * Require the current fixture to refresh debugger identity by instrument kind.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220FinObserverFixtureRepair = sources => {
	const source = sources["tests/fin-container-entry-ci.test.mjs"];
	assert.equal(typeof source, "string");
	assert.match(source, /const scripts = \{ "gdb-breakpoints": sources[.]strictScript/u);
	assert.match(source, /"gdb-breakpoints-extracted-root": sources[.]extractedScript/u);
	assert.match(source
		, /if\(Object[.]hasOwn\(scripts, host[.]instrument\)\) host[.]scriptSha256 = scripts\[host[.]instrument\]/u);
	assert.doesNotMatch(source
		, /if\(\["java", "kotlin"\][.]includes\(report[.]profile\)\)\s*\{\s*report[.]dispatch[.]public[.]scriptSha256/u);
	return { ...vo1220FinObserverFixtureRepairBehavior };
};

/**
 * Reverse one authenticated fixture-repair transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220FinObserverFixtureRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220FinObserverFixtureRepairNormalizationPaths
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
 * Remove only this fixture repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220FinObserverFixtureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220FinObserverFixtureRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220FinObserverFixtureRepairUpdate(
				current, update);
	}
	return current;
};
