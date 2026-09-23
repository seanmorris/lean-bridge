/**
 * Prepared recursive Python APIs and original, offline-installed wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPythonGraphPackage, compileCopiedPythonGraphPackageModel } from "../src/backends/python/copied-graph-package.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";
import { assertPythonGraphRegressions } from "./helpers/native-python-graph-regression.mjs";

test("recursive Python packages expose typed functions and isolate native loading", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir);
	const files = generateCopiedPythonGraphPackage(ir), model = compileCopiedPythonGraphPackageModel(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedPythonGraphPackage(ir), files);
	const audit = auditPythonPackage(ir, files);
	assert.ok(audit.exports.includes("Forest")); assert.ok(audit.exports.includes("word_max"));
	for(const file of ["lean_recursive/__init__.py", "lean_recursive/__init__.pyi"])
	{
		assert.match(files[file], /def forest\(value0: Forest \| _Input\d+\) -> Forest:/);
		assert.match(files[file], /def word_max\(value0: int\) -> bool:/);
		assert.match(files[file], /def units\(value0: _Input\d+\) -> _Value\d+:/);
		assert.match(files[file], /def envelope\(value0: Envelope\) -> Envelope:/);
		assert.doesNotMatch(files[file], /ctypes|c_void_p|GraphRaw|graph_call|\bAny\b/);
	}
	assert.match(files["lean_recursive/__init__.py"], /from \. import _native as _GraphNative/);
	assert.match(files["lean_recursive/_native.py"], /from \. import _assets as _GraphAssets/);
	assert.match(files["lean_recursive/_native.py"], /_GraphAssets\._ensure_process\(\)/);
	assert.match(files["lean_recursive/_native.py"], /lifecycle=_graph_lifecycle/);
	assert.match(files["lean_recursive/_assets.py"], /Build a compiled PyPI release/);
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).copiedGraph, { schemaVersion: 1, layoutSha256: model.layoutSha256 });
	assert.match(files["README.md"], /262,144 nodes/); assert.match(files["README.md"], /finally/);
});

test("recursive Python admission checks all selected hosts and protects loader namespaces", () => {
	const ir = nativeRecursiveReviewedIr(), model = compileNativeGraphProjection(ir, ["pypi"]);
	assert.equal(model.prefix, "recursive");
	assert.equal(compileNativeGraphProjection(ir, ["c", "cpp", "cargo", "pypi"]).layoutSha256, model.layoutSha256);
	for(const targets of [[], ["pypi", "pypi"], ["pypi", "cpan"], ["pypi", "maven"], ["rubygems"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
	for(const name of ["native", "assets", "scope", "value", "_GraphNative"])
	{
		const valid = structuredClone(ir); valid.declarations[0].parameters[0].name = name;
		const generated = generateCopiedPythonGraphPackage(valid);
		assert.match(generated["lean_recursive/__init__.py"], /return _GraphNative\._call0\([a-z_]+\)/);
	}
	for(const name of ["LeanBridgeError", "Some", "_GraphNative", "Scalars__private"])
	{
		const invalid = structuredClone(ir); invalid.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => compileNativeGraphProjection(invalid, ["c", "pypi"]), /reserved|name|identifier|collision/);
	}
	for(const id of ["gmp", "leanshared", "lean-bridge-native", "a".repeat(160)])
	{
		const invalid = structuredClone(ir); invalid.component.id = `${id}@1.0.0`; invalid.component.name = id;
		assert.throws(() => compileCopiedPythonGraphPackageModel(invalid), /name|dependency|identifier/);
	}
});

test("prepared recursive Python wheels install offline and execute without the producer", {
	skip: process.env.LEAN_BRIDGE_PYTHON_GRAPH_PACKAGE_TEST !== "1"
	, timeout: 1_800_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-python-graph-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkInstalledPythonGraphs } = await import("./helpers/python-graph-packages.mjs");
	const report = await checkInstalledPythonGraphs(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	for(const run of report.observations) assert.equal(run.installations.length, 3);
	await saveLakeFile("build/recursive", "python-packages.json", canonicalJson(report));
});

test("recursive Python receipts bind installed wheels, public calls, typing and failure cleanup", async () => {
	const record = JSON.parse(await readFile("docs/evidence/python-recursive-packages-20260923.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.installedPackage, true); assert.equal(record.wordBits, 64);
	assert.equal(record.reportSha256, sha256(canonicalJson(record.report)));
	assert.equal(record.log.sha256, sha256(record.log.text));
	assert.match(record.log.text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	assert.deepEqual(record.report.observations.map(run => run.reviewed), [false, true]);
	for(const run of record.report.observations)
	{
		assert.equal(run.exports, 18); assert.equal(run.pypiOnly, true);
		assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.rejectsRegeneratedSourceDrift, 3);
		assert.equal(run.deterministicReassembly, true); assert.equal(run.checkedSourceUnchanged, true);
		assert.equal(run.package.target, "pypi"); assert.equal(run.package.name, "recursive-api");
		assert.equal(run.package.runtimeDelivery, "embedded"); assert.deepEqual(run.package.requires, []);
		assert.equal(run.peers.length, 2);
		for(const peer of run.peers) assert.equal(peer.package.runtimeIdentity, run.package.runtimeIdentity);
		assert.deepEqual(run.installations.map(item => item.name), ["3.11-minimum", "3.11-current", "3.12-standard"]);
		for(const installed of run.installations)
		{
			assert.equal(installed.public.checks, 308); assert.equal(installed.public.rejected, 76);
			assert.equal(installed.public.functions, 18); assert.equal(installed.public.threadedCalls, 256);
			assert.deepEqual(installed.typing, { rejectedCalls: 12, executed: true, memoryLimitMiB: 1024 });
			assert.deepEqual(installed.faults, {
				checks: 2214, checkpoints: 170, inputFailures: 93
				, outputFailures: 77, ownedOutputs: 156, exactlyOnceCleanup: true });
			assert.equal(installed.installedPackages.length, 3);
			assert.equal(installed.dependency?.version ?? null, installed.name === "3.12-standard" ? null : installed.name === "3.11-minimum" ? "4.6.0" : "4.16.0");
			for(const key of ["resolvedOffline", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "authorSourcesRemoved", "handoffRemoved", "buildMetadataNotRequired", "rejectsTamperedAssets", "rejectsSymlinkAssets", "installedFilesUnchanged"])
				assert.equal(installed[key], true, key);
			assert.deepEqual(installed.composition.map(item => item.mode), ["raw", "during"]);
			for(const composition of installed.composition)
			{
				assert.equal(composition.components, 3); assert.equal(composition.libraries.length, 8);
				assert.equal(composition.retirementClears, 1);
				assert.equal(composition.libraries.filter(name => name === "libleanshared.so").length, 1);
				assert.equal(composition.libraries.filter(name => name === "liblean_bridge_native.so").length, 1);
				for(const key of ["forkRejection", "forkWithLockHeld", "crossPackageRetirement", "retainedValuesUsable"])
					assert.equal(composition[key], true, key);
				assert.equal(composition.forkWarnings, installed.name === "3.12-standard" ? 1 : 0);
				assert.deepEqual(composition.publicNameCollisions, ["next", "scope", "value"]);
			}
			const guide = (await readFile("docs/consume/python.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
			assert.equal(installed.documentation.sourceSha256, sha256(guide.match(/```python\n([^]*?)\n```/)[1] + "\n"));
			assert.equal(installed.documentation.stdout, "Depth: 2\n");
		}
		const previous = record.reproduction.runs.find(item => item.reviewed === run.reviewed);
		assert.deepEqual(previous.package, run.package);
		assert.equal(previous.binarySha256, run.binarySha256);
		for(const item of previous.installations)
		{
			const installed = run.installations.find(run => run.name === item.name);
			for(const key of ["installedPackages", "public", "typing", "faults", "composition", "documentation"])
				assert.equal(item[`${key}Sha256`], sha256(canonicalJson(installed[key])), key);
		}
	}
	assert.equal(record.reproduction.log.sha256, sha256(record.reproduction.log.text));
	assert.match(record.reproduction.log.text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
	assert.equal(record.regressions.sha256, sha256(await readFile(record.regressions.path)));
	await assertPythonGraphRegressions();
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const installed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("python-recursive-installed"));
	assert.equal(installed.length, 6);
	for(const cell of installed)
	{
		assert.equal(cell.profile, "python"); assert.equal(cell.shape, "recursive");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed");
	}
	for(const cell of cells.filter(cell => cell.profile === "python" && cell.shape === "recursive" && cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_GRAPH_PACKAGE_TEST=1 node --test tests/python-graph-package.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/python-packages.json"));
	assert.ok(workflow.includes("            build/recursive/python-packages.json\n"));
});
