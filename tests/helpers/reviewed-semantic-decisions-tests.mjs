/**
 * Review comparison preserves checked decisions without granting compiler evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference, reconcileReviewedSource, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";

const input = () => corpusReviewedIr({ id: "decisions" }, [{ name: "Decisions.echo", parameters: ["nat"], result: "nat" }]);
const fin = bound => ({ kind: "fin", bound });
const reviewInput = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
const location = "bindingIr.declarations[0].source.extensions";
const erasedProofsKey = "lean-lang.org/erased-proofs";

// These are schema-valid synthetic comparison documents, not installed evidence.
const decisions = [
	["refinements"
		, { parameters: [{ kind: "array", arguments: [{ kind: "option", arguments: [fin("10")] }] }], result: fin("10") }
		, value => { value.parameters[0].arguments[0].arguments[0].bound = "5"; }]
	, ["refinements"
		, { parameters: [{ kind: "subtype", constructor: "Decisions.check" }], result: null }
		, value => { value.parameters[0].constructor = "Decisions.unchecked"; }]
	, ["nominal-refinements", { kind: "record", fields: [fin("10"), null] }
		, value => { value.fields.reverse(); }]
	, ["specialization"
		, { name: "Decisions.echo", declaration: "Decisions.generic", types: ["Nat"], application: "@Decisions.generic Nat" }
		, value => { value.types[0] = "Int"; }]
	, ["instantiation"
		, { structure: "Decisions.Box", arguments: [{ kind: "named", id: "lean:Decisions.Tag" }] }
		, value => { value.arguments[0].id = "lean:Decisions.Other"; }]
];

test("reviewed comparison retains every known semantic source extension and its complete tree", () => {
	for(const [suffix, decision, mutate] of decisions)
	{
		const key = `lean-lang.org/${suffix}`, reviewed = input(), compiled = input();
		compiled.declarations[0].source.extensions[key] = structuredClone(decision);
		validateBindingIr(reviewed); validateBindingIr(compiled);
		assert.equal(reviewedContractDifference(reviewed, compiled), `${location}.${key}`, key);
		assert.equal(reviewedContractDifference(compiled, reviewed), `${location}.${key}`, key);
		reviewed.declarations[0].source.extensions[key] = structuredClone(decision);
		validateBindingIr(reviewed);
		assert.equal(reviewedContractDifference(reviewed, compiled), null, key);
		mutate(reviewed.declarations[0].source.extensions[key]);
		validateBindingIr(reviewed);
		assert.ok(reviewedContractDifference(reviewed, compiled)?.startsWith(`${location}.${key}.`), key);
		// Equality must not erase unrecognized data nested inside a known decision.
		reviewed.declarations[0].source.extensions[key] = { ...structuredClone(decision), altered: true };
		assert.equal(reviewedContractDifference(reviewed, compiled), `${location}.${key}.altered`, key);
	}
});

test("checked result decisions distinguish absent, null, bound and constructor changes", () => {
	const key = "lean-lang.org/refinements", compiled = input();
	compiled.declarations[0].source.extensions[key] = { parameters: [fin("10")], result: fin("10") };
	for(const changed of [null, { parameters: [fin("10")], result: fin("11") }, { parameters: [fin("10")], result: null }, { parameters: [], result: fin("10") }])
	{
		const reviewed = structuredClone(compiled);
		reviewed.declarations[0].source.extensions[key] = changed;
		assert.ok(reviewedContractDifference(reviewed, compiled)?.startsWith(`${location}.${key}`));
	}
});

test("nominal definitions and callback definitions retain their own checked decisions", () => {
	const box = { record: "Decisions.Box", fields: { value: "nat" } };
	const record = corpusReviewedIr({ id: "decisions" }, [{ name: "Decisions.echo", parameters: [box], result: box }]);
	const callback = callableReviewedIr();
	for(const compiled of [record, callback]) for(const key of ["lean-lang.org/nominal-refinements", "lean-lang.org/refinements", "lean-lang.org/instantiation"])
	{
		const definition = compiled.types[0], declarations = structuredClone(compiled.declarations);
		definition.source.extensions = { [key]: { parameters: [fin("10")], result: null } };
		const reviewed = structuredClone(compiled);
		reviewed.types[0].source.extensions = {};
		validateBindingIr(reviewed); validateBindingIr(compiled);
		const index = compiled.types.toSorted((a, b) => a.id.localeCompare(b.id)).findIndex(type => type.id === definition.id);
		assert.equal(reviewedContractDifference(reviewed, compiled), `bindingIr.types[${index}].source.extensions.${key}`);
		assert.deepEqual(compiled.declarations, declarations);
	}
});

test("source locations, producer facts, theorem references and public annotations remain compiler-owned", () => {
	const reviewed = input(), compiled = structuredClone(reviewed);
	compiled.declarations[0].source.extensions = {
		"lean-lang.org/source-position": { path: "Other.lean", startLine: 40 }
		, "lean-lang.org/theorem-references": ["Decisions.proof"]
		, "example.org/compiler": { build: "fresh" }
	};
	compiled.declarations[0].parameters[0].name = "compilerName";
	compiled.declarations[0].documentation.summary = "Compiler annotation";
	compiled.producers[0].extensions = { "example.org/compiler": "fresh" };
	assert.equal(reviewedContractDifference(reviewed, compiled), null);
	assert.equal(reviewedContractDifference(compiled, reviewed), null);
	assert.deepEqual(compiled.declarations[0].source.extensions["lean-lang.org/theorem-references"], ["Decisions.proof"]);
});

test("an independently reviewed closed proof binder preserves one runtime slot and exact compiler evidence", () => {
	const fixture = nativeMetadataFixture();
	const declaration = fixture.metadata.modules[0].declarations[0];
	declaration.typeExpression = "(value : UInt32) → (_proof : True) → UInt32";
	declaration.parameters.push({ name: "_proof", binderInfo: "explicit"
		, typeExpression: "True" });
	declaration.projection.erasedProofs = [{ sourceIndex: 1, name: "_proof"
		, proposition: "True", witness: "True.intro" }];
	const model = createNativeModel({ ...fixture
		, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	assert.equal(model.exports[0].parameters.length, 1);
	assert.deepEqual(model.exports[0].erasedProofs
		, declaration.projection.erasedProofs);
	const generated = generateNativeLeanAdapters(model);
	assert.match(generated.leanSource
		, /_root_\.Sample\.increment a0 _root_\.True\.intro/u);
	assert.match(generated.header
		, new RegExp(`uint32_t ${model.exports[0].symbol}\\(uint32_t a0\\);`, "u"));
	assert.doesNotMatch(generated.header, /proof/iu);
	const refinedModel = structuredClone(model);
	refinedModel.exports[0].refinements = { parameters: [null], result: null };
	assert.match(generateNativeLeanAdapters(refinedModel).leanSource
		, /_root_\.Sample\.increment a0 _root_\.True\.intro/u);

	const compiled = model.bindingIr;
	const reviewed = structuredClone(compiled);
	for(const producer of reviewed.producers) producer.extensions = {};
	for(const item of reviewed.declarations)
		item.source.extensions = { [erasedProofsKey]: structuredClone(
			item.source.extensions[erasedProofsKey]) };
	const review = reviewInput(reviewed);
	validateReviewedSource(review);
	const configuration = { schemaVersion: 1, modules: ["Sample"] };
	const exportConfigurationSource = canonicalJson(configuration);
	const identity = { ...fixture.sourceIdentity, exportConfigurationSource
		, exportConfigurationSha256: sha256(exportConfigurationSource) };
	assert.deepEqual(reconcileReviewedSource(review, compiled, identity), compiled);

	for(const mutate of [
		proof => { proof.sourceIndex = 0; }
		, proof => { proof.name = "other"; }
		, proof => { proof.proposition = "False"; }
	]) {
		const changed = structuredClone(reviewed);
		mutate(changed.declarations[0].source.extensions[erasedProofsKey].parameters[0]);
		assert.throws(() => reconcileReviewedSource(reviewInput(changed), compiled, identity)
			, { code: "reviewed-ir-source-mismatch" });
	}
	const changedSource = structuredClone(compiled);
	changedSource.declarations[0].source.declaration = "Sample.other";
	assert.throws(() => reconcileReviewedSource(review, changedSource, identity)
		, { code: "reviewed-ir-source-mismatch" });
	const forgedTheorem = structuredClone(reviewed);
	forgedTheorem.declarations[0].source.extensions["lean-lang.org/theorem-references"]
		= ["Sample.fabricated"];
	assert.throws(() => validateReviewedSource(reviewInput(forgedTheorem))
		, { code: "reviewed-ir-build-unsupported" });
});

test("semantic comparison does not authorize misplaced decisions or compiler evidence", () => {
	for(const [suffix, decision] of [...decisions, ["theorem-references", ["Decisions.forgedProof"]]])
	{
		const document = input();
		document.declarations[0].source.extensions[`lean-lang.org/${suffix}`] = decision;
		if(suffix === "refinements" && decision.parameters[0]?.kind === "subtype")
			assert.doesNotThrow(() => validateReviewedSource(reviewInput(document)));
		else assert.throws(() => validateReviewedSource(reviewInput(document)), { code: "reviewed-ir-build-unsupported" });
	}
});

test("a plain review cannot reconcile a freshly lowered checked Fin signature", () => {
	// Real semantic lowering of explicit synthetic compiler metadata, not a claim of installed execution.
	const fixture = nativeMetadataFixture();
	const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
	const refined = { kind: "refinement", base: nat, predicate: fin("10"), abi: nat.abi };
	const declaration = fixture.metadata.modules[0].declarations[0];
	declaration.projection.parameters[0].type = refined;
	declaration.projection.result = refined;
	const compiled = createNativeModel({ ...fixture, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } }, { refinements: true }).bindingIr;
	const document = structuredClone(compiled);
	for(const producer of document.producers) producer.extensions = {};
	for(const item of document.declarations) item.source.extensions = {};
	const review = reviewInput(document);
	validateReviewedSource(review);
	const configuration = { schemaVersion: 1, modules: ["Sample"] };
	const exportConfigurationSource = canonicalJson(configuration);
	const identity = { ...fixture.sourceIdentity, exportConfigurationSource
		, exportConfigurationSha256: sha256(exportConfigurationSource) };
	assert.throws(() => reconcileReviewedSource(review, compiled, identity), error => {
		assert.equal(error.code, "reviewed-ir-source-mismatch");
		assert.equal(error.details.field, `${location}.lean-lang.org/refinements`);
		return true;
	});
});
