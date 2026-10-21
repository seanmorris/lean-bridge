/**
 * Zero-payload checked records (VO #1482): proof-only records cross as empty carriers,
 * Unit-bearing records keep their unit payload beside erased proofs, and plain empty records
 * stay ordinary copied records. None of them is an Option, null or default value.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { validateCheckedRefinementSelection } from "../src/analyze/checked-refinement-selection.mjs";
import { reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { assertJsonSchema, jsonSchemaErrors } from "./helpers/json-schema.mjs";
import {
	erasedProofsKey, refinementsKey, zeroPayloadCheckedRecordContracts, zeroPayloadCheckedRecordFixture
	, zeroPayloadCheckedRecordModule, zeroPayloadCheckedRecordRefusalSource, zeroPayloadCheckedRecordRefusals
	, zeroPayloadCheckedRecordReview
} from "./helpers/zero-payload-checked-record-fixture.mjs";

const lean = process.env.LEAN_BRIDGE_ZERO_PAYLOAD_CHECKED_RECORD_LEAN_TEST === "1";
const module = zeroPayloadCheckedRecordModule;
const leanPrefix = join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const reviewInput = review => {
	const source = canonicalJson(review);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) };
};
const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const unit = { kind: "primitive", name: "unit", lean: "Unit", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
const record = (name, fields, erased) => ({ kind: "record"
	, name: `${module}.${name}`
	, lean: `${module}.${name}`
	, constructor: `${module}.${name}.mk`
	, fields
	, ...(erased ? { erased } : {})
	, abi });
const witness = record("Witness", [], ["positive"]);
const token = record("Token", [{ name: "tag", projection: `${module}.Token.tag`, type: unit }], ["fresh"]);
const marker = record("Marker", []);
const checked = (base, constructor) => ({ kind: "refinement", base, predicate: { kind: "checked-record", constructor: `${module}.${constructor}` }, abi });

test("an independent zero-payload review is valid and selects the nullary constructor", () => {
	const review = zeroPayloadCheckedRecordReview();
	validateReviewedSource(reviewInput(review));
	const selection = reviewedSourceSelection(reviewInput(review));
	const expected = Object.fromEntries(Object.entries(zeroPayloadCheckedRecordContracts())
		.filter(([name]) => [`${module}.witnessCount`, `${module}.absentCount`, `${module}.tokenTag`].includes(name)));
	assert.equal(canonicalJson(selection.contracts), canonicalJson(expected));
	assert.equal(selection.contracts[`${module}.witnessCount`].parameters[0].refinement.constructor, `${module}.mkWitness`);
	assert.equal(selection.contracts[`${module}.tokenTag`].parameters[0].refinement.constructor, `${module}.mkToken`);
	const types = Object.fromEntries(review.types.map(item => [item.name, item]));
	assert.deepEqual(types.Witness.fields, []);
	assert.deepEqual(types.Witness.source.extensions[erasedProofsKey], { fields: ["positive"] });
	assert.deepEqual(types.Token.fields.map(field => field.name), ["tag"]);
	assert.deepEqual(types.Token.source.extensions[erasedProofsKey], { fields: ["fresh"] });
	assert.deepEqual(types.Marker.fields, []);
	assert.equal(types.Marker.source.extensions[erasedProofsKey], undefined);
	const produced = review.declarations.find(item => item.name === "produceWitness");
	assert.equal(produced.source.extensions[refinementsKey], undefined);
});

test("native metadata admits zero-payload checked records only through a constructor or as a result", () => {
	validateNativeType(checked(witness, "mkWitness"), 0, false, "parameter");
	validateNativeType(checked(token, "mkToken"), 0, false, "parameter");
	validateNativeType(witness, 0, false, "result");
	validateNativeType(token, 0, false, "result");
	validateNativeType({ kind: "array", element: witness, abi }, 0, false, "result");
	validateNativeType({ kind: "option", element: witness, abi }, 0, false, "result");
	// A plain empty record is an ordinary copied record in both directions.
	validateNativeType(marker, 0, false, "parameter");
	validateNativeType(marker, 0, false, "result");
	validateNativeType({ kind: "array", element: marker, abi }, 0, false, "parameter");
	const refused = [
		["a bare proof-only record at a parameter", () => validateNativeType(witness, 0, false, "parameter")]
		, ["a bare Unit-bearing record at a parameter", () => validateNativeType(token, 0, false, "parameter")]
		, ["a constructor at a result", () => validateNativeType(checked(witness, "mkWitness"), 0, false, "result")]
		, ["a constructor over a plain empty record", () => validateNativeType(checked(marker, "mkWitness"), 0, false, "parameter")]
		, ["an empty erased list", () => validateNativeType({ ...witness, erased: [] }, 0, false, "result")]
		, ["a proof-only record inside a parameter array", () => validateNativeType({ kind: "array", element: witness, abi }, 0, false, "parameter")]];
	for(const [label, check] of refused) assert.throws(check, TypeError, label);
});

test("compiler plans retain empty checked-record input and result trees", async () => {
	const input = { kind: "checked-record", name: `${module}.Witness`, constructor: `${module}.mkWitness`, fields: [] };
	const result = { ...input, constructor: null };
	assert.deepEqual(validateCheckedRefinementSelection(input), input);
	assert.equal(await jsonSchemaErrors("compiler-adapter-plan#/$defs/refinement", input), null);
	assert.equal(await jsonSchemaErrors("compiler-adapter-plan#/$defs/resultRefinement", result), null);
});

const nativeModel = async (t, { extra = "", contracts = zeroPayloadCheckedRecordContracts(), review } = {}) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-checked-records-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(zeroPayloadCheckedRecordFixture, projectRoot, { recursive: true });
	const source = await readFile(join(zeroPayloadCheckedRecordFixture, `${module}.lean`), "utf8");
	await writeFile(join(projectRoot, `${module}.lean`), source.replace(`end ${module}`, `${extra}\nend ${module}`));
	const targets = { c: { name: "zeropayloadcheckedrecords", version: "1.0.0" } };
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson(review ? { schemaVersion: 1, modules: [module], targets }
		: { schemaVersion: 1, modules: [module], exports: Object.keys(contracts), contracts, targets }));
	if(review) await writeFile(join(projectRoot, "api.binding-ir.json"), canonicalJson(review));
	let captured;
	const options = { projectRoot
		, outputRoot: join(directory, "out")
		, leanPrefix
		, targets: ["c"]
		, profile: "native-library-v1"
		, receiptName: "native-component.json"
		, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
		, createAdapters: generateCompiledNativeLeanAdapters
		, compileComponent: async ({ model, adapters, metadata }) => { captured = { model, adapters, metadata }; throw Object.assign(new Error("stop before C"), { code: "stop-before-c" }); } };
	await assert.rejects(() => buildElaboratedComponent(options), error => {
		if(error.code !== "stop-before-c") throw error;
		return true;
	});
	return captured;
};
const exportNamed = (model, name) => model.exports.find(item => item.name === `${module}.${name}`);

test("fresh Lean admits proof-only and Unit-bearing checked records with exact erased proofs", { skip: !lean, timeout: 900_000 }, async t => {
	const { model, adapters, metadata } = await nativeModel(t);
	await assertJsonSchema("elaborated-export-metadata", metadata);
	assert.equal(reviewedContractDifference(zeroPayloadCheckedRecordReview(), model.bindingIr), null);
	const types = Object.fromEntries(model.bindingIr.types.map(item => [item.name, item]));
	assert.deepEqual(types.Witness.fields, []);
	assert.deepEqual(types.Witness.source.extensions[erasedProofsKey], { fields: ["positive"] });
	assert.deepEqual(types.Token.source.extensions[erasedProofsKey], { fields: ["fresh"] });
	assert.equal(types.Marker.source.extensions[erasedProofsKey], undefined);
	assert.deepEqual(exportNamed(model, "witnessCount").refinements
		, { parameters: [{ kind: "checked-record", definition: `${module}.Witness`, constructor: `${module}.mkWitness`, fields: [] }], result: null });
	assert.deepEqual(exportNamed(model, "absentCount").refinements
		, { parameters: [{ kind: "checked-record", definition: `${module}.Witness`, constructor: `${module}.mkAbsent`, fields: [] }], result: null });
	assert.deepEqual(exportNamed(model, "produceWitness").refinements
		, { parameters: [], result: { kind: "checked-record", definition: `${module}.Witness`, constructor: null, fields: [] } });
	assert.deepEqual(exportNamed(model, "tokenTag").refinements
		, { parameters: [{ kind: "checked-record", definition: `${module}.Token`, constructor: `${module}.mkToken`, fields: ["tag"] }], result: null });
	// A plain empty record is unrefined, so its export carries no refinement metadata at all.
	assert.equal(exportNamed(model, "markerCount").refinements, undefined);
	// Mirrors exist for both checked records; the nullary constructor is applied with no payload.
	const source = adapters.leanSource;
	for(const name of ["Witness", "Token"])
	{
		assert.match(source, new RegExp(`structure LbErased\\.${module}\\.${name} where`, "u"), name);
		assert.match(source, new RegExp(`def LbErased\\.${module}\\.${name}\\.erase \\(value : _root_\\.${module}\\.${name}\\)`, "u"), name);
	}
	assert.match(source, new RegExp(`_root_\\.${module}\\.mkWitness\\b`, "u"));
	assert.doesNotMatch(source, new RegExp(`_root_\\.${module}\\.(Witness|Token)\\.mk|⟨`, "u"));
});

test("every refused zero-payload site reports its own diagnostic", { skip: !lean, timeout: 900_000 }, async t => {
	const refusals = zeroPayloadCheckedRecordRefusals();
	const contracts = Object.fromEntries(Object.entries(refusals).map(([name, { contract }]) => [name, contract]));
	let details;
	await assert.rejects(() => nativeModel(t, { extra: zeroPayloadCheckedRecordRefusalSource, contracts }), error => {
		details = error.details;
		return true;
	});
	const projections = new Map((details?.projections ?? []).map(item => [item.declaration, item.expression]));
	for(const [name, { pattern }] of Object.entries(refusals)) assert.match(projections.get(name) ?? JSON.stringify(details), pattern, name);
});

test("the independent zero-payload review reconciles exactly with fresh Lean", { skip: !lean, timeout: 900_000 }, async t => {
	const review = zeroPayloadCheckedRecordReview();
	const { model } = await nativeModel(t, { review });
	assert.equal(reviewedContractDifference(review, model.bindingIr), null);
	const changed = zeroPayloadCheckedRecordReview();
	changed.types.find(item => item.name === "Witness").source.extensions[erasedProofsKey] = { fields: [] };
	assert.notEqual(reviewedContractDifference(changed, model.bindingIr), null);
});
