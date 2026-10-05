/**
 * Compile and execute actual C# copied-value adapters without a Lean library.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkDotnetCollectionTypes } from "./helpers/dotnet-collection-types.mjs";
import { dotnetCollectionIndices, dotnetCollectionProbe } from "./helpers/dotnet-collection-probes.mjs";

test("generated C# collection conversions validate copied values without loading Lean", { skip: process.env.LEAN_BRIDGE_DOTNET_CONVERSION_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-collection-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = collectionReviewedIr(), model = compileCopiedDotnetModel(ir), files = generateCopiedDotnetPackage(ir);
	const path = "src/LeanBridge.Collections", project = `${path}/LeanBridge.Collections.csproj`;
	for(const [path, content] of Object.entries(files))
		await saveLakeFile(root, path, path === project ? content.replace("<PropertyGroup>", "<PropertyGroup><OutputType>Exe</OutputType><StartupObject>Program</StartupObject><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit>") : content);
	const source = await readFile("tests/fixtures/collection-consumers/dotnet-conversions.cs", "utf8");
	await saveLakeFile(root, `${path}/Program.cs`, source);
	const publicSource = await readFile("tests/fixtures/collection-consumers/dotnet.cs", "utf8");
	await saveLakeFile(root, `${path}/PublicConsumer.cs`, publicSource);
	const indices = dotnetCollectionIndices(model);
	const environment = nativeFixtureEnvironment(["dotnet"]), dotnet = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(dotnet, ["build", project, "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	const result = await runCopied(dotnet, ["out/LeanBridge.Collections.dll", JSON.stringify(indices)], root, env);
	assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks > 10000); assert.ok(observation.rejected > 90);
	assert.equal(observation.primitiveShapes, 19); assert.equal(observation.records, 7); assert.equal(observation.fixedArrayDepth, 24);
	const publicTypes = await checkDotnetCollectionTypes({ root, dotnet, assembly: join(root, "out/LeanBridge.Collections.dll"), environment: env });
	const probe = await dotnetCollectionProbe({ api: files[`${path}/Api.cs`], runtime: files[`${path}/Runtime.cs`] });
	const probeRoot = join(root, "probe");
	await saveLakeFile(probeRoot, "Api.cs", files[`${path}/Api.cs`]); await saveLakeFile(probeRoot, "Runtime.cs", probe.runtime);
	await saveLakeFile(probeRoot, "Program.cs", probe.program);
	await saveLakeFile(probeRoot, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await runCopied(dotnet, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], probeRoot, env);
	const faults = await runCopied(dotnet, ["out/Probe.dll", "host", JSON.stringify(indices)], probeRoot, env);
	assert.equal(faults.stderr, ""); const hostFaults = JSON.parse(faults.stdout);
	assert.equal(hostFaults.mode, "host"); assert.ok(hostFaults.checkpoints > 200);
	assert.equal(hostFaults.partialInputChecks, 64); assert.equal(hostFaults.liveAllocations, 0); assert.equal(hostFaults.nativeExecuted, false);
	await saveLakeFile("build/collections", "dotnet-conversions.json", canonicalJson({ schemaVersion: 1
		, kind: "dotnet-collection-conversion-preflight"
		, compiledLean: false, installedPackage: false
		, observation, fixtureSha256: sha256(source)
		, publicCallerCompiled: true, publicCallerExecuted: false
		, publicCallerSha256: sha256(publicSource), publicTypes
		, nativeFaultsCompiled: true, nativeFaultsExecuted: false
		, hostFaults, probeSourceSha256: sha256(probe.program)
		, instrumentedRuntimeSha256: sha256(probe.runtime)
		, generatedSourceHashes: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) }));
	t.diagnostic(`${observation.checks} host-conversion checks, ${observation.rejected} rejections; no Lean library was loaded`);
});
