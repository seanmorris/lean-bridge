/**
 * Installed owned, recursive and ordinary NuGet packages share one runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { ownedDotnetRuntimeOnly } from "./helpers/owned-dotnet-installed.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned, copied and ordinary NuGet peers share loading, fork guards and retirement", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-dotnet-peers-"));
	t.after(() => process.env.LEAN_BRIDGE_DOTNET_DEBUG === "1"
		? t.diagnostic(`Retained diagnostic workspace: ${directory}`)
		: rm(directory, { recursive: true, force: true }));
	const environment = nativeFixtureEnvironment(["dotnet"]), packages = [], inputs = [];
	const author = join(directory, "author"), consumer = join(directory, "consumer");
	for(const name of ["owned-aggregates", "owned-peer", "copied-peer", "plain-peer"])
	{
		const source = join(author, name), output = join(author, name + "-release");
		const handoff = join(author, name + "-handoff"), owned = name.startsWith("owned-");
		if(owned)
		{
			await cp(resolve("tests/fixtures/onboarding/owned-cpp-composition"), source, { recursive: true });
			await saveLakeFile(source, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n`);
			const config = JSON.parse(await readFile(join(source, "lean-bridge.exports.json"), "utf8"));
			config.targets = { nuget: { name, version: "1.0.0" } };
			await saveLakeFile(source, "lean-bridge.exports.json", canonicalJson(config));
		}
		else
		{
			const graph = name === "copied-peer";
			await saveLakeFile(source, "Peer.lean", graph ? `namespace Peer
inductive Tree where
  | tip (value : Nat)
  | branch (children : Array Tree)
def echo (value : Tree) := value
def apply (value : Tree) (callback : Tree → Tree) := callback value
def answer : Nat := 2 ^ 200 + 31
end Peer
` : "namespace Peer\ndef answer : UInt32 := 42\ndef apply (value : UInt32) (callback : UInt32 → UInt32) := callback value\nend Peer\n");
			await saveLakeFile(source, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
			await saveLakeFile(source, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Peer"\n`);
			await saveLakeFile(source, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
				, modules: ["Peer"]
				, exports: [...graph ? ["Peer.echo"] : [], "Peer.apply", "Peer.answer"]
				, targets: { nuget: { name, version: "1.0.0" } } }));
		}
		const before = await lakeInputState(source);
		const built = await buildCanonicalProject({ projectRoot: source, outputRoot: output, targets: ["nuget"], environment })
			.catch(error => { error.message += ": " + JSON.stringify(error.details); throw error; });
		assert.deepEqual(await lakeInputState(source), before);
		assert.equal(built.backend, owned ? "owned-dotnet-v1" : "ordinary-dotnet-v1");
		const receipt = await copyPackageSetHandoff(output, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const pkg = receipt.packages[0]; packages.push(pkg);
		inputs.push({ name, source: before, receipt });
		await cp(join(handoff, pkg.artifacts[0].path), join(consumer, "feed", `${pkg.name}.${pkg.version}.nupkg`), { recursive: true });
		t.diagnostic(`built peer ${name}`);
	}
	assert.equal(new Set(packages.map(pkg => pkg.runtimeIdentity)).size, 1);
	const forkProbe = `#include <errno.h>
#include <signal.h>
#include <sys/wait.h>
#include <unistd.h>
int probe_fork(int (*call)(int), int kind) {
  pid_t child = fork();
  if (child < 0) return -1;
  if (child == 0) { alarm(5); _exit(call(kind)); }
  int status = 0;
  while (waitpid(child, &status, 0) < 0) if (errno != EINTR) return -2;
  return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}
`;
	await saveLakeFile(author, "fork.c", forkProbe);
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-std=c11", "-Wall", "-Wextra", "-Werror", "fork.c", "-o", join(consumer, "fork-probe.so")], author, { PATH: "/usr/bin:/bin" });
	await rm(author, { recursive: true, force: true });
	await assert.rejects(access(author), { code: "ENOENT" });
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-coexistence.cs", "utf8");
	await saveLakeFile(consumer, "Program.cs", source);
	await saveLakeFile(consumer, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/>${packages.map(pkg => `<PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/>`).join("")}</ItemGroup></Project>`);
	await saveLakeFile(consumer, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const command = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command)
		, DOTNET_CLI_HOME: join(consumer, "home")
		, NUGET_PACKAGES: join(consumer, "packages")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await runCopied(command, ["restore", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
	const manifests = [];
	for(const pkg of packages)
	{
		const installed = join(consumer, "packages", pkg.name.toLowerCase(), pkg.version);
		const manifest = JSON.parse(await readFile(join(installed, "lean-bridge/package-receipt.json"), "utf8"));
		await verifyNativeFiles(installed, Object.fromEntries(Object.entries(manifest.files)
			.filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path))));
		manifests.push(manifest);
	}
	const runtime = await ownedDotnetRuntimeOnly(join(directory, "runtime-only"), command);
	if(process.env.LEAN_BRIDGE_DOTNET_DEBUG === "1") runtime.env.LEAN_BRIDGE_DOTNET_DEBUG = "1";
	const relocated = join(directory, "relocated");
	await rename(join(consumer, "out"), relocated);
	await cp(join(consumer, "fork-probe.so"), join(relocated, "fork-probe.so"));
	await rm(consumer, { recursive: true, force: true });
	await assert.rejects(access(consumer), { code: "ENOENT" });
	const observations = [];
	for(const order of ["copied-first", "owned-first", "plain-first"]) for(const retiredBy of ["copied", "owned"])
	for(const forkKind of [0, 1, 2])
	{
		const result = await runCopied(runtime.executable, ["Consumer.dll", order, retiredBy, String(forkKind)], relocated, runtime.env);
		assert.equal(result.stderr, "");
		const observation = JSON.parse(result.stdout); const { checks, ...rest } = observation;
		assert.ok(checks >= 200);
		assert.deepEqual(rest, { order, retiredBy, rejectedCalls: 4, threadedCalls: 64
			, components: 4, runtimeInitializations: 1, liveIdentities: 0
			, forkChecks: 1, forkKind, libraries: 11 });
		observations.push(observation); t.diagnostic(JSON.stringify(observation));
	}
	await saveLakeFile(resolve("build/owned-dotnet-packaging"), "coexistence.json", canonicalJson({
		schemaVersion: 1, planNode: 1219, installedNuget: true
		, sourceFreeExecution: true, sourceUnchanged: true, sdkFreeExecution: true
		, consumerRemoved: true, packageCachesRemoved: true, relocated: true
		, consumerSha256: sha256(source), forkProbeSha256: sha256(forkProbe)
		, inputs, manifests, observations
	}));
});
