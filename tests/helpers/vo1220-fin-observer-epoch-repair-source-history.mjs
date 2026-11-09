/**
 * Authenticate the strict-host current/historical Fin observer epoch repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220FinObserverEpochRepairHistoryPath
	= "docs/evidence/vo1220-fin-observer-epoch-repair-source-history-20261109.json";
export const vo1220FinObserverEpochRepairPredecessor
	= "79b095a007e0f592e9f8acd9531d03efbdad387d";
export const vo1220FinObserverEpochRepairImplementation
	= "1f2ba9fd5a4b7d53ecaa45341eadeaf4575584da";
export const vo1220FinObserverEpochRepairImplementationPaths
	= Object.freeze([
		"tests/fin-container-edge-report.test.mjs"
		, "tests/helpers/fin-container-edge-measured-evidence-tests.mjs"
		, "tests/helpers/fin-container-edge-report-fixtures.mjs"
		, "tests/helpers/fin-container-edge-report-hosts.mjs"
		, "tests/helpers/fin-container-edge-report.mjs"
		, "tests/helpers/fin-container-foreign-measured-evidence-tests.mjs"
		, "tests/helpers/fin-container-hosted.mjs"
	]);
export const vo1220FinObserverEpochRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220FinObserverEpochRepairNormalizationPaths
	= Object.freeze([
		...vo1220FinObserverEpochRepairImplementationPaths
		, ...vo1220FinObserverEpochRepairIntegrationPaths
	]);
export const vo1220FinObserverEpochRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-fin-observer-epoch-repair-source-history.mjs"
		, "tests/helpers/vo1220-fin-observer-epoch-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-fin-observer-epoch-repair-source-history.mjs"
	]);
export const vo1220FinObserverEpochRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, measurementSemanticChanges: 0, testContractChanges: 1
	, strictHostProfiles: 3, observerEpochs: 2, uncheckedObserverEpochs: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220FinObserverEpochRepairHistoryPath, "utf8"
));

/**
 * Require exact current and historical observer contracts with no unchecked epoch.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220FinObserverEpochRepair = sources => {
	for(const path of vo1220FinObserverEpochRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const hosts = sources["tests/helpers/fin-container-edge-report-hosts.mjs"];
	assert.match(hosts, /finContainerEdgeGdbBaseScript, finContainerEdgeGdbScript/u);
	assert.match(hosts, /\["current", "historical-base"\][.]includes\(strictHostObserver\)/u);
	assert.match(hosts, /assertFinHostProcessExit\(manifest[.]processExit, manifest[.]pid\)/u);
	assert.match(hosts, /historical base observers cannot acquire new exit observations/u);
	assert.match(hosts, /strictHostObserver === "current"\s*\? finContainerEdgeGdbScript : finContainerEdgeGdbBaseScript/u);
	const report = sources["tests/helpers/fin-container-edge-report.mjs"];
	assert.match(report, /strictHostObserver = "current"/u);
	assert.match(report, /\["current", "historical-base"\][.]includes\(strictHostObserver\)/u);
	const fixtures = sources["tests/helpers/fin-container-edge-report-fixtures.mjs"];
	assert.match(fixtures, /manifest[.]processExit = \{\s*schemaVersion: 1, kind: "gdb-exit", pid, code: 0/u);
	for(const path of [
		"tests/helpers/fin-container-edge-measured-evidence-tests.mjs"
		, "tests/helpers/fin-container-foreign-measured-evidence-tests.mjs"
		, "tests/helpers/fin-container-hosted.mjs"
	]) assert.match(sources[path], /strictHostObserver: "historical-base"/u);
	assert.match(sources["tests/helpers/fin-container-hosted.mjs"]
		, /finContainerEdgeJvmExpectedBeforeOptionNullEntry/u);
	const controls = sources["tests/fin-container-edge-report.test.mjs"];
	assert.match(controls
		, /strict hosts require current exit receipts or an explicit receipt-free historical observer/u);
	for(const value of ["null", '""', '"none"', '"current-or-historical"'])
		assert.ok(controls.includes(value), value);
	return { ...vo1220FinObserverEpochRepairBehavior };
};

/**
 * Reverse one authenticated observer-epoch transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220FinObserverEpochRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220FinObserverEpochRepairNormalizationPaths
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
 * Remove only this observer-epoch repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220FinObserverEpochRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220FinObserverEpochRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220FinObserverEpochRepairUpdate(current, update);
	}
	return current;
};
