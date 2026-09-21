/**
 * Source-bound installed Python variant receipts and exact matrix promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";

test("Python variant evidence binds original wheels to independent contracts and fault probes", async () => {
	const record = JSON.parse(await readFile("docs/evidence/python-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64); assert.deepEqual(record.profiles, ["python"]);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.signatures, cVariantSignatures()); assert.deepEqual(record.types, cVariantReviewedIr().types);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(cVariantReviewedIr())));
	assert.equal(record.types.filter(type => type.kind === "variant").length, 7);
	assert.equal(record.types.flatMap(type => type.cases).length, 18);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "python"); assert.equal(run.runs.length, 3); assert.equal(run.probes.length, 2);
		for(const execution of run.runs)
		{
			assert.deepEqual(execution, run.runs[0]);
			assert.equal(execution.checks, 26434); assert.equal(execution.calls, 4383); assert.equal(execution.rejected, 64);
			assert.equal(execution.loadedLibraries.length, 4);
			for(const { path, ...identity } of execution.loadedLibraries) assert.deepEqual(identity, run.installedFiles[path]);
			assert.deepEqual(Object.keys(run.installedFiles).filter(path => /\.so(?:\.|$)/.test(path)).sort(), execution.loadedLibraries.map(library => library.path).sort());
		}
		for(const faults of run.probes) assert.deepEqual(faults, { allocationFailures: 18, checks: 754, clears: 96, conversionFailures: 58, inactiveCases: 7, malformedTags: 7 });
		for(const key of ["offlineInstall", "compilerFreePath", "relocatedInstallation", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "installedFilesUnchanged", "repeatExecution"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/python.py"]);
		assert.equal(run.probeSha256, record.sourceHashes["tests/fixtures/variant-consumers/python-probe.py"]);
		assert.match(run.strictTypecheck.version, /^mypy 1\.17\.1\b/);
		assert.equal(run.strictTypecheck.repeatedAfterRelocation, true); assert.equal(run.strictTypecheck.rejectedCalls, 8);
		assert.equal(run.strictTypecheck.sourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/python-typed.py"]);
		assert.equal(run.strictTypecheck.rejectionSourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/python-invalid.py"]);
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "pypi"); assert.equal(pkg.runtimeDelivery, "embedded"); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/variants_api-1.0.0-py3-none-manylinux_2_36_x86_64.whl");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		const native = run.faultChecks;
		assert.equal(native.checks, 1182); assert.equal(native.allocationFailures, 242); assert.equal(native.rejected, 70); assert.equal(native.malformedNativeTags, 1);
		assert.equal(native.syntheticTagInjection, true); assert.equal(native.realLeanExecution, true);
		assert.equal(native.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/native-probe.c"]);
		assert.deepEqual(native.sanitizers, ["address", "leak", "undefined"]);
		assert.equal(native.startupLeakBaseline.unchangedAfterConversions, true);
		assert.equal(native.startupLeakBaseline.bytes, 128); assert.equal(native.startupLeakBaseline.allocations, 12);
		assert.match(native.startupLeakBaseline.report, /__gmp_default_allocate/);
		for(const key of ["adapterSha256", "probeAdapterSha256", "executableSha256"]) assert.match(native[key], /^[a-f0-9]{64}$/);
	}
	const source = await readFile("tests/fixtures/variant-consumers/python.py", "utf8");
	assert.doesNotMatch(source, /ctypes|from lean_variants import _native|lean_obj_tag|lean_ctor_get/);
});

test("Python variants advance only six copied cells and require installed CI receipts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("python-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "python"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["python-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_PYTHON_VARIANT_TEST=1 node --test tests\/python-variants\.test\.mjs/);
	assert.match(workflow, /test -s build\/variants\/python\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/python\.json/);
});
