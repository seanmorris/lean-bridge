/**
 * Offline NuGet consumers, exact Roslyn diagnostics and relocated runtime-only runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { corpusCases, corpusHostCase } from "../fixtures/type-corpus/cases.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { corpusDotnetRejection, corpusDotnetSignatures, corpusDotnetSource } from "./type-corpus-dotnet-source.mjs";

const repository = resolve(import.meta.dirname, "../..");
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const selectVersion = versions => versions.filter(version => /^8\.0\.\d+$/.test(version)).sort((a, b) => Number(a.split(".")[2]) - Number(b.split(".")[2])).at(-1);
const msbuildIsolation = ["-noAutoResponse", "/p:ImportDirectoryBuildProps=false", "/p:ImportDirectoryBuildTargets=false", "/p:ImportDirectoryPackagesProps=false", "/p:UseSharedCompilation=false", "/p:NuGetAudit=false"];
export const dotnetCompilerOptions = Object.freeze(["/nologo", "/noconfig", "/nostdlib+", "/target:library", "/langversion:12", "/nullable:enable", "/warnaserror+"]);

/**
 * Require source-located C# type/range errors, never restore or dependency failures.
 *
 * @param report - Complete Roslyn SARIF output.
 * @param entry - Invalid catalog input.
 * @param project - Isolated compiler working directory.
 * @param file - Exact relative source path for this input.
 */
export const dotnetDiagnostics = (report, entry, project, file) => {
	assert.equal(report.version, "2.1.0");
	assert.equal(report.runs.length, 1);
	const errors = report.runs[0].results.filter(result => result.level === "error");
	assert.ok(errors.length > 0);
	return errors.map(result => {
		assert.equal(result.ruleId, entry.expectation.diagnostic);
		assert.equal(result.locations.length, 1);
		const location = result.locations[0].physicalLocation;
		assert.equal(fileURLToPath(new URL(location.artifactLocation.uri, pathToFileURL(`${project}/`))), join(project, file));
		assert.ok(location.region.startLine > 0 && location.region.startColumn > 0);
		return { code: result.ruleId, file, line: location.region.startLine, column: location.region.startColumn, message: result.message.text };
	});
};

/**
 * Install only the prepared NuGet package and compile an independent C# caller.
 *
 * @param options - Exact producer handoff and isolated runtime environment.
 * @param options.library - Catalog library.
 * @param options.consumer - Task-owned consumer root.
 * @param options.handoff - Verified package-set archives.
 * @param options.pkg - Component package receipt entry.
 * @param options.environment - Selected author toolchain paths.
 * @param options.clean - Compiler-free runtime environment.
 */
