/**
 * Isolated alias conversion fault probes leave the installed assembly unchanged.
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
 * Inject conversion failures and malformed native values into verified sources.
 *
 * @param options - Completed installed consumer and verified source projections.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.environment - Absolute .NET toolchain paths.
 * @param options.sources - Verified Api.cs and Runtime.cs source text.
 * @param options.projection - Private type indices, not a semantic oracle.
 */
export const checkDotnetAliasFaults = async ({ consumer, environment, sources, projection }) => {
	const root = join(consumer, "dotnet/probe"), replacements = [];
	let runtime = sources.runtime;
	const replace = (pattern, replacement, minimum = 1) => {
		const matches = [...runtime.matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); runtime = runtime.replace(pattern, replacement);
	};
	replace(/(private static [^\n]+ (?:To|From)\d+\([^\n]+\)\n {4}\{\n)/g, "$1        AliasProbe.Check();\n", 40);
	replace(/try \{ allocations.Add\(data\); \}/g, "AliasProbe.Live++;\n        try { AliasProbe.Check(); allocations.Add(data); }");
	replace(/catch \{ NativeMemory.Free\(\(void\*\)data\); throw; \}/g, "catch { AliasProbe.Live--; NativeMemory.Free((void*)data); throw; }");
	replace(/foreach \(var data in allocations\) NativeMemory.Free\(\(void\*\)data\);/g, "foreach (var data in allocations) { AliasProbe.Live--; NativeMemory.Free((void*)data); }");
	replace(/( {12}var status = Native.Call\d+)/g, "            AliasProbe.Calls++;\n$1", 31);
	replace(/finally \{ (Native.Clear\d+\(ref output\);) \}/g, "finally { AliasProbe.Clears++; $1 }", 10);
	runtime += `\ninternal static class AliasProbe {
    [ThreadStatic] internal static int Count, Target, Live, Calls, Clears;
    internal static void Check() { if (++Count == Target) throw new OutOfMemoryException("injected conversion failure"); }
}\n`;
	const program = await readFile("tests/fixtures/alias-consumers/dotnet-faults.cs", "utf8");
	await saveLakeFile(root, "Api.cs", sources.api); await saveLakeFile(root, "Runtime.cs", runtime);
	await saveLakeFile(root, "Program.cs", program);
	await saveLakeFile(root, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(environment.LEAN_BRIDGE_DOTNET), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(environment.LEAN_BRIDGE_DOTNET, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	await cp(join(consumer, "dotnet/out/runtimes"), join(root, "out/runtimes"), { recursive: true });
	const indices = ["echo_maybe", "echo_outcome", "reverse_rows", "echo_string", "echo_char"].map(field => String(projection.surface.copy(projection.surface.functions.find(fn => fn.field === field).declaration.result.type).index));
	const result = await runCopied(environment.LEAN_BRIDGE_DOTNET, ["out/Probe.dll", ...indices], root, env);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^alias-dotnet-faults:\d+:17\n$/);
	const checks = Number(result.stdout.split(":")[1]); assert.ok(checks > 100);
	return { checks, malformedChecks: 17, partialInputChecks: 64, replacements
		, apiSourceSha256: sha256(sources.api)
		, runtimeSourceSha256: sha256(sources.runtime)
		, instrumentedRuntimeSha256: sha256(runtime)
		, probeSourceSha256: sha256(program)
		, isolatedInstrumentedProjection: true, releaseAssemblyUnchanged: true };
};
