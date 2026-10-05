/**
 * Execute generated Java FFM graph conversions through fresh Lean components.
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
import { generateCopiedJvmGraphConversions } from "../../src/backends/jvm/copied-graph-conversions.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { javaCompilerOptions } from "./type-corpus-jvm-tools.mjs";
import { jvmGraphLayoutProbe, jvmGraphProbe } from "./jvm-graph-conversion-fixture.mjs";

/**
 * Build ordinary and reviewed source; isolate poisoned runtimes in new JVMs.
 *
 * @param directory - Test-owned temporary directory.
 */
export const checkJvmNativeGraphs = async directory => {
	const environment = nativeFixtureEnvironment(["java"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr();
	const probe = await readFile("tests/fixtures/structured-types/recursive-jvm-lean.java", "utf8"), observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), project = join(root, "project");
		await saveLakeFile(project, "Recursive.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Recursive"], ...reviewed ? {} : { exports: reviewedIr.declarations.map(item => item.source.declaration) } }));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const compiled = await buildNativeComponent({ projectRoot: project, outputRoot: join(root, "component"), runtimeRoot: runtime.root, leanPrefix: prefix, targets: ["c"], copiedGraphs: true });
		const { model, receipt } = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		assert.equal(model.schemaVersion, reviewed ? 5 : 4);
		const native = generateNativeCopiedGraphAdapters(model.bindingIr, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
		const generated = generateCopiedJvmGraphConversions(model.bindingIr), layout = jvmGraphLayoutProbe(generated);
		assert.deepEqual(generated.layout, native.layout);
		await saveLakeFile(root, "recursive-graph.h", native.header);
		await saveLakeFile(root, "recursive-graph-types.h", native.typesHeader);
		const fixture = `#include <lean/lean.h>
#include <assert.h>
#include <stdlib.h>
static size_t native_live, native_attempts, native_fail, native_decodes, native_encodes, native_bad;
static uint32_t native_mode;
static void *jvm_malloc(size_t size) {
  if (++native_attempts == native_fail) return NULL;
  void *value = malloc(size); if (value) ++native_live; return value;
}
static void jvm_free(void *value) { assert(value && native_live); --native_live; free(value); }
static lean_object *jvm_encode(lean_object *value) {
  if (++native_encodes == native_bad) { lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
#define LB_GRAPH_MALLOC jvm_malloc
#define LB_GRAPH_FREE jvm_free
#define LB_GRAPH_DECODE() (++native_decodes)
#define LB_GRAPH_ENCODE(value) jvm_encode(value)
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
			, "-o", "libjvm-native-test.so"], root, environment);
		const sources = [], generatedSourceHashes = {}, instrumentedSourceHashes = {};
		for(const [path, source] of Object.entries(generated.files))
		{
			const instrumented = path.endsWith("/_GraphRuntime.java") ? source
				.replace("static void checkpoint() { }", "static void checkpoint() { GraphLean.Faults.hit(); }")
				.replace("var result = arena.allocate(size, alignment);", "var result = arena.allocate(size, alignment); GraphLean.Faults.allocated(result);") : source;
			await saveLakeFile(root, path, instrumented); sources.push(path);
			generatedSourceHashes[path] = sha256(source); instrumentedSourceHashes[path] = sha256(instrumented);
		}
		const caller = jvmGraphProbe(generated, { compiledLean: true });
		await saveLakeFile(root, "GraphProbe.java", caller);
		const program = probe.replace("// WIDE_SETTERS", Array.from({ length: 255 }, (_, i) => `        builder.field${i}(${i});`).join("\n"));
		await saveLakeFile(root, "GraphLean.java", program);
		await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources, "GraphProbe.java", "GraphLean.java"], root);
		const scenarios = [];
		for(const mode of ["carrier", "raw", "cycle", "during"])
		{
			const result = await runCopied(environment.LEAN_BRIDGE_JAVA, [
				"--enable-native-access=ALL-UNNAMED", "-Xss256k", "-cp", "classes"
				, "org.leanbridge.recursive.GraphLean"
				, join(root, "libjvm-native-test.so"), mode], root);
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			assert.equal(observed.layoutChecks, layout.count); assert.ok(observed.checks > 200);
			assert.ok(observed.nativeCheckpoints > 1); assert.ok(observed.managedCheckpoints > 20);
			assert.ok(observed.inputFailures > 0 && observed.outputFailures > 0); assert.equal(observed.live, 0);
			scenarios.push({ mode, ...observed });
		}
		observations.push({
			reviewed, exports: generated.layout.roots.length, scenarios
			, modelSha256: receipt.modelSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, generatedSourceHashes, instrumentedSourceHashes
			, nativeSourceSha256: sha256(fixture), probeSha256: sha256(probe)
			, programSha256: sha256(program), callerSha256: sha256(caller) });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: false, observations };
};
