/**
 * Python recursive conversions: independent C layouts, bounded copies and cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPythonGraphConversions } from "../src/backends/python/copied-graph-conversions.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { pythonConversionIr, pythonBuiltinNamesIr, pythonGraphLayouts, pythonGraphProbeModule, pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";

test("recorded Python conversion evidence binds source and compiled acceptance without claiming wheels", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/python-recursive-conversions-20260923.json", "utf8"));
	assert.equal(receipt.planNode, 1219); assert.equal(receipt.installedPackage, false);
	for(const [path, hash] of Object.entries(receipt.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	const generated = generateCopiedPythonGraphConversions(pythonConversionIr());
	assert.equal(receipt.isolated.sourceSha256, sha256(generated.source));
	assert.equal(receipt.isolated.valuesSha256, sha256(generated.valuesSource));
	const collisions = generateCopiedPythonGraphConversions(pythonBuiltinNamesIr());
	assert.equal(receipt.isolated.collisionSourceSha256, sha256(collisions.source));
	assert.equal(receipt.isolated.collisionValuesSha256, sha256(collisions.valuesSource));
	assert.equal(receipt.isolated.compiledLean, false); assert.equal(receipt.isolated.installedPackage, false);
	assert.deepEqual(receipt.isolated.reports.map(item => item.name), ["3.11-minimum", "3.11-current", "3.12-standard"]);
	for(const item of receipt.isolated.reports)
	{
		assert.equal(item.layoutChecks, 478); assert.equal(item.checkpoints, 170);
		assert.equal(item.checks, 2458); assert.equal(item.inputFailures, 93); assert.equal(item.outputFailures, 77);
	}
	const ir = nativeRecursiveReviewedIr(); ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const compiled = generateCopiedPythonGraphConversions(ir);
	assert.equal(receipt.native.compiledLean, true); assert.equal(receipt.native.installedPackage, false);
	assert.deepEqual(receipt.native.observations.map(item => item.reviewed), [false, true]);
	for(const item of receipt.native.observations)
	{
		assert.equal(item.pythonSourceSha256, sha256(compiled.source));
		assert.equal(item.pythonValuesSha256, sha256(compiled.valuesSource));
		assert.equal(item.exports, 18); assert.equal(item.scenarios.length, 9);
		for(const scenario of item.scenarios)
		{
			assert.equal(scenario.checks, 2464); assert.equal(scenario.nativeCheckpoints, 28); assert.equal(scenario.pythonCheckpoints, 170);
			assert.equal(scenario.inputFailures, 93); assert.equal(scenario.outputFailures, 77);
		}
	}
});

test("Python graph conversions retain deterministic private layouts and pre-call validation", () => {
	const ir = pythonConversionIr(), before = structuredClone(ir), generated = generateCopiedPythonGraphConversions(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedPythonGraphConversions(ir), generated);
	const scalar = name => generated.rawTypes.find(item => generated.layout.nodes.find(node => node.id === item.id).ref.name === name);
	assert.equal(scalar("bool").name, "_c.c_uint8"); assert.equal(scalar("unit").name, "_c.c_uint8"); assert.equal(scalar("char").name, "_c.c_uint32");
	assert.doesNotMatch(generated.valuesSource, /ctypes|c_void_p/);
	const call = generated.source.slice(generated.source.indexOf("def _graph_call_join_trees"));
	assert.ok(call.indexOf("checked.close()") < call.indexOf("scope = _GraphScope()"));
	assert.ok(call.indexOf("input1 =") < call.indexOf("lifecycle[0]()"));
	assert.ok(call.indexOf("lifecycle[0]()") < call.indexOf("_graph_status(invoke("));
	assert.match(call, /finally:\n {8}try:\n {12}_graph_clear\(output\)\n {8}finally:\n {12}scope.close\(\)/);
});

test("Python graph conversions agree with C layouts and clean up every conversion failure", {
	skip: process.env.LEAN_BRIDGE_PYTHON_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-python-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = pythonConversionIr(), generated = generateCopiedPythonGraphConversions(ir), layout = pythonGraphLayouts(generated);
	const collisions = generateCopiedPythonGraphConversions(pythonBuiltinNamesIr());
	const probe = await readFile("tests/fixtures/structured-types/recursive-conversions.py", "utf8");
	const checks = await readFile("tests/fixtures/structured-types/recursive-python-checks.py", "utf8");
	const native = await readFile("tests/fixtures/structured-types/recursive-rust-native.c", "utf8");
	await saveLakeFile(root, "recursive.h", generateCopiedCGraphTypes(ir).header);
	await saveLakeFile(root, "native.c", `#include "recursive.h"\n${native}\n${layout.c}`);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-fPIC", "-shared", "native.c", "-o", "libgraph-probe.so"], root, { PATH: "/usr/bin:/bin" });
	const reports = [];
	for(const interpreter of await pythonGraphInterpreters(root))
	{
		await saveLakeFile(interpreter.site, "graph.py", pythonGraphProbeModule(generated));
		await saveLakeFile(interpreter.site, "graph_builtin_names.py", pythonGraphProbeModule(collisions));
		await saveLakeFile(interpreter.site, "graph_checks.py", checks);
		await saveLakeFile(interpreter.directory, "probe.py", probe);
		const result = await runCopied(interpreter.command, ["-I", "-B", "probe.py", join(root, "libgraph-probe.so")], interpreter.directory);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.equal(observed.layoutChecks, layout.count); assert.ok(observed.checks > 200); assert.ok(observed.checkpoints > 20);
		reports.push({ name: interpreter.name, typing: interpreter.typing, ...observed });
	}
	await saveLakeFile("build/recursive", "python-conversions.json", canonicalJson({
		schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, reports
		, sourceSha256: sha256(generated.source)
		, valuesSha256: sha256(generated.valuesSource)
		, collisionSourceSha256: sha256(collisions.source)
		, collisionValuesSha256: sha256(collisions.valuesSource)
		, probeSha256: sha256(probe)
		, checksSha256: sha256(checks)
		, nativeSha256: sha256(native) }));
});

test("ordinary and reviewed Lean graphs execute through Python with cleanup and retirement", {
	skip: process.env.LEAN_BRIDGE_PYTHON_GRAPH_NATIVE_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-python-native-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkPythonNativeGraphs } = await import("./helpers/python-native-graphs.mjs");
	const report = await checkPythonNativeGraphs(root);
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	for(const item of report.observations)
	{
		assert.equal(item.exports, 18); assert.equal(item.scenarios.length, 9);
		assert.deepEqual([...new Set(item.scenarios.map(scenario => scenario.mode))], ["carrier", "raw", "during"]);
	}
	await saveLakeFile("build/recursive", "python-native.json", canonicalJson(report));
});

test("downstream CI requires isolated and compiled Python graph acceptance", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_GRAPH_TEST=1 LEAN_BRIDGE_PYTHON_GRAPH_NATIVE_TEST=1 node --test tests/python-copied-graph-conversions.test.mjs"));
	for(const name of ["python-conversions", "python-native"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});
