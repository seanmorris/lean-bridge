/**
 * Isolated conversion/union probes preserve the original installed assembly.
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
 * Inject failures into a separate copy of the verified source projection.
 *
 * @param options - Installed consumer and private compiler-authorized type names.
 * @param options.consumer - Task-owned temporary root.
 * @param options.environment - Explicit .NET toolchain paths.
 * @param options.sources - Verified Api.cs and Runtime.cs sources.
 * @param options.projection - Native type indices, not an expected semantic result.
 */
export const checkDotnetVariantFaults = async ({ consumer, environment, sources, projection }) => {
	const root = join(consumer, "dotnet/probe"), replacements = [];
	let runtime = sources.runtime;
	const replace = (pattern, replacement, minimum = 1) => {
		const matches = [...runtime.matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); runtime = runtime.replace(pattern, replacement);
	};
	replace(/(private static [^\n]+ (?:To|From)\d+\([^\n]+\)\n {4}\{\n)/g, "$1        VariantProbe.Check();\n", 60);
	replace(/try \{ allocations.Add\(data\); \}/g, "VariantProbe.Live++;\n        try { VariantProbe.Check(); allocations.Add(data); }");
	replace(/catch \{ NativeMemory.Free\(\(void\*\)data\); throw; \}/g, "catch { VariantProbe.Live--; NativeMemory.Free((void*)data); throw; }");
	replace(/foreach \(var data in allocations\) NativeMemory.Free\(\(void\*\)data\);/g, "foreach (var data in allocations) { VariantProbe.Live--; NativeMemory.Free((void*)data); }");
	replace(/( {12}var status = Native.Call\d+)/g, "            VariantProbe.Calls++;\n$1", 14);
	replace(/finally \{ (Native.Clear\d+\(ref output\);) \}/g, "finally { VariantProbe.Clears++; $1 }", 10);
	runtime += `\ninternal static class VariantProbe {
    [ThreadStatic] internal static int Count, Target, Live, Calls, Clears;
    internal static void Check() { if (++Count == Target) throw new OutOfMemoryException("injected conversion failure"); }
}\n`;
	const program = await readFile("tests/fixtures/variant-consumers/dotnet-faults.cs", "utf8");
	await saveLakeFile(root, "Api.cs", sources.api); await saveLakeFile(root, "Runtime.cs", runtime);
	await saveLakeFile(root, "Program.cs", program);
	await saveLakeFile(root, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(environment.LEAN_BRIDGE_DOTNET), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(environment.LEAN_BRIDGE_DOTNET, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	await cp(join(consumer, "dotnet/out/runtimes"), join(root, "out/runtimes"), { recursive: true });
	const indices = projection.surface.copies.filter(copy => copy.variant).map(copy => String(copy.index));
	assert.equal(indices.length, 7);
	const result = await runCopied(environment.LEAN_BRIDGE_DOTNET, ["out/Probe.dll", ...indices], root, env);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^variant-dotnet-faults:\d+:13\n$/);
	const checks = Number(result.stdout.split(":")[1]); assert.ok(checks > 100);
	return { checks, malformedChecks: 13, malformedTags: 7, inactiveCases: 6
		, partialInputChecks: 64, replacements
		, apiSourceSha256: sha256(sources.api)
		, runtimeSourceSha256: sha256(sources.runtime)
		, instrumentedRuntimeSha256: sha256(runtime)
		, probeSourceSha256: sha256(program)
		, isolatedInstrumentedProjection: true, releaseAssemblyUnchanged: true };
};
