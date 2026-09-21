/**
 * Bind installed C variant acceptance to its source, archives and failure probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gmpIdentity } from "../src/backends/c/gmp.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";

test("C variant receipts bind plain and GMP installations to both source contracts", async () => {
	const record = JSON.parse(await readFile("docs/evidence/c-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64); assert.deepEqual(record.profiles, ["c"]);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.executions.map(run => `${run.transport}/${run.path}`), ["plain/ordinary-source", "plain/reviewed-ir", "gmp/ordinary-source", "gmp/reviewed-ir"]);
	for(const transport of ["plain", "gmp"])
	{
		const ir = cVariantReviewedIr(transport === "gmp");
		assert.equal(record.contracts[transport].reviewedIrSha256, sha256(canonicalJson(ir)));
		assert.deepEqual(record.contracts[transport].signatures, cVariantSignatures(transport === "gmp"));
		assert.deepEqual(record.contracts[transport].types, ir.types);
		assert.equal(ir.types.filter(type => type.kind === "variant").length, transport === "gmp" ? 7 : 6);
		assert.equal(ir.types.flatMap(type => type.cases).length, transport === "gmp" ? 18 : 16);
	}
	for(const run of record.executions)
	{
		const gmp = run.transport === "gmp", call = run.runs[0];
		assert.equal(run.profile, "c"); assert.equal(run.runs.length, 2); assert.deepEqual(call, run.runs[1]);
		assert.equal(call.checks, gmp ? 46234 : 1815); assert.equal(call.calls, gmp ? 2361 : 518); assert.equal(call.rejected, gmp ? 11 : 1);
		for(const key of ["offlineInstall", "compilerFreePath", "relocatedInstallation", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "installedFilesUnchanged", "repeatExecution"]) assert.equal(run[key], true, key);
		for(const key of ["executableSha256", "bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(run.consumerSha256, record.sourceHashes[`tests/fixtures/variant-consumers/${gmp ? "c.c" : "c-basic.c"}`]);
		assert.equal(call.loadedLibraries.length, gmp ? 6 : 4);
		for(const { path, ...identity } of call.loadedLibraries) assert.deepEqual(identity, run.installedFiles[path]);
		assert.deepEqual(Object.keys(run.installedFiles).filter(path => /\.so(?:\.|$)/.test(path)).sort(), call.loadedLibraries.map(library => library.path).sort());
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "c"); assert.equal(pkg.runtimeDelivery, "embedded"); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/variants-1.0.0-c.tar.gz"); assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/);
		const native = run.faultChecks;
		assert.equal(native.checks, 1182); assert.equal(native.allocationFailures, 242); assert.equal(native.rejected, 70); assert.equal(native.malformedNativeTags, 1);
		assert.equal(native.syntheticTagInjection, true); assert.equal(native.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/native-probe.c"]);
		if(gmp)
		{
			for(const [key, value] of Object.entries(gmpIdentity)) assert.equal(run.dependency[key], value);
			assert.equal(run.dependency.checked, true); const faults = native.gmp;
			assert.equal(faults.checks, 1584); assert.equal(faults.allocationFailures, 448); assert.equal(faults.rejected, 4); assert.equal(faults.previousPayloadsReleased, 32);
			assert.equal(faults.facadeAllocatorOnly, true); assert.equal(faults.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/gmp-probe.c"]);
		} else
		{ assert.equal(run.dependency, null); assert.equal(native.gmp, undefined); }
		for(const faults of [native, ...gmp ? [native.gmp] : []])
		{
			assert.equal(faults.realLeanExecution, true); assert.deepEqual(faults.sanitizers, ["address", "leak", "undefined"]);
			assert.equal(faults.startupLeakBaseline.unchangedAfterConversions, true); assert.equal(faults.startupLeakBaseline.bytes, 128); assert.equal(faults.startupLeakBaseline.allocations, 12);
			assert.match(faults.startupLeakBaseline.report, /__gmp_default_allocate/);
			for(const key of ["adapterSha256", "probeAdapterSha256", "executableSha256"]) assert.match(faults[key], /^[a-f0-9]{64}$/);
		}
	}
	for(const path of ["c.c", "c-basic.c"])
	{
		const consumer = await readFile(`tests/fixtures/variant-consumers/${path}`, "utf8");
		assert.match(consumer, /VARIANTS_SIGNAL_KIND_DATA/); assert.doesNotMatch(consumer, /\.kind\s*=\s*\d|lean_ctor_|lean_obj_tag|#include.*detail\/|lb_gmp_/);
	}
});

test("C variants promote six copied positions and require both installed transports in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("c-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "c"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["c-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_C_VARIANT_TEST=1 node --test tests\/c-variants\.test\.mjs/);
	assert.match(workflow, /test -s build\/variants\/c\.json/); assert.match(workflow, /path: \|[^]*?build\/variants\/c\.json/);
});
