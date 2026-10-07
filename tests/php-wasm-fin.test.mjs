/**
 * Checked Fin in plain copied PHP-Wasm packages (VO #1220, PHP-Wasm slice 1).
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createNativeModel, createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { phpWasmFinReadme } from "../src/release/php-wasm-copied-package.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { finRecordCompilerInput, finRecordNat } from "./helpers/fin-record-model.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const refinedError = pattern => error => error.code === "native-refinements-unsupported" && pattern.test(error.message);

test("plain copied PHP-Wasm models carry the native Fin trees and the same Lean guards", () => {
	const input = finRecordCompilerInput(), native = createNativeModel(input, { refinements: true }), wasm = createPhpWasmCopiedModel(input);
	assert.equal(wasm.profile, "php-wasm-copied-v1");
	assert.equal(wasm.pointerBits, 32);
	assert.deepEqual(wasm.bindingIr, native.bindingIr);
	assert.deepEqual(wasm.exports.map(item => item.refinements), native.exports.map(item => item.refinements));
	// One adapter text: the erased mirrors and decidable Fin construction are shared with native packages.
	// Only the List conversion fuel follows the 32-bit pointer width.
	const lean = model => generateNativeLeanAdapters(model).leanSource;
	const fuel = text => text.replace(/loop \d+ value #\[\]/gu, "loop FUEL value #[]");
	assert.equal(fuel(lean(wasm)), fuel(lean(native)));
	assert.match(lean(wasm), /def LbErased\.FinRecords\.Tile\.check/u);
});

test("the PHP-Wasm side module compares caller limbs with each bound before the only conversion into Lean", () => {
	const wasm = createPhpWasmCopiedModel(finRecordCompilerInput());
	const provider = generateNativePrimitiveC(wasm, { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const call = name => { const start = provider.indexOf(`static finrecords_status lb_call_${name}(`); return provider.slice(start, provider.indexOf("\n}\n", start)); };
	const nest = call("nest_sum");
	const inner = nest.indexOf("(&(&arg0->inner)->digit)->data"), tag = nest.indexOf("(&arg0->tag)->data"), dispatch = nest.indexOf("lean_object *checked = ");
	assert.ok(nest.indexOf("_check(arg0, &budget)") < inner && inner < tag && tag < dispatch, nest);
	assert.match(call("shape_size"), /if \(arg0->kind == 0u\) \{\n\s+if \(!lb_fin_below\(\(&arg0->cases\.circle\.radius\)->data, \(&arg0->cases\.circle\.radius\)->length, lb_fin_shape_size_0_0, 1\)\) return lb_invalid\(error, "arg0 is not below its Fin 10 bound"\);/u);
	// Fin 0 compares against no limbs; a bound is carried in exact 32-bit limbs whatever its width.
	assert.match(call("gate_open"), /lb_fin_below\(\(&arg0->cases\.never\.value\)->data, \(&arg0->cases\.never\.value\)->length, NULL, 0\)/u);
	assert.ok(provider.includes("static const uint32_t lb_fin_tile_sum_0_0[1] = {0x5u};"));
});

test("PHP-Wasm keeps checked Subtype, callables and graph packages refused", () => {
	const component = { id: "sample@1.0.0", name: "sample", version: "1.0.0" };
	const input = parameter => {
		const value = nativeMetadataFixture(), projection = value.metadata.modules[0].declarations[0].projection;
		projection.parameters[0].type = parameter;
		return { ...value, component };
	};
	const base = nativeMetadataFixture().metadata.modules[0].declarations[0].projection.parameters[0].type;
	assert.throws(() => createPhpWasmCopiedModel(input({ kind: "refinement", base, predicate: { kind: "subtype", constructor: "Sample.checkedText" }, abi: base.abi })), refinedError(/checked Subtype refinements are not yet supported by PHP-Wasm packages/u));
	// A refined export beside a callable export is refused for the whole package.
	const signatures = { tileSum: finRecordCompilerInput().metadata.modules[0].declarations.find(item => item.identity === "Sample.tileSum").projection.parameters[0].type };
	const mixed = finRecordCompilerInput({}, { callable: [{ kind: "callback", parameters: [finRecordNat], result: finRecordNat, abi: heap }, finRecordNat], tileSum: [signatures.tileSum, finRecordNat] });
	assert.throws(() => createPhpWasmCopiedModel(mixed), refinedError(/cannot share a PHP-Wasm package with callables/u));
});

test("PHP-Wasm packages document each checked path, and packages without bounds document nothing new", () => {
	const settings = { integerBits: 32, structuredCallables: true, lists: true, variants: true };
	const readme = phpWasmFinReadme(compileCopiedPhpModel(createPhpWasmCopiedModel(finRecordCompilerInput()).bindingIr, settings));
	assert.match(readme, /^\n## Bounded integers\n\nLean Fin n parameters and results are Brick\\Math\\BigInteger values below n\. The PHP-Wasm side module compares each argument/u);
	assert.match(readme, /Fin inside callbacks or generic record instantiations is not supported in PHP-Wasm packages\./u);
	for(const line of ["nest_sum: $arg0.inner.digit < 5; $arg0.tag < 3", "maybe_shape: $arg0?.circle.radius < 10", "tile_except: $arg0.ok.digit < 5; $arg0.error.circle.radius < 10"])
		assert.ok(readme.includes(`\\${line}\n`), line);
	const plain = { ...nativeMetadataFixture(), component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	assert.equal(phpWasmFinReadme(compileCopiedPhpModel(createPhpWasmCopiedModel(plain).bindingIr, settings)), "");
});
