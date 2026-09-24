/**
 * Original installed recursive and ordinary NuGet packages share one runtime.
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
const inventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => [path, sha256(await readFile(join(root, path)))])));
const source = `using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using A = LeanBridge.GraphOne;
using B = LeanBridge.GraphTwo;
using P = LeanBridge.GraphPeer;
internal static unsafe class Program
{
    static int checks;
    static void Check(bool value) { checks++; if (!value) throw new Exception("Check " + checks); }
    static void Unavailable(Action action)
    {
        checks++;
        try { action(); }
        catch (A.LeanBridgeException error) when (error.Status == 5) { return; }
        catch (B.LeanBridgeException error) when (error.Status == 5) { return; }
        catch (P.LeanBridgeException error) when (error.Status == 5) { return; }
        throw new Exception("Expected shared retirement");
    }
    static void Main(string[] args)
    {
        var first = new A.System(new A.VNext(new A.VDone(41)));
        var second = new B.System(new B.VNext(new B.VDone(43)));
        if (args[0] == "peer-first") Check(P.Api.Answer() == 42);
        var retained = A.Api.Echo(first); Check(retained == first);
        Check(!ReferenceEquals(retained, first)); Check(B.Api.Echo(second) == second);
        Check(P.Api.Answer() == 42);
        Parallel.For(0, 64, _ => {
            if (A.Api.Echo(first) != first || B.Api.Echo(second) != second || P.Api.Answer() != 42)
                throw new Exception("Concurrent cross-package call");
        });
        // This isolated lifecycle probe calls the original installed adapter's
        // retirement hook. Public consumers need no native interop.
        var path = Path.Combine(AppContext.BaseDirectory, "runtimes", "linux-x64", "native", "libgraph_one.so");
        var handle = NativeLibrary.Load(path);
        ((delegate* unmanaged[Cdecl]<void>)NativeLibrary.GetExport(handle, "graph_one_graph_retire"))();
        Unavailable(() => A.Api.Echo(first)); Unavailable(() => B.Api.Echo(second)); Unavailable(() => P.Api.Answer());
        Check(retained == first); Check(retained.Node is A.VNext(A.VDone(41)));
        Console.WriteLine("composition-ok:" + args[0] + ":" + checks);
    }
}
`;

/**
 * Build three independent packages, including a mixed C++/NuGet graph release.
 *
 * @param root - Test-owned scratch directory.
 * @param diagnostic - Progress reporter.
 */
