/**
 * Rust compound admission and typed public signatures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test("Rust compound evidence binds both installed crates to independent signatures and consumers", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/rust-compounds-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(evidence.signatures), sort(compoundSignatures));
	assert.deepEqual(evidence.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of evidence.runs)
	{
		assert.equal(run.profile, "rust"); assert.equal(run.checks, 5311);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/compound-consumers/rust.rs")));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, "cargo");
		for(const artifact of run.packages[0].artifacts) assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
		const safety = run.safety;
		assert.equal(safety.sourceFreeChecks, run.checks); assert.equal(safety.faultTests, 2); assert.equal(safety.faultChecks, 126);
		assert.equal(safety.faultSourceSha256, sha256(await readFile("tests/fixtures/compound-consumers/rust-faults.rs")));
		for(const field of ["executableSha256", "malformedSourceSha256"]) assert.match(safety[field], /^[a-f0-9]{64}$/);
		assert.equal(safety.rejected.length, 11);
		assert.equal(new Set(safety.rejected.map(item => item.name)).size, 11);
		for(const rejected of safety.rejected)
		{
			assert.equal(rejected.diagnostics, 1); assert.match(rejected.sourceSha256, /^[a-f0-9]{64}$/);
			assert.equal(rejected.code, rejected.name === "fixed-overflow" ? "overflowing_literals" : "E0308");
		}
	}
});

test("Rust compounds borrow native containers and return owned domain values inside boundary Results", () => {
	const ir = compoundReviewedIr(), model = compileCopiedRustModel(ir), files = generateCopiedRustPackage(ir);
	assert.equal(model.surface.functions.length, 64);
	assert.deepEqual(files, generateCopiedRustPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRustBindingPackage(ir));
	const source = files["src/lib.rs"], native = files["src/__runtime.rs"];
	assert.match(source, /pub fn classify\(value0: &Option<Option<\(\)>>\) -> Result<u32, Error>/);
	assert.match(source, /pub fn flip\(value0: &Result<\(u32, Option<\(\)>\), Option<String>>\) -> Result<Result<Option<String>, \(u32, Option<\(\)>\)>, Error>/);
	assert.match(source, /pub choice: Option<Result<\(BigUint, \(\)\), String>>/);
	assert.doesNotMatch(source, /unsafe|extern|c_void|constructor_tag|has_value|is_ok/);
	assert.match(native, /has_value: u8/); assert.match(native, /is_ok: u8/);
	assert.match(native, /match value.has_value \{ 0 => Ok\(None\)/);
	assert.match(native, /match value.is_ok \{ 1 => Ok\(Ok\(/);
	assert.match(native, /_ => Err\(Error::InvalidNative\)/);
});

for(const name of ["Option", "Some", "Result", "Ok", "Err"])
	test(`Rust compound name ${name} cannot collide with a generated record`, () => {
		const ir = compoundReviewedIr(); ir.types.find(type => type.kind === "record").name = name;
		assert.throws(() => compileCopiedRustModel(ir), /record name collides/);
	});

test("Rust compounds do not enable compound callbacks or borrowed copied identities", () => {
	const ir = callableReviewedIr();
	ir.types[0].callable.result.type = { kind: "apply", constructor: "option", arguments: [{ kind: "primitive", name: "unit" }] };
	assert.throws(() => compileCopiedRustModel(ir), /callbacks currently require copied primitive/);
	const borrowed = compoundReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedRustModel(borrowed), /copy ownership/);
});
