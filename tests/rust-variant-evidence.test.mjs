/**
 * Installed Rust enum receipts, exact source identities and six-cell promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";

test("Rust variant evidence binds original crates to independent contracts and fault probes", async () => {
	const record = JSON.parse(await readFile("docs/evidence/rust-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64); assert.deepEqual(record.profiles, ["rust"]);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.signatures, cVariantSignatures()); assert.deepEqual(record.types, cVariantReviewedIr().types);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(cVariantReviewedIr())));
	assert.equal(record.types.filter(type => type.kind === "variant").length, 7);
	assert.equal(record.types.flatMap(type => type.cases).length, 18);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const negatives = JSON.parse(await readFile("tests/fixtures/variant-consumers/rust-invalid.json"));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "rust"); assert.equal(run.checks, 4936); assert.equal(run.calls, 4274);
		assert.equal(run.faultTests, 2); assert.equal(run.faultChecks, 208);
		assert.equal(run.malformedTags, 7); assert.equal(run.inactiveCases, 6);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/rust.rs"]);
		assert.equal(run.faultSourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/rust-faults.rs"]);
		assert.equal(run.rejectionSourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/rust-invalid.json"]);
		for(const key of ["offlineInstall", "compilerFreePath", "emptyCargoHome", "linkOnly", "relocatedExecutable", "installedSourcesRemoved", "handoffRemovedBeforeExecution", "repeatExecution", "normalExitCleanup", "installedFilesUnchanged", "sourceRemovedBeforeInstallation"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "executableSha256", "malformedSourceSha256", "linkerSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(run.installedFilesSha256, sha256(canonicalJson(run.installedFiles)));
		assert.equal(run.declarationsSha256, run.installedFiles["src/lib.rs"].sha256);
		assert.equal(Object.keys(run.nativeLibraries).length, 4);
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => /\.so(?:\.|$)/.test(path))));
		assert.match(run.version, /^rustc 1\.90\.0 /);
		assert.equal(run.rejected.length, negatives.length);
		for(const [index, entry] of run.rejected.entries())
		{
			assert.equal(entry.name, negatives[index].name); assert.equal(entry.code, negatives[index].code);
			assert.equal(entry.diagnostics, 1);
			assert.equal(entry.sourceSha256, sha256(`use variants_api as api; fn main() { ${negatives[index].statement} }\n`));
		}
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "cargo"); assert.equal(pkg.runtimeDelivery, "embedded"); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/variants-api-1.0.0.crate");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.match(run.dependencies.sha256, /^[a-f0-9]{64}$/);
		assert.equal(run.dependencies.lockSha256, run.installedFiles["Cargo.lock"].sha256);
		assert.ok(run.dependencies.packages.some(pkg => pkg.directory === "num-bigint-0.4.6"));
		assert.ok(run.dependencies.packages.some(pkg => pkg.directory === "sha2-0.10.9"));
		const native = run.nativeFaults;
		assert.equal(native.checks, 1182); assert.equal(native.allocationFailures, 242); assert.equal(native.rejected, 70); assert.equal(native.malformedNativeTags, 1);
		assert.equal(native.syntheticTagInjection, true); assert.equal(native.realLeanExecution, true);
		assert.equal(native.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/native-probe.c"]);
		assert.deepEqual(native.sanitizers, ["address", "leak", "undefined"]);
		assert.equal(native.startupLeakBaseline.unchangedAfterConversions, true);
		assert.equal(native.startupLeakBaseline.bytes, 128); assert.equal(native.startupLeakBaseline.allocations, 12);
		assert.match(native.startupLeakBaseline.report, /__gmp_default_allocate/);
	}
	const source = await readFile("tests/fixtures/variant-consumers/rust.rs", "utf8");
	assert.doesNotMatch(source, /unsafe\s*\{|__runtime|extern "C"|constructor_tag|lean_obj_tag|lean_ctor_get/);
});

test("Rust variants promote only six copied cells and require installed CI receipts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("rust-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "rust"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["rust-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_RUST_VARIANT_TEST=1 node --test tests\/rust-variants\.test\.mjs/);
	assert.match(workflow, /test -s build\/variants\/rust\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/rust\.json/);
});
