/**
 * Structured Ruby admission, complete predecessor output and fault coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { assertRubyStructuredCodegenRegression } from "./helpers/ruby-structured-callable-regression.mjs";
import { assertRubyStructuredFaults } from "./helpers/ruby-structured-callable-install.mjs";

test("Ruby structured callbacks preserve all earlier generated packages byte for byte", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-structured-codegen-regression-20260924.json"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assertRubyStructuredCodegenRegression(record);
	const altered = structuredClone(record);
	Object.values(altered.fixtures[0].files)[0].sha256 = "0".repeat(64);
	assert.throws(() => assertRubyStructuredCodegenRegression(altered));
});

test("Ruby structured callbacks admit copied values while retaining ownership restrictions", () => {
	const { surface } = compileCopiedRubyModel(structuredCallableReviewedIr());
	assert.equal(surface.functions.length, 26); assert.equal(surface.callbacks.size, 14);
	assert.equal(surface.copies.length, 25);
	for(const mutate of [
		ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.result.lifetime = { scope: "explicit", anchor: null }; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => compileCopiedRubyModel(ir), { code: "unsupported-native-c-signature" });
	}
	assert.throws(() => compileCopiedRubyModel(structuredCallableReviewedIr({ recursive: true })), { code: "unsupported-native-c-signature" });
	const files = generateCopiedRubyPackage(structuredCallableReviewedIr());
	assert.doesNotMatch(files["lib/lean_bridge/structured.rb"], /Fiddle|Pointer|dispatch/);
	assert.match(files["README.md"], /acyclic copied structured callbacks/);
	assert.doesNotMatch(files["README.md"], /List callback payloads remain unsupported|compound callable payloads/);
	assert.match(files["binding-manifest.json"], /acyclic structured callables/);
});

test("Ruby fault records require every shape, both exception classes and every execution path", () => {
	const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];
	const valid = { checks: 3000, faults: 1600, clears: 2000, closes: 2000
		, malformed: 12, conversion_methods: 65
		, shapes: shapes.map(shape => ({ shape, paths: { callback: 20, create: 20, "create-call": 20, "held-call": 20, repeated: 20 }, faults: 200 })) };
	assertRubyStructuredFaults(valid);
	for(const change of [
		value => { value.shapes.pop(); }
		, value => { value.shapes[7].shape = "array"; }
		, value => { value.shapes[0].paths.callback = 0; }
		, value => { delete value.shapes[0].paths.create; }
		, value => { value.shapes[0].faults /= 2; }
		, value => { value.faults -= 1; }
		, value => { value.malformed = 0; }
		, value => { value.conversion_methods = 0; }
	]) {
		const altered = structuredClone(valid); change(altered);
		assert.throws(() => assertRubyStructuredFaults(altered));
	}
});
