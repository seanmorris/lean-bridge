/**
 * Compile generated C# once against verified ordinary native artifacts.
 *
 * @file
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateCopiedDotnetPackage } from "../backends/dotnet/copied-values.mjs";
import { generateCallableDotnetGraphPackage } from "../backends/dotnet/callable-graph-package.mjs";
import { generateCopiedDotnetGraphPackage } from "../backends/dotnet/copied-graph-package.mjs";
import { auditManagedBindingPackage } from "../backends/managed/package-audit.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { ordinaryDotnetEvidence } from "./native-dotnet-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOrdinaryNuget } from "../release/native-nuget.mjs";

/**
 * Compile C# before invoking compiler-free NuGet assembly.
 *
 * @param options - Native roots and selected NuGet metadata.
 * @param options.working - Private staging directory.
 * @param options.nativeRoot - Verified native component directory.
 * @param options.runtimeRoot - Verified native runtime directory.
 * @param options.adapterRoot - Verified C adapter directory.
 * @param options.leanPrefix - Compiler license notices.
 * @param options.settings - Optional NuGet name and version.
 * @param options.glibcMinimumVersion - Validated native glibc floor.
 * @param options.environment - Explicit compiler environment.
 * @param options.signal - Optional cancellation signal.
 */
export const projectOrdinaryDotnet = async ({ working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings, glibcMinimumVersion, environment, signal }) => {
	const { model, projection, evidence } = await ordinaryDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const root = join(working, "native/dotnet"), scratch = join(working, "dotnet-compiler");
	const files = (model.copiedGraph ? (model.copiedGraph.callbacks ? generateCallableDotnetGraphPackage : generateCopiedDotnetGraphPackage) : generateCopiedDotnetPackage)(model.bindingIr, evidence);
	auditManagedBindingPackage(model.bindingIr, files, "dotnet");
	for(const [path, contents] of Object.entries(files))
	{ await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), contents, { flag: "wx" }); }
	const env = { ...environment, DOTNET_CLI_HOME: join(scratch, "cli"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1", NUGET_PACKAGES: join(scratch, "packages") };
	const run = args => processBuildRunner.capture({ command: environment.LEAN_BRIDGE_DOTNET ?? "dotnet", args, cwd: root, env, signal });
	const sdks = (await run(["--list-sdks"])).stdout.split("\n").map(line => /^(8\.0\.\d+) \[/.exec(line)?.[1]).filter(Boolean);
	const version = sdks.sort((a, b) => Number(a.split(".")[2]) - Number(b.split(".")[2])).at(-1);
	if(!version) throw new Error("Ordinary .NET packages require a .NET 8 SDK");
	await writeFile(join(root, "global.json"), canonicalJson({ sdk: { version, rollForward: "disable", allowPrerelease: false } }), { flag: "wx" });
	if((await run(["--version"])).stdout.trim() !== version) throw new Error("The generated .NET project did not use its selected SDK");
	const output = join(root, "lib/net8.0");
	await run(["build", `src/${projection.assembly}/${projection.assembly}.csproj`
		, "--configuration", "Release", "--output", output
		, "--nologo", "--disable-build-servers"
		, "-noAutoResponse"
		, "/p:ImportDirectoryBuildProps=false"
		, "/p:ImportDirectoryBuildTargets=false"
		, "/p:ImportDirectoryPackagesProps=false"
		, "/p:ContinuousIntegrationBuild=true", "/p:UseSharedCompilation=false"
		, `/p:BaseIntermediateOutputPath=${scratch}/obj/`
		, `/p:PathMap=${working}=/build/ordinary-dotnet`]);
	await rm(scratch, { recursive: true, force: true });
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(root, "native-dotnet.json"), canonicalJson({ schemaVersion: 1, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256, evidence, sdk: version, assembly: projection.assembly, files: inventory }), { flag: "wx" });
	return packageOrdinaryNuget({ working, dotnetRoot: root, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings, glibcMinimumVersion });
};
