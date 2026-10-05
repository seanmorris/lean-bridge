/**
 * Original NuGet builds of one Lean coordinate must not silently share symbols.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const select = values => values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
const snapshot = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => [path, sha256(await readFile(join(root, path)))])));
const probe = `using System;
using System.IO;
using System.Reflection;
using System.Runtime.Loader;
internal static class Program
{
    static int count;
    static MethodInfo Load(string root)
    {
        var target = Path.Combine(AppContext.BaseDirectory, "runtimes", "linux-x64", "native");
        // Rename mapped files instead of overwriting their inodes. The installed
        // source packages are immutable; each process has a private deployment.
        if (Directory.Exists(target)) Directory.Move(target, Path.Combine(AppContext.BaseDirectory, "retained-" + count));
        Directory.CreateDirectory(target);
        foreach (var file in Directory.GetFiles(Path.Combine(root, "runtimes", "linux-x64", "native")))
            File.Copy(file, Path.Combine(target, Path.GetFileName(file)));
        var context = new AssemblyLoadContext("coordinate-probe-" + count++);
        var assembly = context.LoadFromAssemblyPath(Path.Combine(root, "LeanBridge.GraphCollision.dll"));
        return assembly.GetType("LeanBridge.GraphCollision.Api", true)!.GetMethod("Value")!;
    }
    static uint Call(MethodInfo method) => (uint)method.Invoke(null, null)!;
    static void Main(string[] args)
    {
        var first = Load(args[0]);
        var expected = uint.Parse(args[2]);
        if (Call(first) != expected) throw new Exception("First installed package returned the wrong value");
        var second = Load(args[1]);
        var duplicate = args[3] == "duplicate";
        if (duplicate)
        {
            if (Call(second) != expected) throw new Exception("An identical installed build changed its value");
        }
        else
        {
            for (int attempt = 0; attempt < 2; attempt++)
            {
                try { Call(second); throw new Exception("Conflicting component build was admitted"); }
                catch (TargetInvocationException error) when (error.InnerException is InvalidOperationException inner
                    && inner.Message.Contains("Conflicting builds of the same Lean component")) { }
            }
            var mappings = File.ReadAllText("/proc/self/maps");
            if (!mappings.Contains(Path.Combine(AppContext.BaseDirectory, "retained-1", args[4])))
                throw new Exception("The first component mapping was not retained");
            if (mappings.Contains(Path.Combine(AppContext.BaseDirectory, "runtimes", "linux-x64", "native", args[4])))
                throw new Exception("The conflicting component loaded before rejection");
        }
        if (Call(first) != expected) throw new Exception("Conflict rejection poisoned the existing component");
        Console.WriteLine("coordinate-ok:" + args[3] + ":" + expected);
    }
}
`;

/**
 * Install two genuine builds independently, then load them in isolated CLR
 * contexts with original native assets. Check duplicate and conflict orderings.
 *
 * @param root - Test-owned scratch directory.
 * @param diagnostic - Progress reporter.
 */
