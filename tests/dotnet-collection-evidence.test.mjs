/**
 * Bind original installed NuGet collections to public callers and cleanup checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";

test("NuGet collection evidence binds original packages, public signatures and failure cleanup", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-collections-20260922.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["dotnet"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures)));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const negatives = JSON.parse(await readFile("tests/fixtures/collection-consumers/dotnet-invalid.json"));
	const guide = (await readFile("docs/consume/dotnet.md", "utf8")).split("### Arrays and records\n")[1].split("\n### ")[0];
	for(const run of record.executions)
	{
		assert.equal(run.profile, "dotnet"); assert.equal(run.checks, 660970);
		assert.equal(run.calls, 3364); assert.equal(run.rejected, 57);
		assert.equal(run.primitiveShapes, 19); assert.equal(run.recordTypes, 7);
		assert.equal(run.fixedArrayDepth, 24); assert.equal(run.threadedCalls, 512);
		assert.equal(run.publicCallerSha256, record.sourceHashes["tests/fixtures/collection-consumers/dotnet.cs"]);
		for(const key of ["offlineInstall", "emptyNuGetCache", "onlyPreparedDependency", "handoffRemovedBeforeExecution", "installedFilesUnchanged", "relocatedExecution", "sdkFreeExecution", "installedSourcesRemoved", "repeatExecution", "sourceRemovedBeforeInstallation"])
			assert.equal(run[key], true, key);
		assert.equal(run.sourceFreeExecutions, 2);
		assert.equal(run.runtimeVersion, "8.0.30"); assert.equal(run.fxrVersion, "8.0.30");
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "installedReceiptSha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(Object.keys(run.installedSnapshot).length, 32);
		assert.equal(Object.keys(run.nativeLibraries).length, 4);
		for(const [path, file] of Object.entries(run.nativeLibraries))
		{
			assert.deepEqual(run.installedFiles[path], file);
			assert.deepEqual(run.installedSnapshot[path], file); assert.deepEqual(run.deployment[path], file);
		}
		const typed = run.publicTypes;
		assert.equal(typed.executed, true); assert.equal(typed.sdk, "8.0.424");
		assert.match(typed.compilerSha256, /^[a-f0-9]{64}$/);
		assert.equal(typed.assemblySha256, run.installedFiles["lib/net8.0/LeanBridge.Collections.dll"].sha256);
		assert.equal(typed.assemblySha256, run.deployment["LeanBridge.Collections.dll"].sha256);
		assert.equal(typed.rejectionSourceSha256, record.sourceHashes["tests/fixtures/collection-consumers/dotnet-invalid.json"]);
		assert.deepEqual(typed.rejected, negatives.map(({ name, statement, code }) => ({
			name, code
			, sourceSha256: sha256(`using LeanBridge.Collections; static class Invalid { static void Test() { ${statement} } }\n`) })));
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "nuget"); assert.equal(pkg.ecosystem, "nuget");
		assert.equal(pkg.name, "Lean.Collections"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/Lean.Collections.1.0.0.nupkg");
		assert.deepEqual(run.installedSnapshot["lean.collections.1.0.0.nupkg"], { bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 });
		const faults = run.faults;
		assert.deepEqual(faults.host, { mode: "host", checkpoints: 391, partialInputChecks: 64, nativeExecuted: false, liveAllocations: 0 });
		assert.deepEqual(faults.native, { mode: "native", checkpoints: 551, partialInputChecks: 64, nativeExecuted: true, liveAllocations: 0 });
		assert.equal(faults.isolatedInstrumentedProjection, true);
		assert.deepEqual(faults.replacements, [178, 1, 1, 1, 35, 32]);
		for(const [file, key] of [["Api.cs", "apiSourceSha256"], ["Runtime.cs", "runtimeSourceSha256"]])
			assert.equal(faults[key], run.installedFiles[`lean-bridge/dotnet/src/LeanBridge.Collections/${file}`].sha256);
		assert.equal(faults.probeSourceSha256, record.sourceHashes["tests/fixtures/collection-consumers/dotnet-faults.cs"]);
		assert.match(faults.instrumentedRuntimeSha256, /^[a-f0-9]{64}$/);
		assert.deepEqual(run.nativeLibraries, record.executions.find(other => other.path !== run.path).nativeLibraries);
		assert.equal(run.documentation.sourceSha256, sha256(guide.match(/```csharp\n([^]*?)\n```/)[1] + "\n"));
		assert.equal(run.documentation.stdout, "3, 2, 1\n1, 2, 3\n42\nTrue\n");
		assert.equal(run.documentation.assemblySha256, typed.assemblySha256);
		for(const key of ["sourceFreeExecution", "sdkFreeExecution", "deploymentUnchanged"]) assert.equal(run.documentation[key], true);
	}
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "installedFilesIdentical", "publicObservationsIdentical"])
		assert.equal(record.reproduction[key], true);
	assert.equal(record.reproduction.runs.length, 2);
	for(const previous of record.reproduction.runs)
	{
		const run = record.executions.find(run => run.path === previous.path); assert.ok(run);
		assert.equal(previous.installedFilesSha256, sha256(canonicalJson(run.installedFiles)));
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.observationsSha256, sha256(canonicalJson({ checks: run.checks, calls: run.calls, rejected: run.rejected, faults: run.faults })));
	}
	const { firstLog, secondLog } = record.reproduction;
	assert.notEqual(firstLog.sha256, secondLog.sha256);
	for(const log of [firstLog, secondLog])
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0/);
		assert.match(log.text, /# ordinary-source: compiling .NET collections/);
		assert.match(log.text, /# reviewed-ir: compiling .NET collections/);
	}
	assert.doesNotMatch(await readFile("tests/fixtures/collection-consumers/dotnet.cs", "utf8"), /unsafe\s*\{|DllImport|Marshal\.|Interop\./);
});

test("C# host-only conversion and equality checks do not claim installed Lean executions", async () => {
	const { conversion, equality } = JSON.parse(await readFile("docs/evidence/dotnet-collections-20260922.json"));
	for(const report of [conversion, equality])
	{ assert.equal(report.compiledLean, false); assert.equal(report.installedPackage, false); }
	assert.deepEqual(conversion.observation, { checks: 21709, rejected: 97, primitiveShapes: 19, records: 7, fixedArrayDepth: 24 });
	assert.equal(conversion.publicCallerCompiled, true); assert.equal(conversion.publicCallerExecuted, false);
	assert.equal(conversion.publicCallerSha256, sha256(await readFile("tests/fixtures/collection-consumers/dotnet.cs")));
	assert.equal(conversion.nativeFaultsCompiled, true); assert.equal(conversion.nativeFaultsExecuted, false);
	assert.equal(conversion.fixtureSha256, sha256(await readFile("tests/fixtures/collection-consumers/dotnet-conversions.cs")));
	assert.equal(equality.fixtureSha256, sha256(await readFile("tests/fixtures/collection-consumers/dotnet-equality.cs")));
	assert.deepEqual(equality.observation, { checks: 3246, fixedArrayDepth: 24, generatedProfiles: 5, nativeCalls: 0 });
});

test("NuGet collections advance only copied reviewed cells and require original CI artifacts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("dotnet-collections-installed"));
	assert.equal(observed.length, 22);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "dotnet"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["dotnet-collections-installed"]); }
	}
	for(const cell of cells.filter(cell => cell.profile === "dotnet" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const [flag, file, report] of [["COLLECTION", "dotnet-collections", "collections/dotnet"], ["CONVERSION", "dotnet-collection-conversions", "collections/dotnet-conversions"], ["EQUALITY", "dotnet-value-equality", "equality/dotnet"]])
	{
		assert.ok(workflow.includes(`LEAN_BRIDGE_DOTNET_${flag}_TEST=1 node --test tests/${file}.test.mjs`));
		assert.ok(workflow.includes(`test -s build/${report}.json`));
		assert.ok(workflow.split("path: |\n").some(block => block.includes(`build/${report}.json`)));
	}
});
