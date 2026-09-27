/**
 * Execute authenticated C# package sources without a compiler workspace.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetPackage } from "../src/backends/dotnet/owned-package.mjs";
import { verifiedDotnetAssets } from "../src/backends/dotnet/verified-assets.mjs";
import { buildNativeGmp } from "../src/build/native-gmp.mjs";
import { readVerifiedNativeRuntime } from "../src/build/native-artifacts.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("owned C# package generation binds its loader to exact private native assets", () => {
	const ir = ownedCppCompositionReviewedIr(), model = generateOwnedDotnetPackage(ir);
	assert.deepEqual(model.files, generateOwnedDotnetPackage(ir).files);
	assert.equal(model.contract.gmp, "libgmp-lean-bridge.so.10");
	assert.equal(model.contract.loadingPolicy, "linux-x64-deepbind-v1");
	assert.match(model.files[`src/${model.assembly}/Loader.cs`], /Build a prepared NuGet release/u);
	assert.equal(JSON.parse(model.files["binding-manifest.json"]).backend, "owned-dotnet-v1");
	const evidence = { runtimeIdentity: "0".repeat(64)
		, componentReceiptSha256: "1".repeat(64)
		, componentId: ir.component.id, library: "libowned_aggregates_dotnet.so"
		, libraries: Object.fromEntries(["libowned_aggregates_dotnet.so", "libleanshared.so", "liblean_bridge_native.so", "libgmp-lean-bridge.so.10"].map(name => [name, "2".repeat(64)])) };
	const loader = verifiedDotnetAssets(evidence);
	assert.equal(loader, verifiedDotnetAssets({ ...evidence, libraries: Object.fromEntries(Object.entries(evidence.libraries).reverse()) }));
	assert.doesNotMatch(loader, /Environment.ProcessId/u);
	assert.ok(loader.indexOf("EnsureProcess();") < loader.indexOf("lock (domain)"));
	for(const libraries of [{ "../escape.so": "0".repeat(64) }, { ...evidence.libraries, "libgmp.so.10": "0".repeat(64) }])
		assert.throws(() => verifiedDotnetAssets({ ...evidence, libraries }), /Invalid authenticated/u);
	assert.throws(() => generateOwnedDotnetPackage(ir, { ...evidence, componentId: "other" }), /differs/u);
});

for(const reviewed of [false, true]) test(`owned C# package sources load real Lean with private GMP (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, { fixture: "owned-cpp-composition"
		, hostCallbacks: true
		, ...reviewed ? { reviewedIr: ownedCppCompositionReviewedIr() } : {} });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-owned-loader-"));
	const debugging = process.env.LEAN_BRIDGE_DOTNET_DEBUG === "1";
	if(debugging) t.diagnostic(`Retaining loader diagnostics: ${directory}`);
	else t.after(() => rm(directory, { recursive: true, force: true }));
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const model = generateOwnedDotnetPackage(compiled.model.bindingIr), prefix = model.c.prefix;
	const privateGmp = join(compiled.directory, "private-gmp");
	await buildNativeGmp({ root: privateGmp, privateSoname: true });
	for(const [path, source] of Object.entries(c.files))
		if(!path.startsWith("src/")) await saveLakeFile(compiled.directory, path.split("/").at(-1), source);
	const nativeProbe = `#define _GNU_SOURCE
#include <dlfcn.h>
#include <sys/wait.h>
#include <unistd.h>
${c.source}
${model.cleanup.source}
size_t probe_identities(void) { lean_bridge_native_snapshot value; lean_bridge_native_snapshot_read(&value); return value.live_identities; }
const char *probe_gmp_path(void) { Dl_info info; return dladdr((void *)(uintptr_t)&__gmpz_init, &info) ? info.dli_fname : ""; }
int probe_fork(int (*callback)(void)) {
  pid_t child = fork(); if (child < 0) return 255;
  if (!child) { alarm(10); _exit(callback()); }
  int status = 0;
  if (waitpid(child, &status, 0) != child || !WIFEXITED(status)) return 254;
  return WEXITSTATUS(status);
}
`;
	await saveLakeFile(compiled.directory, "public-api.c", nativeProbe);
	await saveLakeFile(compiled.directory, "guard.cpp", model.cleanup.guardSource);
	const library = `lib${prefix}_dotnet.so`, environment = { PATH: "/usr/bin:/bin" };
	const flags = ["-O2", "-g0", "-fPIC", "-Wall", "-Wextra", "-Werror"
		, "-I", join(privateGmp, "include")
		, "-I", join(compiled.directory, "runtime/include")];
	await runCopied("/usr/bin/cc", ["-std=c11", ...flags, "-c", "public-api.c", "-o", "api.o"], compiled.directory, environment);
	await runCopied("/usr/bin/c++", ["-std=c++17", ...flags, "-c", "guard.cpp", "-o", "guard.o"], compiled.directory, environment);
	await runCopied("/usr/bin/c++", ["-shared", "-pthread", "api.o", "guard.o"
		, "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(privateGmp, "lib"), "-L", join(compiled.directory, "runtime/lib")
		, "-Wl,--no-as-needed", "-l:libgmp-lean-bridge.so.10"
		, "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath,$ORIGIN", "-Wl,-z,defs", "-Wl,-z,nodelete"
		, "-Wl,--build-id=none", `-Wl,-soname,${library}`, "-ldl", "-o", library
	], compiled.directory, environment);
	const { identity } = await readVerifiedNativeRuntime(join(compiled.directory, "runtime"));
	const paths = { [library]: join(compiled.directory, library)
		, "libgmp-lean-bridge.so.10": join(privateGmp, "lib/libgmp-lean-bridge.so.10")
		, "liblean_bridge_native.so": join(compiled.directory, "runtime/lib/liblean_bridge_native.so")
		, "libleanshared.so": join(compiled.directory, "runtime/lib/libleanshared.so") };
	const libraries = {}, native = "runtimes/linux-x64/native";
	for(const [name, path] of Object.entries(paths))
	{
		const bytes = await readFile(path); libraries[name] = sha256(bytes);
		await saveLakeFile(directory, `out/${native}/${name}`, bytes);
	}
	const evidence = { runtimeIdentity: identity
		, componentId: compiled.model.component.id
		, componentReceiptSha256: sha256(canonicalJson({ sourceIdentity: compiled.sourceIdentity, metadata: compiled.metadata }))
		, library, libraries };
	const packaged = generateOwnedDotnetPackage(compiled.model.bindingIr, evidence);
	for(const [path, source] of Object.entries(packaged.files)) await saveLakeFile(directory, `package/${path}`, source);
	const probe = await readFile("tests/fixtures/structured-types/owned-dotnet-loading.cs", "utf8");
	await saveLakeFile(directory, "consumer/Program.cs", probe);
	const extras = Object.entries({ MatchedAssets: { ...evidence, componentId: "matching-other-package@1" }
		, RuntimeConflictAssets: { ...evidence, runtimeIdentity: "f".repeat(64) }
		, ComponentConflictAssets: { ...evidence, componentReceiptSha256: "e".repeat(64) } })
		.map(([name, value]) => `internal static class ${name}\n{\n${verifiedDotnetAssets(value)}\n}\n`).join("\n");
	await saveLakeFile(directory, "consumer/OtherAssets.cs", extras);
	await saveLakeFile(directory, "consumer/Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup><ItemGroup><ProjectReference Include="../package/src/${model.assembly}/${model.assembly}.csproj" /></ItemGroup></Project>`);
	await saveLakeFile(directory, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const managedEnvironment = { ...environment, DOTNET_ROOT: dirname(dotnet)
		, ...debugging ? { LEAN_BRIDGE_DOTNET_DEBUG: "1" } : {}
		, DOTNET_CLI_HOME: join(directory, "home")
		, NUGET_PACKAGES: join(directory, "packages")
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1" };
	await runCopied(dotnet, ["build", "consumer/Consumer.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], directory, managedEnvironment);
	await rm(compiled.directory, { recursive: true, force: true });
	if(!debugging)
	{
		await rm(join(directory, "package"), { recursive: true, force: true });
		await rm(join(directory, "consumer"), { recursive: true, force: true });
	}
	const consume = (mode = "run", output = "out") => runCopied(dotnet, [`${output}/Consumer.dll`, mode], directory, managedEnvironment);
	const result = await consume(); assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks > 150); assert.equal(observation.identities, 0);
	assert.equal(observation.privateGmp, true); assert.equal(observation.forkBeforeLock, true);
	assert.equal((await consume("preload")).stdout, "preload rejected\n");
	const binary = join(directory, "out", native, library), original = await readFile(binary);
	const changed = Buffer.from(original); changed[changed.length - 1] ^= 1;
	await saveLakeFile(directory, `out/${native}/${library}`, changed);
	await assert.rejects(() => consume(), error => /differs from the compiled package/u.test(error.details?.stderr));
	await saveLakeFile(directory, `out/${native}/${library}`, original);
	const moved = join(directory, "original-library.so"); await rename(binary, moved); await symlink(moved, binary);
	await assert.rejects(() => consume(), error => /must be a regular file/u.test(error.details?.stderr));
	await rm(binary); await rename(moved, binary);
	const nativeRoot = join(directory, "out", native), nativeMoved = join(directory, "native-moved");
	await rename(nativeRoot, nativeMoved); await symlink(nativeMoved, nativeRoot);
	await assert.rejects(() => consume(), error => /must be a regular directory/u.test(error.details?.stderr));
	await rm(nativeRoot); await rename(nativeMoved, nativeRoot);
	await rename(join(directory, "out"), join(directory, "relocated"));
	assert.deepEqual(await consume("run", "relocated"), result);
	await saveLakeFile(resolve("build/owned-dotnet-loading"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observation, compiledLean: true, installedNuget: false
		, compilerWorkspaceRemoved: true, managedSourcesRemoved: true, relocated: true
		, rejectsTamperedLibrary: true, rejectsSymlinkLibrary: true
		, rejectsSymlinkDirectory: true, rejectsUnverifiedPreload: true
		, rejectsRuntimeConflict: true, rejectsComponentConflict: true
		, probeSha256: sha256(probe), nativeProbeSha256: sha256(nativeProbe)
		, evidence, contract: packaged.contract
		, generatedFiles: Object.fromEntries(Object.entries(packaged.files).map(([path, source]) => [path, sha256(source)]))
	}));
	t.diagnostic(JSON.stringify(observation));
});
