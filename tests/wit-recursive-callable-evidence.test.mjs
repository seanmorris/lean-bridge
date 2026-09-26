/**
 * Reject missing WIT executions, forged ownership results and source drift.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertWitRecursiveCallableExecution, assertWitRecursiveCallableIntegration, witRecursiveCallableExecutionPath } from "./helpers/wit-recursive-callable-evidence.mjs";
import { assertWitRecursiveCallablePackages } from "./helpers/wit-recursive-callable-receipt.mjs";
import { assertWitRecursiveNativeProbes, assertWitRecursiveFaultProbes } from "./helpers/wit-recursive-callable-probes.mjs";
import { beforeWitRecursiveCallables, reverseWitRecursiveCallableUpdate, witRecursiveCallableHistoryPath } from "./helpers/wit-recursive-callable-source-history.mjs";
import { beforeOwnedAggregates } from "./helpers/owned-aggregate-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("WIT recursive acceptance completes seventeen-profile callback coverage and preserves predecessors", async () => {
	await assertWitRecursiveCallableIntegration(await json(witRecursiveCallableHistoryPath));
});

test("WIT recursive acceptance requires original enabled executions and exact source identities", async () => {
	const original = await json(witRecursiveCallableExecutionPath);
	for(const change of [
		record => { record.generated.exitCode = 1; }
		, record => { record.installed.command += " --import substitute.mjs"; }
		, record => { record.generated.text += "edited"; }
		, record => { record.regressions.command = record.installed.command; }
		, record => { delete record.projectionSources["src/backends/wit/callable-graph-package.mjs"]; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertWitRecursiveCallableExecution(changed), change.toString());
	}
});

test("WIT recursive package records require original carriers, both source paths and independent callers", async () => {
	const original = (await json(witRecursiveCallableExecutionPath)).installed.reports.recursive;
	await assertWitRecursiveCallablePackages(original);
	for(const change of [
		record => { record.observations.pop(); }
		, record => { record.observations[0].checkedSourceUnchanged = false; }
		, record => { record.observations[0].documentation.compiledVerbatim = false; }
		, record => { record.observations[0].producerSources[0].sha256 = "0".repeat(64); }
		, record => { record.observations[0].receipt.headerSha256 = "0".repeat(64); }
		, record => { delete record.observations[0].adapter.files["include/detail/structured-callable-borrows.h"]; }
		, record => { record.observations[0].installed.compiled.files["include/structured_wasmtime.h"].sha256 = "0".repeat(64); }
		, record => { record.observations[0].installed.sourceAndHandoffRemovedBeforeExecution = false; }
		, record => { record.observations[0].installed.componentBase64 = "AA=="; }
		, record => { record.observations[0].installed.observations.pop(); }
		, record => { record.observations[0].installed.observations[0].values.rejections--; }
		, record => { record.observations[0].installed.observations[0].documentation.stdout = "wrong\n"; }
		, record => { record.observations[0].installed.resultFaults[0].runtimeRetired = false; }
		, record => { record.observations[0].installed.resultFaults.at(-1).runtimeRetired = true; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertWitRecursiveCallablePackages(changed), change.toString());
	}
	const mixed = (await json(witRecursiveCallableExecutionPath)).installed.reports.mixed;
	mixed.observations[0].installed.observations[0].primitives.wideUnit = 0;
	await assert.rejects(() => assertWitRecursiveCallablePackages(mixed, true));
});

test("WIT recursive probes retain unsuppressed startup controls and specific ownership failures", async () => {
	const original = (await json(witRecursiveCallableExecutionPath)).generated.reports;
	await assertWitRecursiveNativeProbes(original.native); assertWitRecursiveFaultProbes(original.faults);
	for(const change of [
		record => { record.observations.pop(); }
		, record => { record.installedPackage = true; }
		, record => { record.observations[0].sanitizerEnvironment.ASAN_OPTIONS = "detect_leaks=0"; }
		, record => { record.observations[0].sanitizerRuns.exercised.stderr += "extra leak"; }
		, record => { record.observations[0].values.sanitized.checks--; }
		, record => { record.observations[0].typed.startupLeakBaseline.unchangedAfterCalls = false; }
	]) {
		const changed = structuredClone(original.native); change(changed);
		await assert.rejects(() => assertWitRecursiveNativeProbes(changed), change.toString());
	}
	for(const change of [
		record => { record.compiledLean = true; }
		, record => { record.sanitized.live++; }
		, record => { record.observed.injected--; }
		, record => { record.diagnostics.sanitized = "runtime error"; }
		, record => { record.mutants[0].stderr = "unrelated failure"; }
		, record => { record.mutants[1].sourceSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original.faults); change(changed);
		assert.throws(() => assertWitRecursiveFaultProbes(changed), change.toString());
	}
});

test("WIT recursive source history rejects unknown text and overlapping edits", async () => {
	for(const update of (await json(witRecursiveCallableHistoryPath)).updates)
	{
		const current = await readFile(update.path, "utf8");
		const source = beforeOwnedAggregates(update.path, current);
		assert.equal(sha256(beforeWitRecursiveCallables(update.path, current)), update.previousSha256);
		assert.equal(sha256(reverseWitRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeWitRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforeWitRecursiveCallables(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeWitRecursiveCallables(update.path, unknown), unknown);
		assert.throws(() => reverseWitRecursiveCallableUpdate(unknown, update));
		assert.throws(() => reverseWitRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseWitRecursiveCallableUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
