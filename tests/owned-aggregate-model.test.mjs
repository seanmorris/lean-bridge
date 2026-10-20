/**
 * Independent structure and ownership checks for resource-bearing type graphs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileOwnedAggregateModel } from "../src/abi/owned-aggregate-model.mjs";
import { declarationRefinements } from "../src/abi/refinements.mjs";
import { ownedAggregateLeaseSource } from "../src/backends/native/owned-aggregate-leases.mjs";
import { generateOwnedNativeBindingAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { generateOwnedBindingCarriers } from "../src/build/owned-aggregate-carriers.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { sha256Text } from "../src/binding-ir/sha256.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedAggregateReviewedIr, ownedSubtypeReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import "./helpers/owned-refinement-carriers-source-history-tests.mjs";
import "./helpers/owned-refinement-model-source-history-tests.mjs";
import "./helpers/owned-subtype-analysis-source-history-tests.mjs";

test("owned models preserve complete contracts and exact copied-versus-retained field decisions", () => {
	const ir = ownedAggregateReviewedIr(), before = structuredClone(ir);
	const model = compileOwnedAggregateModel(ir), types = new Map(model.types.map(type => [type.id, type]));
	assert.deepEqual(ir, before); assert.deepEqual(compileOwnedAggregateModel(ir), model);
	assert.equal(model.refinementModel, undefined);
	assert.equal(model.bindingIrSha256, sha256Text(canonicalizeJsonValue(ir)));
	assert.deepEqual(model.bindingIr, ir); assert.equal(Object.isFrozen(ir), false);
	assert.ok(model.declarations.every(declaration => declaration.parameters.every(site => site.optional === false && site.default === null)));
	assert.equal(model.declarations.length, 22); assert.equal(Object.isFrozen(model.types), true);
	const bundle = types.get("lean:Owned.Bundle");
	assert.equal(bundle.representation, "owned");
	assert.deepEqual(bundle.fields.map(field => [field.name, field.retention]), [
		["primary", "lease"], ["spare", "lease"], ["peers", "lease"]
		, ["history", "lease"], ["payload", "copy"]
	]);
	assert.equal(types.get("lean:Owned.Ticket").representation, "identity");
	assert.equal(types.get("lean:Owned.Payload").representation, "copied");
	assert.ok(types.get("lean:Owned.Payload").fields.every(field => field.retention === "copy"));
	assert.equal(types.get("lean:Owned.BundleAlias").target, bundle.id);
	assert.equal(types.get("lean:Owned.TicketRow").representation, "owned");
	for(const kind of ["array", "list", "option", "result", "tuple", "record", "variant", "alias"])
		assert.ok(model.types.some(type => type.kind === kind && type.representation === "owned"), kind);
});

test("recursive types and repeated resources share type references without copying identity", () => {
	const model = compileOwnedAggregateModel(ownedAggregateReviewedIr());
	const types = new Map(model.types.map(type => [type.id, type])), tree = types.get("lean:Owned.Tree");
	assert.equal(new Set(model.types.map(type => type.id)).size, model.types.length);
	assert.equal(tree.cases[0].fields[0].type, "lean:Owned.Ticket");
	assert.deepEqual(types.get(tree.cases[1].fields[0].type).arguments, [tree.id]);
	const pair = types.get("lean:Owned.Choice").cases.find(branch => branch.name === "pair");
	assert.deepEqual(pair.fields.map(field => field.type), ["lean:Owned.Ticket", "lean:Owned.Ticket"]);
	assert.deepEqual(pair.fields.map(field => field.retention), ["lease", "lease"]);
});

test("owned models authenticate and retain per-use Subtype decisions without opening copied contracts", () => {
	const ir = ownedSubtypeReviewedIr(), before = structuredClone(ir);
	const declaration = ir.declarations.find(item => item.name === "echoRecord");
	assert.throws(() => declarationRefinements(declaration
		, declaration.source.extensions["lean-lang.org/refinements"], ir.types));
	const model = compileOwnedAggregateModel(ir);
	assert.deepEqual(ir, before);
	assert.deepEqual(model.declarations.find(item => item.name === "echoRecord").refinements
		, declaration.source.extensions["lean-lang.org/refinements"]);
	assert.equal(Object.isFrozen(model.declarations.find(item => item.name === "echoRecord").refinements), true);
	assert.deepEqual(model.refinementModel.sites.map(site => [site.direction
		, site.position.kind, site.type]), [
		["input", "parameter", "lean:Owned.Bundle"]
		, ["result", "result", "lean:Owned.Bundle"]]
	);
	assert.equal(model.refinementModel.sites[0].carrierKey
		, model.refinementModel.sites[1].carrierKey);
	assert.notEqual(model.refinementModel.sites[0].adapterKey
		, model.refinementModel.sites[1].adapterKey);
	const inputCount = model.refinementModel.sites[0].tree.fields[4]
		.refinement.fields[0].refinement;
	const resultCount = model.refinementModel.sites[1].tree.fields[4]
		.refinement.fields[0].refinement;
	assert.deepEqual(inputCount, { kind: "subtype", type: "primitive:int"
		, path: [{ kind: "field", name: "payload" }
			, { kind: "field", name: "count" }]
		, operation: "construct", constructor: "Owned.checkedCount" });
	assert.deepEqual(resultCount, { kind: "subtype", type: "primitive:int"
		, path: [{ kind: "field", name: "payload" }
			, { kind: "field", name: "count" }]
		, operation: "project", constructor: null });
	assert.equal(Object.isFrozen(model.refinementModel.sites[0].tree), true);
	const focused = structuredClone(ir);
	focused.declarations = focused.declarations.filter(item => item.name === "echoRecord");
	const carriers = generateOwnedBindingCarriers({
		document: focused
		, sourceIdentity: {}
		, declarations: [{ name: "Owned.echoRecord", module: "Owned" }]
		, metadataSha256: "a".repeat(64)
	});
	assert.match(carriers.leanSource, /structure LbOwnedErased\.Owned\.Bundle/u);
	assert.match(carriers.leanSource, /_root_\.Owned\.checkedCount/u);
	assert.match(carriers.leanSource, /Subtype\.val/u);
	assert.equal(Object.keys(carriers.refinementValidators).length, 1);
	const wrongInput = ownedSubtypeReviewedIr();
	wrongInput.declarations.find(item => item.name === "echoRecord")
		.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor = null;
	assert.throws(() => compileOwnedAggregateModel(wrongInput), /Invalid declaration refinement|Refinement does not match/u);
	const wrongResult = ownedSubtypeReviewedIr();
	wrongResult.declarations.find(item => item.name === "echoRecord")
		.source.extensions["lean-lang.org/refinements"].result
		.fields[4].refinement.fields[0].refinement.constructor = "Owned.checkedCount";
	assert.throws(() => compileOwnedAggregateModel(wrongResult), /Invalid declaration refinement|Refinement does not match/u);
	const wrongField = ownedSubtypeReviewedIr();
	wrongField.declarations.find(item => item.name === "echoRecord")
		.source.extensions["lean-lang.org/refinements"].parameters[0].fields[4].name = "other";
	assert.throws(() => compileOwnedAggregateModel(wrongField), /Invalid declaration refinement|Refinement does not match/u);
});

test("owned refinement carriers share erased shape without sharing constructors", () => {
	const ir = ownedSubtypeReviewedIr();
	const original = ir.declarations.find(item => item.name === "echoRecord");
	const alternate = structuredClone(original);
	alternate.id = "lean:Owned.echoRecordAlternate";
	alternate.name = "echoRecordAlternate";
	alternate.overloadKey = "Owned.echoRecordAlternate";
	alternate.source.declaration = "Owned.echoRecordAlternate";
	alternate.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor
		= "Owned.checkedCountAlternate";
	ir.declarations.push(alternate);
	const sites = compileOwnedAggregateModel(ir).refinementModel.sites;
	const inputs = sites.filter(site => site.direction === "input");
	const results = sites.filter(site => site.direction === "result");
	assert.equal(inputs.length, 2); assert.equal(results.length, 2);
	assert.equal(inputs[0].carrierKey, inputs[1].carrierKey);
	assert.notEqual(inputs[0].adapterKey, inputs[1].adapterKey);
	assert.equal(results[0].carrierKey, results[1].carrierKey);
	assert.equal(results[0].adapterKey, results[1].adapterKey);
});

test("owned refinement mirrors compile against the proof-carrying Lean source", {
	skip: process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST !== "1", timeout: 120000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-refinement-carriers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = resolve("tests/fixtures/onboarding/owned-subtypes/Owned.lean");
	await writeFile(join(directory, "Owned.lean"), await readFile(fixture));
	const ir = ownedSubtypeReviewedIr();
	ir.declarations = ir.declarations.filter(item => item.name === "echoRecord");
	const native = generateOwnedNativeBindingAdapters({
		document: ir, sourceIdentity: {}
		, declarations: [{ name: "Owned.echoRecord", module: "Owned" }]
		, metadataSha256: "a".repeat(64) });
	const generated = native.carriers;
	await writeFile(join(directory, "Generated.lean"), generated.leanSource);
	await writeFile(join(directory, "carriers.h"), generated.header);
	await writeFile(join(directory, "owned-values.h"), native.typesHeader);
	await writeFile(join(directory, "owned-leases.h"), ownedAggregateLeaseSource);
	await writeFile(join(directory, "lean_bridge_native_runtime.h"), brokerHeader);
	await writeFile(join(directory, "owned-values.c"), native.source);
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
		?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const lean = join(leanPrefix, "bin/lean");
	const env = { ...process.env, LEAN_PATH: directory
		, PATH: `${join(leanPrefix, "bin")}:${process.env.PATH}` };
	const capture = async input => {
		try
		{ await processBuildRunner.capture(input); }
		catch(error)
		{ throw new Error(error.details?.stderr || error.details?.stdout || error.message, { cause: error }); }
	};
	const compile = args => capture({ command: lean, args, cwd: directory, env });
	await compile(["-o", "Owned.olean", "Owned.lean"]);
	await compile(["Generated.lean"]);
	await capture({ command: process.env.CC ?? "cc"
		, args: ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only"
			, "-I", directory, "-I", join(leanPrefix, "include"), "owned-values.c"]
		, cwd: directory, env });
});

test("owned refinement preflight runs before transfer handoff", () => {
	const ir = ownedSubtypeReviewedIr();
	ir.declarations = ir.declarations.filter(item => item.name === "echoRecord");
	ir.declarations[0].parameters[0].ownership = "transfer";
	const generated = generateOwnedNativeBindingAdapters({
		document: ir, sourceIdentity: {}
		, declarations: [{ name: "Owned.echoRecord", module: "Owned" }]
		, metadataSha256: "a".repeat(64), transferredInputs: true });
	const validator = Object.values(generated.carriers.refinementValidators)[0];
	const preflight = generated.source.indexOf(`if (!${validator}(child))`);
	const handoff = generated.source.lastIndexOf("status = lb_owned_scope_transfer_many");
	assert.ok(preflight >= 0); assert.ok(handoff > preflight);
	assert.match(generated.carriers.header, new RegExp(`uint8_t ${validator}\\(lean_object \\*\\);`, "u"));
});

test("callback arguments, returned closures and borrowed anchors retain ownership sites", () => {
	const ir = ownedAggregateReviewedIr();
	const primary = ir.declarations.find(declaration => declaration.name === "primary");
	primary.result.ownership = "borrow"; primary.result.lifetime = { scope: "parameter", anchor: "arg0" };
	const model = compileOwnedAggregateModel(ir), types = new Map(model.types.map(type => [type.id, type]));
	const borrowed = model.declarations.find(declaration => declaration.name === "primary");
	assert.deepEqual(borrowed.result.lifetime, { scope: "parameter", anchor: "arg0" });
	for(const callback of model.types.filter(type => type.kind === "callback"))
	{
		assert.equal(callback.callable.result.ownership, "lease");
		assert.equal(callback.callable.result.representation, "owned");
		assert.ok(callback.callable.parameters.filter(site => site.representation === "owned").every(site => site.ownership === "borrow"));
	}
	const capture = model.declarations.find(declaration => declaration.name === "makeRecord");
	assert.equal(capture.parameters[0].type, "lean:Owned.Bundle");
	assert.equal(capture.result.ownership, "lease");
	assert.equal(types.get(capture.result.type).kind, "callback");
});

test("contract drift changes identity and incomplete or unowned inputs cannot generate a model", () => {
	const ir = ownedAggregateReviewedIr(), original = compileOwnedAggregateModel(ir);
	ir.types.find(type => type.name === "Bundle").aggregate.fallback = "none";
	assert.notEqual(compileOwnedAggregateModel(ir).bindingIrSha256, original.bindingIrSha256);
	ir.types.find(type => type.name === "Bundle").fields[0].mutability = "write";
	assert.throws(() => compileOwnedAggregateModel(ir), { code: "aggregate-mutability" });
	const missing = ownedAggregateReviewedIr();
	missing.declarations = missing.declarations.filter(declaration => declaration.name === "serial");
	assert.throws(() => compileOwnedAggregateModel(missing), { code: "owned-aggregate-required" });
});

test("long owned aliases use a finite work queue and fail at the stated type budget", () => {
	const aliases = count => {
		const ir = ownedAggregateReviewedIr();
		const base = ir.types.find(type => type.name === "BundleAlias");
		for(let index = 0; index < count; ++index)
			ir.types.push({ ...base, id: `lean:Owned.A${index}`, name: `A${index}`
				, target: { kind: "named", id: index === count - 1 ? "lean:Owned.Bundle" : `lean:Owned.A${index + 1}` } });
		base.target = { kind: "named", id: "lean:Owned.A0" }; return ir;
	};
	const model = compileOwnedAggregateModel(aliases(2500));
	assert.ok(model.types.length > 2500 && model.types.length < 4096);
	assert.equal(model.types.find(type => type.id === "lean:Owned.A2499").target, "lean:Owned.Bundle");
	assert.throws(() => compileOwnedAggregateModel(aliases(5000)), { code: "owned-aggregate-type-limit" });
});

test("unresolved generic parameters cannot acquire a concrete ownership layout", () => {
	const ir = ownedAggregateReviewedIr();
	ir.declarations[0].typeParameters = [{ id: "T", representation: "identity", constraints: [] }];
	assert.throws(() => compileOwnedAggregateModel(ir), { code: "owned-aggregate-specialization" });
});
