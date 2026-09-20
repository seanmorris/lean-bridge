/**
 * .NET compound admission and closed typed public signatures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test(".NET compound evidence binds installed assemblies and separate cleanup probes on both paths", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/dotnet-compounds-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(evidence.signatures), sort(compoundSignatures));
	assert.deepEqual(evidence.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of evidence.runs)
	{
		assert.equal(run.profile, "dotnet"); assert.equal(run.checks, 41534);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/compound-consumers/dotnet.cs")));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, "nuget");
		for(const artifact of run.packages[0].artifacts) assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
		const installed = run.installed, faults = run.faults;
		assert.equal(installed.onlyPreparedDependency, true); assert.equal(installed.sourceFree, true);
		assert.equal(installed.sourceFreeExecutions, 2); assert.equal(installed.sourceFreeChecks, run.checks);
		assert.equal(installed.deployment["LeanBridge.Compounds.dll"].sha256, installed.assemblySha256);
		for(const field of ["compilerSha256", "assemblySha256", "packageReceiptSha256"]) assert.match(installed[field], /^[a-f0-9]{64}$/);
		assert.equal(installed.rejected.length, 12); assert.equal(new Set(installed.rejected.map(item => item.name)).size, 12);
		for(const rejected of installed.rejected)
		{
			assert.match(rejected.sourceSha256, /^[a-f0-9]{64}$/);
			assert.deepEqual(rejected.codes, [rejected.name.startsWith("mutable-") ? "CS0200" : rejected.name === "bare-result" ? "CS0029" : "CS1503"]);
		}
		assert.equal(faults.isolatedInstrumentedProjection, true); assert.equal(faults.releaseAssemblyUnchanged, true);
		assert.equal(faults.checks, 94); assert.equal(faults.flagChecks, 9); assert.equal(faults.partialInputChecks, 16);
		assert.equal(faults.probeSourceSha256, sha256(await readFile("tests/fixtures/compound-consumers/dotnet-faults.cs")));
		for(const field of ["apiSourceSha256", "runtimeSourceSha256", "instrumentedRuntimeSha256"]) assert.match(faults[field], /^[a-f0-9]{64}$/);
		assert.notEqual(faults.runtimeSourceSha256, faults.instrumentedRuntimeSha256);
	}
});

test(".NET compounds use typed value wrappers and native binary tuples", () => {
	const ir = compoundReviewedIr(), model = compileCopiedDotnetModel(ir), files = generateCopiedDotnetPackage(ir);
	assert.equal(model.surface.functions.length, 64);
	assert.deepEqual(files, generateCopiedDotnetPackage(structuredClone(ir)));
	assert.deepEqual(files, generateDotnetBindingPackage(ir));
	auditManagedBindingPackage(ir, files, "dotnet");
	const source = files["src/LeanBridge.Compounds/Api.cs"], native = files["src/LeanBridge.Compounds/Runtime.cs"];
	assert.match(source, /public readonly record struct Option<T>/);
	assert.match(source, /public readonly record struct Result<T, E>/);
	assert.match(source, /uint Classify\(Option<Option<Unit>>/);
	assert.match(source, /Result<Option<string>, \(uint, Option<Unit>\)> Flip\(Result<\(uint, Option<Unit>\), Option<string>>/);
	assert.doesNotMatch(source, /unsafe|DllImport|IntPtr|nint/);
	assert.match(native, /internal byte Flag/);
	assert.match(native, /Invalid native Option flag/); assert.match(native, /Invalid native Except flag/);
	assert.match(native, /default\(Result\) has no branch/);
	assert.match(native, /AllocateUninitializedArray<Option<Result<\(string, ulong\), \(byte\[\], global::System.Numerics.BigInteger\)>>>/);
});

for(const name of ["Option", "Result"]) test(`.NET compound ${name} cannot collide with a generated record`, () => {
	const ir = compoundReviewedIr(); ir.types.find(type => type.kind === "record").name = name;
	assert.throws(() => compileCopiedDotnetModel(ir), /record name collides/);
});

test(".NET compounds do not admit compound callables or borrowed copied identity", () => {
	const ir = callableReviewedIr();
	ir.types[0].callable.result.type = { kind: "apply", constructor: "option", arguments: [{ kind: "primitive", name: "unit" }] };
	assert.throws(() => compileCopiedDotnetModel(ir), /callbacks currently require copied primitive/);
	const borrowed = compoundReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedDotnetModel(borrowed), /copy ownership/);
});
