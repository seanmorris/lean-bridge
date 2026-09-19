/**
 * Rust callable admission, typed APIs and generated lifetime guards.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test("Rust primitive callables expose typed FnMut and non-Send owned closures", () => {
	const ir = callableReviewedIr(), model = compileCopiedRustModel(ir), files = generateCopiedRustPackage(ir);
	assert.equal(model.surface.callbacks.size, 38);
	assert.equal(model.closureSignatures.length, 34, "platform words share host signatures with fixed 64-bit integers");
	assert.equal(model.surface.functions.length, 58);
	assert.deepEqual(files, generateCopiedRustPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRustBindingPackage(ir));
	const source = files["src/lib.rs"], native = files["src/__runtime.rs"];
	assert.match(source, /pub fn call_nat\(value0: &BigUint, value1: impl FnMut\(BigUint\) -> Result<BigUint, Error>\)/);
	assert.match(source, /pub struct LeanClosure<F>/);
	assert.match(source, /pub fn close\(&self\) -> Result<\(\), Error>/);
	assert.doesNotMatch(source, /unsafe|extern|c_void|dispatch/);
	assert.match(native, /catch_unwind/);
	assert.match(native, /resume_unwind/);
	assert.match(native, /try_borrow_mut/);
	assert.match(native, /PhantomData<std::rc::Rc<\(\)>>/);
	assert.match(native, /impl Drop for Lease/);
	assert.throws(() => compilePrimitiveCSurface(ir), { code: "unsupported-native-c-signature" });
});

for(const [label, change] of Object.entries({
	"retained callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "async callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "nonprimitive callback": ir => { ir.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint8" }] }; }
	, "builtin collision": ir => { ir.declarations[0].name = "match"; }
})) test(`Rust callable admission rejects ${label}`, () => {
	const ir = callableReviewedIr(); change(ir);
	assert.throws(() => compileCopiedRustModel(ir));
});