export const checkDotnetGraphComposition = async (root, diagnostic) => {
	const environment = nativeFixtureEnvironment(["dotnet"]), packages = [];
	const feed = join(root, "consumer/feed"); await mkdir(feed, { recursive: true });
	for(const [name, module, graph, targets] of [["graph_one", "GraphOne", true, ["nuget"]], ["graph_two", "GraphTwo", true, ["cpp", "nuget"]], ["graph_peer", "GraphPeer", false, ["nuget"]]])
	{
		const author = join(root, "author"), projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(root, "handoff");
		const lean = graph ? `namespace ${module}
inductive V where
  | done (value : UInt32)
  | next (value : V)
structure System where
  node : V
def echo (Interop : System) : System := Interop
end ${module}
` : `namespace ${module}\ndef answer : UInt32 := 42\nend ${module}\n`;
		await saveLakeFile(projectRoot, `${module}.lean`, lean);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: [module]
			, exports: [`${module}.${graph ? "echo" : "answer"}`]
			, targets: { nuget: { name: `Lean.${module}`, version: "1.0.0" } } }));
		diagnostic(`composition: building ${name} (${targets.join(", ")})`);
		await buildCanonicalProject({ projectRoot, outputRoot, targets, environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const handoffReceipt = await copyPackageSetHandoff(outputRoot, handoff);
		assert.deepEqual(handoffReceipt.packages.map(pkg => pkg.target).sort(), [...targets].sort());
		const pkg = handoffReceipt.packages.find(pkg => pkg.target === "nuget");
		const archive = await readFile(join(handoff, pkg.artifacts[0].path)); assert.equal(sha256(archive), pkg.artifacts[0].sha256);
		await saveLakeFile(feed, `${pkg.name}.${pkg.version}.nupkg`, archive);
		packages.push({ ...pkg, graph, targets, sourceSha256: sha256(lean) });
		await rm(author, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	}
	assert.equal(new Set(packages.map(pkg => pkg.runtimeIdentity)).size, 1);
	const consumer = join(root, "consumer"), cache = join(consumer, "packages"); await mkdir(cache);
	assert.deepEqual(await readdir(cache), []);
	await saveLakeFile(consumer, "Program.cs", source);
	await saveLakeFile(consumer, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><UseAppHost>false</UseAppHost><AllowUnsafeBlocks>true</AllowUnsafeBlocks><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/>${packages.map(pkg => `<PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/>`).join("")}</ItemGroup></Project>`);
	await saveLakeFile(consumer, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const dotnet = await realpath(environment.LEAN_BRIDGE_DOTNET), dotnetRoot = dirname(dotnet);
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dotnetRoot
		, DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1"
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: cache };
	await runCopied(dotnet, ["restore", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(dotnet, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
	const receipts = [];
	for(const pkg of packages)
	{
		const installed = join(cache, pkg.name.toLowerCase(), pkg.version), bytes = await readFile(join(installed, "lean-bridge/package-receipt.json"));
		const receipt = JSON.parse(bytes);
		await verifyNativeFiles(installed, Object.fromEntries(Object.entries(receipt.files).filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path))));
		assert.equal(sha256(await readFile(join(installed, `${pkg.name.toLowerCase()}.${pkg.version}.nupkg`))), pkg.artifacts[0].sha256);
		receipts.push({ name: pkg.name, sha256: sha256(bytes), files: receipt.files });
	}
	const assets = JSON.parse(await readFile(join(consumer, "obj/project.assets.json")));
	assert.deepEqual(Object.keys(assets.libraries).sort(), packages.map(pkg => `${pkg.name}/${pkg.version}`).sort());
	const deployment = await inventory(join(consumer, "out")), relocated = join(root, "relocated"), runtime = join(root, "runtime-only");
	await rename(join(consumer, "out"), relocated); await mkdir(runtime);
	const fxr = select((await readdir(join(dotnetRoot, "host/fxr"))).filter(version => /^8\.0\./.test(version)));
	const version = select((await readdir(join(dotnetRoot, "shared/Microsoft.NETCore.App"))).filter(version => /^8\.0\./.test(version)));
	await cp(dotnet, join(runtime, "dotnet"));
	await cp(join(dotnetRoot, "host/fxr", fxr), join(runtime, "host/fxr", fxr), { recursive: true });
	await cp(join(dotnetRoot, "shared/Microsoft.NETCore.App", version), join(runtime, "shared/Microsoft.NETCore.App", version), { recursive: true });
	await rm(consumer, { recursive: true, force: true }); await rm(join(root, "home"), { recursive: true, force: true });
	assert.deepEqual((await readdir(root)).sort(), ["relocated", "runtime-only"]);
	const runEnv = { ...copiedCleanEnvironment, DOTNET_ROOT: runtime, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_NOLOGO: "1" };
	assert.equal((await runCopied(join(runtime, "dotnet"), ["--list-sdks"], relocated, runEnv)).stdout.trim(), "");
	const scenarios = [];
	for(const mode of ["graph-first", "peer-first"])
	{
		const result = await runCopied(join(runtime, "dotnet"), ["Consumer.dll", mode], relocated, runEnv);
		assert.equal(result.stderr, ""); assert.match(result.stdout, new RegExp(`^composition-ok:${mode}:\\d+\n$`));
		scenarios.push({ mode, stdout: result.stdout, concurrentCalls: 192 });
	}
	assert.deepEqual(await inventory(relocated), deployment);
	return { packages, receipts, scenarios, sourceSha256: sha256(source)
		, deployment
		, mixedCppNuget: true, sharedRetirement: true, sourceFreeExecution: true
		, sdkFreeExecution: true, deploymentUnchanged: true };
};
