/**
 * Installed NuGet variants, independent contracts and original assembly identity.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";

test("NuGet variant evidence binds original assemblies to independent contracts and probes", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64); assert.deepEqual(record.profiles, ["dotnet"]);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.signatures, cVariantSignatures()); assert.deepEqual(record.types, cVariantReviewedIr().types);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(cVariantReviewedIr())));
	assert.equal(record.types.filter(type => type.kind === "variant").length, 7);
	assert.equal(record.types.flatMap(type => type.cases).length, 18);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const negatives = JSON.parse(await readFile("tests/fixtures/variant-consumers/dotnet-invalid.json"));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "dotnet"); assert.equal(run.checks, 209519);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/dotnet.cs"]);
		assert.equal(run.rejectionSourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/dotnet-invalid.json"]);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		const installed = run.installed;
		assert.equal(installed.onlyPreparedDependency, true); assert.equal(installed.sourceFree, true);
		assert.equal(installed.sourceFreeExecutions, 2); assert.equal(installed.sourceFreeChecks, 209519);
		assert.equal(installed.sdk, "8.0.424"); assert.equal(installed.runtimeVersion, "8.0.30"); assert.equal(installed.fxrVersion, "8.0.30");
		for(const key of ["compilerSha256", "assemblySha256", "packageReceiptSha256"]) assert.match(installed[key], /^[a-f0-9]{64}$/);
		assert.equal(installed.assemblySha256, run.installedFiles["lib/net8.0/LeanBridge.Variants.dll"].sha256);
		assert.equal(installed.assemblySha256, installed.deployment["LeanBridge.Variants.dll"].sha256);
		const libraries = files => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith("runtimes/")));
		assert.equal(Object.keys(libraries(installed.deployment)).length, 4);
		assert.deepEqual(libraries(installed.deployment), libraries(run.installedFiles));
		assert.equal(installed.rejected.length, negatives.length);
		for(const [index, entry] of installed.rejected.entries())
		{
			assert.equal(entry.name, negatives[index].name); assert.deepEqual(entry.codes, [negatives[index].code]);
			assert.equal(entry.sourceSha256, sha256(`using LeanBridge.Variants; static class Invalid { static void Test() { ${negatives[index].statement} } }`));
		}
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "nuget"); assert.equal(pkg.name, "Lean.Variants"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/Lean.Variants.1.0.0.nupkg");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		const faults = run.faults;
		assert.equal(faults.checks, 152); assert.equal(faults.partialInputChecks, 64);
		assert.equal(faults.malformedChecks, 13); assert.equal(faults.malformedTags, 7); assert.equal(faults.inactiveCases, 6);
		assert.equal(faults.isolatedInstrumentedProjection, true); assert.equal(faults.releaseAssemblyUnchanged, true);
		assert.deepEqual(faults.replacements, [66, 1, 1, 1, 14, 12]);
		assert.equal(faults.apiSourceSha256, run.installedFiles["lean-bridge/dotnet/src/LeanBridge.Variants/Api.cs"].sha256);
		assert.equal(faults.runtimeSourceSha256, run.installedFiles["lean-bridge/dotnet/src/LeanBridge.Variants/Runtime.cs"].sha256);
		assert.equal(faults.probeSourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/dotnet-faults.cs"]);
		assert.match(faults.instrumentedRuntimeSha256, /^[a-f0-9]{64}$/);
		const native = run.nativeFaults;
		assert.equal(native.checks, 1182); assert.equal(native.allocationFailures, 242); assert.equal(native.rejected, 70); assert.equal(native.malformedNativeTags, 1);
		assert.equal(native.syntheticTagInjection, true); assert.equal(native.realLeanExecution, true);
		assert.equal(native.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/native-probe.c"]);
		assert.deepEqual(native.sanitizers, ["address", "leak", "undefined"]);
		assert.equal(native.startupLeakBaseline.unchangedAfterConversions, true);
		assert.equal(native.startupLeakBaseline.bytes, 128); assert.equal(native.startupLeakBaseline.allocations, 12);
		assert.match(native.startupLeakBaseline.report, /__gmp_default_allocate/);
	}
	const source = await readFile("tests/fixtures/variant-consumers/dotnet.cs", "utf8");
	assert.doesNotMatch(source, /unsafe\s*\{|DllImport|Marshal\.|Interop\.|lean_obj_tag|lean_ctor_get/);
});

test("NuGet variants promote only six copied cells and require installed CI receipts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("dotnet-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "dotnet"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["dotnet-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_DOTNET_VARIANT_TEST=1 node --test tests\/dotnet-variants\.test\.mjs/);
	assert.match(workflow, /test -s build\/variants\/dotnet\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/dotnet\.json/);
});
