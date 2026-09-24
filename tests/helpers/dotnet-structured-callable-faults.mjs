/**
 * Fault injection into isolated copies of verified C# package sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Add before/after conversions and ownership/allocation checkpoints.
 *
 * @param source - Hash-verified original Runtime.cs.
 */
export const instrumentDotnetStructuredCallables = source => {
	let runtime = source;
	const replacements = {}, wrappers = [];
	const replace = (name, pattern, value, minimum = 1) => {
		const count = [...runtime.matchAll(pattern)].length;
		assert.ok(count >= minimum, `${name}: ${count}`); replacements[name] = count;
		runtime = runtime.replace(pattern, value);
	};
	replace("conversions", /private static ([^\n]+) ((?:To|From)\d+)\(([^\n]+)\)\n {4}\{/g, (all, type, name, parameters) => {
		wrappers.push(`    private static ${type} ${name}(${parameters})
    {
        StructuredProbe.Tick();
        var result = Core${name}(value${parameters.includes(", Scope scope") ? ", scope" : ""});
        StructuredProbe.Tick();
        return result;
    }`);
		return all.replace(`${name}(`, `Core${name}(`);
	}, 40);
	replace("conversionWrappers", /internal static unsafe class Runtime\n\{/g, all => `${all}\n${wrappers.join("\n")}`);
	replace("scopeCount", /internal sealed unsafe class Scope : IDisposable\n\{/g, "$&\n    internal Scope() { StructuredProbe.Scopes++; }");
	replace("allocation", /NativeMemory.AllocZeroed\(checked\(\(nuint\)count \* \(nuint\)width\)\)/g, "StructuredProbe.Allocate(checked((nuint)count * (nuint)width))");
	replace("allocationRegister", /try \{ allocations.Add\(data\); \}/g, "try { StructuredProbe.Tick(); allocations.Add(data); }");
	replace("free", /NativeMemory.Free\(\(void\*\)data\)/g, "StructuredProbe.Free((void*)data)", 2);
	replace("scopeClose", /allocations.Clear\(\);/g, "allocations.Clear(); StructuredProbe.Scopes--;");
	replace("frameCount", /internal sealed class CallbackFrame : IDisposable\n\{/g, "$&\n    internal CallbackFrame() { StructuredProbe.Frames++; }");
	replace("callbackKeep", /internal void Keep\(global::System.Delegate callback\) => roots.Add\(callback\);/g, "internal void Keep(global::System.Delegate callback) { StructuredProbe.Tick(); roots.Add(callback); StructuredProbe.Roots++; StructuredProbe.Tick(); }");
	replace("frameClose", /global::System.GC.KeepAlive\(roots\); roots.Clear\(\);/g, "global::System.GC.KeepAlive(roots); StructuredProbe.Roots -= roots.Count; roots.Clear(); StructuredProbe.Frames--;");
	replace("borrow", /CallbackFrame.Validate\(callback\);/g, "StructuredProbe.Tick(); CallbackFrame.Validate(callback); StructuredProbe.Tick();", 14);
	replace("thunk", /return new B(\d+) \{ Call = Marshal.GetFunctionPointerForDelegate\(function\) \};/g, "StructuredProbe.Tick(); return new B$1 { Call = Marshal.GetFunctionPointerForDelegate(function) };", 14);
	replace("own", /var lease = new ClosureLease\(Native.Dispose(\d+)\);/g, "StructuredProbe.Tick(); var lease = new ClosureLease(Native.Dispose$1); StructuredProbe.Tick();", 14);
	replace("adopt", /lease.Adopt\(ref pointer\);/g, "StructuredProbe.Tick(); lease.Adopt(ref pointer);", 14);
	replace("clear", /internal static extern void (Clear\d+)\(ref (N\d+) value\);/g, (_, name, type) => `internal static extern void Raw${name}(ref ${type} value);
    internal static void ${name}(ref ${type} value) { Raw${name}(ref value); StructuredProbe.Zero(value); }`, 15);
	replace("dispose", /internal static extern void (Dispose\d+)\(ref nint self\);/g, (_, name) => `internal static extern void Raw${name}(ref nint self);
    internal static void ${name}(ref nint self) { Raw${name}(ref self); StructuredProbe.Zero(self); }`, 14);
	return { runtime, replacements };
};

/**
 * Run instrumented copies with the original installed native libraries.
 *
 * @param options - Installed original package and its compiler-checked projection.
 * @param options.consumer - Task-owned consumer root.
 * @param options.environment - Explicit .NET toolchain selection.
 * @param options.sources - Verified original Api.cs and Runtime.cs.
 * @param options.projection - Private native layout names, not expected results.
 */
export const checkDotnetStructuredCallableFaults = async ({ consumer, environment, sources, projection }) => {
	const root = join(consumer, "dotnet/probe");
	const probe = instrumentDotnetStructuredCallables(sources.runtime);
	const program = await readFile("tests/fixtures/structured-callable-consumers/dotnet-faults.cs", "utf8");
	const values = await readFile("tests/fixtures/structured-callable-consumers/dotnet-values.cs", "utf8");
	await saveLakeFile(root, "Api.cs", sources.api);
	await saveLakeFile(root, "Runtime.cs", probe.runtime);
	await saveLakeFile(root, "Program.cs", program);
	await saveLakeFile(root, "Values.cs", values);
	await saveLakeFile(root, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const dotnet = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet)
		, DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1"
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(dotnet, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	await cp(join(consumer, "dotnet/out/runtimes"), join(root, "out/runtimes"), { recursive: true });
	const layouts = projection.surface.copies.filter(copy => copy.compound && copy.compound !== "tuple" || copy.variant || copy.element).map(copy => ({ index: copy.index, kind: copy.variant ? "variant" : copy.element ? "sequence" : copy.compound }));
	const result = await runCopied(dotnet, ["out/Probe.dll", JSON.stringify(layouts)], root, env);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assertDotnetStructuredFaults(observation);
	return { ...observation, replacements: probe.replacements
		, apiSourceSha256: sha256(sources.api)
		, runtimeSourceSha256: sha256(sources.runtime)
		, instrumentedRuntimeSha256: sha256(probe.runtime)
		, probeSourceSha256: sha256(program), valuesSourceSha256: sha256(values)
		, isolatedInstrumentedProjection: true, originalNativeLibraries: true };
};

/**
 * Every measured checkpoint in each owned and borrowed path must have failed twice.
 *
 * @param record - Actual isolated-probe observations.
 */
export const assertDotnetStructuredFaults = record => {
	assert.deepEqual(record.shapes.map(row => row.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias"]);
	let faults = 0;
	for(const row of record.shapes)
	{
		assert.deepEqual(Object.keys(row.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
		for(const value of Object.values(row.paths)) assert.ok(Number.isInteger(value) && value > 0);
		assert.equal(row.faults, Object.values(row.paths).reduce((sum, value) => sum + value, 0) * 2);
		faults += row.faults;
	}
	assert.equal(record.faults, faults); assert.ok(faults > 1000);
	assert.ok(record.checks > faults); assert.ok(record.clears > 100);
	assert.ok(record.malformed >= 10); assert.equal(record.liveAllocations, 0);
	assert.equal(record.liveIdentities, 0); assert.equal(record.deferredCloseChecks, 8);
};