export const checkDotnetGraphConflicts = async (root, diagnostic) => {
	const environment = nativeFixtureEnvironment(["dotnet"]), packages = [];
	const dotnet = await realpath(environment.LEAN_BRIDGE_DOTNET), dotnetRoot = dirname(dotnet);
	for(const value of [41, 43])
	{
		const author = join(root, "author"), projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(root, "handoff");
		const name = `Lean.Collision${value}`, lean = `namespace Collision
inductive Node where
  | leaf (value : UInt32)
  | next (value : Node)
def echo (value : Node) : Node := value
def value : UInt32 := ${value}
end Collision
`;
		await saveLakeFile(projectRoot, "Collision.lean", lean);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", 'name = "graph_collision"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Collision"\n');
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Collision"]
			, exports: ["Collision.echo", "Collision.value"]
			, targets: { nuget: { name, version: "1.0.0" } } }));
		diagnostic(`coordinate conflicts: building ${name}`);
		await buildCanonicalProject({ projectRoot, outputRoot, targets: ["nuget"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const release = await copyPackageSetHandoff(outputRoot, handoff), pkg = release.packages[0]; assert.equal(release.packages.length, 1);
		const component = JSON.parse(await readFile(join(outputRoot, "native/component/native-component.json"), "utf8"));
		await rm(author, { recursive: true, force: true });
		const consumer = join(root, "consumer"), cache = join(consumer, "packages"), feed = join(consumer, "feed");
		await mkdir(cache, { recursive: true }); await mkdir(feed); assert.deepEqual(await readdir(cache), []);
		const archive = await readFile(join(handoff, pkg.artifacts[0].path)); assert.equal(sha256(archive), pkg.artifacts[0].sha256);
		await saveLakeFile(feed, `${pkg.name}.${pkg.version}.nupkg`, archive);
		await saveLakeFile(consumer, "Program.cs", 'using System; using LeanBridge.GraphCollision; Console.WriteLine(Api.Value());\n');
		await saveLakeFile(consumer, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
		await saveLakeFile(consumer, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
		const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dotnetRoot
			, DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1"
			, DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: cache };
		await runCopied(dotnet, ["restore", "--configfile", "NuGet.Config"], consumer, env);
		await runCopied(dotnet, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
		const installed = join(cache, pkg.name.toLowerCase(), pkg.version), receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json"));
		const receipt = JSON.parse(receiptBytes);
		await verifyNativeFiles(installed, Object.fromEntries(Object.entries(receipt.files).filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path))));
		assert.equal(sha256(await readFile(join(installed, `${pkg.name.toLowerCase()}.${pkg.version}.nupkg`))), pkg.artifacts[0].sha256);
		const assets = JSON.parse(await readFile(join(consumer, "obj/project.assets.json")));
		assert.deepEqual(Object.keys(assets.libraries), [`${pkg.name}/${pkg.version}`]);
		const destination = join(root, `installed-${value}`); await rename(join(consumer, "out"), destination);
		packages.push({ value, pkg, componentId: receipt.component.id
			, componentLibrary: component.library
			, receiptSha256: sha256(receiptBytes), files: receipt.files
			, deployment: await snapshot(destination), sourceSha256: sha256(lean) });
		await rm(consumer, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	}
	assert.equal(packages[0].componentId, "graph_collision@1.0.0"); assert.equal(packages[1].componentId, packages[0].componentId);
	assert.equal(packages[0].pkg.runtimeIdentity, packages[1].pkg.runtimeIdentity);
	assert.equal(packages[0].componentLibrary, packages[1].componentLibrary);
	assert.notEqual(packages[0].receiptSha256, packages[1].receiptSha256);
	const libraryPath = `runtimes/linux-x64/native/${packages[0].componentLibrary}`;
	assert.notEqual(packages[0].deployment[libraryPath], packages[1].deployment[libraryPath]);
	const compilerRoot = join(root, "compiler"); await saveLakeFile(compilerRoot, "Program.cs", probe);
	await saveLakeFile(compilerRoot, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(compilerRoot, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	await runCopied(dotnet, ["build", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], compilerRoot
		, { ...copiedCleanEnvironment, DOTNET_ROOT: dotnetRoot, DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1" });
	const host = join(root, "probe"); await rename(join(compilerRoot, "out"), host); await rm(compilerRoot, { recursive: true, force: true });
	const runtime = join(root, "runtime-only"); await mkdir(runtime);
	const fxr = select((await readdir(join(dotnetRoot, "host/fxr"))).filter(version => /^8\.0\./.test(version)));
	const version = select((await readdir(join(dotnetRoot, "shared/Microsoft.NETCore.App"))).filter(version => /^8\.0\./.test(version)));
	await cp(dotnet, join(runtime, "dotnet"));
	await cp(join(dotnetRoot, "host/fxr", fxr), join(runtime, "host/fxr", fxr), { recursive: true });
	await cp(join(dotnetRoot, "shared/Microsoft.NETCore.App", version), join(runtime, "shared/Microsoft.NETCore.App", version), { recursive: true });
	await rm(join(root, "home"), { recursive: true, force: true });
	assert.deepEqual((await readdir(root)).sort(), ["installed-41", "installed-43", "probe", "runtime-only"]);
	const driver = join(runtime, "dotnet"), env = { ...copiedCleanEnvironment, DOTNET_ROOT: runtime, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_NOLOGO: "1" };
	assert.equal((await runCopied(driver, ["--list-sdks"], root, env)).stdout.trim(), "");
	for(const pkg of packages)
	{
		const result = await runCopied(driver, ["Consumer.dll"], join(root, `installed-${pkg.value}`), env);
		assert.equal(result.stderr, ""); assert.equal(result.stdout, `${pkg.value}\n`);
	}
	const scenarios = [];
	for(const first of packages) for(const duplicate of [false, true])
	{
		const second = duplicate ? first : packages.find(pkg => pkg !== first), directory = join(root, "scenario");
		await cp(host, directory, { recursive: true });
		const mode = duplicate ? "duplicate" : "conflict";
		const result = await runCopied(driver, ["Probe.dll", join(root, `installed-${first.value}`), join(root, `installed-${second.value}`), String(first.value), mode, second.componentLibrary], directory, env);
		assert.equal(result.stderr, ""); assert.equal(result.stdout, `coordinate-ok:${mode}:${first.value}\n`);
		scenarios.push({ first: first.value, second: second.value, mode, stdout: result.stdout });
		await rm(directory, { recursive: true, force: true });
	}
	for(const pkg of packages) assert.deepEqual(await snapshot(join(root, `installed-${pkg.value}`)), pkg.deployment);
	return { packages, scenarios, probeSha256: sha256(probe)
		, originalArchives: true, sdkFreeExecution: true
		, sourceFreeExecution: true, deploymentsUnchanged: true
		, rejectsBeforeComponentLoad: true, earlierPackageSurvivesConflict: true };
};
