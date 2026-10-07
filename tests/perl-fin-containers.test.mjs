/**
 * Checked Fin inside arrays, lists and options of generated XS for CPAN packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { nativeRefinementHasConstructor } from "../src/backends/native/fin-refinements.mjs";
import { createNativeModel, nativeTypeKey } from "../src/build/native-model.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";

const huge = "1180591620717411303424";
const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi: heap };
const keyed = type => ({ ...type, key: nativeTypeKey(type) });
const container = (kind, element) => ({ kind, element, abi: heap });
const fin = bound => ({ kind: "fin", bound });
const inside = (kind, child) => ({ kind, arguments: [child] });
const digits = container("array", nat), huges = container("list", nat), maybe = container("option", nat);
const rows = container("list", digits), cells = container("array", maybe);
const alias = { kind: "alias", name: "Digits", lean: "Digits", target: digits, abi: heap };
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

const generate = () => {
	const base = createNativeModel({ component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample", ...nativeMetadataFixture() });
	const item = (name, parameters, result, refinements) => ({
		...base.exports[0]
		, name: `Sample.${name}`, publicName: name, symbol: `lb_${name}`
		, parameters: parameters.map(([parameter, type]) => ({ name: parameter, type }))
		, result
		, ...(refinements ? { refinements } : {}) });
	const model = { ...base
		, types: [nat, text, digits, huges, maybe, rows, cells, alias].map(keyed)
		, exports: [
			item("mirrorAll", [["values", alias]], alias, { parameters: [inside("array", fin("10"))], result: inside("array", fin("10")) })
			, item("countNone", [["values", digits]], nat, { parameters: [inside("array", fin("0"))], result: null })
			, item("sumHuge", [["values", huges]], nat, { parameters: [inside("list", fin(huge))], result: null })
			, item("orDefault", [["value", maybe]], nat, { parameters: [inside("option", fin("1"))], result: null })
			, item("present", [["values", cells]], digits, { parameters: [inside("array", inside("option", fin("10")))], result: inside("array", fin("10")) })
			, item("flatten", [["rows", rows]], nat, { parameters: [inside("list", inside("array", fin("10")))], result: null })
			, item("label", [["names", text], ["offsets", digits]], text, { parameters: [null, inside("array", fin("4"))], result: null })
			, item("wrapAll", [["values", digits]], digits, { parameters: [null], result: inside("array", fin("7")) })] };
	const files = generatePerlBindingPackage(model, receipt), xs = files["Component.xs"];
	return { files, xs, section: name => xs.slice(xs.indexOf(`\n${name}(...)`), xs.indexOf("XSRETURN(1);", xs.indexOf(`\n${name}(...)`))) };
};

test("generated XS walks every container element against its exact bound before any Lean call", () => {
	const { files, section } = generate();
	// Arrays are read in place; the element is compared, never consumed, and the message names the parameter and leaf bound.
	const mirror = section("mirrorAll");
	assert.match(mirror, /for \(size_t k0 = 0; k0 < lean_array_size\(a0\); \+\+k0\) \{ lean_object \*e0 = lean_array_get_core\(a0, k0\);\s+\{ lean_object \*bound = lean_cstr_to_nat\("10"\); int below = lean_nat_lt\(e0, bound\); lean_dec\(bound\);\s+if \(!below\) croak\("%s", "values is not below its Fin 10 bound"\); \} \} \}/);
	assert.ok(mirror.indexOf("lean_array_size(a0)") < mirror.indexOf("lean_inc(a0)"));
	assert.ok(mirror.indexOf("lean_inc(a0)") < mirror.indexOf("lean_object *checked = lb_mirrorAll(a0);"));
	assert.match(mirror, /if \(lean_is_scalar\(checked\)\) croak\("Lean rejected an argument outside its Fin bound"\);/);
	assert.doesNotMatch(mirror, /lean_dec\(e0\)|lean_inc\(e0\)/);
	// A Fin 0 leaf is rejected whenever it is present; the empty array passes the loop untouched.
	assert.match(section("countNone"), /lean_cstr_to_nat\("0"\); int below = lean_nat_lt\(e0, bound\)/);
	// Lists are viewed through their scope-owned array; the list keeps its own reference.
	const sum = section("sumHuge");
	assert.match(sum, new RegExp(`lean_inc\\(a0\\); lean_object \\*items0 = lbp_keep\\(scope, lb_t${nativeTypeKey(huges)}_to_array\\(a0\\)\\);\\s+for \\(size_t k0 = 0; k0 < lean_array_size\\(items0\\); \\+\\+k0\\)`));
	assert.match(sum, new RegExp(`lean_cstr_to_nat\\("${huge}"\\); int below = lean_nat_lt\\(e0, bound\\)`));
	// Options are opened only when present, through the typed accessors the conversions use.
	const option = section("orDefault");
	assert.match(option, new RegExp(`lean_inc\\(a0\\); if \\(lb_t${nativeTypeKey(maybe)}_has\\(a0\\)\\) \\{ lean_inc\\(a0\\); lean_object \\*v0 = lbp_keep\\(scope, lb_t${nativeTypeKey(maybe)}_get0\\(a0\\)\\);\\s+\\{ lean_object \\*bound = lean_cstr_to_nat\\("1"\\); int below = lean_nat_lt\\(v0, bound\\)`));
	// Nesting composes the same walkers with distinct names.
	const present = section("present");
	assert.match(present, new RegExp(`lean_array_get_core\\(a0, k0\\);\\s+\\{ lean_inc\\(e0\\); if \\(lb_t${nativeTypeKey(maybe)}_has\\(e0\\)\\) \\{ lean_inc\\(e0\\); lean_object \\*v1 = lbp_keep\\(scope, lb_t${nativeTypeKey(maybe)}_get0\\(e0\\)\\);\\s+\\{ lean_object \\*bound = lean_cstr_to_nat\\("10"\\); int below = lean_nat_lt\\(v1, bound\\)`));
	const flatten = section("flatten");
	assert.match(flatten, new RegExp(`lb_t${nativeTypeKey(rows)}_to_array\\(a0\\)\\);\\s+for \\(size_t k0 = 0; k0 < lean_array_size\\(items0\\); \\+\\+k0\\) \\{ lean_object \\*e0 = lean_array_get_core\\(items0, k0\\);\\s+\\{ \\s*for \\(size_t k1 = 0; k1 < lean_array_size\\(e0\\); \\+\\+k1\\) \\{ lean_object \\*e1 = lean_array_get_core\\(e0, k1\\);`));
	// A late refined argument is checked after the unrefined one converts, before either is retained.
	const label = section("label");
	assert.match(label, /"offsets is not below its Fin 4 bound"/);
	assert.doesNotMatch(label, /lean_nat_lt\(a0|lean_array_size\(a0\)/);
	assert.ok(label.indexOf("lean_array_size(a1)") < label.indexOf("lean_inc(a0)"));
	// Result-only container refinements keep the direct call and project after Lean returns.
	assert.doesNotMatch(section("wrapAll"), /lean_nat_lt|checked|boxed/);
	assert.match(section("wrapAll"), /lean_object \* result = lb_wrapAll\(a0\);/);
	// Documentation lists each checked path from the model.
	const pod = files["lib/LeanBridge/Sample.pm"];
	assert.match(pod, /=head2 mirrorAll\n\n[^\n]+\n\nChecked Lean Fin bounds: values\[\*\] < 10; result\[\*\] < 10\.\n/);
	assert.match(pod, /=head2 present\n\n[^\n]+\n\nChecked Lean Fin bounds: values\[\*\]\? < 10; result\[\*\] < 10\.\n/);
	assert.match(pod, /=head2 flatten\n\n[^\n]+\n\nChecked Lean Fin bounds: rows\[\*\]\[\*\] < 10\.\n/);
	assert.match(pod, /=head2 orDefault\n\n[^\n]+\n\nChecked Lean Fin bounds: value\? < 1\.\n/);
	assert.match(pod, /=head1 BOUNDED INTEGERS[^]*no present element|C<Fin 0> element is rejected while an empty array or an undefined option is accepted/);
});

test("the cpan gate now refuses only checked constructors, anywhere in a refinement tree", () => {
	assert.equal(nativeRefinementHasConstructor(null), false);
	assert.equal(nativeRefinementHasConstructor(fin("10")), false);
	assert.equal(nativeRefinementHasConstructor(inside("list", inside("option", fin("0")))), false);
	assert.equal(nativeRefinementHasConstructor({ kind: "subtype", constructor: "Sample.checkedText" }), true);
	assert.equal(nativeRefinementHasConstructor(inside("array", { kind: "subtype", constructor: "Sample.checkedText" })), true);
	// The walker refuses a refinement kind the Perl transport has no accessor for, rather than erasing it.
	const base = createNativeModel({ component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample", ...nativeMetadataFixture() });
	const odd = { ...base.exports[0], name: "Sample.odd", publicName: "odd", symbol: "lb_odd", parameters: [{ name: "value", type: nat }], result: nat };
	odd.refinements = { parameters: [{ kind: "subtype", constructor: "Sample.checkedNat" }], result: null };
	const model = { ...base, types: [keyed(nat)], exports: [odd] };
	assert.throws(() => generatePerlBindingPackage(model, receipt), /value: checked subtype refinements are not implemented for cpan packages/);
});
