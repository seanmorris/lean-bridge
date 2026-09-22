/**
 * Original offline NuGet collections, compiler rejections and runtime-only reruns.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkDotnetCollectionTypes } from "./dotnet-collection-types.mjs";
import { checkDotnetCollectionFaults } from "./dotnet-collection-probes.mjs";

const select = values => values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
const digest = async path => sha256(await readFile(path));
const snapshot = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));

/**
 * Install the exact archive, retain its hashes and run after removing all sources.
 *
 * @param options - Original package handoff and independent caller.
 * @param options.consumer - Task-owned temporary consumer root.
 * @param options.handoff - Verified package-set directory.
 * @param options.packages - Verified original package entries.
 * @param options.environment - Explicit .NET toolchain path.
 * @param options.sources - Hash-verified compiler-produced sources for isolated probes.
 * @param options.projection - Private layout names used only by failure probes.
 */
export const installDotnetCollections = async ({ consumer, handoff, packages, environment, sources, projection }) => {
	assert.equal(packages.length, 1);
	const pkg = packages[0]; assert.equal(pkg.role, "component"); assert.equal(pkg.ecosystem, "nuget");
	assert.equal(pkg.name, "Lean.Collections"); assert.equal(pkg.version, "1.0.0");
	const root = join(consumer, "dotnet"), feed = join(root, "feed"), cache = join(root, "packages");
	await mkdir(feed, { recursive: true }); await mkdir(cache);
	assert.deepEqual(await readdir(cache), []);
	const archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(await digest(archive), pkg.artifacts[0].sha256);
	await cp(archive, join(feed, `${pkg.name}.${pkg.version}.nupkg`));
	const source = await readFile("tests/fixtures/collection-consumers/dotnet.cs", "utf8");
	await saveLakeFile(root, "consumer.cs", source);
	await saveLakeFile(root, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const dotnet = await realpath(environment.LEAN_BRIDGE_DOTNET), dotnetRoot = dirname(dotnet);
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dotnetRoot, DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: cache, NUGET_HTTP_CACHE_PATH: join(root, "http-cache") };
	await runCopied(dotnet, ["restore", "--configfile", "NuGet.Config"], root, env);
	await runCopied(dotnet, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	const installed = join(cache, pkg.name.toLowerCase(), pkg.version);
	const receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json")), receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.namespace, "LeanBridge.Collections"); assert.equal(receipt.assembly, "LeanBridge.Collections");
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(await digest(join(installed, `${pkg.name.toLowerCase()}.${pkg.version}.nupkg`)), pkg.artifacts[0].sha256);
	const installedFiles = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path)));
	await verifyNativeFiles(installed, installedFiles);
	for(const [file, source] of [["Api.cs", sources.api], ["Runtime.cs", sources.runtime]])
		assert.equal(await readFile(join(installed, `lean-bridge/dotnet/src/LeanBridge.Collections/${file}`), "utf8"), source);
	const originalFiles = await snapshot(installed);
	const assets = JSON.parse(await readFile(join(root, "obj/project.assets.json")));
	assert.deepEqual(Object.keys(assets.libraries), [`${pkg.name}/${pkg.version}`]);
	assert.deepEqual(Object.keys(assets.project.restore.sources), [feed]);
	const publicTypes = await checkDotnetCollectionTypes({ root, dotnet, assembly: join(installed, "lib/net8.0/LeanBridge.Collections.dll"), environment: env });
	const guide = (await readFile("docs/consume/dotnet.md", "utf8")).split("### Arrays and records\n")[1].split("\n### ")[0];
	const example = guide.match(/```csharp\n([^]*?)\n```/)[1] + "\n";
	await saveLakeFile(root, "Example.cs", example);
	await saveLakeFile(root, "Example.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Example.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
	await runCopied(dotnet, ["restore", "Example.csproj", "--configfile", "NuGet.Config"], root, env);
	await runCopied(dotnet, ["build", "Example.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "example-out"], root, env);
	await rm(handoff, { recursive: true, force: true }); await rm(feed, { recursive: true, force: true });
	const execute = async (driver, directory, environment) => {
		const result = await runCopied(driver, ["Consumer.dll"], directory, environment);
		assert.equal(result.stderr, ""); assert.match(result.stdout, /^collections-dotnet-ok:\d+:\d+:57\n$/);
		return result.stdout;
	};
	const first = await execute(dotnet, join(root, "out"), env);
	const [checks, calls, rejected] = first.trim().split(":").slice(1).map(Number);
	assert.ok(checks > 100000); assert.ok(calls > 3000); assert.equal(rejected, 57);
	assert.deepEqual(await snapshot(installed), originalFiles);
	const faults = await checkDotnetCollectionFaults({ consumer, environment: { ...environment, LEAN_BRIDGE_DOTNET: dotnet }, sources, projection });
	assert.deepEqual(await snapshot(installed), originalFiles);
	assert.equal(await execute(dotnet, join(root, "out"), env), first);
	const relocated = join(consumer, "relocated"); await rename(join(root, "out"), relocated);
	const exampleRoot = join(consumer, "example"); await rename(join(root, "example-out"), exampleRoot);
	const exampleDeployment = await snapshot(exampleRoot);
	assert.equal(exampleDeployment["LeanBridge.Collections.dll"].sha256, publicTypes.assemblySha256);
	const deployment = await snapshot(relocated);
	assert.equal(deployment["LeanBridge.Collections.dll"].sha256, publicTypes.assemblySha256);
	const nativeLibraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith("runtimes/")));
	assert.ok(Object.keys(nativeLibraries).length >= 3);
	for(const [path, file] of Object.entries(nativeLibraries)) assert.deepEqual(deployment[path], file);
	for(const [path, file] of Object.entries(nativeLibraries)) assert.deepEqual(exampleDeployment[path], file);
	const runtime = join(consumer, "runtime-only"); await mkdir(runtime);
	const fxrVersion = select((await readdir(join(dotnetRoot, "host/fxr"))).filter(version => version.startsWith("8.0.")));
	const runtimeVersion = select((await readdir(join(dotnetRoot, "shared/Microsoft.NETCore.App"))).filter(version => version.startsWith("8.0.")));
	await cp(dotnet, join(runtime, "dotnet"));
	await cp(join(dotnetRoot, "host/fxr", fxrVersion), join(runtime, "host/fxr", fxrVersion), { recursive: true });
	await cp(join(dotnetRoot, "shared/Microsoft.NETCore.App", runtimeVersion), join(runtime, "shared/Microsoft.NETCore.App", runtimeVersion), { recursive: true });
	await rm(root, { recursive: true, force: true });
	assert.deepEqual((await readdir(consumer)).sort(), ["example", "relocated", "runtime-only"]);
	const runEnv = { ...copiedCleanEnvironment, DOTNET_ROOT: runtime, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_NOLOGO: "1" };
	assert.equal((await runCopied(join(runtime, "dotnet"), ["--list-sdks"], relocated, runEnv)).stdout.trim(), "");
	for(let repeat = 0; repeat < 2; ++repeat) assert.equal(await execute(join(runtime, "dotnet"), relocated, runEnv), first);
	const exampleResult = await runCopied(join(runtime, "dotnet"), ["Example.dll"], exampleRoot, runEnv);
	assert.equal(exampleResult.stderr, ""); assert.equal(exampleResult.stdout, "3, 2, 1\n1, 2, 3\n42\nTrue\n");
	assert.deepEqual(await snapshot(exampleRoot), exampleDeployment);
	assert.deepEqual(await snapshot(relocated), deployment);
	return {
		checks, calls, rejected, primitiveShapes: 19, recordTypes: 7
		, fixedArrayDepth: 24, threadedCalls: 512
		, publicTypes: { ...publicTypes, executed: true }
		, publicCallerSha256: sha256(source)
		, installedFiles: receipt.files, installedSnapshot: originalFiles
		, installedReceiptSha256: sha256(receiptBytes)
		, nativeLibraries, deployment, faults, runtimeVersion, fxrVersion
		, offlineInstall: true, emptyNuGetCache: true, onlyPreparedDependency: true
		, handoffRemovedBeforeExecution: true, installedFilesUnchanged: true
		, relocatedExecution: true, sdkFreeExecution: true
		, installedSourcesRemoved: true
		, sourceFreeExecutions: 2, repeatExecution: true
		, documentation: { sourceSha256: sha256(example), stdout: exampleResult.stdout
			, sdkFreeExecution: true, sourceFreeExecution: true
			, deploymentUnchanged: true
			, assemblySha256: exampleDeployment["LeanBridge.Collections.dll"].sha256 }
	};
};
