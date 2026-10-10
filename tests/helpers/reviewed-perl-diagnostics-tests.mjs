/**
 * Reviewed Perl errors and POD use the names selected by the independent API.
 * Ordinary-source positional diagnostics remain byte-compatible.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { createNativeModel, nativeTypeKey } from "../../src/build/native-model.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

const fixture = () => {
	const base = createNativeModel({ component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample", ...nativeMetadataFixture() });
	const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
	const array = { kind: "array", element: nat, abi: { ...nat.abi, heap: true } };
	const subtype = { kind: "subtype", constructor: "Sample.checkedEven" }, fin = { kind: "fin", bound: "10" };
	return { ...base, types: [nat, array].map(type => ({ ...type, key: nativeTypeKey(type) }))
		, exports: [{ ...base.exports[0]
			, name: "Sample.mix", publicName: "mix", symbol: "lb_mix"
			, parameters: [{ name: "word", type: nat }, { name: "digit", type: nat }]
			, result: nat
			, refinements: { parameters: [subtype, fin], result: null } }
		, { ...base.exports[0]
			, name: "Sample.rows", publicName: "rows", symbol: "lb_rows"
			, parameters: [{ name: "values", type: array }], result: array
			, refinements: { parameters: [{ kind: "array", arguments: [fin] }], result: { kind: "array", arguments: [fin] } } }] };
};
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

test("reviewed Perl names drive Subtype, scalar Fin, indexed Fin and POD diagnostics", () => {
	const model = fixture(), ordinary = generatePerlBindingPackage(model, receipt);
	const reviewed = generatePerlBindingPackage({ ...model, sourceIdentity: { ...model.sourceIdentity, reviewedBindingIr: {} } }, receipt);
	assert.match(ordinary["Component.xs"], /arg0 was rejected by Sample\.checkedEven/u);
	assert.match(ordinary["Component.xs"], /arg1 is not below its Fin 10 bound/u);
	assert.match(reviewed["Component.xs"], /word was rejected by Sample\.checkedEven/u);
	assert.match(reviewed["Component.xs"], /digit is not below its Fin 10 bound/u);
	assert.match(reviewed["Component.xs"], /"%s\[%zu\] is not below its Fin 10 bound", "values"/u);
	assert.match(reviewed["lib/LeanBridge/Sample.pm"], /word checked by Sample\.checkedEven; digit < 10/u);
	assert.match(reviewed["lib/LeanBridge/Sample.pm"], /values\[\*\] < 10; result\[\*\] < 10/u);
	const restored = reviewed["Component.xs"].replaceAll("word was rejected", "arg0 was rejected")
		.replaceAll("digit is not below", "arg1 is not below").replaceAll('bound", "values"', 'bound", "arg0"');
	assert.equal(restored, ordinary["Component.xs"], "only the recorded diagnostic literals change");
});

test("reviewed Perl diagnostics quote authored names without introducing a format string", () => {
	const model = fixture();
	model.sourceIdentity = { ...model.sourceIdentity, reviewedBindingIr: {} };
	model.exports[0].parameters[0].name = "renamed_word";
	const xs = generatePerlBindingPackage(model, receipt)["Component.xs"];
	assert.match(xs, /croak\("%s", "renamed_word was rejected by Sample\.checkedEven"\)/u);
	assert.doesNotMatch(xs, /word was rejected by Sample\.checkedEven"\);[\s\S]*arg0 was rejected/u);
});
