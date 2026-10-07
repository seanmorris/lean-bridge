/**
 * Every route that must refuse checked refinements does so with a classified diagnostic.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { createNativeModel, createPhpWasmCopiedModel } from "../src/build/native-model.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";

const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const fin = bound => ({ kind: "refinement", base: nat, predicate: { kind: "fin", bound }, abi: nat.abi });
const checked = constructor => ({ kind: "refinement", base: text, predicate: { kind: "subtype", constructor }, abi: text.abi });
const component = { id: "sample@1.0.0", name: "sample", version: "1.0.0" };
/**
 * Fresh fixture metadata whose single export takes `parameter` and returns `result`.
 *
 * @param parameter - Native metadata type of the exported parameter.
 * @param result - Native metadata type of the exported result.
 */
const refined = (parameter, result = nat) => {
	const input = nativeMetadataFixture();
	const projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = parameter;
	projection.result = result;
	return { ...input, component };
};
const unsupported = (fn, pattern) => assert.throws(fn, error => error.code === "native-refinements-unsupported" && pattern.test(error.message));

test("readers without the checked capability refuse refined metadata before any adapter exists", () => {
	for(const [label, site] of [["Fin", fin("10")], ["Subtype", checked("Sample.checkedText")]])
	{
		const input = refined(site);
		unsupported(() => createNativeModel(input), /implemented only for ordinary native packages with bound-checking adapters/);
		// The plain copied PHP-Wasm side module checks Fin since VO #1220; checked Subtype has no PHP-Wasm acceptance yet.
		if(label === "Fin") assert.deepEqual(createPhpWasmCopiedModel(input).exports[0].refinements, { parameters: [{ kind: "fin", bound: "10" }], result: null });
		else unsupported(() => createPhpWasmCopiedModel(input), /checked Subtype refinements are not yet supported by PHP-Wasm packages/);
		unsupported(() => createCompiledNativeModel(input, { nativeRefinements: false }), /implemented only for ordinary native packages with bound-checking adapters/);
		unsupported(() => createCompiledNativeModel(input, {}), /implemented only for ordinary native packages with bound-checking adapters/);
		assert.deepEqual(createNativeModel(input, { refinements: true }).exports[0].refinements, { parameters: [site.predicate.kind === "fin" ? { kind: "fin", bound: "10" } : { kind: "subtype", constructor: "Sample.checkedText" }], result: null }, label);
	}
});

test("checked exports never share a component with callbacks, and Subtype never enters a container", () => {
	const callback = { kind: "callback", parameters: [nat], result: nat, abi: heap };
	unsupported(() => createNativeModel(refined(fin("10"), callback), { refinements: true }), /cannot share a native export with callbacks/);
	// The type validator refuses a nested Subtype before the model's own guard can.
	const nested = { kind: "array", element: checked("Sample.checkedText"), abi: heap };
	assert.throws(() => createNativeModel(refined(nested), { refinements: true }), /Subtype refinements require a top-level native parameter or result/);
	// A product is a structural container (VO #1441); Subtype still never enters one.
	const product = { kind: "tuple", arguments: [fin("10"), nat], abi: heap };
	assert.deepEqual(createNativeModel(refined(product), { refinements: true }).exports[0].refinements.parameters[0], { kind: "tuple", arguments: [{ kind: "fin", bound: "10" }, null] });
	assert.throws(() => createNativeModel(refined({ ...product, arguments: [checked("Sample.checkedText"), nat] }), { refinements: true }), /Subtype refinements require a top-level native parameter or result/);
});

// Reviewed Binding IR rejection needs a real build with a reviewed document; tests/native-fin.test.mjs covers it.
