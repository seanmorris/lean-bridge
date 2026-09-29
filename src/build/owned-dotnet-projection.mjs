/**
 * Compile the private C# ownership adapter and deterministic managed assembly.
 *
 * @file
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedDotnetPackage } from "../backends/dotnet/owned-package.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { ownedDotnetAdapterSources, ownedDotnetEvidence } from "./owned-dotnet-artifacts.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOwnedNuget } from "../release/owned-nuget.mjs";

/**
 * Producers compile once; NuGet consumers only load the authenticated binaries.
 *
 * @param options - Authenticated native roots, package settings and build tools.
 */
export const projectOwnedDotnet = async options => {
	const { working, nativeRoot, runtimeRoot, environment = process.env, signal } = options;
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
	if(!model.ownedGraph?.hostCallbacks) throw new TypeError("Owned C# requires authenticated callback/copy support");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks: true, transferredInputs });
	const projection = generateOwnedDotnetPackage(model.bindingIr, null, { transferredInputs }), prefix = c.values.prefix;
	const adapterRoot = join(working, "native/owned-dotnet-binding"), gmpRoot = join(adapterRoot, "gmp");
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
	if(!/^2\.\d+$/u.test(floor)) throw new TypeError("Invalid C# native glibc floor");
	for(const [path, source] of Object.entries(ownedDotnetAdapterSources(c, projection)))
	{
		await mkdir(dirname(join(adapterRoot, path)), { recursive: true });
		await writeFile(join(adapterRoot, path), source, { flag: "wx" });
	}
	await buildNativeGmp({ root: gmpRoot, environment, signal, privateSoname: true });
	await mkdir(join(adapterRoot, "lib"));
	const library = `lib${prefix}_dotnet.so`, gmpLibrary = "libgmp-lean-bridge.so.10";
	const nativeScratch = join(working, "dotnet-native-compiler"); await mkdir(nativeScratch);
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: adapterRoot, env: environment, signal });
	const flags = ["-O2", "-g0", "-fPIC", "-Wall", "-Wextra", "-Werror"
		, `-ffile-prefix-map=${working}=/build/owned-dotnet`
		, "-I", join(adapterRoot, "include"), "-I", join(adapterRoot, "internal")
		, "-I", join(gmpRoot, "include"), "-I", join(runtimeRoot, "include")];
	await run(environment.CC ?? "cc", ["-std=c11", ...flags
		, "-c", join(adapterRoot, "src", `${prefix}-dotnet.c`)
		, "-o", join(nativeScratch, "api.o")]);
	await run(environment.CXX ?? "c++", ["-std=c++17", ...flags
		, "-c", join(adapterRoot, "src", `${prefix}-dotnet-thread-exit.cpp`)
		, "-o", join(nativeScratch, "guard.o")]);
	await run(environment.CXX ?? "c++", ["-shared", "-pthread"
		, join(nativeScratch, "api.o"), join(nativeScratch, "guard.o")
		, "-L", join(gmpRoot, "lib"), "-L", nativeRoot
		, "-L", join(runtimeRoot, "lib"), "-Wl,--no-as-needed"
		, `-l:${gmpLibrary}`, `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared", "-Wl,-z,defs"
		, "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN", "-Wl,-z,nodelete"
		, `-Wl,-soname,${library}`, "-o", join(adapterRoot, "lib", library)]);
	await rm(nativeScratch, { recursive: true, force: true });
	for(const path of [join(adapterRoot, "lib", library)
		, join(nativeRoot, receipt.library)
		, join(runtimeRoot, "lib/libleanshared.so")
		, join(runtimeRoot, "lib/liblean_bridge_native.so")
		, join(gmpRoot, "lib", gmpLibrary)]) {
		const report = await run("readelf", ["--version-info", path]);
		for(const match of report.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(Number(match[1]) > 2 || (Number(match[1]) === 2 && (Number(match[2]) > Number(floor.slice(2)) || (Number(match[2]) === Number(floor.slice(2)) && Number(match[3] ?? 0) > 0))))
				throw new Error(`Owned C# library requires ${match[0]}, above the package floor ${floor}`);
		}
	const files = {};
	for(const path of await nativeArtifactPaths(adapterRoot))
	{ const bytes = await readFile(join(adapterRoot, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(adapterRoot, "native-dotnet-adapter.json"), canonicalJson({ schemaVersion: transferredInputs ? 2 : 1
		, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, runtimeIdentity: identity, library
		, ownedValues: { schemaVersion: transferredInputs ? 3 : 2
			, hostCallbacks: model.ownedGraph.hostCallbacks
			, ...transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
			, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) }
		, dotnetValues: projection.contract
		, gmp: { version: "6.3.0", soname: gmpLibrary, binding: "local-symbols" }
		, files }), { flag: "wx" });
	const { evidence } = await ownedDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const generated = generateOwnedDotnetPackage(model.bindingIr, evidence, { transferredInputs });
	const dotnetRoot = join(working, "native/dotnet"), scratch = join(working, "dotnet-managed-compiler");
	for(const [path, contents] of Object.entries(generated.files))
	{ await mkdir(dirname(join(dotnetRoot, path)), { recursive: true }); await writeFile(join(dotnetRoot, path), contents, { flag: "wx" }); }
	const env = { ...environment, DOTNET_CLI_HOME: join(scratch, "cli")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
		, DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
		, NUGET_PACKAGES: join(scratch, "packages") };
	const managed = args => processBuildRunner.capture({ command: environment.LEAN_BRIDGE_DOTNET ?? "dotnet", args, cwd: dotnetRoot, env, signal });
	const sdks = (await managed(["--list-sdks"])).stdout.split("\n").map(line => /^(8\.0\.\d+) \[/.exec(line)?.[1]).filter(Boolean);
	const version = sdks.sort((a, b) => Number(a.split(".")[2]) - Number(b.split(".")[2])).at(-1);
	if(!version) throw new Error("Owned C# packages require a .NET 8 SDK");
	await writeFile(join(dotnetRoot, "global.json"), canonicalJson({ sdk: { version, rollForward: "disable", allowPrerelease: false } }), { flag: "wx" });
	if((await managed(["--version"])).stdout.trim() !== version) throw new Error("The owned C# project did not use its selected SDK");
	await managed(["build"
		, `src/${projection.assembly}/${projection.assembly}.csproj`
		, "--configuration", "Release", "--output", join(dotnetRoot, "lib/net8.0")
		, "--nologo", "--disable-build-servers", "-noAutoResponse"
		, "/p:ImportDirectoryBuildProps=false", "/p:ImportDirectoryBuildTargets=false"
		, "/p:ImportDirectoryPackagesProps=false"
		, "/p:ContinuousIntegrationBuild=true"
		, "/p:UseSharedCompilation=false"
		, `/p:BaseIntermediateOutputPath=${scratch}/obj/`
		, `/p:PathMap=${working}=/build/owned-dotnet`]);
	await rm(scratch, { recursive: true, force: true });
	const inventory = {};
	for(const path of await nativeArtifactPaths(dotnetRoot))
	{ const bytes = await readFile(join(dotnetRoot, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(dotnetRoot, "native-dotnet.json"), canonicalJson({ schemaVersion: transferredInputs ? 2 : 1
		, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256
		, evidence, sdk: version, assembly: projection.assembly
		, ownedValues: projection.contract, files: inventory }), { flag: "wx" });
	return packageOwnedNuget({ ...options, adapterRoot, dotnetRoot, glibcMinimumVersion: floor });
};
