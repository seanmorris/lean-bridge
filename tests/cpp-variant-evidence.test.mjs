/**
 * Bind C++ installed variant claims to source contracts and unchanged archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { nativeVariantReviewedIr, nativeVariantSignatures } from "./helpers/native-variant-fixture.mjs";

test("C++ variant receipts bind every constructor, installed package and failure probe", async () => {
	const record = JSON.parse(await readFile("docs/evidence/cpp-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["cpp"]); assert.deepEqual(record.signatures, nativeVariantSignatures);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeVariantReviewedIr())));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const expected = record.contracts;
	assert.deepEqual(expected, nativeVariantReviewedIr().types.map(type => ({ id: type.id
		, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })));
	assert.equal(expected.filter(type => type.kind === "variant").length, 7);
	assert.equal(expected.flatMap(type => type.cases).length, 18);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "cpp"); assert.equal(run.runs.length, 2); assert.deepEqual(run.runs[0], run.runs[1]);
		for(const key of ["offlineInstall", "compilerFreePath", "relocatedInstallation", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "installedFilesUnchanged", "repeatExecution"])
			assert.equal(run[key], true, key);
		for(const key of ["executableSha256", "bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/cpp.cpp"]);
		const call = run.runs[0];
		assert.equal(call.checks, 36091); assert.equal(call.calls, 2372); assert.equal(call.rejected, 9); assert.equal(call.allocationFailures, 13);
		assert.equal(call.loadedLibraries.length, 4);
		for(const { path, ...identity } of call.loadedLibraries) assert.deepEqual(identity, run.installedFiles[path]);
		assert.deepEqual(Object.keys(run.installedFiles).filter(path => /\.so(?:\.|$)/.test(path)).sort(), call.loadedLibraries.map(library => library.path).sort());
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "cpp"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.artifacts[0].path, "archives/variants-1.0.0-cpp.tar.gz");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		const faults = run.faultChecks;
		assert.equal(faults.checks, 1182); assert.equal(faults.allocationFailures, 242);
		assert.equal(faults.rejected, 70); assert.equal(faults.malformedNativeTags, 1);
		assert.equal(faults.realLeanExecution, true); assert.equal(faults.syntheticTagInjection, true);
		assert.deepEqual(faults.sanitizers, ["address", "leak", "undefined"]);
		assert.equal(faults.startupLeakBaseline.unchangedAfterConversions, true);
		assert.equal(faults.startupLeakBaseline.bytes, 128); assert.equal(faults.startupLeakBaseline.allocations, 12);
		assert.match(faults.startupLeakBaseline.report, /__gmp_default_allocate/);
		assert.equal(faults.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/native-probe.c"]);
		for(const key of ["adapterSha256", "probeAdapterSha256", "executableSha256"]) assert.match(faults[key], /^[a-f0-9]{64}$/);
	}
	const source = await readFile("tests/fixtures/variant-consumers/cpp.cpp", "utf8");
	assert.doesNotMatch(source, /\.index\(|\.kind\s*=|lean_ctor_|lean_obj_tag|lean_bridge::variants::detail/);
});

test("C++ variants promote only six copied positions and execute in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const observed = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("cpp-variants-installed"));
	assert.equal(observed.length, 6);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "cpp"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["cpp-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_CPP_VARIANT_TEST=1 node --test tests\/cpp-variants.test.mjs/);
	assert.match(workflow, /test -s build\/variants\/cpp\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/cpp\.json/);
});
