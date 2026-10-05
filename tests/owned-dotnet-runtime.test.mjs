/**
 * Real Lean resources, managed lifetime failures and native thread-exit cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { ownedDotnetRuntime } from "../src/backends/dotnet/owned-runtime.mjs";
import { ownedDotnetThreadExit } from "../src/backends/dotnet/owned-thread-exit.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("owned .NET support rejects injected native identifiers", () => {
	for(const name of ["Bad", "a__b", "a;\n#error injected", ""])
	{
		assert.throws(() => ownedDotnetRuntime(name));
		assert.throws(() => ownedDotnetThreadExit(name));
	}
});

for(const reviewed of [false, true]) test(`C# leases and native TLS reclaim real Lean owners (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: "owned-host-callbacks", hostCallbacks: true
		, ...(reviewed ? { reviewedIr: ownedHostCallbackReviewedIr() } : {}) });
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const p = generated.values.prefix, exit = ownedDotnetThreadExit(p);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
#include <stdint.h>
#include <stdatomic.h>
#include <sys/wait.h>
#include <signal.h>
static _Atomic size_t live, exits, exit_errors, release_calls;
static _Thread_local ptrdiff_t fail_after = -1;
static _Thread_local int invalid_process;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) atomic_fetch_add(&live, 1); return value;
}
static void deallocate(void *value) { if (value) { atomic_fetch_sub(&live, 1); free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${generated.source}
${exit.source}
size_t owned_test_live(void) { return atomic_load(&live); }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
void owned_test_thread_exit(uint32_t status) {
  atomic_fetch_add(&exits, 1); if (status) atomic_fetch_add(&exit_errors, 1);
}
size_t owned_test_exits(void) { return atomic_load(&exits); }
size_t owned_test_exit_errors(void) { return atomic_load(&exit_errors); }
size_t owned_test_release_calls(void) { return atomic_load(&release_calls); }
uint32_t owned_test_release(${p}_result **owner) {
  atomic_fetch_add(&release_calls, 1); return ${p}_result_release(owner);
}
int owned_test_process_valid(void) { return !invalid_process && lean_bridge_native_process_valid(); }
void owned_test_invalid_process(int value) { invalid_process = value; }
void owned_test_retire(void) { lean_bridge_native_runtime_retire(); }
uint32_t owned_test_new(${p}_session *session, uint64_t serial, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL; ${p}_scalar_string_t label = {"dotnet", 6};
  mpz_t number; mpz_init_set_ui(number, serial);
  ${p}_status status = ${p}_new_ticket(session, number, label, &value, owner);
  mpz_clear(number); if (!status) *out = value; return (uint32_t)status;
}
uint32_t owned_test_retain(${p}_session *session, void *input, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL;
  ${p}_status status = ${p}_ticket_t_retain(session, input, &value, owner);
  if (!status) *out = value;
  return (uint32_t)status;
}
uint32_t owned_test_serial(${p}_session *session, void *input, uint64_t *out, ${p}_result **owner) {
  mpz_srcptr value = NULL; ${p}_status status = ${p}_serial(session, input, &value, owner);
  if (!status) {
    if (mpz_sgn(value) < 0 || !mpz_fits_ulong_p(value)) return ${p.toUpperCase()}_MALFORMED_RESULT;
    *out = mpz_get_ui(value);
  }
  return (uint32_t)status;
}
uint32_t owned_test_closure(${p}_session *session, void **out, ${p}_result **owner) {
  ${p}_callback_record_argument1_t closure = NULL;
  ${p}_status status = ${p}_identity_closure(session, 0, &closure, owner);
  if (!status) *out = closure;
  return (uint32_t)status;
}
static ${p}_status active_callback(void *context, ${p}_session *session,
    uint8_t unit, ${p}_ticket_t *out, ${p}_result **owner) {
  (void)session; (void)unit; (void)owner;
  uint32_t status = ${p}_dotnet_thread_cleanup();
  if (status != LB_OWNED_ORDER) abort();
  *out = context; return ${p.toUpperCase()}_OK;
}
uint32_t owned_test_active_cleanup(${p}_session *session, void *ticket) {
  ${p}_ticket_t recovery = ticket;
  ${p}_factory_argument0_t_host callback = {.call = active_callback, .context = ticket, .recovery = &recovery};
  ${p}_ticket_t out = NULL; ${p}_result *owner = NULL;
  uint32_t status = ${p}_factory(session, &callback, &out, &owner);
  if (!status && out != ticket) status = LB_OWNED_INVALID;
  uint32_t released = ${p}_result_release(&owner); return status ? status : released;
}
uint32_t owned_test_close_during_call(${p}_session *session, void *ticket, uint32_t (*callback)(void)) {
  oc_session *context = oc_session_find(session);
  if (!context) return LB_OWNED_INVALID;
  lb_owned_scope scope = {0};
  uint32_t status = lb_owned_scope_begin(&context->native, &scope);
  if (status) return status;
  lean_object *value = NULL;
  status = lb_owned_scope_borrow(&scope, ${JSON.stringify(generated.values.nodes.find(node => node.kind === "resource").identityKind)}, (uint64_t)(uintptr_t)ticket, &value);
  /* The native cleanup must reject while the borrowed stack frame exists. */
  if (${p}_dotnet_thread_cleanup() != LB_OWNED_ORDER) abort();
  ++context->calls;
  uint32_t closed = callback();
  uint32_t ended = lb_owned_scope_abort(&scope);
  --context->calls; oc_session_collect(context);
  return status ? status : closed ? closed : ended;
}
static void *held_lock_fork(uint8_t builtin) {
  (void)builtin;
  pid_t child = fork(); if (child < 0) abort();
  if (!child) {
    alarm(3);
    ${p}_session *session = NULL;
    if (${p}_dotnet_thread_cleanup() != LB_OWNED_PROCESS) _exit(1);
    if (${p}_dotnet_session_open(&session) != LB_OWNED_PROCESS || session) _exit(2);
    if (lean_bridge_native_process_valid()) _exit(3);
    _exit(0);
  }
  int status = 0;
  if (waitpid(child, &status, 0) != child || !WIFEXITED(status) || WEXITSTATUS(status)) abort();
  return lean_io_result_mk_ok(lean_box(0));
}
int owned_test_fork(void) {
  return lean_bridge_native_component_initialize("owned-dotnet-held-lock-fork", held_lock_fork);
}
_Static_assert(sizeof(unsigned long) == sizeof(uint64_t), "Probe targets Linux x86-64");
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const cleanupCall = `(void)${p}_dotnet_thread_cleanup();`;
	assert.equal(exit.guardSource.split(cleanupCall).length, 2);
	const guard = exit.guardSource.replace("#include <cstdint>", '#include <cstdint>\nextern "C" void owned_test_thread_exit(uint32_t);')
		.replace(cleanupCall, `owned_test_thread_exit(${p}_dotnet_thread_cleanup());`);
	await saveLakeFile(compiled.directory, "guard.cpp", guard);
	const env = { PATH: "/usr/bin:/bin" }, includes = ["-I", join(compiled.directory, "runtime/include")];
	await runCopied("/usr/bin/cc", [
		"-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC"
		, ...includes, "-c", "public-api.c", "-o", "public-api.o"
	], compiled.directory, env);
	await runCopied("/usr/bin/c++", [
		"-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC"
		, ...includes, "-c", "guard.cpp", "-o", "guard.o"
	], compiled.directory, env);
	await runCopied("/usr/bin/c++", [
		"-shared", "-pthread", "public-api.o", "guard.o"
		, "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete"
		, "-o", "libowned-dotnet.so"], compiled.directory, env);
	const runtime = ownedDotnetRuntime(p), probe = await readFile("tests/fixtures/structured-types/owned-dotnet-runtime.cs", "utf8");
	const checkpoint = "internal static void Checkpoint() { }";
	assert.equal(runtime.split(checkpoint).length, 2);
	const releaseSymbol = JSON.stringify(`${p}_result_release`), processSymbol = '"lean_bridge_native_process_valid"';
	assert.equal(runtime.split(releaseSymbol).length, 2); assert.equal(runtime.split(processSymbol).length, 2);
	const instrumented = runtime.replace(checkpoint, "internal static void Checkpoint() { Faults.Check(); }")
		.replace(releaseSymbol, '"owned_test_release"').replace(processSymbol, '"owned_test_process_valid"');
	await saveLakeFile(compiled.directory, "Runtime.cs", "namespace Probe;\n" + instrumented);
	await saveLakeFile(compiled.directory, "Program.cs", probe);
	await saveLakeFile(compiled.directory, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(compiled.directory, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const environment = { ...env, DOTNET_ROOT: dirname(dotnet)
		, DOTNET_CLI_HOME: join(compiled.directory, "home")
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, NUGET_PACKAGES: join(compiled.directory, "packages") };
	await runCopied(dotnet, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], compiled.directory, environment);
	const observations = [];
	for(const mode of ["ordinary", "retirement"])
	{
		const result = await runCopied(dotnet, ["out/Probe.dll", join(compiled.directory, "libowned-dotnet.so"), mode], compiled.directory, environment);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.ok(observation.checks > (mode === "ordinary" ? 200 : 5));
		assert.equal(observation.live, 0); assert.equal(observation.identities, 0); assert.equal(observation.exitErrors, 0);
		if(mode === "ordinary")
		{ assert.ok(observation.managedFailures > 0); assert.ok(observation.nativeFailures > 0); assert.equal(observation.deadThreadsHeld, 40); }
		observations.push(observation); t.diagnostic(JSON.stringify(observation));
	}
	await saveLakeFile(resolve("build/owned-dotnet-runtime"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observations, compiledLean: true, installedPackage: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, runtimeSha256: sha256(runtime), cleanupSha256: sha256(exit.source)
		, guardSha256: sha256(exit.guardSource)
		, nativeProbeSha256: sha256(implementation), managedProbeSha256: sha256(probe)
		, instrumentedRuntimeSha256: sha256(instrumented)
		, leanConfigSha256: sha256(await readFile(join(compiled.directory, "runtime/include/lean/config.h")))
	}));
});
