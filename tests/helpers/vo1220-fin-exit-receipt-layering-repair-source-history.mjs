/**
 * Authenticate the Fin host/JVM exit-receipt layering repair exposed by hosted Downstream.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220FinExitReceiptLayeringRepairHistoryPath
	= "docs/evidence/vo1220-fin-exit-receipt-layering-repair-source-history-20261109.json";
export const vo1220FinExitReceiptLayeringRepairPredecessor
	= "ad5a06a6cbbd03af13349ef99f09c4b4f5806782";
export const vo1220FinExitReceiptLayeringRepairImplementation
	= "b502a65c1a14fd20ca02ac5dbe7ff80625394616";
export const vo1220FinExitReceiptLayeringRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/fin-container-edge-gdb.mjs"
		, "tests/helpers/fin-container-edge-jvm-gdb.mjs"
		, "tests/helpers/fin-container-edge-jvm-wait-tests.mjs"
		, "tests/helpers/fin-container-edge-jvm-wait.mjs"
	]);
export const vo1220FinExitReceiptLayeringRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220FinExitReceiptLayeringRepairNormalizationPaths
	= Object.freeze([
		...vo1220FinExitReceiptLayeringRepairImplementationPaths
		, ...vo1220FinExitReceiptLayeringRepairIntegrationPaths
	]);
export const vo1220FinExitReceiptLayeringRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-fin-exit-receipt-layering-repair-source-history.mjs"
		, "tests/helpers/vo1220-fin-exit-receipt-layering-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-fin-exit-receipt-layering-repair-source-history.mjs"
	]);
export const vo1220FinExitReceiptLayeringRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, measurementSemanticChanges: 0, testContractChanges: 1
	, exitObserverKinds: 2, uncheckedExitObserverKinds: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220FinExitReceiptLayeringRepairHistoryPath, "utf8"
));

/**
 * Require a closed host/JVM selector with no unchecked observation mode.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220FinExitReceiptLayeringRepair = sources => {
	for(const path of vo1220FinExitReceiptLayeringRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const wait = sources["tests/helpers/fin-container-edge-jvm-wait.mjs"];
	assert.match(wait, /export const assertFinContainerEdgeObservedExit/u);
	assert.match(wait, /\["host", "jvm"\][.]includes\(observer\)/u);
	assert.match(wait
		, /assertFinHostProcessExit\(manifest[.]processExit, pid\)/u);
	assert.match(wait
		, /assertFinContainerEdgeJvmExit\(manifest[.]jvmExit, pid\)/u);
	const edge = sources["tests/helpers/fin-container-edge-gdb.mjs"];
	assert.match(edge, /\{ exitObserver = "host" \} = \{\}/u);
	assert.match(edge
		, /assertFinContainerEdgeObservedExit\(manifest, manifest[.]pid, exitObserver\)/u);
	const jvm = sources["tests/helpers/fin-container-edge-jvm-gdb.mjs"];
	assert.match(jvm
		, /assertFinContainerEdgeGdbRun\(observer, run, rows, \{ exitObserver: "jvm" \}\)/u);
	assert.doesNotMatch(jvm
		, /Object[.]hasOwn\(manifest, "jvmExit"\)/u);
	const controls = sources[
		"tests/helpers/fin-container-edge-jvm-wait-tests.mjs"
	];
	assert.match(controls
		, /edge observers require exactly their own host or JVM exit receipt/u);
	for(const value of ["undefined", "null", '"none"', '"host-or-jvm"'])
		assert.ok(controls.includes(value), value);
	return { ...vo1220FinExitReceiptLayeringRepairBehavior };
};

/**
 * Reverse one authenticated exit-receipt layering transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220FinExitReceiptLayeringRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220FinExitReceiptLayeringRepairNormalizationPaths
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
 * Remove only this layering repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220FinExitReceiptLayeringRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220FinExitReceiptLayeringRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220FinExitReceiptLayeringRepairUpdate(
				current, update);
	}
	return current;
};
