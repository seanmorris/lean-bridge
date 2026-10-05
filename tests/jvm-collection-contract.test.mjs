/**
 * Independently specified JVM array/record types and safe native conversions.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";

const prefix = "src/main/java/org/leanbridge/collections/";

test("JVM collections admit all 35 exports, nineteen primitive arrays and seven records", () => {
	const ir = collectionReviewedIr(), model = compileCopiedJvmModel(ir), files = generateCopiedJvmPackage(ir);
	assert.equal(model.surface.functions.length, 35);
	assert.deepEqual(files, generateCopiedJvmPackage(structuredClone(ir)));
	assert.deepEqual(generateCopiedJvmKotlinPackage(ir), generateJvmBindingPackage(ir));
	assert.deepEqual(model.surface.copies.filter(copy => copy.record).map(copy => copy.publicName), ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"]);
	for(const [name, type] of Object.entries({ Unit: "Unit", Bool: "boolean", Uint8: "int", Uint16: "int", Uint32: "long", Uint64: "java.math.BigInteger", Int8: "byte", Int16: "short", Int32: "int", Int64: "long", Nat: "java.math.BigInteger", Int: "java.math.BigInteger", Float32: "float", Float64: "double", String: "String", Bytes: "byte[]", Char: "int", Usize: "java.math.BigInteger", Isize: "long" }))
		assert.ok(files[`${prefix}Api.java`].includes(`public static ${type}[][] arrayReverse${name}(${type}[][] arg0)`), name);
	assert.match(files[`${prefix}Primitives.java`], /int char_, java.math.BigInteger usize, long isize/);
	assert.match(files[`${prefix}Pair.java`], /record Pair\(long first, String second\)/);
	assert.match(files[`${prefix}Reversed.java`], /record Reversed\(String second, long first\)/);
	for(const path of JSON.parse(files["binding-manifest.json"]).publicFiles)
		assert.doesNotMatch(files[path], /MemorySegment|MethodHandle|java.lang.foreign|JsonSerializer/);
});

test("JVM record accessors escape keywords and preserve distinguishing underscores", () => {
	for(const name of ["char", "class", "float", "static", "record", "char_", "char__", "candidate", "other"])
	{
		const ir = collectionReviewedIr(); ir.types.find(type => type.name === "Pair").fields[0].name = name;
		const record = compileCopiedJvmModel(ir).surface.copies.find(copy => copy.record?.name === "Pair");
		assert.equal(record.fields[0].publicName, ["candidate", "other"].includes(name) || name.endsWith("_") ? name : `${name}_`);
	}
	for(const names of [["first", "First"], ["class", "class_"], ["hashCode", "second"], ["getClass", "second"]])
	{
		const ir = collectionReviewedIr(); ir.types.find(type => type.name === "Pair").fields.forEach((field, i) => { field.name = names[i]; });
		assert.throws(() => compileCopiedJvmModel(ir), /(?:Java field name collides|C\/C\+\+ record field is reserved or duplicated)/);
	}
});

test("JVM arrays keep 24 explicit levels and record equality uses nested contents", () => {
	const ir = collectionReviewedIr(), model = compileCopiedJvmModel(ir), files = generateCopiedJvmPackage(ir);
	const fn = model.surface.functions.find(fn => fn.field === "deep");
	assert.equal(model.publicType(model.surface.copy(fn.declaration.result.type)), "long" + "[]".repeat(24));
	assert.match(files[`${prefix}Packet.java`], /Objects.deepEquals\(this.values, other.values\)/);
	assert.match(files[`${prefix}Packet.java`], /Arrays.deepHashCode\(new Object\[\] \{ Packet.class, this.label, this.values/);
	assert.match(files[`${prefix}Empty.java`], /candidate instanceof Empty other/);
});

test("JVM native buffers reject invalid lengths and markers before reads", () => {
	const runtime = generateCopiedJvmPackage(collectionReviewedIr())[`${prefix}Runtime.java`];
	assert.match(runtime, /length < 0 \|\| length > \(16 \* 1024 \* 1024\) \/ width/);
	assert.match(runtime, /if \(length == 0\) return MemorySegment.NULL/);
	assert.match(runtime, /pointer.address\(\) == 0 \|\| pointer.address\(\) % alignment != 0/);
	assert.match(runtime, /var buffer = checkedData\(value, 4, 4\)/);
	for(const message of ["Invalid native Unit", "Invalid native Bool", "Invalid native integer magnitude", "Invalid native integer sign"])
		assert.ok(runtime.includes(message), message);
});
