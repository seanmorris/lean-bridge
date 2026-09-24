/**
 * Build ordinary/reviewed Lean graphs and execute PHP allocation/retirement gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { readVerifiedNativeComponent } from "../../src/build/native-artifacts.mjs";
import { nativeGraphCarrierAbi } from "../../src/build/native-graph-model.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { generateCopiedPhpGraphConversions } from "../../src/backends/php/copied-graph-conversions.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { phpGraphLayoutProbe, phpLeanGraphProbe } from "./php-graph-conversion-fixture.mjs";

/**
 * Compile each source path once; run each permanent retirement in a fresh PHP.
 *
 * @param directory - Test-owned temporary workspace, cleaned by the test.
 */
export const checkPhpNativeGraphs = async directory => {
	const environment = nativeFixtureEnvironment(["php-native"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr();
	const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", observations = [];
	const probe = await readFile("tests/fixtures/structured-types/recursive-php-lean.php", "utf8");
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), project = join(root, "project");
		await saveLakeFile(project, "Recursive.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Recursive"]
			, ...reviewed ? {} : { exports: reviewedIr.declarations.map(item => item.source.declaration) } }));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const compiled = await buildNativeComponent({ projectRoot: project, outputRoot: join(root, "component"), runtimeRoot: runtime.root, leanPrefix: prefix, targets: ["c"], copiedGraphs: true });
		const { model, receipt } = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		assert.equal(model.schemaVersion, reviewed ? 5 : 4);
		const native = generateNativeCopiedGraphAdapters(model.bindingIr, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
		const generated = generateCopiedPhpGraphConversions(model.bindingIr), layout = phpGraphLayoutProbe(generated);
		assert.deepEqual(generated.layout, native.layout);
		await saveLakeFile(root, "recursive-graph.h", native.header);
		await saveLakeFile(root, "recursive-graph-types.h", native.typesHeader);
		const nativeSource = `#include <lean/lean.h>
#include <assert.h>
#include <stdlib.h>
static size_t native_live, native_attempts, native_fail, native_decodes, native_encodes, native_bad;
static uint32_t native_mode;
static void *php_malloc(size_t size) {
  if (++native_attempts == native_fail) return NULL;
  void *value = malloc(size); if (value) ++native_live; return value;
}
static void php_free(void *value) { assert(value && native_live); --native_live; free(value); }
static lean_object *php_encode(lean_object *value) {
  if (++native_encodes == native_bad) { lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
#define LB_GRAPH_MALLOC php_malloc
#define LB_GRAPH_FREE php_free
#define LB_GRAPH_DECODE() (++native_decodes)
#define LB_GRAPH_ENCODE(value) php_encode(value)
${native.source}
${generated.nativeReleaseSource}
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
    output->cases.branch.children.data = output; output->cases.branch.children.length = 1;
  }
  if (!status && native_mode == 3) lean_bridge_native_runtime_retire();
  return status;
}
${layout.c}`;
		await saveLakeFile(root, "native.c", nativeSource);
		await runCopied("/usr/bin/cc", [
			"-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fPIC"
			, "-I", join(runtime.root, "include")
			, "-include", join(compiled.root, "component.h")
			, "-c", "native.c", "-o", "native.o"], root, environment);
		await runCopied("/usr/bin/cc", ["-shared", "native.o", "-L", compiled.root
			, "-L", join(runtime.root, "lib")
			, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
			, "-Wl,--no-undefined"
			, `-Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}`
			, "-o", "libphp-native-test.so"], root, environment);
		const generatedSourceHashes = {}, instrumentedSourceHashes = {};
		for(const [path, source] of Object.entries({ ...generated.files, ...bundledBrickMath() }))
		{
			const instrumented = path.endsWith("/GraphNative.php") ? source
				.replace("public static function checkpoint(): void {}", "public static function checkpoint(): void { \\GraphFaults::hit(); }")
				.replace("$this->owners[] = $owner;", "$this->owners[] = $owner; \\GraphFaults::allocated($owner);") : source;
			await saveLakeFile(root, path, instrumented);
			if(Object.hasOwn(generated.files, path))
			{ generatedSourceHashes[path] = sha256(source); instrumentedSourceHashes[path] = sha256(instrumented); }
		}
		const caller = phpLeanGraphProbe(generated); await saveLakeFile(root, "caller.php", caller);
		const scenarios = [];
		for(const callerMode of ["weak", "strict"])
		{
			const program = probe.replace("strict_types=0", `strict_types=${callerMode === "strict" ? 1 : 0}`);
			await saveLakeFile(root, "probe.php", program);
			for(const mode of ["carrier", "raw", "cycle", "during"])
			{
				const result = await runCopied(php, [
					"-d", "ffi.enable=true", "-d", "memory_limit=128M"
					, "-d", "display_errors=stderr"
					, "probe.php", join(root, "libphp-native-test.so"), mode], root);
				assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
				assert.equal(observed.layoutChecks, layout.count); assert.ok(observed.checks > 500);
				assert.ok(observed.nativeCheckpoints > 1 && observed.managedCheckpoints > 20);
				assert.ok(observed.inputFailures > 0 && observed.outputFailures > 0); assert.equal(observed.live, 0);
				scenarios.push({ callerMode, mode, ...observed, programSha256: sha256(program) });
			}
		}
		observations.push({ reviewed, exports: generated.layout.roots.length
			, scenarios, modelSha256: receipt.modelSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, generatedSourceHashes, instrumentedSourceHashes
			, nativeSourceSha256: sha256(nativeSource), probeSha256: sha256(probe)
			, callerSha256: sha256(caller) });
	}
	const version = await runCopied(php, ["-v"], directory);
	return { schemaVersion: 1, compiledLean: true, installedPackage: false, phpVersion: version.stdout, phpSha256: sha256(await readFile(php)), observations };
};
