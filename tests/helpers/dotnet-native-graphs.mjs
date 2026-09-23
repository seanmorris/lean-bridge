/**
 * Execute generated C# graph conversions through fresh native Lean components.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { readVerifiedNativeComponent } from "../../src/build/native-artifacts.mjs";
import { nativeGraphCarrierAbi } from "../../src/build/native-graph-model.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { generateCopiedDotnetGraphConversions } from "../../src/backends/dotnet/copied-graph-conversions.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { dotnetGraphLayoutProbe, dotnetGraphProbeSource, instrumentDotnetGraphs } from "./dotnet-graph-probes.mjs";

/**
 * Build both source paths; poison scenarios run in separate CLR/runtime processes.
 *
 * @param directory - Test-owned temporary directory.
 */
export const checkDotnetNativeGraphs = async directory => {
	const environment = nativeFixtureEnvironment(["dotnet"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const dotnet = environment.LEAN_BRIDGE_DOTNET;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr();
	const probe = await readFile("tests/fixtures/structured-types/recursive-dotnet-lean.cs", "utf8");
	const faults = await readFile("tests/fixtures/structured-types/recursive-dotnet-faults.cs", "utf8"), observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), project = join(root, "project");
		await saveLakeFile(project, "Recursive.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1
			, modules: ["Recursive"]
			, ...reviewed ? {} : { exports: reviewedIr.declarations.map(item => item.source.declaration) } }));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const compiled = await buildNativeComponent({ projectRoot: project, outputRoot: join(root, "component"), runtimeRoot: runtime.root, leanPrefix: prefix, targets: ["c"], copiedGraphs: true });
		const { model, receipt } = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		assert.equal(model.schemaVersion, reviewed ? 5 : 4);
		const native = generateNativeCopiedGraphAdapters(model.bindingIr, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
		const generated = generateCopiedDotnetGraphConversions(model.bindingIr), layout = dotnetGraphLayoutProbe(generated);
		assert.deepEqual(generated.layout, native.layout);
		await saveLakeFile(root, "recursive-graph.h", native.header);
		await saveLakeFile(root, "recursive-graph-types.h", native.typesHeader);
		const fixture = `#include <lean/lean.h>
#include <assert.h>
#include <stdlib.h>
static size_t native_live, native_attempts, native_fail, native_decodes, native_encodes, native_bad;
static uint32_t native_mode;
static void *dotnet_malloc(size_t size) {
  if (++native_attempts == native_fail) return NULL;
  void *value = malloc(size); if (value) ++native_live; return value;
}
static void dotnet_free(void *value) { assert(value && native_live); --native_live; free(value); }
static lean_object *dotnet_encode(lean_object *value) {
  if (++native_encodes == native_bad) { lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
#define LB_GRAPH_MALLOC dotnet_malloc
#define LB_GRAPH_FREE dotnet_free
#define LB_GRAPH_DECODE() (++native_decodes)
#define LB_GRAPH_ENCODE(value) dotnet_encode(value)
${native.source}
void graph_fixture_reset(size_t fail, size_t bad, uint32_t mode) {
  native_attempts = native_decodes = native_encodes = 0; native_fail = fail; native_bad = bad; native_mode = mode;
}
uint32_t graph_fixture_live(void) { return (uint32_t)native_live; }
uint32_t graph_fixture_attempts(void) { return (uint32_t)native_attempts; }
uint32_t graph_fixture_decodes(void) { return (uint32_t)native_decodes; }
uint32_t graph_fixture_initialize(void) { return lean_bridge_native_component_initialize("recursive@1.0.0", ng_initialize) ? 0 : 5; }
int graph_fixture_ready(void) { return ng_ready(); }
void graph_fixture_retire(void) { lean_bridge_native_runtime_retire(); }
static recursive_scalars_t retained;
uint32_t graph_fixture_hold(void) {
  recursive_scalars_t input = {0}; input.text.data = "retained"; input.text.length = 8;
  return recursive_scalars_graph(&input, &retained);
}
void graph_fixture_release(void) { recursive_scalars_t_clear(&retained); }
void graph_fixture_detach(void) { lean_bridge_native_component_detach("recursive@1.0.0"); }
uint32_t graph_fixture_tree(const recursive_tree_t *input, recursive_tree_t *output) {
  uint32_t status = recursive_tree_graph(input, output);
  if (!status && native_mode == 1) output->kind = UINT32_MAX;
  if (!status && native_mode == 2) {
    output->kind = RECURSIVE_TREE_T_KIND_BRANCH;
    output->cases.branch.children.data = output;
    output->cases.branch.children.length = 1;
  }
  return status;
}
${layout.c}`;
		await saveLakeFile(root, "native.c", fixture);
		await runCopied("/usr/bin/cc", [
			"-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fPIC"
			, "-I", join(runtime.root, "include")
			, "-include", join(compiled.root, "component.h")
			, "-c", "native.c", "-o", "native.o"], root, environment);
		await runCopied("/usr/bin/cc", [
			"-shared", "native.o", "-L", compiled.root
			, "-L", join(runtime.root, "lib")
			, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
			, "-Wl,--no-undefined"
			, `-Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}`
			, "-o", "libdotnet-native-test.so"], root, environment);
		await saveLakeFile(root, "Values.cs", generated.valuesSource);
		const instrumented = instrumentDotnetGraphs(generated.source);
		await saveLakeFile(root, "Runtime.cs", instrumented);
		await saveLakeFile(root, "Probe.cs", dotnetGraphProbeSource(generated, { compiledLean: true }));
		await saveLakeFile(root, "Faults.cs", faults);
		const program = probe.replace("WIDE_ARGUMENTS", Array.from({ length: 255 }, (_, i) => i).join(", "));
		await saveLakeFile(root, "Program.cs", program);
		await saveLakeFile(root, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableNETAnalyzers>false</EnableNETAnalyzers></PropertyGroup></Project>');
		await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
		const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
		await runCopied(dotnet, ["build", "Probe.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
		const scenarios = [];
		for(const mode of ["carrier", "raw", "cycle", "during"])
		{
			const result = await runCopied(dotnet, ["out/Probe.dll", join(root, "libdotnet-native-test.so"), mode], root, env);
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			assert.equal(observed.layoutChecks, layout.count); assert.ok(observed.checks > 200);
			assert.ok(observed.nativeCheckpoints > 1); assert.ok(observed.managedCheckpoints > 20);
			scenarios.push({ mode, ...observed });
		}
		observations.push({
			reviewed, exports: generated.layout.roots.length, scenarios
			, modelSha256: receipt.modelSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, dotnetSourceSha256: sha256(generated.source)
			, dotnetValuesSha256: sha256(generated.valuesSource)
			, instrumentedSha256: sha256(instrumented)
			, nativeSourceSha256: sha256(fixture)
			, probeSha256: sha256(probe), programSha256: sha256(program)
			, faultsSha256: sha256(faults) });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: false, observations };
};
