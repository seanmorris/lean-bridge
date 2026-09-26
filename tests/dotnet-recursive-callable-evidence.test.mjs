/**
 * Reject unsupported recursive C# claims and unknown source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertDotnetRecursiveCallableExecution, assertDotnetRecursiveCallableIntegration, dotnetRecursiveCallableExecutionPath } from "./helpers/dotnet-recursive-callable-evidence.mjs";
import { beforeDotnetRecursiveCallables, dotnetRecursiveCallableHistoryPath, reverseDotnetRecursiveCallableUpdate } from "./helpers/dotnet-recursive-callable-source-history.mjs";
import { assertDotnetRecursiveProbes } from "./helpers/dotnet-recursive-callable-faults.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("recursive C# acceptance adds exactly four cells and preserves authenticated history", async () => {
	await assertDotnetRecursiveCallableIntegration(await json(dotnetRecursiveCallableHistoryPath));
});

test("recursive C# receipts require original packages, both source paths and SDK-free consumers", async () => {
	const original = await json(dotnetRecursiveCallableExecutionPath);
	await assertDotnetRecursiveCallableExecution(original);
	for(const change of [
		record => { record.reports.pop(); }
		, record => { record.mixedReports.pop(); }
		, record => { record.reports[0].sdkFree = false; }
		, record => { record.reports[0].producerRemovedBeforeInstall = false; }
		, record => { record.reports[0].onlyPreparedDependency = false; }
		, record => { record.reports[0].handoffRemoved = false; }
		, record => { record.reports[0].installedUnchanged = false; }
		, record => { record.reports[0].public.checks--; }
		, record => { record.reports[0].acyclic.checks--; }
		, record => { record.reports[0].documentation.consumerSha256 = "0".repeat(64); }
		, record => { record.reports[0].packages[0].target = "c"; }
		, record => { record.reports[0].installedFiles["lean.structured.1.0.0.nupkg"] = "0".repeat(64); }
		, record => { record.reports[0].originalRecursive.originalAssemblySha256 = "0".repeat(64); }
		, record => { record.reports[0].originalRecursive.sourceFree = false; }
		, record => { record.reports[0].originalRecursive.sdkFree = false; }
		, record => { record.reports[0].originalRecursive.example = "20\n19\n"; }
		, record => { record.reports[0].originalRecursive.deployment["LeanBridge.Structured.dll"] = "0".repeat(64); }
		, record => { record.reports[0].tamperChecks.pop(); }
		, record => { record.reports[0].tamperChecks[0].cold.checks--; }
		, record => { record.mixedReports[0].mixed.checks--; }
		, record => { record.mixedReports[0].mixed.sourceSha256 = "0".repeat(64); }
		, record => { record.regressions.primitive.reports.pop(); }
		, record => { record.regressions.structured.reports.pop(); }
		, record => { record.regressions.copied.reports.reproducibility.observations[0].archiveSha256 = "0".repeat(64); }
		, record => { record.regressions.copied.installed.exitCode = 1; }
		, record => { delete record.regressions.projectionSources["src/build/native-graph-projection.mjs"]; }
		, record => { record.installed.command += " --import staging.mjs"; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertDotnetRecursiveCallableExecution(changed));
	}
});

test("recursive C# probes require every failure path, ownership mutation and typed rejection", async () => {
	const original = (await json(dotnetRecursiveCallableExecutionPath)).reports[0].probes;
	assertDotnetRecursiveProbes(original);
	for(const change of [
		record => { record.recursive.nesting--; }
		, record => { record.recursive.layout--; }
		, record => { record.lifetimes.capacity--; }
		, record => { record.lifetimes.finalized = false; }
		, record => { record.lifetimes.identities++; }
		, record => { record.authenticatedLoaderRetained = false; }
		, record => { record.installedAssetIsolation = false; }
		, record => { record.structuredTypes.rejected.pop(); }
		, record => { record.recursiveTypes.rejected.pop(); }
		, record => { record.recursiveTypes.namedArgumentsCompile = false; }
		, record => { record.recursiveTypes.assemblySha256 = "0".repeat(64); }
		, record => { record.faults.shapes.pop(); }
		, record => { record.faults.shapes[0].seed = 1; }
		, record => { delete record.faults.shapes[0].paths["create-call"]; }
		, record => { record.faults.shapes[0].paths.callback.checkpoints = 0; }
		, record => { record.faults.shapes[0].paths.callback.hostAllocations--; }
		, record => { record.faults.shapes[0].paths.callback.nativeAllocations--; }
		, record => { record.faults.faults--; }
		, record => { record.faults.identities++; }
		, record => { record.faults.deferred--; }
		, record => { record.poison.retired--; }
		, record => { record.poison.clears++; }
		, record => { record.ownership.baseline.checkedBeforeDecode = false; }
		, record => { record.ownership["reply-scope"].errors.pop(); }
		, record => { record.ownership.retirement.exitCode = 139; }
		, record => { record.ownership.retirement.stderr = "unrelated failure"; }
		, record => { record.instrumentedAdapterSha256 = record.originalAdapterSha256; }
		, record => { record.baselineSources["Calls.cs"] = "0".repeat(64); }
		, record => { record.instrumentedSources["Api.cs"] = "0".repeat(64); }
		, record => { record.edits.returned--; }
		, record => { delete record.runtimeHeaders["include/lean_bridge_native_runtime.h"]; }
	]) {
		const changed = structuredClone(original); change(changed);
		assert.throws(() => assertDotnetRecursiveProbes(changed));
	}
});

test("recursive C# source transitions reject unknown bytes and substituted predecessors", async () => {
	for(const update of (await json(dotnetRecursiveCallableHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseDotnetRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeDotnetRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforeDotnetRecursiveCallables(update.path, source, update.currentSha256), source);
		const unrelated = source + "\n/* unrelated */\n";
		assert.equal(beforeDotnetRecursiveCallables(update.path, unrelated), unrelated);
		assert.throws(() => reverseDotnetRecursiveCallableUpdate(unrelated, update));
		assert.throws(() => reverseDotnetRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("CI requires recursive C# installs and preserves the complete per-ABI Perl suite", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const command = "LEAN_BRIDGE_DOTNET_RECURSIVE_CALLABLE_TEST=1 node --test tests/dotnet-recursive-callables.test.mjs";
	assert.equal(workflow.split(command).length, 3);
	assert.match(workflow, /test -s build\/recursive-callables\/dotnet\.json/u);
	assert.match(workflow, /^ {12}build\/recursive-callables\/dotnet\.json$/mu);
	const perl = (await readFile(".github/workflows/perl-consumer.yml", "utf8")).split("  perl:\n")[1].split("\n  combine:")[0];
	assert.match(perl, /^ {4}timeout-minutes: 90$/mu);
	for(const name of ["recursive-callables", "structured-callables", "graph-package", "copied-graph-conversions"])
		assert.ok(perl.includes(`tests/perl-${name}.test.mjs`));
});
