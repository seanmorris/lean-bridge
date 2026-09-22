/**
 * Isolated C# collection probes. Original release sources stay unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Add conversion and allocation checkpoints only to a separate source copy.
 *
 * @param sources - Verified generated public API and private runtime sources.
 */
export const dotnetCollectionProbe = async sources => {
	let runtime = sources.runtime;
	const replacements = [];
	const replace = (pattern, replacement, minimum = 1) => {
		const count = [...runtime.matchAll(pattern)].length;
		assert.ok(count >= minimum, String(pattern)); replacements.push(count);
		runtime = runtime.replace(pattern, replacement);
	};
	replace(/(private static [^\n]+ (?:To|From)\d+\([^\n]+\)\n {4}\{\n)/g, "$1        CollectionProbe.Check();\n", 100);
	replace(/try \{ allocations.Add\(data\); \}/g, "CollectionProbe.Live++;\n        try { CollectionProbe.Check(); allocations.Add(data); }");
	replace(/catch \{ NativeMemory.Free\(\(void\*\)data\); throw; \}/g, "catch { CollectionProbe.Live--; NativeMemory.Free((void*)data); throw; }");
	replace(/foreach \(var data in allocations\) NativeMemory.Free\(\(void\*\)data\);/g, "foreach (var data in allocations) { CollectionProbe.Live--; NativeMemory.Free((void*)data); }");
	replace(/( {12}var status = Native.Call\d+)/g, "            CollectionProbe.Calls++;\n$1", 35);
	replace(/finally \{ (Native.Clear\d+\(ref output\);) \}/g, "finally { CollectionProbe.Clears++; $1 }", 30);
	runtime += `\ninternal static class CollectionProbe {
    [ThreadStatic] internal static int Count, Target, Live, Calls, Clears;
    internal static void Check() { if (++Count == Target) throw new OutOfMemoryException("injected collection conversion failure"); }
}\n`;
	return { runtime, program: await readFile("tests/fixtures/collection-consumers/dotnet-faults.cs", "utf8"), replacements };
};

/**
 * Private layout indices, never an expected algorithm result.
 *
 * @param projection - Actual compiler-checked C# projection.
 */
export const dotnetCollectionIndices = projection => {
	const indices = Object.fromEntries(projection.surface.functions.map(fn => [fn.field, projection.surface.copy(fn.declaration.result.type).index]));
	for(const copy of projection.surface.copies.filter(copy => copy.scalarName)) indices[copy.scalarName] = copy.index;
	indices.record = projection.surface.copies.find(copy => copy.record?.name === "Primitives").index;
	indices.packet = projection.surface.copies.find(copy => copy.record?.name === "Packet").index;
	indices.words = projection.surface.copies.find(copy => copy.element?.scalarName === "uint32").index;
	return indices;
};

/**
 * Exercise host cleanup and native-result clears in an isolated projection copy.
 *
 * @param options - Verified source and installed original native libraries.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.environment - Absolute .NET toolchain selection.
 * @param options.sources - Hash-verified generated sources.
 * @param options.projection - Compiler-checked private layout indices.
 */
export const checkDotnetCollectionFaults = async ({ consumer, environment, sources, projection }) => {
	const root = join(consumer, "dotnet/probe"), probe = await dotnetCollectionProbe(sources);
	await saveLakeFile(root, "Api.cs", sources.api); await saveLakeFile(root, "Runtime.cs", probe.runtime);
	await saveLakeFile(root, "Program.cs", probe.program);
	await saveLakeFile(root, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(environment.LEAN_BRIDGE_DOTNET), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(environment.LEAN_BRIDGE_DOTNET, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	await cp(join(consumer, "dotnet/out/runtimes"), join(root, "out/runtimes"), { recursive: true });
	const observations = {};
	for(const mode of ["host", "native"])
	{
		const result = await runCopied(environment.LEAN_BRIDGE_DOTNET, ["out/Probe.dll", mode, JSON.stringify(dotnetCollectionIndices(projection))], root, env);
		assert.equal(result.stderr, "");
		const observation = JSON.parse(result.stdout);
		assert.equal(observation.mode, mode); assert.ok(observation.checkpoints > 200);
		assert.equal(observation.partialInputChecks, 64); assert.equal(observation.liveAllocations, 0);
		assert.equal(observation.nativeExecuted, mode === "native"); observations[mode] = observation;
	}
	return { ...observations, replacements: probe.replacements
		, apiSourceSha256: sha256(sources.api)
		, runtimeSourceSha256: sha256(sources.runtime)
		, instrumentedRuntimeSha256: sha256(probe.runtime)
		, probeSourceSha256: sha256(probe.program)
		, isolatedInstrumentedProjection: true };
};
