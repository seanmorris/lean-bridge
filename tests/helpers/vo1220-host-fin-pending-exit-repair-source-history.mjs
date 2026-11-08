/**
 * Authenticate the host Fin pending-exit measurement repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220HostFinPendingExitRepairHistoryPath
	= "docs/evidence/vo1220-host-fin-pending-exit-repair-source-history-20261108.json";
export const vo1220HostFinPendingExitRepairPredecessor
	= "8c16b68f552a785c4adf0b22513927de683bd916";
export const vo1220HostFinPendingExitRepairImplementation
	= "91d1b0ecc211409f9e21918e473eb25b76dd40a2";
export const vo1220HostFinPendingExitRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/fin-container-dispatch-gdb.mjs"
		, "tests/helpers/fin-container-edge-gdb.mjs"
		, "tests/helpers/fin-container-edge-jvm-gdb.mjs"
		, "tests/helpers/fin-container-edge-jvm-wait-tests.mjs"
		, "tests/helpers/fin-container-edge-jvm-wait.mjs"
		, "tests/helpers/fin-container-jvm-entry-wait.mjs"
		, "tests/helpers/native-fin-dispatch-gdb-run.mjs"
		, "tests/helpers/native-fin-dispatch-gdb-tests.mjs"
		, "tests/helpers/native-fin-dispatch-gdb.mjs"
		, "tests/ruby-fin.test.mjs"
	]);
export const vo1220HostFinPendingExitRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220HostFinPendingExitRepairNormalizationPaths
	= Object.freeze([
		...vo1220HostFinPendingExitRepairImplementationPaths
		, ...vo1220HostFinPendingExitRepairIntegrationPaths
	]);
export const vo1220HostFinPendingExitRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-host-fin-pending-exit-repair-source-history.mjs"
		, "tests/helpers/vo1220-host-fin-pending-exit-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-host-fin-pending-exit-repair-source-history.mjs"
	]);
export const vo1220HostFinPendingExitRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, measurementSemanticChanges: 1, kernelExitControls: 20
	, currentSourcePaths: 1, refreshedPins: 1
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220HostFinPendingExitRepairHistoryPath, "utf8"
));

/**
 * Require exact-child recovery, host-neutral receipts and the unchanged JVM specialization boundary.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220HostFinPendingExitRepair = sources => {
	for(const path of vo1220HostFinPendingExitRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const wrapper = sources["tests/helpers/fin-container-jvm-entry-wait.mjs"];
	for(const text of ["withFinHostProcessWait", "process_watch_exit()"
		, '"processExit"', "hostProcessWaitSupport"])
		assert.ok(wrapper.includes(text), text);
	const wait = sources["tests/helpers/fin-container-edge-jvm-wait.mjs"];
	assert.match(wait, /assertFinHostProcessExit/u);
	assert.match(wait, /assertFinContainerEdgeJvmExit/u);
	assert.match(wait, /os[.]WEXITED \| os[.]WNOHANG \| os[.]WNOWAIT/u);
	const scalar = sources["tests/helpers/native-fin-dispatch-gdb.mjs"];
	assert.match(scalar, /withFinHostProcessWait\(String[.]raw/u);
	const container = sources["tests/helpers/fin-container-dispatch-gdb.mjs"];
	assert.match(container, /finContainerGdbBaseScript = String[.]raw/u);
	assert.match(container
		, /finContainerGdbScript = withFinHostProcessWait\(finContainerGdbBaseScript\)/u);
	const edge = sources["tests/helpers/fin-container-edge-gdb.mjs"];
	assert.match(edge, /finContainerEdgeGdbBaseScript/u);
	assert.match(edge, /assertFinHostProcessExit\(manifest[.]processExit, manifest[.]pid\)/u);
	const jvm = sources["tests/helpers/fin-container-edge-jvm-gdb.mjs"];
	assert.match(jvm, /finContainerEdgeGdbBaseScript/u);
	assert.doesNotMatch(jvm, /replace\(finContainerEdgeGdbScript/u);
	for(const path of ["tests/helpers/native-fin-dispatch-gdb-run.mjs"
		, "tests/ruby-fin.test.mjs"])
		assert.match(sources[path]
			, /assertFinHostProcessExit\(manifest[.]processExit, manifest[.]pid\)/u, path);
	const controls = sources["tests/helpers/fin-container-edge-jvm-wait-tests.mjs"];
	assert.match(controls, /host-neutral wrapper preserves exact-child recovery/u);
	assert.match(controls, /assertFinHostProcessExit/u);
	return { ...vo1220HostFinPendingExitRepairBehavior };
};

/**
 * Reverse one authenticated pending-exit repair transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220HostFinPendingExitRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220HostFinPendingExitRepairNormalizationPaths
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
 * Remove only this exact pending-exit repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220HostFinPendingExitRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220HostFinPendingExitRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220HostFinPendingExitRepairUpdate(
				current, update);
	}
	return current;
};
