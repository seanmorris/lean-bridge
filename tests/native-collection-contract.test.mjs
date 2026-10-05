/**
 * Independent copied collection shapes, record member names and C++ equality.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cRecordIdentifier, generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { compilePrimitiveCppModel, renderPrimitiveCppPackage } from "../src/backends/cpp/primitives.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";

const surface = ir => compilePrimitiveCSurface(ir, { compounds: true, lists: true, variants: true });

test("the independent native collection contract retains all primitives and seven named records", () => {
	const ir = collectionReviewedIr(), compiled = surface(ir);
	assert.equal(ir.declarations.length, 35); assert.equal(compiled.functions.length, 35);
	assert.equal(compiled.copies.filter(copy => copy.record).length, 7);
	assert.equal(collectionSignatures.filter(fn => fn.name.startsWith("Collections.arrayReverse")).length, 19);
	const primitive = compiled.copies.find(copy => copy.record?.name === "Primitives");
	assert.equal(primitive.fields.length, 19);
	assert.equal(primitive.record.fields.find(field => field.name === "char").type.name, "char");
	assert.equal(primitive.fields.find(field => field.name === "char_").type.scalarName, "char");
});

test("C record member escaping preserves existing normalization and rejects collisions", () => {
	for(const keyword of ["char", "bool", "class", "namespace", "switch", "mutable", "requires", "new"])
		assert.equal(cRecordIdentifier(keyword), `${keyword}_`);
	assert.equal(cRecordIdentifier("rowCount"), "row_count");
	assert.equal(cRecordIdentifier("row_count_"), "row_count");
	const ir = collectionReviewedIr(), record = ir.types.find(type => type.name === "Primitives");
	record.fields.push({ ...record.fields.find(field => field.name === "char"), name: "char_" });
	assert.throws(() => surface(ir), /record field is reserved or duplicated: char_/);
});

test("record declarations and cleanup use the same keyword-escaped member spelling", () => {
	const ir = collectionReviewedIr(), record = ir.types.find(type => type.name === "Primitives");
	record.fields.find(field => field.name === "text").name = "class";
	const generated = generateCBindingPackage(ir);
	assert.match(generated["include/collections.h"], /collections_string class_;/);
	assert.match(generated["src/collections.c"], /collections_string_clear\(&value->class_\)/);
	assert.doesNotMatch(generated["include/collections.h"], /uint32_t char;/);
	assert.match(generated["include/collections.h"], /uint32_t char_;/);
	assert.doesNotThrow(() => generateGmpProjection(ir));
});

test("C++ copied records provide value equality even when the package has no variants", () => {
	const ir = collectionReviewedIr(), files = renderPrimitiveCppPackage(compilePrimitiveCppModel(ir));
	const header = files["include/collections.hpp"];
	assert.ok(!ir.types.some(type => type.kind === "variant"));
	for(const name of ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"])
		assert.ok(header.includes(`friend bool operator==(const ${name}&, const ${name}&) = default;`), name);
	assert.match(header, /char32_t char_\{\};/);
});
