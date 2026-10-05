/**
 * Independent native layout, bounded marshalling and cleanup checks for C#.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { generateCopiedDotnetGraphConversions } from "../src/backends/dotnet/copied-graph-conversions.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { dotnetConversionIr, dotnetCollisionIr, dotnetGraphLayoutProbe, dotnetGraphProbeSource, dotnetGraphNativeExtras, instrumentDotnetGraphs } from "./helpers/dotnet-graph-probes.mjs";
import { dotnetAliasGraphIr } from "./helpers/dotnet-graph-values-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";

test("recorded C# graph conversions bind independent probes and compiled Lean without claiming NuGet", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-recursive-conversions-20260923.json", "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219); assert.equal(record.installedPackage, false);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	const isolated = generateCopiedDotnetGraphConversions(dotnetConversionIr());
	assert.equal(record.isolated.sourceSha256, sha256(isolated.source));
	assert.equal(record.isolated.valuesSha256, sha256(isolated.valuesSource));
	assert.equal(record.isolated.instrumentedSha256, sha256(instrumentDotnetGraphs(isolated.source)));
	const collisions = generateCopiedDotnetGraphConversions(dotnetCollisionIr());
	assert.equal(record.isolated.collisionSourceSha256, sha256(collisions.source));
	assert.equal(record.isolated.collisionValuesSha256, sha256(collisions.valuesSource));
	assert.equal(record.isolated.compiledLean, false); assert.equal(record.isolated.installedPackage, false);
	assert.deepEqual(record.isolated.observation, { checks: 3159, checkpoints: 135
		, inputFailures: 66, outputFailures: 69, layoutChecks: 478
		, compiledLean: false, live: 0 });
	const ir = nativeRecursiveReviewedIr(); ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const compiled = generateCopiedDotnetGraphConversions(ir);
	assert.equal(record.native.compiledLean, true); assert.equal(record.native.installedPackage, false);
	assert.deepEqual(record.native.observations.map(item => item.reviewed), [false, true]);
	for(const item of record.native.observations)
	{
		assert.equal(item.dotnetSourceSha256, sha256(compiled.source));
		assert.equal(item.dotnetValuesSha256, sha256(compiled.valuesSource));
		assert.equal(item.instrumentedSha256, sha256(instrumentDotnetGraphs(compiled.source)));
		assert.equal(item.exports, 18);
		assert.deepEqual(item.scenarios.map(scenario => scenario.mode), ["carrier", "raw", "cycle", "during"]);
		for(const scenario of item.scenarios) assert.deepEqual(scenario, { mode: scenario.mode
			, checks: 3513, compiledLean: true
			, nativeCheckpoints: 28, managedCheckpoints: 116
			, allocationCheckpoints: 28, inputFailures: 56, outputFailures: 60
			, layoutChecks: 455, live: 0 });
	}
});

test("C# graph conversions keep deterministic native storage and prevalidate before allocation and initialization", () => {
	const ir = dotnetConversionIr(), before = structuredClone(ir), generated = generateCopiedDotnetGraphConversions(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedDotnetGraphConversions(ir), generated);
	assert.equal(generated.functions.length, 20);
	assert.match(generated.source, /^using _V = global::LeanBridge.Recursive;/);
	for(const name of ["bool", "unit"]) assert.equal(generated.types.find(node => node.ref.name === name).raw, "byte");
	assert.doesNotMatch(generated.valuesSource, /NativeMemory|DllImport|delegate\*/);
	const method = generated.source.slice(generated.source.indexOf(" CallJoinTrees("));
	assert.ok(method.indexOf("new GraphScope(true)") < method.indexOf("using var scope = new GraphScope();"));
	assert.ok(method.indexOf("var input1 =") < method.indexOf("lifecycle.Before();"));
	assert.match(method, /Clear\(ref output.Owner, ref output.Release\);/);
	assert.match(generated.source, /catch \(GraphInvalidNative error\)\n\s*\{\n\s*lifecycle.Poison\(\);/);
});

test("C# converter source budgets reject repeated large signatures before expansion", () => {
	const ir = dotnetAliasGraphIr(13), template = ir.declarations[0];
	ir.declarations = Array.from({ length: 100 }, (_, i) => ({ ...structuredClone(template)
		, id: `lean:Recursive.echo${i}`
		, name: `echo${i}`, overloadKey: `echo${i}` }));
	assert.throws(() => generateCopiedDotnetGraphConversions(ir), /generated converters exceed 16 MiB/);
});

