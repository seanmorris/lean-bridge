/**
 * Exercise the previously missing Fin 0 nominal collection cases without changing older fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./fin-record-zero-declarations-tests.mjs";
import { generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { assertReviewedFinChangesRefused, checkInstalledFinFixture, finFixtureProfiles } from "./fin-fixture-installed.mjs";
import { finRecordZeroCompilerModel, finRecordZeroRefinements, finRecordZeroReviewedIr, finRecordZeroSpec, finRecordZeroTargets, finRecordZeroWitPatterns } from "./fin-record-zero-fixture.mjs";

test("Fin 0 record collections retain nominal bounds on both sides of every call", () => {
	const model = finRecordZeroCompilerModel();
	assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name.replace("Sample.", "FinRecordZero."), item.refinements])), finRecordZeroRefinements);
	const review = finRecordZeroReviewedIr(); validateBindingIr(review);
	for(const type of review.types)
		assert.deepEqual(model.bindingIr.types.find(item => item.id === type.id).source.extensions["lean-lang.org/nominal-refinements"], type.source.extensions["lean-lang.org/nominal-refinements"]);
	const lean = generateNativeLeanAdapters(model).leanSource;
	assert.doesNotMatch(lean, /\bsorry\b|\baxiom\b|unsafeCast|panic!|default/u);
	assert.match(lean, /if proof : .* < 0 then/u);
	for(const declaration of review.declarations) assert.equal(declaration.source.extensions["lean-lang.org/refinements"], undefined);
	assert.deepEqual(model.exports.map(item => item.name.split(".").at(-1)), ["arrayFields", "arrayRecords", "fieldCollections", "listFields", "listRecords"]);
});

test("independent zero-bound reviews do not share mutable metadata with the next review or expected contract", () => {
	const first = finRecordZeroReviewedIr(), expected = structuredClone(finRecordZeroRefinements);
	first.types.find(type => type.id === "lean:FinRecordZero.Zero").source.extensions["lean-lang.org/nominal-refinements"].fields[0].bound = "1";
	const next = finRecordZeroReviewedIr();
	assert.equal(next.types.find(type => type.id === "lean:FinRecordZero.Zero").source.extensions["lean-lang.org/nominal-refinements"].fields[0].bound, "0");
	assert.deepEqual(finRecordZeroRefinements, expected);
});

test("Fin 0 record collection consumers use all eleven installed native package profiles", async () => {
	const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c", perl: "pl" };
	assert.deepEqual(Object.keys(extensions).sort(), Object.keys(finRecordZeroTargets).sort());
	for(const [profile, extension] of Object.entries(extensions))
		assert.match(await readFile(`tests/fixtures/fin-record-zero-consumers/${profile}.${extension}`, "utf8"), /fin-record-zero-ok/u);
	const wit = compileCopiedWitModel(finRecordZeroCompilerModel().bindingIr).wit;
	assert.match(wit, /array-records: func/u);
	assert.match(wit, /field-collections: func/u);
	for(const pattern of finRecordZeroWitPatterns) assert.match(wit, pattern);
});

const profiles = finFixtureProfiles("LEAN_BRIDGE_FIN_RECORD_ZERO_PROFILES", finRecordZeroTargets);
const reviewed = finFixtureProfiles("LEAN_BRIDGE_REVIEWED_FIN_RECORD_ZERO_PROFILES", finRecordZeroTargets);
test("installed native packages check empty Fin 0 record collections and reject populated fields", { skip: !profiles.length, timeout: 2_400_000 }, t => checkInstalledFinFixture(t, finRecordZeroSpec, profiles));
test("independently reviewed native packages check empty Fin 0 record collections", { skip: !reviewed.length, timeout: 2_400_000 }, t => checkInstalledFinFixture(t, finRecordZeroSpec, reviewed, true));
test("changed zero-bound record collections are refused against fresh Lean before output", { skip: !reviewed.includes("c"), timeout: 1_800_000 }, t => {
	const key = "lean-lang.org/nominal-refinements";
	const fields = ir => ir.types.find(type => type.id === "lean:FinRecordZero.Fields").source.extensions[key].fields;
	return assertReviewedFinChangesRefused(t, finRecordZeroSpec, [
		["loosened empty record", ir => { ir.types.find(type => type.id === "lean:FinRecordZero.Zero").source.extensions[key].fields[0].bound = "1"; }, /types\[\d+\]\.source\.extensions\.lean-lang\.org\/nominal-refinements/u]
		, ["loosened array field", ir => { fields(ir)[2].arguments[0].bound = "1"; }, /types\[\d+\]\.source\.extensions\.lean-lang\.org\/nominal-refinements/u]
		, ["omitted list field", ir => { fields(ir)[3] = null; }, /types\[\d+\]\.source\.extensions\.lean-lang\.org\/nominal-refinements/u]
	]);
});
