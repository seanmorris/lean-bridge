/**
 * Keep shipped NuGet identities exact when comparing repeated C# consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertRepeatedDotnetFamilies } from "./helpers/dotnet-repeat-observations.mjs";
import { assertDotnetFamilyRegressionEvidence } from "./helpers/dotnet-installed-regressions.mjs";

const original = async () => JSON.parse(await readFile("docs/evidence/dotnet-recursive-family-regressions-20260923.json")).runs;

test("C# repeated-family comparison isolates test-consumer digests and preserves original reports", async () => {
	const previous = await original(), snapshot = structuredClone(previous);
	assertRepeatedDotnetFamilies(previous, previous);
	const current = structuredClone(previous);
	for(const run of current.aliases.executions)
		for(const name of ["Consumer.dll", "Consumer.pdb"])
			run.installed.deployment[name].sha256 = "0".repeat(64);
	current.aliases.executionsSha256 = sha256(canonicalJson(current.aliases.executions));
	for(const run of current.collections.executions)
		run.installedSnapshot[".nupkg.metadata"].sha256 = "0".repeat(64);
	current.collections.executionsSha256 = sha256(canonicalJson(current.collections.executions));
	for(const run of current.variants.executions)
	{
		run.nativeFaults.executableSha256 = "0".repeat(64);
		run.nativeFaults.startupLeakBaseline.report = run.nativeFaults.startupLeakBaseline.report.replace(/\/tmp\/lean-bridge-dotnet-variant-author-[A-Za-z0-9]+/g, "/tmp/lean-bridge-dotnet-variant-author-NewRun");
	}
	current.variants.executionsSha256 = sha256(canonicalJson(current.variants.executions));
	assertRepeatedDotnetFamilies(current, previous);
	current.aliases.executionsSha256 = "0".repeat(64);
	assert.throws(() => assertRepeatedDotnetFamilies(current, previous));
	assert.deepEqual(previous, snapshot);
});

test("C# repeated-family comparison rejects changed packages, callers, runtimes and failure coverage", async () => {
	const previous = await original();
	for(const change of [
		runs => { delete runs.callables; }
		, runs => { runs.aliases.executions.pop(); }
		, runs => { runs.aliases.executions[0].profile = "java"; }
		, runs => { runs.aliases.executions[0].checks--; }
		, runs => { runs.aliases.executions[0].consumerSha256 = "0".repeat(64); }
		, runs => { runs.aliases.executions[0].installed.assemblySha256 = "0".repeat(64); }
		, runs => { runs.aliases.executions[0].installed.deployment["Consumer.dll"].bytes++; }
		, runs => { runs.aliases.executions[0].installed.deployment["Consumer.pdb"].sha256 = "invalid"; }
		, runs => { runs.aliases.executions[0].installed.deployment["Extra.dll"] = { bytes: 1, sha256: "0".repeat(64) }; }
		, runs => { runs.aliases.executions[0].installed.sourceFreeExecutions--; }
		, runs => { runs.aliases.executions[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, runs => { runs.callables.executions[0].installed.compilerSha256 = "0".repeat(64); }
		, runs => { runs.collections.executions[0].faults.native.liveAllocations++; }
		, runs => { runs.collections.executions[0].installedSnapshot[".nupkg.metadata"].bytes++; }
		, runs => { runs.collections.executions[0].installedSnapshot[".nupkg.metadata"].sha256 = "invalid"; }
		, runs => { runs.collections.executions[0].installedSnapshot["lean.collections.1.0.0.nupkg"].sha256 = "0".repeat(64); }
		, runs => { runs.collections.executions[0].installedSnapshot["lean.collections.1.0.0.nupkg.sha512"].sha256 = "0".repeat(64); }
		, runs => { runs.variants.executions[0].nativeFaults.allocationFailures--; }
		, runs => { runs.variants.executions[0].nativeFaults.adapterSha256 = "0".repeat(64); }
		, runs => { runs.variants.executions[0].nativeFaults.probeAdapterSha256 = "0".repeat(64); }
		, runs => { runs.variants.executions[0].nativeFaults.consumerSha256 = "0".repeat(64); }
		, runs => { runs.variants.executions[0].nativeFaults.executableSha256 = "invalid"; }
		, runs => { runs.variants.executions[0].nativeFaults.sanitizers.pop(); }
		, runs => { runs.variants.executions[0].nativeFaults.realLeanExecution = false; }
		, runs => { runs.variants.executions[0].nativeFaults.startupLeakBaseline.report += "\nnew failure"; }
	]) {
		const changed = structuredClone(previous); change(changed);
		for(const run of Object.values(changed)) run.executionsSha256 = sha256(canonicalJson(run.executions));
		assert.throws(() => assertRepeatedDotnetFamilies(changed, previous));
	}
});

test("fresh C# family evidence binds current executed sources, original packages and complete gates", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-current-family-regressions-20260924.json"));
	await assertDotnetFamilyRegressionEvidence(record);
	for(const change of [
		run => { run.previous.sha256 = "0".repeat(64); }
		, run => { run.previous.path = "docs/evidence/dotnet-recursive-packages-20260923.json"; }
		, run => { delete run.sourceHashes["src/backends/managed/package-audit.mjs"]; }
		, run => { run.sourceHashes["src/backends/managed/package-audit.mjs"] = "0".repeat(64); }
		, run => { delete run.verifierSources["tests/helpers/dotnet-repeat-observations.mjs"]; }
		, run => { run.verifierSources["tests/helpers/dotnet-repeat-observations.mjs"] = "0".repeat(64); }
		, run => { run.packageGlibcFloor = "2.36"; }
		, run => { run.wordBits = 32; }
		, run => { run.finalAcceptance = true; }
		, run => { run.runs.variants.executions.pop(); }
		, run => { run.runs.collections.executions[0].checks--; }
		, run => { run.log.text = run.log.text.replace("# skipped 0", "# skipped 1"); }
		, run => { run.log.text = run.log.text.replaceAll("installed .NET variants", "different test"); }
	]) {
		const changed = structuredClone(record); change(changed);
		for(const run of Object.values(changed.runs)) run.executionsSha256 = sha256(canonicalJson(run.executions));
		changed.log.sha256 = sha256(changed.log.text);
		await assert.rejects(() => assertDotnetFamilyRegressionEvidence(changed));
	}
});
