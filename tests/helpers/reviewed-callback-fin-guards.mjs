/**
 * Synthetic review controls for callback bounds. These exercise review and comparison
 * policy, not fresh Lean extraction or an installed downstream package.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { callbackSemanticSignature } from "../../src/analyze/callback-signature.mjs";
import { assertReviewedFinCallback } from "../../src/analyze/reviewed-refinements.mjs";
import { reconcileReviewedSource, reviewedSourceSelection, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { callableReviewedIr, callableReviewInput } from "./callable-fixture.mjs";
import { finCallbackCompilerModel } from "./fin-callback-model.mjs";

const key = "lean-lang.org/refinements", nominalKey = "lean-lang.org/nominal-refinements";
const fixture = () => {
	const document = structuredClone(finCallbackCompilerModel().bindingIr);
	// An authored review cannot supply the compiler's invocation evidence.
	for(const producer of document.producers) producer.extensions = {};
	for(const declaration of document.declarations) declaration.source.extensions = {};
	return document;
};
const scaler = document => document.types.find(type => type.id === document.declarations.find(item => item.id === "lean:Sample.scaler").result.type.id);
const rehash = (document, definition) => {
	const previous = definition.id;
	const signature = { ...callbackSemanticSignature(definition.callable)
		, ...(Object.hasOwn(definition.source.extensions, key) ? { refinements: definition.source.extensions[key] } : {}) };
	definition.name = `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`;
	definition.id = `bridge:${definition.name}`;
	definition.source.declaration = definition.name;
	const visit = value => {
		if(!value || typeof value !== "object") return;
		if(value.kind === "named" && value.id === previous) value.id = definition.id;
		Object.values(value).forEach(visit);
	};
	visit(document);
};
const identity = review => {
	const source = canonicalJson({ schemaVersion: 1, modules: ["Sample"] });
	return { exportConfigurationSource: source
		, exportConfigurationSha256: sha256(source)
		, request: { exportModules: ["Sample"], ...reviewedSourceSelection(review), resources: [] } };
};

test("reviewed callbacks admit scalar, container and nominal Fin without putting bounds into selection", () => {
	const document = fixture(), review = callableReviewInput(document);
	assert.deepEqual(validateReviewedSource(review), document);
	const bounded = document.types.filter(type => type.kind === "callback" && Object.hasOwn(type.source.extensions, key));
	assert.equal(bounded.length, 8);
	for(const definition of bounded) assertReviewedFinCallback(definition);
	assert.deepEqual(document.types.filter(type => Object.hasOwn(type.source.extensions, nominalKey)).map(type => type.name).sort(), ["Shape", "Tile"]);
	const selection = reviewedSourceSelection(review);
	assert.deepEqual(Object.keys(selection).sort(), ["arities", "exports"]);
	assert.equal(selection.exports.length, 14);
	assert.equal(selection.arities.length, 11);
	assert.deepEqual(reconcileReviewedSource(review, document, identity(review)).types, document.types);
});

test("unrefined reviewed callback identities keep their original signature bytes", () => {
	const document = callableReviewedIr();
	assert.deepEqual(validateReviewedSource(callableReviewInput(document)), document);
	for(const definition of document.types)
	{
		const signature = { parameters: definition.callable.parameters.map(item => item.type), result: definition.callable.result.type };
		assert.deepEqual(callbackSemanticSignature(definition.callable), signature);
		assert.equal(definition.id, `bridge:Callback${sha256(canonicalJson(signature)).slice(0, 20)}`);
	}
});

for(const [label, mutate] of Object.entries({
	"Subtype": value => { value.parameters[0] = { kind: "subtype", constructor: "Sample.checked" }; }
	, "empty decision": value => { value.parameters[0] = null; }
	, "wrong arity": value => { value.parameters.push(null); }
	, "unknown member": value => { value.extra = true; }
	, "wrong transport": value => { value.parameters[0] = { kind: "array", arguments: [{ kind: "fin", bound: "10" }] }; }
	, "noncanonical bound": value => { value.parameters[0].bound = "010"; }
})) test(`reviewed callback rejects ${label} even with a consistently rehashed identity`, () => {
	const document = fixture(), definition = scaler(document);
	mutate(definition.source.extensions[key]);
	rehash(document, definition);
	assert.throws(() => assertReviewedFinCallback(definition), TypeError);
	assert.throws(() => validateReviewedSource(callableReviewInput(document)), error => error.code === "reviewed-ir-build-unsupported"
		&& error.details.path === `${definition.id}.source.extensions.${key}`);
});

for(const [label, mutate] of Object.entries({
	"dropped bounds": definition => { delete definition.source.extensions[key]; }
	, "changed bound": definition => { definition.source.extensions[key].parameters[0].bound = "11"; }
	, "unknown extension": definition => { definition.source.extensions["lean-lang.org/forged"] = {}; }
	, "misplaced nominal extension": definition => { definition.source.extensions[nominalKey] = { kind: "alias", target: { kind: "fin", bound: "10" } }; }
})) test(`reviewed callback rejects ${label} without trusting its old ID`, () => {
	const document = fixture();
	mutate(scaler(document));
	assert.throws(() => validateReviewedSource(callableReviewInput(document)), { code: "reviewed-ir-build-unsupported" });
});

for(const [label, mutate] of Object.entries({
	"consistently rehashed bound": document => {
		const definition = scaler(document);
		definition.source.extensions[key].parameters[0].bound = "11";
		rehash(document, definition);
	}
	, "missing nominal bound": document => { delete document.types.find(type => type.kind === "record").source.extensions[nominalKey]; }
	, "changed nominal bound": document => { document.types.find(type => type.kind === "record").source.extensions[nominalKey].fields[0].bound = "6"; }
})) test(`fresh contract comparison refuses ${label}`, () => {
	const compiled = fixture(), authored = structuredClone(compiled);
	mutate(authored);
	const review = callableReviewInput(authored);
	assert.deepEqual(validateReviewedSource(review), authored);
	assert.throws(() => reconcileReviewedSource(review, compiled, identity(review)), { code: "reviewed-ir-source-mismatch" });
});
