/**
 * Independent collection shapes remain typed in the generated Rust API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";

test("Rust collections preserve all independent primitive arrays and seven nominal records", () => {
	const ir = collectionReviewedIr(), model = compileCopiedRustModel(ir), files = generateCopiedRustPackage(ir);
	assert.equal(model.surface.functions.length, 35); assert.equal(collectionSignatures.length, 35);
	assert.deepEqual(files, generateCopiedRustPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRustBindingPackage(ir));
	const records = model.surface.copies.filter(copy => copy.record);
	assert.deepEqual(records.map(copy => copy.publicName), ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"]);
	const source = files["src/lib.rs"];
	for(const [name, type] of Object.entries({ unit: "()", bool: "bool", uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64", int8: "i8", int16: "i16", int32: "i32", int64: "i64", nat: "BigUint", int: "BigInt", float32: "f32", float64: "f64", string: "String", bytes: "Vec<u8>", char: "char", usize: "u64", isize: "i64" }))
		assert.ok(source.includes(`pub fn array_reverse_${name}(value0: &[Vec<${type}>]) -> Result<Vec<Vec<${type}>>, Error>`), name);
	assert.equal(records[0].fields.length, 19);
	assert.match(source, /pub values: Vec<Vec<Primitives>>/);
	assert.match(source, /pub struct Pair \{\n {4}pub first: u32,\n {4}pub second: String,/);
	assert.match(source, /pub struct Reversed \{\n {4}pub second: String,\n {4}pub first: u32,/);
	assert.equal(source.split("#[derive(Clone, Debug, PartialEq)]").length - 1, 7);
	assert.doesNotMatch(source, /unsafe|extern|c_void|serde|serde_json/);
	assert.match(files["src/assets.rs"], /Build a compiled Cargo release before calling this API/);
});

test("Rust deep arrays retain 24 explicit levels with borrowed input and owned output", () => {
	const model = compileCopiedRustModel(collectionReviewedIr());
	const fn = model.surface.functions.find(fn => fn.field === "deep");
	const copy = model.surface.copy(fn.declaration.result.type);
	assert.equal(copy.publicType, "Vec<".repeat(24) + "u32" + ">".repeat(24));
	assert.equal(copy.inputType, "&[" + "Vec<".repeat(23) + "u32" + ">".repeat(23) + "]");
	let depth = 0, child = copy;
	while(child.element)
	{
		depth++; child = child.element;
	}
	assert.equal(depth, 24); assert.equal(child.scalarName, "uint32");
});

test("Rust collection callers stay independent of private layouts and exercise every export", async () => {
	const source = await readFile("tests/fixtures/collection-consumers/rust.rs", "utf8");
	const model = compileCopiedRustModel(collectionReviewedIr());
	for(const fn of model.surface.functions) assert.ok(source.includes(`api::${fn.field}`), fn.field);
	assert.doesNotMatch(source, /__runtime|unsafe|extern|serde|serde_json|include!/);
	const invalid = JSON.parse(await readFile("tests/fixtures/collection-consumers/rust-invalid.json", "utf8"));
	assert.equal(invalid.length, 15); assert.equal(new Set(invalid.map(item => item.name)).size, 15);
	assert.deepEqual([...new Set(invalid.map(item => item.code))].sort(), ["E0063", "E0308", "E0560", "overflowing_literals"]);
});
