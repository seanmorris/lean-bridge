/**
 * Rust List identity, typed borrowed inputs and owned results.
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
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test("Rust List evidence binds both installed crates to independent signatures, consumers and fault probes", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/rust-lists-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(evidence.signatures), sort(listSignatures));
	assert.deepEqual(evidence.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of evidence.runs)
	{
		assert.equal(run.profile, "rust"); assert.equal(run.checks, 34130);
		assert.deepEqual(sort(run.signatures), sort(listSignatures));
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/list-consumers/rust.rs")));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, "cargo");
		assert.equal(run.packages[0].artifacts.length, 1);
		assert.match(run.packages[0].artifacts[0].path, /\.crate$/);
		assert.match(run.packages[0].artifacts[0].sha256, /^[a-f0-9]{64}$/);
		const safety = run.safety;
		assert.equal(safety.sourceFreeChecks, run.checks); assert.equal(safety.faultTests, 2); assert.equal(safety.faultChecks, 444);
		assert.equal(safety.faultSourceSha256, sha256(await readFile("tests/fixtures/list-consumers/rust-faults.rs")));
		for(const field of ["executableSha256", "malformedSourceSha256"]) assert.match(safety[field], /^[a-f0-9]{64}$/);
		assert.equal(safety.rejected.length, 12);
		assert.equal(new Set(safety.rejected.map(item => item.name)).size, 12);
		for(const rejected of safety.rejected)
		{
			assert.equal(rejected.diagnostics, 1); assert.match(rejected.sourceSha256, /^[a-f0-9]{64}$/);
			assert.equal(rejected.code, ["fixed-overflow", "platform-overflow"].includes(rejected.name) ? "overflowing_literals" : "E0308");
		}
	}
});

test("Rust Lists borrow slices and return owned vectors while retaining distinct List/Array identities", () => {
	const ir = listReviewedIr(), model = compileCopiedRustModel(ir), files = generateCopiedRustPackage(ir);
	assert.equal(model.surface.functions.length, 27);
	assert.deepEqual(files, generateCopiedRustPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRustBindingPackage(ir));
	const source = files["src/lib.rs"], native = files["src/__runtime.rs"];
	assert.match(source, /pub fn reverse_uint32\(value0: &\[u32\]\) -> Result<Vec<u32>, Error>/);
	assert.match(source, /pub fn mix\(value0: &\[Vec<u32>\]\) -> Result<Vec<Vec<u32>>, Error>/);
	assert.match(source, /pub branches: Vec<Option<Result<\(BigUint, \(\)\), String>>>/);
	assert.match(source, /pub fn swap\(value0: &Result<\(Vec<BigUint>, Vec<u32>\), Vec<String>>\) -> Result<Result<Vec<String>, \(Vec<BigUint>, Vec<u32>\)>, Error>/);
	assert.doesNotMatch(source, /unsafe|extern|c_void|constructor_tag|has_value|is_ok/);
	assert.match(native, /scope\.charge\(value\.len\(\), 8\)/);
	assert.match(native, /impl<T> Drop for Output<T>/);
	const word = { kind: "primitive", name: "uint32" };
	const list = model.surface.copy({ kind: "apply", constructor: "list", arguments: [word] });
	const array = model.surface.copy({ kind: "apply", constructor: "array", arguments: [word] });
	assert.notEqual(list.name, array.name); assert.notEqual(list.ctype, array.ctype);
	assert.equal(list.publicType, array.publicType);
	assert.match(files["README.md"], /Lean List inputs borrow Rust slices and return owned Vec values/);
});

test("Rust Lists reject borrowed identities, compound callbacks and record name collisions", () => {
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		const list = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "uint32" }] };
		if(position === "parameter") callback.callable.parameters[0].type = list;
		else callback.callable.result.type = list;
		assert.throws(() => compileCopiedRustModel(ir), /callbacks currently require copied primitive/);
	}
	const borrowed = listReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedRustModel(borrowed), /copy ownership/);
	const collision = listReviewedIr(); collision.types[0].name = "Vec";
	assert.throws(() => compileCopiedRustModel(collision), /record name collides/);
});
