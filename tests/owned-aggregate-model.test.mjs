/**
 * Independent structure and ownership checks for resource-bearing type graphs.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedAggregateModel } from "../src/abi/owned-aggregate-model.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { sha256Text } from "../src/binding-ir/sha256.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";

test("owned models preserve complete contracts and exact copied-versus-retained field decisions", () => {
	const ir = ownedAggregateReviewedIr(), before = structuredClone(ir);
	const model = compileOwnedAggregateModel(ir), types = new Map(model.types.map(type => [type.id, type]));
	assert.deepEqual(ir, before); assert.deepEqual(compileOwnedAggregateModel(ir), model);
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
