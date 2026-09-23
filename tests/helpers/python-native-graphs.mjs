/**
 * Fresh ordinary/reviewed Lean components called through Python graph adapters.
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
import { generateCopiedPythonGraphConversions } from "../../src/backends/python/copied-graph-conversions.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { pythonGraphInterpreters, pythonGraphProbeModule } from "./python-graph-probes.mjs";

/**
 * Compile both source paths and run independent processes for runtime retirement.
 *
 * @param directory - Test-owned temporary directory.
 */
export const checkPythonNativeGraphs = async directory => {
	const environment = nativeFixtureEnvironment(["python"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr();
	const probe = await readFile("tests/fixtures/structured-types/recursive-python-lean.py", "utf8");
	const checks = await readFile("tests/fixtures/structured-types/recursive-python-checks.py", "utf8");
	const interpreters = await pythonGraphInterpreters(directory), observations = [];
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
		const generated = generateCopiedPythonGraphConversions(model.bindingIr);
		assert.deepEqual(generated.layout, native.layout);
		await saveLakeFile(root, "recursive-graph.h", native.header);
		await saveLakeFile(root, "recursive-graph-types.h", native.typesHeader);
		const fixture = `#include <lean/lean.h>
#include <assert.h>
#include <stdlib.h>
static size_t native_live, native_attempts, native_fail, native_decodes, native_encodes, native_bad;
static void *python_malloc(size_t size) {
  if (++native_attempts == native_fail) return NULL;
  void *value = malloc(size); if (value) ++native_live; return value;
}
static void python_free(void *value) { assert(value && native_live); --native_live; free(value); }
static lean_object *python_encode(lean_object *value) {
  if (++native_encodes == native_bad) { lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
#define LB_GRAPH_MALLOC python_malloc
#define LB_GRAPH_FREE python_free
#define LB_GRAPH_DECODE() (++native_decodes)
#define LB_GRAPH_ENCODE(value) python_encode(value)
${native.source}
void python_native_reset(size_t fail, size_t bad) { native_attempts = native_decodes = native_encodes = 0; native_fail = fail; native_bad = bad; }
size_t python_native_live(void) { return native_live; }
size_t python_native_attempts(void) { return native_attempts; }
size_t python_native_decodes(void) { return native_decodes; }
uint32_t python_native_initialize(void) { return lean_bridge_native_component_initialize("recursive@1.0.0", ng_initialize) ? 0 : 5; }
int python_native_ready(void) { return ng_ready(); }
void python_native_retire(void) { lean_bridge_native_runtime_retire(); }
static recursive_scalars_t retained;
uint32_t python_native_hold(void) {
  recursive_scalars_t input = {0}; input.text.data = "retained"; input.text.length = 8;
  return recursive_scalars_graph(&input, &retained);
}
void python_native_release(void) { recursive_scalars_t_clear(&retained); }
void python_native_detach(void) { lean_bridge_native_component_detach("recursive@1.0.0"); }
`;
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
			, "-o", "libpython-native-test.so"], root, environment);
		const scenarios = [];
		for(const interpreter of interpreters)
		{
			await saveLakeFile(interpreter.site, "graph.py", pythonGraphProbeModule(generated));
			await saveLakeFile(interpreter.site, "graph_checks.py", checks);
			await saveLakeFile(interpreter.directory, "probe.py", probe);
			for(const mode of ["carrier", "raw", "during"])
			{
				const result = await runCopied(interpreter.command, ["-I", "-B", "probe.py", join(root, "libpython-native-test.so"), mode], interpreter.directory);
				assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
				assert.ok(observed.checks > 200); assert.ok(observed.nativeCheckpoints > 1); assert.ok(observed.pythonCheckpoints > 20);
				scenarios.push({ name: interpreter.name, typing: interpreter.typing, mode, ...observed });
			}
		}
		observations.push({
			reviewed
			, exports: generated.layout.roots.length
			, scenarios
			, modelSha256: receipt.modelSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, pythonSourceSha256: sha256(generated.source)
			, pythonValuesSha256: sha256(generated.valuesSource)
			, nativeSourceSha256: sha256(fixture)
			, probeSha256: sha256(probe)
			, checksSha256: sha256(checks) });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: false, observations };
};
