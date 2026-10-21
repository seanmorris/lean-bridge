/**
 * Result projection never supplies a constructor for a host-produced input.
 * These unit models are synthetic, separate from fresh source compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertRefinement } from "../../src/abi/refinements.mjs";
import { validateNativeType, validateOwnedNativeType } from "../../src/analyze/native-types.mjs";
import { checkedRefinementSelection, projectionCheckedSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { nativeFinSummary, nativeFinBoundPaths } from "../../src/backends/native/fin-refinements.mjs";
import { nominalSubtypeNativeFixture } from "./nominal-subtype-native-fixture.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const key = "lean-lang.org/refinements";
const project = value => {
	if(value && typeof value === "object")
	{
		if(value.kind === "subtype") value.constructor = null;
		else for(const child of Object.values(value)) project(child);
	}
	return value;
};
const fixture = () => {
	const value = nominalSubtypeNativeFixture();
	for(const item of value.metadata.modules[0].declarations) project(item.projection.result);
	return value;
};
const find = (value, name) => value.metadata.modules[0].declarations.find(item => item.identity === `Sample.${name}`);
const model = () => createNativeModel(fixture(), { refinements: true });

test("constructor-free native results require an explicit result direction", async () => {
	const value = fixture(), result = find(value, "produce").projection.result;
	validateNativeType(result, 0, false, "result");
	await assertJsonSchema("native-metadata-type", result);
	for(const site of [undefined, "parameter"]) assert.throws(() => validateNativeType(result, 0, false, site), /invalid Subtype refinement/u);
	const input = structuredClone(value);
	find(input, "first").projection.parameters[0].type = structuredClone(result);
	assert.throws(() => createNativeModel(input, { refinements: true }), /invalid Subtype refinement/u);
	const invented = fixture();
	find(invented, "produce").projection.result.fields[0].type.predicate.constructor = "NominalConversion.plusOne";
	assert.throws(() => createNativeModel(invented, { refinements: true }), /invalid Subtype refinement/u);
	const missing = structuredClone(result); delete missing.fields[0].type.predicate.constructor;
	assert.throws(() => validateNativeType(missing, 0, false, "result"), /refinement predicate fields/u);
	await assert.rejects(() => assertJsonSchema("native-metadata-type", missing));
	const callback = { kind: "callback", parameters: [result], result: find(value, "first").projection.result, abi: result.abi };
	assert.throws(() => validateNativeType(callback, 0, false, "result"), /invalid Subtype refinement/u);
	const returnedCallback = { ...callback, parameters: [callback.result], result };
	validateNativeType(returnedCallback, 0, false, "result");
	assert.throws(() => validateOwnedNativeType(result, { ownership: "lease", disposal: "required", fallback: "none", cycles: "reject" }), /Subtype refinements require/u);
	const generic = { ...result, name: "Library.Instance", lean: "Library.Instance"
		, constructor: "Library.Generic.mk"
		, provenance: { structure: "Library.Generic", arguments: [callback.result] } };
	assert.throws(() => validateNativeType(generic, 0, false, "result"), /Fin refinements require/u);
});

test("result projection retains shared identity and every Fin bound without inventing choices", () => {
	const selected = createNativeModel(nominalSubtypeNativeFixture(), { refinements: true }), value = model();
	assert.deepEqual(value.bindingIr.types, selected.bindingIr.types);
	for(const item of value.bindingIr.declarations)
	{
		const refinements = item.source.extensions[key];
		assertRefinement(refinements.result, item.result.type, 0, true, value.bindingIr.types, true);
		assert.equal(checkedRefinementSelection(refinements.result), null);
		if(refinements.result !== null) assert.throws(() => assertRefinement(refinements.result, item.result.type, 0, true, value.bindingIr.types), /Refinement does not match/u);
	}
	const choices = reviewedSubtypeContracts(value.bindingIr);
	assert.ok(choices["Sample.first"].parameters[0].refinement);
	assert.equal(choices["Sample.produce"], undefined);
	assert.equal(choices["Sample.produceEvent"], undefined);
	assert.equal(choices["Sample.echo"].result.refinement, undefined);
	assert.equal(projectionCheckedSelection(find(fixture(), "produceEvent").projection.result), null);
	assert.equal(reviewedContractDifference(selected.bindingIr, value.bindingIr), null);
	const changed = structuredClone(value.bindingIr);
	changed.declarations.find(item => item.name === "produce").source.extensions[key].result.fields[1].refinement.bound = "4";
	assert.notEqual(reviewedContractDifference(changed, value.bindingIr), null);
});

test("result-only adapters contain erasure and no checked input conversion", () => {
	const value = model();
	const resultOnly = { ...value, exports: value.exports.filter(item => ["Sample.produce", "Sample.produceEvent"].includes(item.name)) };
	const generated = generateNativeLeanAdapters(resultOnly);
	assert.match(generated.leanSource, /LbErased\.NominalConversion\.Envelope/u);
	assert.doesNotMatch(generated.leanSource, /plusOne|plusTwo|_refinement_|_root_\.null/u);
	assert.doesNotMatch(generated.header, /_refinement_/u);
	assert.deepEqual(generateNativeLeanAdapters(value), generateNativeLeanAdapters(createNativeModel(nominalSubtypeNativeFixture(), { refinements: true })), "A result's unused constructor choice must not change generated native code");
});

test("native documentation describes output projection rather than constructor invocation", () => {
	const value = model(), document = value.bindingIr;
	const produced = document.declarations.find(item => item.name === "produce");
	assert.equal(nativeFinSummary(produced, ["value"], document.types), "result.payload projects the Subtype base value; result.digit < 3");
	assert.deepEqual(nativeFinBoundPaths({ kind: "subtype", constructor: "Library.checked" }, "value"), ["value checked by Library.checked"]);
	assert.deepEqual(nativeFinBoundPaths({ kind: "subtype", constructor: "Library.checked" }, "result", true), ["result projects the Subtype base value"]);
	const borrowed = structuredClone(document);
	borrowed.declarations.find(item => item.name === "produce").result.ownership = "borrow";
	assert.throws(() => reviewedSubtypeContracts(borrowed), /Invalid reviewed Subtype constructor decision/u);
});
