/**
 * Per-use nominal decisions survive review, model lowering and native guard generation.
 * Unit fixtures are synthetic; the registered fresh compiler checks establish source typing.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertRefinement } from "../../src/abi/refinements.mjs";
import { checkedRefinementSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { generateCopiedNativeCalls } from "../../src/backends/c/native-copied-values.mjs";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { nativeFinRefinements, nativeFinSummary } from "../../src/backends/native/fin-refinements.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { nominalSubtypeNativeFixture } from "./nominal-subtype-native-fixture.mjs";

const key = "lean-lang.org/refinements";
const model = () => createNativeModel(nominalSubtypeNativeFixture(), { refinements: true });
const declaration = (document, name) => document.declarations.find(item => item.id === `lean:Sample.${name}`);
const choices = document => reviewedSubtypeContracts(document);

test("nominal native metadata keeps per-use choices out of shared type definitions", () => {
	const value = model(), document = value.bindingIr;
	const nominal = document.types.find(type => type.id === "lean:NominalConversion.Envelope");
	assert.deepEqual(nominal.source.extensions["lean-lang.org/nominal-refinements"], { kind: "record", fields: [null, { kind: "fin", bound: "3" }] });
	assert.doesNotMatch(JSON.stringify(document.types), /plusOne|plusTwo/u);
	assert.equal(value.types.filter(type => type.lean === "NominalConversion.Envelope").length, 1);
	const selected = choices(document)["Sample.nested"].parameters[0].refinement.fields;
	assert.equal(selected[0].refinement.fields[0].refinement.constructor, "NominalConversion.plusOne");
	assert.equal(selected[1].refinement.fields[0].refinement.constructor, "NominalConversion.plusTwo");
	assert.equal(selected[0].refinement.fields[1].refinement, null);
	const reversed = nominalSubtypeNativeFixture();
	for(const item of reversed.metadata.modules[0].declarations)
		if(item.identity === "Sample.first") item.projection.parameters[0].type.fields[0].type.predicate.constructor = "NominalConversion.plusTwo";
	const reverse = createNativeModel(reversed, { refinements: true });
	assert.deepEqual(reverse.bindingIr.types, document.types);
	assert.notDeepEqual(reverse.bindingIr.declarations, document.declarations);
	assert.notEqual(generateNativeLeanAdapters(value).leanSource, generateNativeLeanAdapters(reverse).leanSource);
});

test("nominal reviewed decisions reject mismatched names, members, ownership and bounded traversal", () => {
	const document = model().bindingIr, item = declaration(document, "nested");
	const original = item.source.extensions[key].parameters[0];
	const check = (tree, types = document.types) => assertRefinement(tree, item.parameters[0].type, 0, true, types);
	check(original);
	const mutations = [
		tree => { tree.name = "NominalConversion.Other"; }
		, tree => { tree.fields.reverse(); }
		, tree => { tree.fields.pop(); }
		, tree => { tree.fields.push(structuredClone(tree.fields[0])); }
		, tree => { tree.fields[0].refinement.fields[1].refinement.bound = "3\n"; }
		, tree => { tree.fields[1].refinement.fields[0].refinement.constructor = null; }
		, tree => { tree.fields[0].refinement.fields[0].refinement.proof = "forged"; }
	];
	for(const mutate of mutations)
	{ const tree = structuredClone(original); mutate(tree); assert.throws(() => check(tree), /Refinement does not match/u); }
	assert.throws(() => check(original, []), /Refinement does not match/u);
	assert.throws(() => check(original, [...document.types, document.types[0]]), /Refinement does not match/u);
	for(const extension of ["lean-lang.org/instantiation", "lean-lang.org/erased-proofs"])
	{
		const types = structuredClone(document.types); types.find(type => type.id === item.parameters[0].type.id).source.extensions[extension] = {};
		assert.throws(() => check(original, types), /Refinement does not match/u);
	}
	let calls = 0;
	const accessor = structuredClone(original); Object.defineProperty(accessor.fields, "1", { get: () => { calls++; return original.fields[1]; } });
	assert.throws(() => check(accessor), /Refinement does not match/u); assert.equal(calls, 0);
	const borrowed = structuredClone(document); declaration(borrowed, "nested").parameters[0].ownership = "borrow";
	assert.throws(() => choices(borrowed), /Invalid reviewed Subtype constructor decision/u);
	assert.throws(() => assertRefinement(original, item.parameters[0].type, 1, false, document.types), /Refinement does not match/u);
	let deep = { kind: "subtype", constructor: "NominalConversion.plusOne" }, transport = { kind: "primitive", name: "nat" };
	for(let depth = 0; depth < 33; depth++)
	{ deep = { kind: "array", arguments: [deep] }; transport = { kind: "apply", constructor: "array", arguments: [transport] }; }
	assert.throws(() => assertRefinement(deep, transport), /Refinement does not match/u);
	let wide = original, wideType = item.parameters[0].type;
	for(let depth = 0; depth < 10; depth++)
	{ wide = { kind: "tuple", arguments: [wide, wide] }; wideType = { kind: "apply", constructor: "tuple", arguments: [wideType, wideType] }; }
	assert.throws(() => assertRefinement(wide, wideType, 0, true, document.types), /Refinement does not match/u);
	const reordered = structuredClone(document); declaration(reordered, "eventFirst").source.extensions[key].parameters[0].cases.reverse();
	assert.throws(() => choices(reordered), /Refinement does not match/u);
});

test("nominal review reconciliation detects changed or dropped field decisions and shared bounds", () => {
	const document = model().bindingIr;
	assert.equal(reviewedContractDifference(document, document), null);
	for(const mutate of [
		value => { declaration(value, "nested").source.extensions[key].parameters[0].fields[1].refinement.fields[0].refinement.constructor = "NominalConversion.plusOne"; }
		, value => { declaration(value, "nested").source.extensions[key].parameters[0].fields[1].refinement = null; }
		, value => { declaration(value, "nested").source.extensions[key].parameters[0].fields[1].refinement.fields[1].refinement.bound = "4"; }
		, value => { value.types.find(type => type.id === "lean:NominalConversion.Envelope").source.extensions["lean-lang.org/nominal-refinements"].fields[1].bound = "4"; }
	]) {
		const changed = structuredClone(document); mutate(changed);
		assert.notEqual(reviewedContractDifference(changed, document), null);
	}
});

test("nominal native documentation preserves each constructor and every sibling Fin bound", () => {
	const document = model().bindingIr;
	assert.equal(nativeFinSummary(declaration(document, "nested"), ["pair"], document.types), "pair.left.payload checked by NominalConversion.plusOne; pair.left.digit < 3; pair.right.payload checked by NominalConversion.plusTwo; pair.right.digit < 3");
	const event = nativeFinSummary(declaration(document, "eventFirst"), ["event"], document.types);
	assert.match(event, /event\.box\.value\.payload checked by NominalConversion\.plusOne/u);
	assert.match(event, /event\.choices\.values\[\*\]\?\.error checked by NominalConversion\.plusTwo/u);
	const changed = structuredClone(document), item = declaration(changed, "first");
	item.source.extensions[key].parameters[0].fields[1].refinement.bound = "4";
	assert.throws(() => nativeFinRefinements(item, changed.types), /conflicts with shared nominal bounds/u);
	const javascript = generateJavaScriptPackage(document);
	assert.match(javascript["internal/validators.mjs"], /refinement\.cases\.find/u);
	assert.match(javascript["index.mjs"], /validate\.assertNestedFin/u);
});

test("nominal C and Perl guards check Fin first and only enter the active variant case", () => {
	const input = nominalSubtypeNativeFixture();
	const value = createNativeModel({ ...input, moduleName: "LeanBridge::Nominal" }, { refinements: true });
	const source = generateCopiedNativeCalls(value, compilePrimitiveCSurface(value.bindingIr, { compounds: true, variants: true }));
	assert.match(source, /arg0\.right\.payload was rejected by NominalConversion\.plusTwo/u);
	assert.match(source, /arg0\.choices\.values\[%zu\]\?\.error was rejected by NominalConversion\.plusTwo/u);
	assert.doesNotMatch(source, /undefined/u);
	for(const item of value.exports.filter(item => ["combine", "nested", "eventFirst"].includes(item.publicName)))
	{
		const symbol = `${item.symbol}_refinement_0`;
		const start = source.lastIndexOf("static ", source.indexOf(symbol + "_"));
		const body = source.slice(start, source.indexOf(`lean_object *checked = ${item.symbol}(`));
		assert.ok(body.indexOf("lb_fin_below(") >= 0 && body.indexOf("lb_fin_below(") < body.indexOf(symbol));
	}
	const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };
	const xs = generatePerlBindingPackage(value, receipt)["Component.xs"];
	assert.match(xs, /%s\.right\.payload was rejected by NominalConversion\.plusTwo/u);
	assert.match(xs, /%s\.choices\.values\[%zu\]\?\.error was rejected by NominalConversion\.plusTwo/u);
	assert.match(xs, /uint32_t t0 = lb_t[0-9a-f]+_tag\(a0\);\n\s+if \(t0 == 1u\)/u);
	assert.doesNotMatch(xs, /undefined/u);
});

test("nominal selectors drop Fin-only children without losing empty cases or field order", () => {
	const document = model().bindingIr, item = declaration(document, "eventFirst");
	const tree = item.source.extensions[key].parameters[0];
	const selection = checkedRefinementSelection(tree);
	assert.deepEqual(selection.cases.map(branch => branch.name), ["empty", "box", "choices"]);
	assert.deepEqual(selection.cases[0].fields, []);
	assert.equal(selection.cases[1].fields[0].refinement.fields[1].refinement, null);
	const fin = { kind: "record", name: "Example.Digits", fields: [{ name: "digit", refinement: { kind: "fin", bound: "3" } }] };
	assert.equal(checkedRefinementSelection(fin), null);
	const invalid = structuredClone(tree); invalid.cases[0].name = "bad name";
	assert.throws(() => checkedRefinementSelection(invalid), /Invalid checked refinement/u);
});
