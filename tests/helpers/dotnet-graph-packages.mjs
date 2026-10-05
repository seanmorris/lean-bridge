/**
 * Original NuGet archives installed offline and executed without author tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { ordinaryDotnetEvidence } from "../../src/build/native-dotnet-artifacts.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { packageOrdinaryNuget } from "../../src/release/native-nuget.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { generateCopiedDotnetGraphPackage } from "../../src/backends/dotnet/copied-graph-package.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { checkDotnetGraphPackageTypes } from "./dotnet-graph-package-types.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const snapshot = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));
const select = values => values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);

const prepare = async ({ author, handoff, environment, reviewed, diagnostic }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release"), ir = nativeRecursiveReviewedIr();
	await saveLakeFile(projectRoot, "Recursive.lean", await nativeRecursiveSource());
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: ["Recursive"]
		, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
		, targets: { nuget: { name: "Lean.Recursive", version: "1.0.0" } } }));
	if(reviewed) await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building NuGet-only recursive release`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["nuget"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const handoffReceipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(handoffReceipt.packages.length, 1); assert.equal(handoffReceipt.packages[0].target, "nuget");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime");
	const adapterRoot = join(outputRoot, "native/c-binding"), dotnetRoot = join(outputRoot, "native/dotnet");
	const { model, receipt, projection, evidence, adapter } = await ordinaryDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, 18);
	assert.equal(adapter.gmp, undefined); assert.equal(adapter.files["include/recursive.h"], undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	const releaseOptions = { working: join(author, "repackaged")
		, dotnetRoot, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: { name: "Lean.Recursive", version: "1.0.0" }
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" };
	const repeated = await packageOrdinaryNuget(releaseOptions); assert.deepEqual(repeated.packages, built.packages);
	await rm(releaseOptions.working, { recursive: true, force: true });
	for(const copiedGraph of [undefined, { schemaVersion: 1, layoutSha256: "0".repeat(64) }, { ...adapter.copiedGraph, extra: true }])
	{
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, copiedGraph }));
		await assert.rejects(() => ordinaryDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot }), /\.NET C adapter differs/);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of ["src/native.c", "include/detail/recursive-graph.h", "include/detail/recursive-graph-types.h"])
	{
		const original = await readFile(join(adapterRoot, path), "utf8"), changed = `${original}\n/* re-signed source drift */\n`;
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, files: { ...adapter.files
			, [path]: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) } } }));
		await assert.rejects(() => packageOrdinaryNuget(releaseOptions), /Generated .NET graph adapter source differs/);
		await saveLakeFile(adapterRoot, path, original); await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	const generated = generateCopiedDotnetGraphPackage(model.bindingIr, evidence);
	return { pkg: handoffReceipt.packages[0], sources: generated, projection
		, provenance: { exports: 18, bindingIrSha256: built.bindingIrSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, layoutSha256: adapter.copiedGraph.layoutSha256
			, modelSha256: sha256(canonicalJson(model))
			, checkedSourceUnchanged: true, nugetOnly: true
			, deterministicReassembly: true
			, rejectsGraphReceiptDrift: 3, rejectsRegeneratedSourceDrift: 3 } };
};

const install = async ({ consumer, handoff, pkg, sources, environment }) => {
	const root = join(consumer, "build"), feed = join(root, "feed"), cache = join(root, "packages");
	await mkdir(feed, { recursive: true }); await mkdir(cache);
	assert.deepEqual(await readdir(cache), []);
	const archive = join(handoff, pkg.artifacts[0].path); assert.equal(await digest(archive), pkg.artifacts[0].sha256);
	await cp(archive, join(feed, `${pkg.name}.${pkg.version}.nupkg`));
	const source = (await readFile("tests/fixtures/structured-types/recursive-dotnet-installed.cs", "utf8"))
		.replace("WIDE_ARGUMENTS", Array.from({ length: 255 }, (_, index) => index).join(", "));
	await saveLakeFile(root, "Program.cs", source);
	await saveLakeFile(root, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const dotnet = await realpath(environment.LEAN_BRIDGE_DOTNET), dotnetRoot = dirname(dotnet);
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dotnetRoot
		, DOTNET_CLI_HOME: join(root, "home")
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: cache
		, NUGET_HTTP_CACHE_PATH: join(root, "http-cache") };
	await runCopied(dotnet, ["restore", "--configfile", "NuGet.Config"], root, env);
	await runCopied(dotnet, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	const installed = join(cache, pkg.name.toLowerCase(), pkg.version), receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json"));
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package"); assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.namespace, "LeanBridge.Recursive");
	assert.equal(await digest(join(installed, `${pkg.name.toLowerCase()}.${pkg.version}.nupkg`)), pkg.artifacts[0].sha256);
	await verifyNativeFiles(installed, Object.fromEntries(Object.entries(receipt.files).filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path))));
	for(const [path, source] of Object.entries(sources).filter(([path]) => path.startsWith("src/") || path === "binding-manifest.json"))
		assert.equal(await readFile(join(installed, "lean-bridge/dotnet", path), "utf8"), source);
	const assets = await json(join(root, "obj/project.assets.json"));
	assert.deepEqual(Object.keys(assets.libraries), [`${pkg.name}/${pkg.version}`]);
	assert.deepEqual(Object.keys(assets.project.restore.sources), [feed]);
	const publicTypes = await checkDotnetGraphPackageTypes({
		root: join(root, "negative"), dotnet
		, assembly: join(installed, "lib/net8.0/LeanBridge.Recursive.dll")
		, environment: env });
	const guide = (await readFile("docs/consume/dotnet.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
	const example = guide.match(/```csharp\n([^]*?)\n```/)[1] + "\n";
	const exampleRoot = join(root, "example");
	await saveLakeFile(exampleRoot, "Program.cs", example);
	await saveLakeFile(exampleRoot, "Example.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
	await runCopied(dotnet, ["restore", "Example.csproj", "--source", feed], exampleRoot, env);
	await runCopied(dotnet, ["build", "Example.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], exampleRoot, env);
	const original = await snapshot(installed), deployment = await snapshot(join(root, "out"));
	await rm(handoff, { recursive: true, force: true }); await rm(feed, { recursive: true, force: true });
	const execute = async (driver, cwd, env, args = []) => {
		const result = await runCopied(driver, ["Consumer.dll", ...args], cwd, env); assert.equal(result.stderr, ""); return result.stdout;
	};
	const first = await execute(dotnet, join(root, "out"), env);
	assert.match(first, /^recursive-dotnet-installed:\d+:256\n$/);
	assert.deepEqual(await snapshot(installed), original);
	const relocated = join(consumer, "relocated"), runtime = join(consumer, "runtime-only");
	await rename(join(root, "out"), relocated); await mkdir(runtime);
	const exampleDeployment = await snapshot(join(exampleRoot, "out")), exampleRelocated = join(consumer, "example");
	await rename(join(exampleRoot, "out"), exampleRelocated);
	const fxrVersion = select((await readdir(join(dotnetRoot, "host/fxr"))).filter(version => /^8\.0\./.test(version)));
	const runtimeVersion = select((await readdir(join(dotnetRoot, "shared/Microsoft.NETCore.App"))).filter(version => /^8\.0\./.test(version)));
	await cp(dotnet, join(runtime, "dotnet"));
	await cp(join(dotnetRoot, "host/fxr", fxrVersion), join(runtime, "host/fxr", fxrVersion), { recursive: true });
	await cp(join(dotnetRoot, "shared/Microsoft.NETCore.App", runtimeVersion), join(runtime, "shared/Microsoft.NETCore.App", runtimeVersion), { recursive: true });
	await rm(root, { recursive: true, force: true });
	assert.deepEqual((await readdir(consumer)).sort(), ["example", "relocated", "runtime-only"]);
	const driver = join(runtime, "dotnet"), runEnv = { ...copiedCleanEnvironment, DOTNET_ROOT: runtime, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_NOLOGO: "1" };
	assert.equal((await runCopied(driver, ["--list-sdks"], relocated, runEnv)).stdout.trim(), "");
	for(let repeat = 0; repeat < 2; repeat++) assert.equal(await execute(driver, relocated, runEnv), first);
	const documented = await runCopied(driver, ["Example.dll"], exampleRelocated, runEnv);
	assert.equal(documented.stderr, ""); assert.equal(documented.stdout, "True\nFalse\nTrue\nTrue\n3\n");
	assert.deepEqual(await snapshot(exampleRelocated), exampleDeployment);
	const nativeLibraries = Object.keys(deployment).filter(path => path.endsWith(".so")); assert.equal(nativeLibraries.length, 4);
	for(const path of nativeLibraries)
	{
		const bytes = await readFile(join(relocated, path)), changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
		await saveLakeFile(relocated, path, changed);
		assert.equal(await execute(driver, relocated, runEnv, ["tamper"]), "tamper-rejected-before-call\n");
		await saveLakeFile(relocated, path, bytes);
	}
	assert.deepEqual(await snapshot(relocated), deployment);
	return { checks: Number(first.split(":")[1]), concurrentCalls: 256, publicTypes
		, publicCallerSha256: sha256(source), archiveSha256: pkg.artifacts[0].sha256
		, installedReceiptSha256: sha256(receiptBytes)
		, installedFiles: receipt.files, deployment, nativeLibraries
		, runtimeVersion, fxrVersion
		, offlineInstall: true, emptyNuGetCache: true, onlyPreparedDependency: true
		, sourceFreeExecutions: 2, sdkFreeExecution: true
		, installedFilesUnchanged: true
		, tamperRejections: nativeLibraries.length, deploymentUnchanged: true
		, documentation: { sourceSha256: sha256(example), stdout: documented.stdout
			, sourceFreeExecution: true, sdkFreeExecution: true
			, deploymentUnchanged: true } };
};

/**
 * Compile and install both source paths, releasing each temporary release first.
 *
 * @param root - Test-owned scratch directory.
 * @param diagnostic - Progress reporter.
 */
export const checkDotnetGraphPackages = async (root, diagnostic) => {
	const environment = nativeFixtureEnvironment(["dotnet"]), observations = [];
	for(const reviewed of [false, true])
	{
		const directory = join(root, reviewed ? "reviewed" : "ordinary"), author = join(directory, "author"), handoff = join(directory, "handoff");
		const prepared = await prepare({ author, handoff, environment, reviewed, diagnostic });
		await rm(author, { recursive: true, force: true });
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: installing original archive and running source-free consumers`);
		const observation = await install({ consumer: join(directory, "consumer"), handoff, ...prepared, environment });
		observations.push({ reviewed, ...prepared.provenance, ...observation });
		await rm(directory, { recursive: true, force: true });
	}
	return { schemaVersion: 1, installedPackage: true, observations };
};

