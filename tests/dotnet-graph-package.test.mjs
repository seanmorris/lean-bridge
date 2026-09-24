/**
 * Generated recursive C# APIs, lazy asset validation and prepared NuGet packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { generateCopiedDotnetGraphPackage, compileCopiedDotnetGraphPackageModel } from "../src/backends/dotnet/copied-graph-package.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { dotnetConversionIr, dotnetCollisionIr } from "./helpers/dotnet-graph-probes.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkDotnetGraphPackageTypes } from "./helpers/dotnet-graph-package-types.mjs";
import { dotnetRegressionExecutions, dotnetCompoundSourceTrees, assertDotnetFamilyRegressions, assertDotnetInstalledRegressions } from "./helpers/dotnet-installed-regressions.mjs";
import { assertDotnetGraphPackageReports } from "./helpers/dotnet-graph-receipt.mjs";
import { beforeDotnetGraphAdmission } from "./helpers/native-dotnet-graph-regression.mjs";
import { beforeNativeSharedAdmission } from "./helpers/native-shared-admission.mjs";
import { assertDotnetSharedRegressions } from "./helpers/dotnet-shared-regressions.mjs";
import { assertCurrentDotnetGraphPackages } from "./helpers/dotnet-current-graph-evidence.mjs";

test("C# regression signatures preserve parameter order and reconstruct reviewed compound sources", async () => {
	const one = { name: "one", parameters: ["uint32", "string"], result: "bool" };
	const two = { name: "two", parameters: [], result: "uint8" };
	const report = signatures => dotnetRegressionExecutions({ reports: [{ signatures }] });
	assert.deepEqual(report([one, two]), report([two, one]));
	assert.notDeepEqual(report([one, two]), report([{ ...one, parameters: [...one.parameters].reverse() }, two]));
	const sources = await dotnetCompoundSourceTrees();
	assert.equal(sources.previous.sourceTreeSha256, "6e22b5654b4cecab9774faace86a54cae4454aca3a4738711a5f2c36b7280dfb");
	assert.equal(sources.current.sourceTreeSha256, "6929469afb9b4c26fb8205000b46944ccbfa1e74e40bba0d15a00abe36dd61bc");
});

test("C# existing-family regressions bind all source paths and reject weakened observations", async () => {
	const { record, baselines } = await assertDotnetFamilyRegressions();
	const reject = change => {
		const runs = structuredClone(record.runs); change(runs);
		assert.throws(() => assertDotnetInstalledRegressions(runs, baselines, record.compoundReviewedSource));
	};
	reject(runs => { runs.aliases.executions.pop(); });
	reject(runs => { runs.collections.executions[0].checks--; });
	reject(runs => { runs.collections.executions[0].faults.native.liveAllocations++; });
	reject(runs => { runs.callables.executions[0].signaturesSha256 = "0".repeat(64); });
	reject(runs => { runs.compounds.executions[1].sourceTreeSha256 = "0".repeat(64); });
	reject(runs => { runs.lists.executions[0].installed.rejected.pop(); });
	reject(runs => { runs.variants.executions[0].nativeFaults.allocationFailures--; });
	reject(runs => { runs.aliases.executions[0].installed.sourceFreeExecutions = 1; });
});

test("recursive C# package observations bind original installs, reproduction and shared loading", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-recursive-packages-20260923.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.installedPackage, true); assert.equal(record.wordBits, 64);
	assert.equal(record.reportSha256, sha256(canonicalJson(record.reports)));
	await assertCurrentDotnetGraphPackages(record);
	for(const log of Object.values(record.logs))
	{
		assert.equal(sha256(log.text), log.sha256);
		assert.match(log.text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/);
	}
	assertDotnetGraphPackageReports(record.reports);
	const guide = (await readFile("docs/consume/dotnet.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
	for(const run of record.reports.packages.observations)
		assert.equal(run.documentation.sourceSha256, sha256(guide.match(/```csharp\n([^]*?)\n```/)[1] + "\n"));
	for(const change of [
		reports => { reports.reproducibility.observations[0].archiveSha256 = "0".repeat(64); }
		, reports => { reports.packages.observations[0].checks--; }
		, reports => { reports.packages.observations[0].tamperRejections--; }
		, reports => { reports.composition.scenarios.pop(); }
		, reports => { reports.conflicts.scenarios.pop(); }
		, reports => { reports.conflicts.rejectsBeforeComponentLoad = false; }
	]) {
		const reports = structuredClone(record.reports); change(reports);
		reports.reproducibility.originalReportSha256 = sha256(canonicalJson(reports.packages));
		assert.throws(() => assertDotnetGraphPackageReports(reports));
	}
});

test("NuGet graph admission reconstructs exact shared sources without masking other edits", async () => {
	const baseline = JSON.parse(await readFile("docs/evidence/perl-recursive-regressions-20260923.json"));
	for(const path of ["src/build/native-c-projection.mjs", "src/build/native-graph-projection.mjs", "src/build/native-project.mjs"])
	{
		const source = beforeNativeSharedAdmission(path, await readFile(path, "utf8"), "maven"), expected = baseline.sourceHashes[path];
		assert.match(expected, /^[a-f0-9]{64}$/);
		assert.equal(sha256(beforeDotnetGraphAdmission(path, source)), expected);
		assert.notEqual(sha256(beforeDotnetGraphAdmission(path, source + "\n// unrelated change\n")), expected);
	}
	assert.throws(() => beforeDotnetGraphAdmission("src/build/native-component.mjs", "anything"), /Not a NuGet/);
});

test("shared NuGet regression controls reject changed archive identities and glibc floors", async () => {
	const baselines = {}, runs = {};
	for(const [key, name] of Object.entries({
		c: "native-recursive-packages", jvm: "native-recursive-jvm-regression"
		, perl: "perl-recursive-packages", python: "python-recursive-packages"
		, pythonRegression: "python-recursive-regressions"
		, ruby: "ruby-recursive-packages", rust: "rust-recursive-packages" }))
		baselines[key] = JSON.parse(await readFile(`docs/evidence/${name}-20260923.json`));
	for(const key of ["c", "jvm", "perl", "python", "ruby", "rust"])
	{
		const baseline = baselines[key];
		runs[key] = { environment: { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: baseline.packageGlibcFloor }
			, ...key === "perl" ? { report: baseline.reports.installed } : { executions: key === "c" ? baseline.reports : key === "jvm" ? baseline.executions : baseline.report.observations } };
	}
	assertDotnetSharedRegressions(runs, baselines);
	const changed = structuredClone(runs); changed.c.executions[0].packages[0].artifacts[0].sha256 = "0".repeat(64);
	assert.throws(() => assertDotnetSharedRegressions(changed, baselines));
	const floor = structuredClone(runs); floor.c.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38";
	assert.throws(() => assertDotnetSharedRegressions(floor, baselines));
});

const loadingEvidence = () => ({ componentId: "recursive@1.0.0"
	, library: "librecursive.so"
	, runtimeIdentity: "1".repeat(64), componentReceiptSha256: "2".repeat(64)
	, libraries: Object.fromEntries(["librecursive.so", "librecursive_component.so", "libleanshared.so", "liblean_bridge_native.so"].map(name => [name, "3".repeat(64)])) });

test("recursive C# package APIs are deterministic, typed and separate from native loading", () => {
	const ir = dotnetConversionIr(), before = structuredClone(ir);
	const files = generateCopiedDotnetGraphPackage(ir), model = compileCopiedDotnetGraphPackageModel(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedDotnetGraphPackage(ir), files);
	const audit = auditManagedBindingPackage(ir, files, "dotnet");
	assert.deepEqual(audit.publicFiles, ["src/LeanBridge.Recursive/Api.cs"]);
	const api = files[audit.publicFiles[0]], calls = files["src/LeanBridge.Recursive/Calls.cs"];
	assert.match(api, /public static _V.Tree Tree\(_V.Tree @value0\)/);
	assert.match(api, /public static bool WordMax\(ulong @value0\)/);
	assert.doesNotMatch(api, /NativeLibrary|NativeMemory|unsafe|GraphRaw|delegate\*/);
	assert.match(calls, /if \(!GraphNative.IsLoaded\)/);
	assert.ok(calls.indexOf("new GraphScope(true)") < calls.indexOf("var symbols = GraphNative.Resolve();"));
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).copiedGraph, { schemaVersion: 1, layoutSha256: model.layoutSha256 });
	assert.match(files["README.md"], /262,144 visited values/);
});

