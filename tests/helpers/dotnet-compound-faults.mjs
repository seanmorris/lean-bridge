/**
 * Fault injection into a copy of verified compiler-produced C# projection sources.
 * The installed release assembly stays unchanged and is tested separately.
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
 * Exercise cleanup at each input/output conversion checkpoint and malformed flags.
 *
 * @param options - Completed installed consumer and verified source projections.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.environment - Absolute .NET toolchain paths.
 * @param options.sources - Verified Api.cs and Runtime.cs source text.
 * @param options.projection - Private native type indices, not a semantic oracle.
 */
export const checkDotnetCompoundFaults = async ({ consumer, environment, sources, projection }) => {
	const root = join(consumer, "dotnet/probe"), replacements = [];
	let runtime = sources.runtime;
	const replace = (pattern, replacement, minimum = 1) => {
		const matches = [...runtime.matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); runtime = runtime.replace(pattern, replacement);
	};
	replace(/(private static [^\n]+ (?:To|From)\d+\([^\n]+\)\n {4}\{\n)/g, "$1        CompoundProbe.Check();\n", 100);
	replace(/try \{ allocations.Add\(data\); \}/g, "CompoundProbe.Live++;\n        try { CompoundProbe.Check(); allocations.Add(data); }");
	replace(/catch \{ NativeMemory.Free\(\(void\*\)data\); throw; \}/g, "catch { CompoundProbe.Live--; NativeMemory.Free((void*)data); throw; }");
	replace(/foreach \(var data in allocations\) NativeMemory.Free\(\(void\*\)data\);/g, "foreach (var data in allocations) { CompoundProbe.Live--; NativeMemory.Free((void*)data); }");
	replace(/( {12}var status = Native.Call\d+)/g, "            CompoundProbe.Calls++;\n$1", 64);
	replace(/finally \{ (Native.Clear\d+\(ref output\);) \}/g, "finally { CompoundProbe.Clears++; $1 }", 60);
	runtime += `\ninternal static class CompoundProbe {
    [ThreadStatic] internal static int Count, Target, Live, Calls, Clears;
    internal static void Check() { if (++Count == Target) throw new OutOfMemoryException("injected conversion failure"); }
}\n`;
	const program = await readFile("tests/fixtures/compound-consumers/dotnet-faults.cs", "utf8");
	await saveLakeFile(root, "Api.cs", sources.api); await saveLakeFile(root, "Runtime.cs", runtime);
	await saveLakeFile(root, "Program.cs", program);
	await saveLakeFile(root, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(environment.LEAN_BRIDGE_DOTNET), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(environment.LEAN_BRIDGE_DOTNET, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	await cp(join(consumer, "dotnet/out/runtimes"), join(root, "out/runtimes"), { recursive: true });
	const index = field => projection.surface.copy(projection.surface.functions.find(fn => fn.field === field).declaration.result.type).index;
	const result = await runCopied(environment.LEAN_BRIDGE_DOTNET, ["out/Probe.dll", String(index("option_string")), String(index("result_string"))], root, env);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^compound-dotnet-faults:\d+:9\n$/);
	const checks = Number(result.stdout.split(":")[1]); assert.ok(checks > 50);
	return { checks, flagChecks: 9, partialInputChecks: 16, replacements
		, apiSourceSha256: sha256(sources.api)
		, runtimeSourceSha256: sha256(sources.runtime)
		, instrumentedRuntimeSha256: sha256(runtime)
		, probeSourceSha256: sha256(program)
		, isolatedInstrumentedProjection: true, releaseAssemblyUnchanged: true };
};
