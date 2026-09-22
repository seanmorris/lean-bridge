/**
 * Execute generated public C# value equality without native libraries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("generated C# values compare nested payloads and hash by value without loading Lean", { skip: process.env.LEAN_BRIDGE_DOTNET_EQUALITY_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-value-equality-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sourceHashes = {};
	for(const fixture of [collectionReviewedIr, compoundReviewedIr, listReviewedIr, nativeAliasReviewedIr, nativeVariantReviewedIr])
	{
		const files = generateCopiedDotnetPackage(fixture());
		for(const [path, source] of Object.entries(files).filter(([path]) => path.endsWith(".cs")))
		{ await saveLakeFile(root, path, source); sourceHashes[path] = sha256(source); }
	}
	await saveLakeFile(root, "Equality.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const source = await readFile("tests/fixtures/collection-consumers/dotnet-equality.cs", "utf8");
	await saveLakeFile(root, "Program.cs", source);
	const environment = nativeFixtureEnvironment(["dotnet"]), dotnet = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(dotnet, ["build", "Equality.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	const result = await runCopied(dotnet, ["out/Equality.dll"], root, env);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks > 2000); assert.equal(observation.generatedProfiles, 5);
	assert.equal(observation.fixedArrayDepth, 24); assert.equal(observation.nativeCalls, 0);
	await saveLakeFile("build/equality", "dotnet.json", canonicalJson({ schemaVersion: 1
		, kind: "dotnet-value-equality-preflight"
		, compiledLean: false, installedPackage: false
		, fixtureSha256: sha256(source), generatedSourceHashes: sourceHashes
		, observation }));
	t.diagnostic(`${observation.checks} public equality/hash checks across five generated C# projections; no native library loaded`);
});
