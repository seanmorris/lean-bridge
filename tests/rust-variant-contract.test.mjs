/**
 * Rust named enum admission and private active-case ABI conversion.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";

test("Rust variants use public named enums and checked private active payloads", () => {
	const ir = nativeVariantReviewedIr(), files = generateCopiedRustPackage(ir);
	assert.deepEqual(files, generateRustBindingPackage(ir));
	assert.deepEqual(files, generateCopiedRustPackage(structuredClone(ir)));
	const source = files["src/lib.rs"], native = files["src/__runtime.rs"];
	assert.match(source, /pub enum Signal \{/);
	assert.match(source, /Idle,/); assert.match(source, /Stopped,/);
	assert.match(source, /Data \{ count: u32, label: String \},/);
	assert.match(source, /Marker \{ value: \(\) \},/);
	assert.match(source, /pub enum One \{\n {4}Only \{ value: u32 \},/);
	assert.match(source, /pub fn echo\(value0: &Signal\) -> Result<Signal, Error>/);
	assert.match(source, /pub fallback: Option<Signal>/);
	assert.doesNotMatch(source, /unsafe|extern|c_void|constructor_tag|pub union/);
	assert.match(native, /union V\d+ \{/);
	assert.match(native, /match value.kind \{/);
	assert.match(native, /_ => Err\(Error::InvalidNative\)/);
	assert.match(native, /crate::Signal::Data \{ count: field0, label: field1 \}/);
	assert.match(native, /unsafe \{ &value.cases.case2 \}/);
	assert.doesNotMatch(native, /lean_obj_tag|lean_ctor_get/);
});

test("Rust enum names and escaped branch members reject collisions", () => {
	for(const name of ["Error", "Result", "V0", "B1_2", "Packet"])
	{
		const ir = nativeVariantReviewedIr(); ir.types.find(type => type.name === "Signal").name = name;
		assert.throws(() => compileCopiedRustModel(ir), /(?:Rust|C\/C\+\+) .*name collides/);
	}
	const ir = nativeVariantReviewedIr(), signal = ir.types.find(type => type.name === "Signal");
	signal.cases[0].name = "self"; signal.cases[1].name = "self_";
	assert.throws(() => compileCopiedRustModel(ir), /Rust constructor name collides/);
	const fields = nativeVariantReviewedIr(), branch = fields.types.find(type => type.name === "Signal").cases[2];
	branch.fields[0].name = "type"; branch.fields[1].name = "type_";
	assert.throws(() => compileCopiedRustModel(fields), /Rust variant field name collides/);
});

test("Rust variants escape keywords but keep recursive and callable payloads gated", () => {
	const ir = nativeVariantReviewedIr(), branch = ir.types.find(type => type.name === "Signal").cases[2];
	branch.name = "self"; branch.fields[0].name = "type"; branch.fields[1].name = "match";
	const files = generateCopiedRustPackage(ir);
	assert.match(files["src/lib.rs"], /Self_ \{ type_: u32, match_: String \}/);
	assert.doesNotMatch(files["src/__runtime.rs"], /\.type\b|\.match\b/);
	const recursive = nativeVariantReviewedIr(); recursive.types.find(type => type.name === "Signal").cases[2].fields[0].type = { kind: "named", id: "lean:Variants.Signal" };
	assert.throws(() => compileCopiedRustModel(recursive), /acyclic/);
});
