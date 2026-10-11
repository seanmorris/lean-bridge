/**
 * Public component admission and JavaScript boundary checks using independently authored APIs.
 * These unit fixtures do not stand in for fresh Lean or installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { parseBindingIr, hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { generateComponentRecursiveAdapters } from "../../src/build/component-recursive-adapters.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { nominalSubtypeReviewedFixture } from "./nominal-subtype-reviewed-fixture.mjs";
import { subtypeResultReviewedFixture, subtypeResultMixedFixture } from "./subtype-result-fixture.mjs";
import { arrayReviewedIr } from "./array-fixture.mjs";
import { recordReviewedIr } from "./record-fixture.mjs";
import { variantReviewedIr } from "./variant-fixture.mjs";
import { compoundReviewedIr } from "./compound-fixture.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { assertJsonSchema, jsonSchemaErrors } from "./json-schema.mjs";
import "./nominal-subtype-installed-fixture-tests.mjs";
import "./nominal-subtype-npm-installed-tests.mjs";
import "./nominal-subtype-npm-evidence-tests.mjs";
import "./nominal-subtype-npm-promotion-tests.mjs";
import "./nominal-subtype-npm-promotion-history-tests.mjs";

const key = "lean-lang.org/refinements";
const named = (document, name) => document.declarations.find(item => item.name === name);
const envelope = document => document.types.find(type => type.name === "Envelope");
const generate = document => {
	const semanticSha256 = hashBindingIr(document);
	return generateCompilerAdapters({ analysis: {
		bindingIr: { origin: "lean-elaborated", document, semanticSha256 }
		, exportCandidates: document.declarations.map(item => ({ declaration: item.source.declaration
			, sourceModule: item.source.declaration.split(".")[0]
			, status: "exportable" }))
	}
	, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256 } } } });
};

test("public nominal Subtype plans use graph carriers and preserve each input decision", async () => {
	const document = nominalSubtypeReviewedFixture(), before = canonicalJson(document);
	parseBindingIr(before); await assertJsonSchema("binding-ir", document);
	const generated = generate(document), plan = generated.plan;
	await assertJsonSchema("compiler-adapter-plan", plan);
	assert.equal(validateCompilerAdapterPlan(plan), true);
	assert.equal(plan.privateAbi.version, 8); assert.equal(plan.exports.length, 12);
	assert.deepEqual(plan.privateAbi, createComponentPrivateAbi(document));
	for(const item of plan.exports)
		assert.deepEqual(item.refinements, document.declarations.find(declaration => declaration.id === item.bindingId).source.extensions[key]);
	assert.doesNotMatch(JSON.stringify(plan.privateAbi.types), /plusOne|plusTwo/u);
	assert.doesNotMatch(JSON.stringify(plan.nominalRefinements), /plusOne|plusTwo/u);
	const source = generated.files["LeanBridgeGenerated.lean"];
	assert.match(source, /_root_\.NominalConversion\.plusOne/u);
	assert.match(source, /_root_\.NominalConversion\.plusTwo/u);
	assert.doesNotMatch(source, /unsafeCast|sorry|_root_\.null|_root_\.undefined/u);
	assert.equal(canonicalJson(document), before);
});

test("per-use nominal choices select graph carriers without relying on shared Fin metadata", () => {
	const document = nominalSubtypeReviewedFixture();
	delete envelope(document).source.extensions["lean-lang.org/nominal-refinements"];
	const generated = generate(document);
	assert.equal(generated.plan.privateAbi.version, 8);
	assert.equal(generated.plan.nominalRefinements, undefined);
	assert.match(generated.files["LeanBridgeGenerated.lean"], /Envelope\.via_/u);
});

test("public component generation checks original provenance before flattening nominal layouts", () => {
	for(const mutate of [
		document => { envelope(document).source.extensions["lean-lang.org/instantiation"] = {}; }
		, document => { envelope(document).source.extensions["lean-lang.org/erased-proofs"] = ["proof"]; }
		, document => { envelope(document).source.declaration = "Other.Envelope"; }
		, document => { envelope(document).representation = "identity"; }
		, document => { named(document, "first").parameters[0].ownership = "borrow"; }
		, document => { named(document, "echo").result.ownership = "lease"; }
		, document => { document.types.push(...callableReviewedIr().types.filter(type => type.kind === "callback")); }
	]) {
		const document = nominalSubtypeReviewedFixture(); mutate(document);
		assert.throws(() => createComponentPrivateAbi(document), /Refinement does not match|copied|callbacks|ownership/u);
	}
});

test("closed nominal plan validators reject changed members, input projections and extra metadata", async () => {
	const original = generate(nominalSubtypeReviewedFixture()).plan;
	const first = plan => plan.exports.find(item => item.sourceDeclaration.endsWith(".first")).refinements.parameters[0];
	const event = plan => plan.exports.find(item => item.sourceDeclaration.endsWith(".eventFirst")).refinements.parameters[0];
	for(const mutate of [
		plan => { first(plan).fields.reverse(); }
		, plan => { first(plan).fields.pop(); }
		, plan => { first(plan).fields.push(structuredClone(first(plan).fields[0])); }
		, plan => { first(plan).name = "Other.Envelope"; }
		, plan => { first(plan).fields[0].refinement.constructor = null; }
		, plan => { first(plan).fields[0].refinement.extra = true; }
		, plan => { first(plan).fields[1].refinement.bound = "3\n"; }
		, plan => { first(plan).fields[0].name = "missing"; }
		, plan => { event(plan).cases.reverse(); }
		, plan => { event(plan).cases.shift(); }
		, plan => { event(plan).cases[1].fields[0].name = "missing"; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => validateCompilerAdapterPlan(changed), { code: "invalid-compiler-adapter-plan" });
	}
	const sub = { kind: "subtype", constructor: "NominalConversion.plusOne" };
	const projected = { ...sub, constructor: null };
	for(const tree of [sub, first(original), event(original)])
		assert.equal(await jsonSchemaErrors("compiler-adapter-plan#/$defs/refinement", tree), null);
	assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan#/$defs/refinement", projected), null);
	assert.equal(await jsonSchemaErrors("compiler-adapter-plan#/$defs/resultRefinement", projected), null);
	assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan#/$defs/refinement", { ...sub, extra: true }), null);
	for(const tree of [sub, projected, first(original), event(original)])
		assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan#/$defs/finRefinement", tree), null);
	assert.equal(await jsonSchemaErrors("compiler-adapter-plan#/$defs/finRefinement", { kind: "array", arguments: [{ kind: "fin", bound: "3" }] }), null);
	assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan#/$defs/callbackRefinements", { parameters: [sub], result: null }), null);
	assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan#/$defs/callbackRefinements", { parameters: [null], result: projected }), null);
	assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan#/$defs/nominalRefinement", { kind: "record", fields: [sub] }), null);
});

test("public component generation refuses missing choices and conflicts with shared bounds", () => {
	for(const mutate of [
		document => { named(document, "first").source.extensions[key].parameters[0] = null; }
		, document => { delete named(document, "first").source.extensions[key]; }
		, document => { named(document, "first").source.extensions[key].parameters[0].fields[1].refinement.bound = "4"; }
	]) {
		const document = nominalSubtypeReviewedFixture(); mutate(document);
		assert.throws(() => generate(document), /Invalid component refinement mirrors|Conflicting nominal refinement layouts/u);
	}
});

test("constructor-free results preserve scalar, structural and nominal projections", async () => {
	for(const create of [subtypeResultReviewedFixture, subtypeResultMixedFixture])
	{
		const document = create(), generated = generate(document);
		await assertJsonSchema("compiler-adapter-plan", generated.plan);
		assert.equal(validateCompilerAdapterPlan(generated.plan), true);
		const source = generated.files["LeanBridgeGenerated.lean"];
		assert.match(source, /Envelope\.erase/u);
		assert.match(source, /Event\.erase/u);
		assert.doesNotMatch(source, /_root_\.null|_root_\.undefined|sorry|unsafeCast/u);
		if(create === subtypeResultReviewedFixture) assert.doesNotMatch(source, /\.via_|checkedOne|checkedTwo/u);
		else
{ assert.match(source, /checkedOne/u); assert.match(source, /checkedTwo/u); }
		for(const name of ["scalar", "arrayValues", "listValues", "optional", "product", "branch"])
		{
			const minimal = create(); minimal.declarations = [named(minimal, name)]; minimal.types = [];
			const plain = generate(minimal);
			assert.ok([2, 4, 6].includes(plain.plan.privateAbi.version));
			await assertJsonSchema("compiler-adapter-plan", plain.plan);
			assert.doesNotMatch(plain.files["LeanBridgeGenerated.lean"], /_root_\.null|\.via_/u);
		}
	}
});

test("public nominal frames preflight all Fin leaves before any constructor or source entry", () => {
	const generated = generate(nominalSubtypeReviewedFixture());
	const item = generated.plan.exports.find(item => item.sourceDeclaration.endsWith(".combine"));
	const c = generateComponentRecursiveAdapters(generated.plan.privateAbi, generated.plan);
	const body = c.slice(c.indexOf(`LEAN_EXPORT uint32_t ${item.symbol}(`));
	const positions = ["_fin_guard_0(a0)", "_fin_guard_1(a1)", "_refinement_0(a0)", "_refinement_1(a1)", "_lean(a0, a1)"]
		.map(suffix => body.indexOf(item.symbol + suffix));
	assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
});

const loadPackage = async (t, document) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-component-nominal-unit-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const files = generateJavaScriptPackage(document);
	for(const path of ["index.mjs", "internal/validators.mjs"]) await saveLakeFile(directory, path, files[path]);
	await saveLakeFile(directory, "internal/runtime.mjs", "export const calls = []; export const state = { result: 0n }; export const runtime = { call(id, args) { calls.push({ id, args }); return state.result; } };\n");
	return { api: await import(pathToFileURL(join(directory, "index.mjs"))), control: await import(pathToFileURL(join(directory, "internal/runtime.mjs"))) };
};

test("JavaScript dispatch checks all nominal inputs without normalizing their Subtype payloads", async t => {
	const { api, control } = await loadPackage(t, nominalSubtypeReviewedFixture());
	const value = Object.freeze({ payload: 40n, digit: 2n });
	api.combine(value, value);
	assert.equal(control.calls.length, 1);
	assert.deepEqual(control.calls[0], { id: "lean:NominalConversion.combine", args: [value, value] });
	assert.equal(control.calls[0].args[0], value);
	const invalid = { payload: 40n, digit: 3n };
	for(const call of [
		() => api.combine(value, invalid)
		, () => api.nested({ left: value, right: invalid })
		, () => api.eventFirst({ kind: "box", value: invalid })
		, () => api.aliases([{ tag: "none" }], [{ tag: "some", value: invalid }])
		, () => api.inspectAliasPair({ left: [], right: [{ tag: "some", value: invalid }] })
	]) assert.throws(call, /digit/u);
	assert.equal(control.calls.length, 1);
	api.eventFirst({ kind: "empty" });
	api.eventFirst({ kind: "choices", values: [{ tag: "none" }, { tag: "some", value: { error: 95n } }] });
	assert.equal(control.calls.length, 3);
	assert.equal(control.calls[2].args[0].values[1].value.error, 95n);
	// Invalid Subtype payloads reach Lean's selected constructor, not a host default or predicate guess.
	api.first({ payload: 100n, digit: 2n });
	assert.equal(control.calls.length, 4);
	let reads = 0;
	const accessor = { payload: 40n };
	Object.defineProperty(accessor, "digit", { enumerable: true, get: () => { reads++; return 2n; } });
	assert.throws(() => api.first(accessor));
	assert.throws(() => api.eventFirst(Object.create({ kind: "empty" })));
	assert.throws(() => api.eventFirst({ kind: "empty", extra: true }));
	assert.equal(reads, 0); assert.equal(control.calls.length, 4);
});

test("JavaScript walks per-use Fin bounds even without shared constraints", async t => {
	const document = nominalSubtypeReviewedFixture();
	delete envelope(document).source.extensions["lean-lang.org/nominal-refinements"];
	const { api, control } = await loadPackage(t, document);
	assert.throws(() => api.eventFirst({ kind: "box", value: { payload: 40n, digit: 3n } }), /eventFirst\.value0\.value\.digit/u);
	assert.equal(control.calls.length, 0);
	api.eventFirst({ kind: "empty" });
	assert.equal(control.calls.length, 1);
});

test("JavaScript validates constructor-free results without reconstructing them", async t => {
	const { api, control } = await loadPackage(t, subtypeResultReviewedFixture());
	control.state.result = Object.freeze({ payload: 121n, digit: 2n });
	assert.equal(api.produceEnvelope(120n), control.state.result);
	control.state.result = { payload: 121n, digit: 3n };
	assert.throws(() => api.produceEnvelope(120n), /result\.digit/u);
	control.state.result = { kind: "empty" };
	assert.equal(api.eventEmpty(120n), control.state.result);
	control.state.result = [{ tag: "some", value: { payload: 121n, digit: 3n } }];
	assert.throws(() => api.groupValues(120n), /digit/u);
	assert.equal(control.calls.length, 4);
});

test("previously supported JavaScript fixture packages remain byte-identical", () => {
	// Package hashes measured from aca7821, before public nominal Subtype admission.
	for(const [fixture, expected] of [
		[arrayReviewedIr, "d2b6ec008c1b1fd2175373ce64b25d2a032b3e6617cc5cc894e89c272e4179f7"]
		, [recordReviewedIr, "26736a5981c617331e1b3ac3c7292bbe82e635219f5e3413b7b2d874ca63ccf2"]
		, [variantReviewedIr, "4397961c788e66da6f33ee5de871d97e949976130303b97f531654d8936d5b2c"]
		, [compoundReviewedIr, "24ee4d7c93bfa0ab1e7ba3cf5983724e211372197b2bc743d135182e1b9a51e7"]
	]) assert.equal(sha256(canonicalJson(generateJavaScriptPackage(fixture()))), expected, fixture.name);
});
