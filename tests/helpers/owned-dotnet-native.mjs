/**
 * Compile generated owned C# call bindings against a fresh Lean native component.
 *
 * @file
 */
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetCalls } from "../../src/backends/dotnet/owned-calls.mjs";
import { ownedDotnetThreadExit } from "../../src/backends/dotnet/owned-thread-exit.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Test-only loader resolves one caller-supplied library; not package admission.
 *
 * @param t - Test context that owns and removes its native fixture directory.
 * @param options - Fresh Lean fixture and optional independent reviewed contract.
 */
export const compileOwnedDotnetFixture = async (t, options = {}) => {
	const compiled = await compileOwnedAggregateFixture(t, { ...options, hostCallbacks: true });
	const model = generateOwnedDotnetCalls(compiled.model.bindingIr);
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const cleanup = ownedDotnetThreadExit(c.values.prefix);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
#include <stdatomic.h>
static _Atomic size_t live;
static _Thread_local ptrdiff_t remaining = -1;
static void *probe_alloc(size_t size) {
  if (remaining == 0) return NULL;
  if (remaining > 0) --remaining;
  void *value = malloc(size); if (value) atomic_fetch_add(&live, 1); return value;
}
static void probe_free(void *value) { if (value) { atomic_fetch_sub(&live, 1); free(value); } }
#define LB_OWNED_ALLOC probe_alloc
#define LB_OWNED_FREE probe_free
${c.source}
${cleanup.source}
size_t probe_live(void) { return atomic_load(&live); }
size_t probe_identities(void) { lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s); return s.live_identities; }
void probe_fail(ptrdiff_t value) { remaining = value; }
void probe_retire(void) { lean_bridge_native_runtime_retire(); }
`;
	for(const [path, content] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : content);
	await saveLakeFile(compiled.directory, "guard.cpp", cleanup.guardSource);
	const env = { PATH: "/usr/bin:/bin" }, includes = ["-I", join(compiled.directory, "runtime/include")];
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "api.c", "-o", "api.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", ["-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "guard.cpp", "-o", "guard.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", ["-shared", "-pthread", "api.o", "guard.o"
		, "Owned.o", "Carriers.o", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete", "-o", "libprobe.so"
	], compiled.directory, env);
	const checkpoint = "internal static void Checkpoint() { }";
	assert.equal(model.files["Lifetime.cs"].split(checkpoint).length, 2);
	const files = { ...model.files, "Lifetime.cs": model.files["Lifetime.cs"].replace(checkpoint, "internal static void Checkpoint() { global::Program.Allocation(); }") };
	const loader = `namespace ${model.namespace}.Interop;
internal static class OwnedLoader
{
    internal static OwnedBindings Bindings = null!;
}
`;
	for(const [path, content] of Object.entries({ ...files, "Loader.cs": loader
		, "Calls.csproj": '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>'
		, "NuGet.Config": '<configuration><packageSources><clear/></packageSources></configuration>'
	})) await saveLakeFile(compiled.directory, path, content);
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const environment = { ...env, DOTNET_ROOT: dirname(dotnet)
		, DOTNET_CLI_HOME: join(compiled.directory, "home")
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, NUGET_PACKAGES: join(compiled.directory, "packages") };
	return { ...compiled, model, implementation, loader
		, compile: async probes => {
			for(const [name, source] of Object.entries(probes)) await saveLakeFile(compiled.directory, name, source);
			await runCopied(dotnet, ["build", "Calls.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], compiled.directory, environment);
			return (mode = "callbacks") => runCopied(dotnet, ["out/Calls.dll", join(compiled.directory, "libprobe.so"), mode], compiled.directory, environment);
		}
	};
};