test("recursive C# loading requires exact native identities and safe parameter names", () => {
	const ir = dotnetConversionIr(), evidence = loadingEvidence();
	const files = generateCopiedDotnetGraphPackage(ir, evidence), calls = files["src/LeanBridge.Recursive/Calls.cs"];
	assert.ok(calls.indexOf("Verify(global::System.IO.Path.Combine") < calls.indexOf("NativeLibrary.Load("));
	assert.match(calls, /Conflicting builds of the same Lean component/);
	assert.match(calls, /Incompatible Lean runtime identities in one process/);
	assert.match(calls, /global::System.Threading.Volatile.Write/);
	for(const change of [{ componentId: "wrong" }
		, { runtimeIdentity: "x" }, { library: "../librecursive.so" }
		, { libraries: { ...evidence.libraries, "../outside.so": "3".repeat(64) } }
		, { libraries: { "librecursive.so": "3".repeat(64) } }])
		assert.throws(() => generateCopiedDotnetGraphPackage(ir, { ...evidence, ...change }), /loading/);
	for(const name of ["a-b", "x);", "", "é"])
	{
		const invalid = structuredClone(ir); invalid.declarations[0].parameters[0].name = name;
		assert.throws(() => compileCopiedDotnetGraphPackageModel(invalid), /parameter|identifier|name/i);
	}
	const duplicate = structuredClone(ir), joinTrees = duplicate.declarations.find(item => item.name === "joinTrees");
	joinTrees.parameters[1].name = joinTrees.parameters[0].name;
	assert.throws(() => compileCopiedDotnetGraphPackageModel(duplicate), /distinct|duplicate/);
});

