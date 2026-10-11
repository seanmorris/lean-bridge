/**
 * Independent model and generated-boundary checks for structural Subtypes.
 * Synthetic metadata here is not installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nativeMetadataFixture } from "./native-metadata.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { constructorRefinementLeaves } from "../../src/build/component-refinements.mjs";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { generateCopiedNativeCalls } from "../../src/backends/c/native-copied-values.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { assertRefinement } from "../../src/abi/refinements.mjs";
import { validateNativeType } from "../../src/analyze/native-types.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
const byte = { kind: "primitive", name: "uint8", lean: "UInt8", abi: { cType: "uint8_t", box: "lean_box", unbox: "lean_unbox", heap: false } };
const sub = (constructor = "Sample.normalize", base = nat) => ({ kind: "refinement", base, predicate: { kind: "subtype", constructor }, abi: base.abi });
const fin = { kind: "refinement", base: nat, predicate: { kind: "fin", bound: "184467440737095516170" }, abi: nat.abi };
const one = (kind, element) => ({ kind, element, abi: heap });
const two = (kind, ...arguments_) => ({ kind, arguments: arguments_, abi: heap });
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const selection = constructor => ({ constructor });
const model = (parameter, result = nat, options = {}) => {
	const input = nativeMetadataFixture();
	const projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = parameter; projection.result = result;
	return createNativeModel({ ...input, ...options, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } }, { refinements: true });
};
const mixed = () => model(one("array", one("option", two("tuple", sub(), two("result", fin, sub("Sample.checked"))))));

test("independent admission gates preserve copied Subtypes without admitting callback leaves", () => {
	for(const kind of ["array", "list", "option"])
	{
		const value = model(one(kind, sub()));
		assert.deepEqual(value.exports[0].refinements.parameters[0], tree(kind, sub().predicate));
		assertRefinement(tree(kind, sub().predicate), { kind: "apply", constructor: kind, arguments: [{ kind: "primitive", name: "nat" }] });
		assert.throws(() => assertRefinement(tree(kind, sub().predicate), { kind: "apply", constructor: kind, arguments: [{ kind: "primitive", name: "nat" }] }, 1), /Refinement does not match/);
	}
	const nominal = [
		{ kind: "record", name: "Sample.Box", lean: "Sample.Box", constructor: "Sample.Box.mk", fields: [{ name: "value", projection: "Sample.Box.value", type: one("array", sub()) }], abi: heap }
		, { kind: "variant", name: "Sample.Choice", lean: "Sample.Choice", cases: [{ name: "value", constructor: "Sample.Choice.value", fields: [{ name: "value", type: sub() }] }], abi: heap }
	];
	for(const type of nominal) validateNativeType(type, 0, false, "parameter");
	assert.throws(() => validateNativeType({ kind: "callback", parameters: [one("list", sub())], result: nat, abi: heap }, 0, false, "parameter"), /Subtype refinements require/);
	assert.throws(() => validateNativeType(one("array", sub()), 1), /refinements require/);
});

test("reviewed structural constructor contracts retain ordering, distinct choices and mixed Fin branches", () => {
	const value = mixed(), before = structuredClone(value.bindingIr);
	const contracts = reviewedSubtypeContracts(value.bindingIr);
	assert.deepEqual(contracts["Sample.increment"].parameters[0].refinement,
		tree("array", tree("option", tree("tuple", selection("Sample.normalize"), tree("result", null, selection("Sample.checked"))))));
	assert.deepEqual(value.bindingIr, before);
	const denied = structuredClone(value.bindingIr);
	denied.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => reviewedSubtypeContracts(denied), /Invalid reviewed Subtype constructor decision/);
	assert.equal(reviewedSubtypeContracts(model(one("array", fin)).bindingIr), undefined);
});

test("native adapters preserve normalized values and emit one leaf validator for each constructor choice", () => {
	const value = mixed(), item = value.exports[0], generated = generateNativeLeanAdapters(value);
	const leaves = constructorRefinementLeaves(item.refinements.parameters[0], item.parameters[0].type);
	assert.deepEqual(leaves.map(leaf => [leaf.refinement.constructor, leaf.suffix]), [["Sample.normalize", "_0_0_0"], ["Sample.checked", "_0_0_1_1"]]);
	for(const leaf of leaves) assert.ok(generated.header.includes(`${item.symbol}_refinement_0${leaf.suffix}(lean_object * value)`));
	assert.match(generated.leanSource, /let _bridgeValue2a ← _root_\.Sample\.normalize/);
	assert.match(generated.leanSource, /let _bridgeValue2b ← \(match[^]*pure \(_bridgeValue2a, _bridgeValue2b\)/);
	assert.equal((generated.leanSource.match(/_root_\.Sample\.increment /g) ?? []).length, 1);
	assert.doesNotMatch(generated.leanSource, /unsafeCast|sorry|panic/);
	const result = generateNativeLeanAdapters(model(nat, one("array", one("option", sub())))).leanSource;
	assert.match(result, /\.map \(fun _bridgeValue0 => \(\(_bridgeValue0\)\.map \(fun _bridgeValue1 => \(_bridgeValue1\)\.val\)\)\)/);
});

test("generated C checks mixed Fin leaves before any constructor and reports actual rejected paths", () => {
	const value = mixed(), item = value.exports[0];
	const calls = generateCopiedNativeCalls(value, compilePrimitiveCSurface(value.bindingIr, { compounds: true }));
	const body = calls.slice(calls.indexOf("static sample_status lb_call_"));
	assert.ok(body.length > 0);
	assert.ok(body.indexOf("_check(") < body.indexOf("lb_fin_below("));
	assert.ok(body.indexOf("lb_fin_below(") < body.indexOf(`${item.symbol}_refinement_0_0_0_0(`));
	assert.ok(body.indexOf(`${item.symbol}_refinement_0_0_0_1_1(`) < body.indexOf(`lean_object *checked = ${item.symbol}(`));
	assert.match(body, /arg0\[%zu\]\?\.0 was rejected by Sample\.normalize/);
	assert.match(body, /arg0\[%zu\]\?\.1\.error was rejected by Sample\.checked/);
	assert.match(body, /arg0\[%zu\]\?\.1\.ok is not below its Fin 184467440737095516170 bound/);
	assert.match(body, /static _Thread_local char/);
	assert.match(body, /if \(![^\n]+->is_ok\)/);
	assert.doesNotMatch(body, /undefined/);
});

test("Perl constructor walks preserve Fin ordering and distinguish boxed and unboxed leaves", () => {
	const value = model(two("tuple", one("option", sub("Sample.byte", byte)), one("array", two("result", fin, sub()))), nat, { moduleName: "LeanBridge::Sample" });
	const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };
	const xs = generatePerlBindingPackage(value, receipt)["Component.xs"];
	const body = xs.slice(xs.indexOf("\nincrement(...)"), xs.indexOf("XSRETURN(1);", xs.indexOf("\nincrement(...)")));
	assert.ok(body.indexOf("is not below its Fin") < body.indexOf("was rejected by Sample.byte"));
	assert.match(body, /uint8_t v1_0 = lb_t[0-9a-f]+_get0\(v0_0\)/);
	assert.doesNotMatch(body, /lean_inc\(v1_0\)/);
	assert.match(body, /%s\.1\[%zu\]\.error was rejected by Sample\.normalize/);
	assert.ok(body.indexOf("was rejected by Sample.normalize") < body.indexOf("lean_object *checked = "));
	const array = model(one("array", sub("Sample.byte", byte)), nat, { moduleName: "LeanBridge::Sample" });
	assert.match(generatePerlBindingPackage(array, receipt)["Component.xs"], /_refinement_0_0\(\(\(uint8_t\)lean_unbox\(e0\)\)\)/);
});

test("generated JavaScript checks every mixed Fin without interpreting a Subtype as a branch", async () => {
	const value = mixed(), files = generateJavaScriptPackage(value.bindingIr);
	const source = files["internal/validators.mjs"];
	const validators = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
	const refinement = value.exports[0].refinements.parameters[0];
	validators.assertNestedFin([{ tag: "some", value: [1n, { ok: 10n }] }], refinement, "input");
	validators.assertNestedFin([{ tag: "some", value: [0n, { error: 0n }] }], refinement, "input");
	assert.throws(() => validators.assertNestedFin([{ tag: "some", value: [1n, { ok: 184467440737095516170n }] }], refinement, "input"), /input\[0\]\.value\[1\]\.ok/);
});