export const installedDotnetCorpus = async ({ library, consumer, handoff, pkg, environment, clean }) => {
	const root = join(consumer, "dotnet"), project = join(root, "project"), feed = join(project, "feed");
	const packages = join(project, "packages"), cliHome = join(project, "cli-home");
	await mkdir(feed, { recursive: true });
	await mkdir(packages); await mkdir(cliHome);
	assert.deepEqual(await readdir(packages), []); assert.deepEqual(await readdir(cliHome), []);
	const dotnet = await realpath(environment.LEAN_BRIDGE_DOTNET), dotnetRoot = dirname(dotnet);
	const compile = { ...clean, DOTNET_ROOT: dotnetRoot, DOTNET_CLI_HOME: cliHome
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
		, DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
		, DOTNET_MULTILEVEL_LOOKUP: "0", NUGET_PACKAGES: packages
		, NUGET_HTTP_CACHE_PATH: join(project, "http-cache") };
	const sdks = (await run(dotnet, ["--list-sdks"], project, compile)).stdout.split("\n").map(line => /^(8\.0\.\d+) \[/.exec(line)?.[1]).filter(Boolean);
	const sdkVersion = selectVersion(sdks); assert.ok(sdkVersion, "The corpus needs a .NET 8 SDK");
	const runtimeVersion = selectVersion((await run(dotnet, ["--list-runtimes"], project, compile)).stdout.split("\n").map(line => /^Microsoft\.NETCore\.App (8\.0\.\d+) \[/.exec(line)?.[1]).filter(Boolean));
	assert.ok(runtimeVersion);
	await saveLakeFile(project, "global.json", canonicalJson({ sdk: { version: sdkVersion, rollForward: "disable", allowPrerelease: false } }));
	assert.equal((await run(dotnet, ["--version"], project, compile)).stdout.trim(), sdkVersion);
	await cp(join(handoff, pkg.artifacts[0].path), join(feed, `${pkg.name}.${pkg.version}.nupkg`));
	const source = corpusDotnetSource(library);
	await saveLakeFile(project, "src/Program.cs", source);
	await saveLakeFile(project, "src/Wire.cs", await readFile(join(repository, "tests/fixtures/type-corpus/consumers/dotnet.cs")));
	const projectSource = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><AssemblyName>Consumer</AssemblyName><Nullable>enable</Nullable><LangVersion>12</LangVersion><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Compile Include="src/Program.cs"/><Compile Include="src/Wire.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>\n`;
	const nugetConfig = `<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders><packageSourceMapping><clear/><packageSource key="prepared"><package pattern="${pkg.name}"/></packageSource></packageSourceMapping></configuration>\n`;
	await saveLakeFile(project, "Consumer.csproj", projectSource);
	await saveLakeFile(project, "NuGet.Config", nugetConfig);
	await run(dotnet, ["restore", "--configfile", "NuGet.Config", "--use-lock-file", "--nologo", ...msbuildIsolation], project, compile);
	const installed = join(packages, pkg.name.toLowerCase(), pkg.version);
	const receiptPath = join(installed, "lean-bridge/package-receipt.json"), receipt = await json(receiptPath);
	assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.namespace, library.dotnetModule); assert.equal(receipt.assembly, library.dotnetModule);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	// NuGet omits ZIP container metadata and normalizes the nuspec filename.
	// Bind the retained original archive, then check every extracted payload.
	assert.equal(await digest(join(installed, `${pkg.name.toLowerCase()}.${pkg.version}.nupkg`)), pkg.artifacts[0].sha256);
	await verifyNativeFiles(installed, Object.fromEntries(Object.entries(receipt.files).filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path))));
	const assets = await json(join(project, "obj/project.assets.json")), lock = await json(join(project, "packages.lock.json"));
	assert.deepEqual(Object.keys(assets.libraries), [`${pkg.name}/${pkg.version}`]);
	assert.deepEqual(Object.keys(assets.packageFolders).map(path => resolve(project, path)), [packages]);
	assert.deepEqual(Object.keys(assets.project.restore.sources).map(path => resolve(project, path)), [feed]);
	const locked = lock.dependencies["net8.0"][pkg.name];
	assert.equal(locked.resolved, pkg.version); assert.equal(locked.type, "Direct");
	assert.equal(locked.contentHash, (await readFile(join(installed, `${pkg.name.toLowerCase()}.${pkg.version}.nupkg.sha512`), "utf8")).trim());
	await run(dotnet, ["restore", "--configfile", "NuGet.Config", "--locked-mode", "--nologo", ...msbuildIsolation], project, compile);
	await run(dotnet, ["build", "--no-restore", "--configuration", "Release", "--disable-build-servers", "--output", "out", "--nologo", ...msbuildIsolation], project, compile);
	const compiler = join(dotnetRoot, "sdk", sdkVersion, "Roslyn/bincore/csc.dll");
	const referenceVersion = selectVersion(await readdir(join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref")));
	assert.ok(referenceVersion);
	const refRoot = join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref", referenceVersion, "ref/net8.0");
	const references = (await readdir(refRoot)).filter(file => file.endsWith(".dll")).sort();
	const assembly = `lib/net8.0/${library.dotnetModule}.dll`;
	const referenceOptions = [...references.map(file => `/reference:${join(refRoot, file)}`), `/reference:${join(installed, assembly)}`];
	const rejected = [];
	for(const entry of corpusCases(library).map(entry => corpusHostCase(entry, "dotnet")).filter(entry => entry.expectation.kind === "compile-rejection"))
	{
		const file = `src/reject-${entry.id.split("/")[1]}.cs`, invalid = corpusDotnetRejection(library, entry);
		await saveLakeFile(project, file, invalid);
		const result = await captureCorpusCompiler(dotnet, ["exec", compiler, ...dotnetCompilerOptions, ...referenceOptions, "/out:rejected.dll", "/errorlog:diagnostics.sarif,version=2.1", file], project, compile);
		assert.equal(result.code, 1, `${entry.id}: expected Roslyn rejection: ${result.stdout} ${result.stderr}`);
		const diagnostics = dotnetDiagnostics(await json(join(project, "diagnostics.sarif")), entry, project, file);
		rejected.push({ id: entry.id, status: "rejected-at-compile-time", sourceSha256: sha256(invalid), diagnostics });
		await rm(join(project, "diagnostics.sarif"));
	}
	const dotnetEvidence = { sdkVersion, runtimeVersion
		, compilerVersion: (await run(dotnet, ["exec", compiler, "/version"], project, compile)).stdout.trim()
		, hostSha256: await digest(dotnet)
		, compilerSha256: await digest(compiler)
		, consumerSourceSha256: sha256(source)
		, signaturesSha256: sha256(corpusDotnetSignatures(library))
		, declarationsSha256: await digest(join(installed, `lean-bridge/dotnet/src/${library.dotnetModule}/Api.cs`))
		, packageReceiptSha256: await digest(receiptPath)
		, compiledProjectionSha256: receipt.compiledProjectionSha256
		, bindingIrSha256: receipt.bindingIrSha256
		, assemblySha256: await digest(join(installed, assembly))
		, projectSourceSha256: sha256(projectSource)
		, nugetConfigSha256: sha256(nugetConfig)
		, assetsSha256: sha256(canonicalJson(assets))
		, lockSha256: sha256(canonicalJson(lock))
		, packageContentHash: locked.contentHash
		, referenceVersion
		, references: Object.fromEntries(await Promise.all(references.map(async file => [file, await digest(join(refRoot, file))])))
		, compilerOptions: [...dotnetCompilerOptions], exactPublicSignatures: true
		, emptyPackageCache: true, emptyCliHome: true, offline: true
		, lockedRestore: true
		, runtimeOverridesDisabled: true, publicApiOnly: true };
	const deployment = join(root, "relocated");
	await rename(join(project, "out"), deployment);
	const deployed = {};
	for(const path of await nativeArtifactPaths(deployment))
	{
		assert.ok(/(?:\.dll|\.pdb|\.json|\.xml|\.so)$/.test(path));
		const bytes = await readFile(join(deployment, path));
		deployed[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	assert.equal(deployed[`${library.dotnetModule}.dll`].sha256, dotnetEvidence.assemblySha256);
	const native = Object.keys(receipt.files).filter(path => path.startsWith("runtimes/") && path.endsWith(".so"));
	for(const path of native) assert.deepEqual(deployed[path], receipt.files[path]);
	dotnetEvidence.deployment = deployed;
	// Only the .NET host, hostfxr and selected framework accompany execution. The
	// SDK, Roslyn, reference assemblies and NuGet cache do not exist in this root.
	const runtimeRoot = join(root, "runtime-only");
	await mkdir(runtimeRoot);
	await cp(dotnet, join(runtimeRoot, "dotnet"));
	const fxrVersion = selectVersion(await readdir(join(dotnetRoot, "host/fxr"))); assert.ok(fxrVersion);
	await cp(join(dotnetRoot, "host/fxr", fxrVersion), join(runtimeRoot, "host/fxr", fxrVersion), { recursive: true });
	await cp(join(dotnetRoot, "shared/Microsoft.NETCore.App", runtimeVersion), join(runtimeRoot, "shared/Microsoft.NETCore.App", runtimeVersion), { recursive: true });
	const runtimeFiles = {};
	for(const path of await nativeArtifactPaths(runtimeRoot)) runtimeFiles[path] = { sha256: await digest(join(runtimeRoot, path)), bytes: (await readFile(join(runtimeRoot, path))).length };
	dotnetEvidence.runtimeHost = { fxrVersion, files: runtimeFiles };
	await rm(project, { recursive: true, force: true });
	assert.deepEqual((await readdir(root)).sort(), ["relocated", "runtime-only"]);
	const runtimeEnv = { ...clean, DOTNET_ROOT: runtimeRoot, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1" };
	const runtimeHost = join(runtimeRoot, "dotnet");
	assert.equal((await run(runtimeHost, ["--list-sdks"], deployment, runtimeEnv)).stdout.trim(), "");
	const observations = [];
	for(let i = 0; i < 2; ++i) observations.push(JSON.parse((await run(runtimeHost, ["Consumer.dll"], deployment, runtimeEnv)).stdout));
	assert.deepEqual(observations[0], observations[1]);
	assert.equal(observations[0].assembly, join(deployment, `${library.dotnetModule}.dll`));
	assert.deepEqual(observations[0].nativeLibraries, native.map(path => join(deployment, path)).sort());
	await verifyNativeFiles(deployment, deployed); await verifyNativeFiles(runtimeRoot, runtimeFiles);
	dotnetEvidence.installedSourcesRemoved = true; dotnetEvidence.compilerFreeExecution = true;
	dotnetEvidence.runtimeOnlyExecution = true; dotnetEvidence.repeatExecution = true;
	dotnetEvidence.localLibraries = true;
	const observation = observations[0];
	observation.results.push(...rejected);
	return { observation, dotnet: dotnetEvidence };
};