test("C# graph adapters match independent C layouts and clean up injected conversion failures", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_CONVERSION_TEST !== "1"
	, timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = dotnetConversionIr(), generated = generateCopiedDotnetGraphConversions(ir), layout = dotnetGraphLayoutProbe(generated);
	const native = await readFile("tests/fixtures/structured-types/recursive-rust-native.c", "utf8");
	await saveLakeFile(root, "recursive.h", generateCopiedCGraphTypes(ir).header);
	await saveLakeFile(root, "native.c", `#include "recursive.h"\n${native}\n${dotnetGraphNativeExtras(generated)}\n${layout.c}`);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-fPIC", "-shared", "native.c", "-o", "libgraph-probe.so"], root, { PATH: "/usr/bin:/bin" });
	await saveLakeFile(root, "Values.cs", generated.valuesSource);
	const instrumented = instrumentDotnetGraphs(generated.source);
	assert.notEqual(instrumented, generated.source);
	await saveLakeFile(root, "Runtime.cs", instrumented);
	await saveLakeFile(root, "Probe.cs", dotnetGraphProbeSource(generated));
	const probe = await readFile("tests/fixtures/structured-types/recursive-dotnet-conversions.cs", "utf8");
	await saveLakeFile(root, "Program.cs", probe);
	const faults = await readFile("tests/fixtures/structured-types/recursive-dotnet-faults.cs", "utf8");
	await saveLakeFile(root, "Faults.cs", faults);
	await saveLakeFile(root, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableNETAnalyzers>false</EnableNETAnalyzers></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const dotnet = nativeFixtureEnvironment(["dotnet"]).LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(dotnet, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	const result = await runCopied(dotnet, ["out/Probe.dll", join(root, "libgraph-probe.so")], root, env);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.equal(observation.layoutChecks, layout.count); assert.ok(observation.checks > 200); assert.ok(observation.checkpoints > 20);
	const collisions = generateCopiedDotnetGraphConversions(dotnetCollisionIr()), collisionRoot = join(root, "collisions");
	await saveLakeFile(collisionRoot, "Values.cs", collisions.valuesSource);
	await saveLakeFile(collisionRoot, "Runtime.cs", collisions.source);
	await saveLakeFile(collisionRoot, "Probe.csproj", await readFile(join(root, "Probe.csproj"), "utf8"));
	await saveLakeFile(collisionRoot, "NuGet.Config", await readFile(join(root, "NuGet.Config"), "utf8"));
	const tree = collisions.types.find(node => node.ref.id === "lean:Recursive.Tree");
	const link = collisions.types.find(node => node.ref.id === "lean:Recursive.Link");
	const collisionProbe = `using V = global::LeanBridge.Recursive;
using global::LeanBridge.Recursive.Interop;
internal static unsafe class Program
{
    static void Main()
    {
        var leaf = new V.System(default, true, 255, 65535, uint.MaxValue, ulong.MaxValue,
            -128, -32768, int.MinValue, long.MinValue, (global::System.Numerics.BigInteger.One << 200) + 7, -1,
            1.5f, -2.25, "text\\0", new byte[] { 0, 255 }, new global::System.Text.Rune(0x1f331), 9, -9);
        var input = new V.GraphRuntimeBranch(new V.GraphRuntime[] { new V.GraphRuntimeLeaf(leaf) });
        using var scope = new GraphScope();
        var raw = GraphRuntime.Write${tree.index}(input, scope);
        var copy = GraphRuntime.Read${tree.index}(&raw, scope);
        if (input != copy || global::System.Object.ReferenceEquals(input, copy)) throw new global::System.Exception("Copied collision value");
        var link = new V.V(V.Option<V.V>.Some(new V.V(V.Option<V.V>.None)));
        var rawLink = GraphRuntime.Write${link.index}(link, scope);
        if (GraphRuntime.Read${link.index}(&rawLink, scope) != link) throw new global::System.Exception("Copied V value");
        global::System.Console.WriteLine("collision-copy-ok");
    }
}
`;
	await saveLakeFile(collisionRoot, "Program.cs", collisionProbe);
	await runCopied(dotnet, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], collisionRoot, env);
	const collided = await runCopied(dotnet, ["out/Probe.dll"], collisionRoot, env);
	assert.equal(collided.stdout, "collision-copy-ok\n"); assert.equal(collided.stderr, "");
	await saveLakeFile("build/recursive", "dotnet-conversions.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false, installedPackage: false
		, observation
		, sourceSha256: sha256(generated.source)
		, valuesSha256: sha256(generated.valuesSource)
		, nativeSha256: sha256(native)
		, probeSha256: sha256(probe), faultsSha256: sha256(faults)
		, collisionSourceSha256: sha256(collisions.source)
		, collisionValuesSha256: sha256(collisions.valuesSource)
		, collisionProbeSha256: sha256(collisionProbe)
		, instrumentedSha256: sha256(instrumented) }));
});

test("ordinary and reviewed Lean graphs execute through C# with cleanup and retirement", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_NATIVE_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-native-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkDotnetNativeGraphs } = await import("./helpers/dotnet-native-graphs.mjs");
	const report = await checkDotnetNativeGraphs(root);
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	for(const item of report.observations)
	{
		assert.equal(item.exports, 18); assert.equal(item.scenarios.length, 4);
		assert.deepEqual(item.scenarios.map(scenario => scenario.mode), ["carrier", "raw", "cycle", "during"]);
	}
	await saveLakeFile("build/recursive", "dotnet-native.json", canonicalJson(report));
});

test("downstream CI requires isolated and compiled C# graph conversions", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_GRAPH_CONVERSION_TEST=1 LEAN_BRIDGE_DOTNET_GRAPH_NATIVE_TEST=1 node --test tests/dotnet-copied-graph-conversions.test.mjs"));
	for(const name of ["dotnet-conversions", "dotnet-native"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});