test("recursive C# auditing accepts nominal FFI-like names only in exact generated public source", () => {
	const ir = dotnetConversionIr(); ir.types.find(type => type.name === "EmptyRecord").name = "NativeLibrary";
	const files = generateCopiedDotnetGraphPackage(ir), path = "src/LeanBridge.Recursive/Api.cs";
	assert.doesNotThrow(() => auditManagedBindingPackage(ir, files, "dotnet"));
	for(const suffix of ["\npublic class Extra {}", "\npublic unsafe class PointerLeak {}"])
		assert.throws(() => auditManagedBindingPackage(ir, { ...files, [path]: files[path] + suffix }, "dotnet"), { code: "private-ffi-public" });
	const manifest = JSON.parse(files["binding-manifest.json"]); manifest.publicFiles = [];
	assert.throws(() => auditManagedBindingPackage(ir, { ...files, "binding-manifest.json": JSON.stringify(manifest) }, "dotnet"), { code: "private-ffi-public" });
});

test("recursive NuGet admission validates requested graph targets without requiring public C", () => {
	const ir = nativeRecursiveReviewedIr(), model = compileNativeGraphProjection(ir, ["nuget"]);
	assert.equal(model.prefix, "recursive");
	for(const targets of [["c", "nuget"], ["cargo", "nuget"], ["pypi", "rubygems", "nuget"]])
		assert.equal(compileNativeGraphProjection(ir, targets).layoutSha256, model.layoutSha256);
	for(const targets of [["nuget", "maven"], ["nuget", "php-native"], ["nuget", "wit-wasi"]])
		assert.equal(compileNativeGraphProjection(ir, targets).prefix, "recursive");
	for(const targets of [["nuget", "nuget"], ["nuget", "unknown"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
});

test("recursive C# package assemblies compile and cold invalid calls never load assets", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_PACKAGE_TEST !== "1"
	, timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-graph-package-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const dotnet = nativeFixtureEnvironment(["dotnet"]).LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet)
		, DOTNET_CLI_HOME: join(root, "home")
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, NUGET_PACKAGES: join(root, "packages") };
	for(const collision of [false, true])
	{
		const ir = collision ? dotnetCollisionIr() : dotnetConversionIr(), unit = { kind: "primitive", name: "unit" };
		if(collision) ir.types.find(type => type.id === "lean:Recursive.EmptyRecord").name = "NativeLibrary";
		const fn = structuredClone(ir.declarations[0]);
		Object.assign(fn, { id: "lean:Recursive.touch", name: "touch", overloadKey: "touch" });
		fn.parameters[0].type = unit; fn.parameters[0].name = "Interop"; fn.result.type = unit; ir.declarations.push(fn);
		const files = generateCopiedDotnetGraphPackage(ir, collision ? loadingEvidence() : null), directory = join(root, collision ? "collision" : "ordinary");
		auditManagedBindingPackage(ir, files, "dotnet");
		for(const [path, contents] of Object.entries(files)) await saveLakeFile(directory, path, contents);
		await runCopied(dotnet, ["build", "src/LeanBridge.Recursive/LeanBridge.Recursive.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], directory, env);
		const consumer = join(directory, "consumer");
		await saveLakeFile(consumer, "Consumer.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><UseAppHost>false</UseAppHost><TreatWarningsAsErrors>true</TreatWarningsAsErrors><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Reference Include="LeanBridge.Recursive"><HintPath>../out/LeanBridge.Recursive.dll</HintPath></Reference></ItemGroup></Project>');
		await saveLakeFile(consumer, "Program.cs", `using V = global::LeanBridge.Recursive;
internal static class Program
{
    static int Main()
    {
        var checks = 0;
        static void Reject(global::System.Action call) { try { call(); } catch (global::System.ArgumentException) { return; } throw new global::System.Exception("Expected validation before native loading"); }
        Reject(() => V.Api.Tree(null!)); checks++;
        Reject(() => V.Api.JoinTrees(new V.${collision ? "GraphRuntime" : "Tree"}Branch(global::System.Array.Empty<V.${collision ? "GraphRuntime" : "Tree"}>()), null!)); checks++;
        var children = new V.${collision ? "GraphRuntime" : "Tree"}[1]; var cycle = new V.${collision ? "GraphRuntime" : "Tree"}Branch(children); children[0] = cycle;
        Reject(() => V.Api.Tree(cycle)); checks++;
        V.${collision ? "Utf8" : "Spine"} deep = new V.${collision ? "Utf8" : "Spine"}Leaf(1);
        for (var index = 0; index < 130; index++) deep = new V.${collision ? "Utf8" : "Spine"}Next(deep);
        Reject(() => V.Api.Spine(deep)); checks++;
        try { V.Api.Touch(Interop: default); }
        catch (global::System.${collision ? "DllNotFoundException" : "InvalidOperationException"}) { checks++; }
        if (checks != 5) throw new global::System.Exception("Valid call must reach the missing asset check");
        global::System.Console.WriteLine("cold-api-ok:" + checks); return 0;
    }
}
`);
		await runCopied(dotnet, ["build", "Consumer.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
		const result = await runCopied(dotnet, ["out/Consumer.dll"], consumer, env);
		assert.equal(result.stdout, "cold-api-ok:5\n"); assert.equal(result.stderr, "");
		if(!collision)
		{
			const types = await checkDotnetGraphPackageTypes({
				root: join(directory, "negative"), dotnet
				, assembly: join(directory, "out/LeanBridge.Recursive.dll")
				, environment: env });
			assert.equal(types.rejected.length, 8);
		}
	}
});

test("ordinary and reviewed recursive NuGet archives install and run without Lean or the SDK", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_INSTALLED_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-graph-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkDotnetGraphPackages } = await import("./helpers/dotnet-graph-packages.mjs");
	const report = await checkDotnetGraphPackages(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	for(const item of report.observations)
	{ assert.ok(item.checks > 650); assert.equal(item.tamperRejections, 4); }
	await saveLakeFile("build/recursive", "dotnet-packages.json", canonicalJson(report));
});

test("downstream CI requires original recursive NuGet installs and retains their report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_DOTNET_GRAPH_INSTALLED_TEST=1 node --test tests/dotnet-graph-package.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/dotnet-packages.json"));
	assert.ok(workflow.includes("            build/recursive/dotnet-packages.json\n"));
	assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_GRAPH_COMPOSITION_TEST=1 node --test tests/dotnet-graph-package.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/dotnet-composition.json"));
	assert.ok(workflow.includes("            build/recursive/dotnet-composition.json\n"));
	for(const [flag, report] of [["REPRODUCIBILITY", "reproducibility"], ["CONFLICT", "conflicts"]])
	{
		const command = `LEAN_BRIDGE_DOTNET_GRAPH_${flag}_TEST=1 node --test tests/dotnet-graph-package.test.mjs`;
		assert.ok(workflow.includes(`          ${command}\n`));
		assert.ok(workflow.includes(`test -s build/recursive/dotnet-${report}.json`));
		assert.ok(workflow.includes(`            build/recursive/dotnet-${report}.json\n`));
		assert.ok(workflow.includes(`consumer_command="$consumer_command && ${command}"`));
	}
});

test("recursive and ordinary installed NuGet packages share retirement and allow mixed C++ builds", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_COMPOSITION_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-graph-composition-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkDotnetGraphComposition } = await import("./helpers/dotnet-graph-composition.mjs");
	const report = await checkDotnetGraphComposition(root, message => t.diagnostic(message));
	assert.equal(report.packages.length, 3); assert.equal(report.scenarios.length, 2);
	await saveLakeFile("build/recursive", "dotnet-composition.json", canonicalJson(report));
});

test("independent recursive NuGet builds reproduce the original installed archives", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_REPRODUCIBILITY_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-graph-reproducibility-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const original = JSON.parse(await readFile("build/recursive/dotnet-packages.json", "utf8"));
	const { checkDotnetGraphReproducibility } = await import("./helpers/dotnet-graph-packages.mjs");
	const report = await checkDotnetGraphReproducibility(root, original, message => t.diagnostic(message));
	await saveLakeFile("build/recursive", "dotnet-reproducibility.json", canonicalJson(report));
});

test("original NuGet coordinate conflicts reject before loading and identical builds compose", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_CONFLICT_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-graph-conflicts-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkDotnetGraphConflicts } = await import("./helpers/dotnet-graph-conflicts.mjs");
	const report = await checkDotnetGraphConflicts(root, message => t.diagnostic(message));
	assert.equal(report.packages.length, 2); assert.equal(report.scenarios.length, 4);
	await saveLakeFile("build/recursive", "dotnet-conflicts.json", canonicalJson(report));
});