/**
 * Rebuild both source paths independently and compare the original installed
 * archives byte-for-byte. No installed observation is replaced on disagreement.
 *
 * @param root - New test-owned scratch directory.
 * @param original - Completed original installed-package observations.
 * @param diagnostic - Progress reporter.
 */
export const checkDotnetGraphReproducibility = async (root, original, diagnostic) => {
	assert.equal(original.schemaVersion, 1); assert.equal(original.installedPackage, true);
	assert.deepEqual(original.observations.map(item => item.reviewed), [false, true]);
	const environment = nativeFixtureEnvironment(["dotnet"]), observations = [];
	for(const prior of original.observations)
	{
		const directory = join(root, prior.reviewed ? "reviewed" : "ordinary"), author = join(directory, "author"), handoff = join(directory, "handoff");
		const repeated = await prepare({ author, handoff, environment, reviewed: prior.reviewed, diagnostic });
		assert.equal(repeated.pkg.artifacts[0].sha256, prior.archiveSha256, "Independent recursive NuGet archives differ");
		assert.equal(repeated.provenance.binarySha256, prior.binarySha256);
		assert.equal(repeated.provenance.bindingIrSha256, prior.bindingIrSha256);
		assert.equal(repeated.provenance.modelSha256, prior.modelSha256);
		observations.push({ reviewed: prior.reviewed
			, archiveSha256: prior.archiveSha256
			, binarySha256: prior.binarySha256, bindingIrSha256: prior.bindingIrSha256
			, modelSha256: prior.modelSha256, exactOriginalArchive: true });
		await rm(directory, { recursive: true, force: true });
	}
	return { schemaVersion: 1, originalReportSha256: sha256(canonicalJson(original)), observations };
};
