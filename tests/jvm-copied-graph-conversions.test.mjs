/**
 * Independent native layout, marshalling, limits and cleanup checks for Java.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { generateCopiedJvmGraphConversions } from "../src/backends/jvm/copied-graph-conversions.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { jvmGraphConversionIr, jvmGraphLayoutProbe, jvmGraphProbe } from "./helpers/jvm-graph-conversion-fixture.mjs";
import { checkJvmGraphConverterTypes, jvmGraphCollisionIr, jvmGraphLargeCatalogIr } from "./helpers/jvm-graph-converter-types.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";

test("Java graph converters retain finite private descriptors and cold input validation", () => {
	const ir = jvmGraphConversionIr(), before = structuredClone(ir), model = generateCopiedJvmGraphConversions(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedJvmGraphConversions(ir), model);
	const runtime = model.files["src/main/java/org/leanbridge/recursive/_GraphRuntime.java"];
	const body = runtime.slice(runtime.indexOf("static Object call(_GraphTypes.Catalog"));
	assert.ok(body.indexOf("validate(catalog, function, arguments)") < body.indexOf("new Scope(false)"));
	assert.ok(body.indexOf("write(catalog, catalog.parameters()") < body.indexOf("target.lifecycle().before()"));
	assert.match(body, /finally \{[\s\S]*target.clear\(\).invokeExact\(output\)/);
	assert.doesNotMatch(model.nativeReleaseSource, /\.kind|\.cases|\.data|\.length/);
	assert.match(runtime, /new java.util.ArrayDeque<Input>/); assert.match(runtime, /new java.util.ArrayDeque<Output>/);
	assert.equal(jvmGraphLayoutProbe(model).count, 478);
});

test("Java FFM graph converters match C layouts and release owned results after faults", {
	skip: process.env.LEAN_BRIDGE_JVM_GRAPH_CONVERSION_TEST !== "1"
	, timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = jvmGraphConversionIr(), model = generateCopiedJvmGraphConversions(ir), layout = jvmGraphLayoutProbe(model);
	const native = await readFile("tests/fixtures/structured-types/recursive-rust-native.c", "utf8");
	const extras = `ECHO(wide, recursive_wide_t)\nECHO(empty_record, recursive_empty_record_t)
static uint32_t initialized, retired;
void graph_fixture_reset_lifecycle(void) { initialized = retired = 0; }
uint32_t graph_fixture_initialize(void) { ++initialized; return retired ? 5 : 0; }
int graph_fixture_ready(void) { return !retired; }
void graph_fixture_retire(void) { retired = 1; }
uint32_t graph_fixture_initialized(void) { return initialized; }
uint32_t graph_fixture_retired(void) { return retired; }
uint32_t graph_fixture_cycle_tree(const recursive_tree_t *input, recursive_tree_t *out) {
  uint32_t status = graph_fixture_tree(input, out); if (status) return status;
  out->kind = RECURSIVE_TREE_T_KIND_BRANCH;
  out->cases.branch.children.data = out; out->cases.branch.children.length = 1; return 0;
}
uint32_t graph_fixture_scalar_more(const recursive_scalars_t *input, recursive_scalars_t *out) {
  uint32_t status = graph_fixture_scalars(input, out); if (status) return status;
  static const uint32_t zero = 0;
  if (mode == 20) { out->natural.data = &zero; out->natural.length = 1; }
  if (mode == 21) { out->integer.negative = true; out->integer.length = 0; out->integer.data = NULL; }
  if (mode == 22) { out->text.data = "\\xed\\xa0\\x80"; out->text.length = 3; }
  if (mode == 23) { out->text.data = "\\xf4\\x90\\x80\\x80"; out->text.length = 4; }
  if (mode == 24) { out->text.data = "\\xe2\\x82"; out->text.length = 2; }
  if (mode == 25) { out->text.data = "\\x80"; out->text.length = 1; }
  if (mode == 26) { out->bytes.data = (const uint8_t *)(UINTPTR_MAX - 1); out->bytes.length = 4; }
  return 0;
}
`;
	await saveLakeFile(root, "recursive.h", generateCopiedCGraphTypes(ir).header);
	const nativeSource = `#include "recursive.h"\n${native}\n${extras}\n${model.nativeReleaseSource}\n${layout.c}`;
	await saveLakeFile(root, "native.c", nativeSource);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-fPIC", "-shared", "native.c", "-o", "libgraph.so"], root, { PATH: "/usr/bin:/bin" });
	const sources = [], hashes = {};
	for(const [path, original] of Object.entries(model.files))
	{
		let source = original;
		if(path.endsWith("/_GraphRuntime.java")) source = source.replace("static void checkpoint() { }", "static void checkpoint() { GraphConversions.Faults.hit(); }")
			.replace("var result = arena.allocate(size, alignment);", "var result = arena.allocate(size, alignment); GraphConversions.Faults.allocated(result);");
		await saveLakeFile(root, path, source); sources.push(path); hashes[path] = sha256(original);
	}
	await saveLakeFile(root, "GraphProbe.java", jvmGraphProbe(model));
	const probe = (await readFile("tests/fixtures/structured-types/recursive-jvm-conversions.java", "utf8"))
		.replace("// WIDE_SETTERS", Array.from({ length: 255 }, (_, i) => `        builder.field${i}(${i});`).join("\n"));
	await saveLakeFile(root, "GraphConversions.java", probe);
	const env = nativeFixtureEnvironment(["java"]);
	await runCopied(env.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources, "GraphProbe.java", "GraphConversions.java"], root);
	const result = await runCopied(env.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", "-Xss256k", "-cp", "classes", "org.leanbridge.recursive.GraphConversions", join(root, "libgraph.so")], root);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.equal(observation.layoutChecks, layout.count); assert.ok(observation.checks > 100); assert.ok(observation.checkpoints > 20);
	assert.equal(observation.live, 0);
	const typeCatalogs = await checkJvmGraphConverterTypes(root, env);
	await saveLakeFile("build/recursive", "jvm-conversions.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, observation
		, typeCatalogs
		, generatedSourceHashes: hashes
		, nativeSourceSha256: sha256(nativeSource)
		, probeSha256: sha256(probe)
		, callerSha256: sha256(jvmGraphProbe(model)) }));
});

test("ordinary and reviewed Lean graphs execute through Java with cleanup and retirement", {
	skip: process.env.LEAN_BRIDGE_JVM_GRAPH_NATIVE_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-native-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkJvmNativeGraphs } = await import("./helpers/jvm-native-graphs.mjs");
	const report = await checkJvmNativeGraphs(root);
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	for(const item of report.observations)
	{
		assert.equal(item.exports, 18); assert.equal(item.scenarios.length, 4);
		assert.deepEqual(item.scenarios.map(scenario => scenario.mode), ["carrier", "raw", "cycle", "during"]);
	}
	await saveLakeFile("build/recursive", "jvm-native.json", canonicalJson(report));
});

test("downstream CI requires isolated and compiled Java graph conversions", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_JVM_GRAPH_CONVERSION_TEST=1 LEAN_BRIDGE_JVM_GRAPH_NATIVE_TEST=1 node --test tests/jvm-copied-graph-conversions.test.mjs"));
	for(const name of ["jvm-conversions", "jvm-native"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});

test("recorded Java conversions bind layouts, fault cleanup and fresh Lean calls without claiming Maven", async () => {
	const record = JSON.parse(await readFile("docs/evidence/jvm-recursive-conversions-20260923.json", "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219); assert.equal(record.installedPackage, false);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	for(const log of Object.values(record.logs))
	{
		assert.equal(sha256(log.text), log.sha256);
		assert.match(log.text, /# pass 1\n# fail 0\n/); assert.match(log.text, /# skipped 0\n/);
	}
	const hashes = model => Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]));
	const isolated = generateCopiedJvmGraphConversions(jvmGraphConversionIr());
	assert.equal(record.isolated.compiledLean, false); assert.equal(record.isolated.installedPackage, false);
	assert.deepEqual(record.isolated.generatedSourceHashes, hashes(isolated));
	assert.equal(record.isolated.callerSha256, sha256(jvmGraphProbe(isolated)));
	const setters = Array.from({ length: 255 }, (_, i) => `        builder.field${i}(${i});`).join("\n");
	const isolatedProbe = await readFile("tests/fixtures/structured-types/recursive-jvm-conversions.java", "utf8");
	assert.equal(record.isolated.probeSha256, sha256(isolatedProbe.replace("// WIDE_SETTERS", setters)));
	assert.deepEqual(record.isolated.observation, {
		checkpoints: 36, checks: 45931, failures: 72
		, inputFailures: 32, layoutChecks: 478, live: 0, outputFailures: 40 });
	assert.deepEqual(record.isolated.typeCatalogs.map(item => item.name), ["collisions", "scale"]);
	const typeCatalogs = [];
	for(const [index, fixture] of [jvmGraphCollisionIr, jvmGraphLargeCatalogIr].entries())
	{
		const model = generateCopiedJvmGraphConversions(fixture()), observation = record.isolated.typeCatalogs[index];
		assert.equal(observation.sourceHashesSha256, sha256(canonicalJson(hashes(model))));
		assert.equal(observation.result, index ? "catalog-copy-ok:700" : "collision-copy-ok");
		const restored = { ...observation, sourceHashes: hashes(model) };
		delete restored.sourceHashesSha256; typeCatalogs.push(restored);
	}
	assert.equal(record.reportHashes.isolated, sha256(canonicalJson({ ...record.isolated, typeCatalogs })));
	assert.equal(record.reportHashes.native, sha256(canonicalJson(record.native)));
	const ir = nativeRecursiveReviewedIr(); ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const compiled = generateCopiedJvmGraphConversions(ir);
	const instrumented = {};
	for(const [path, source] of Object.entries(compiled.files))
	{
		const text = path.endsWith("/_GraphRuntime.java") ? source
			.replace("static void checkpoint() { }", "static void checkpoint() { GraphLean.Faults.hit(); }")
			.replace("var result = arena.allocate(size, alignment);", "var result = arena.allocate(size, alignment); GraphLean.Faults.allocated(result);") : source;
		instrumented[path] = sha256(text);
	}
	const nativeProbe = await readFile("tests/fixtures/structured-types/recursive-jvm-lean.java", "utf8");
	assert.equal(record.native.compiledLean, true); assert.equal(record.native.installedPackage, false);
	assert.deepEqual(record.native.observations.map(item => item.reviewed), [false, true]);
	for(const item of record.native.observations)
	{
		assert.deepEqual(item.generatedSourceHashes, hashes(compiled));
		assert.deepEqual(item.instrumentedSourceHashes, instrumented);
		assert.equal(item.callerSha256, sha256(jvmGraphProbe(compiled, { compiledLean: true })));
		assert.equal(item.probeSha256, sha256(nativeProbe));
		assert.equal(item.programSha256, sha256(nativeProbe.replace("// WIDE_SETTERS", setters)));
		assert.equal(item.exports, 18);
		assert.deepEqual(item.scenarios.map(scenario => scenario.mode), ["carrier", "raw", "cycle", "during"]);
		for(const scenario of item.scenarios) assert.deepEqual(scenario, {
			mode: scenario.mode, checks: 29099, compiledLean: true
			, nativeCheckpoints: 28, managedCheckpoints: 181
			, allocationCheckpoints: 30, inputFailures: 70, outputFailures: 111
			, layoutChecks: 455, live: 0 });
	}
});
