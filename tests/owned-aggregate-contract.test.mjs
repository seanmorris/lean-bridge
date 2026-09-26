/**
 * Keep retained resource fields distinct from the existing copied-value contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateBindingIr, validateBindingIrForMigration, validateOwnedAggregateBindingIr } from "../src/binding-ir/contract.mjs";
import { canonicalizeBindingIr } from "../src/binding-ir/canonical.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";

const changed = (change, code) => {
	const ir = ownedAggregateReviewedIr(); change(ir);
	assert.throws(() => validateOwnedAggregateBindingIr(ir), { code });
};
const bundle = ir => ir.types.find(type => type.name === "Bundle");
const echo = ir => ir.declarations.find(declaration => declaration.name === "echoRecord");

test("owned aggregate contracts preserve all resource-bearing shapes and callable positions", async () => {
	const ir = ownedAggregateReviewedIr(), before = structuredClone(ir);
	assert.equal(validateOwnedAggregateBindingIr(ir), ir); assert.deepEqual(ir, before);
	assert.equal(ir.declarations.length, 22); assert.equal(ir.types.filter(type => type.kind === "callback").length, 4);
	assert.equal(bundle(ir).fields[0].type.id, "lean:Owned.Ticket");
	assert.equal(echo(ir).parameters[0].ownership, "borrow"); assert.equal(echo(ir).result.ownership, "lease");
	const schema = JSON.parse(await readFile("schema/binding-ir-owned.schema.json", "utf8"));
	assert.equal(schema.properties.schemaVersion.const, 4);
	assert.ok(schema.$defs.typeDefinition.required.includes("aggregate"));
	assert.ok(schema.$defs.typeDefinition.properties.representation.enum.includes("owned"));
	assert.deepEqual(schema.$defs.aggregate.properties.ownership, { const: "lease" });
});

test("new ownership semantics cannot enter a v3 backend or masquerade as copied records", () => {
	const ir = ownedAggregateReviewedIr();
	assert.throws(() => validateBindingIr(ir), { code: "unsupported-schema" });
	assert.throws(() => validateBindingIrForMigration(ir), { code: "unsupported-schema" });
	assert.throws(() => canonicalizeBindingIr(ir), { code: "consumer-upgrade-required" });
	changed(ir => { ir.schemaVersion = 3; }, "unsupported-schema");
	changed(ir => { bundle(ir).representation = "copied"; bundle(ir).aggregate = null; }, "record-field-representation");
	changed(ir => { ir.types.find(type => type.name === "Choice").representation = "copied"; ir.types.find(type => type.name === "Choice").aggregate = null; }, "record-field-representation");
	changed(ir => { ir.types.find(type => type.name === "BundleAlias").representation = "copied"; }, "alias-representation");
	changed(ir => { ir.types.find(type => type.name === "TicketRow").representation = "identity"; }, "alias-representation");
});

test("owned fields require a closed explicit retention and disposal policy", () => {
	changed(ir => { delete bundle(ir).aggregate; }, "missing-property");
	changed(ir => { bundle(ir).aggregate = null; }, "invalid-type");
	changed(ir => { bundle(ir).aggregate.ownership = "borrow"; }, "invalid-value");
	changed(ir => { bundle(ir).aggregate.disposal = "runtime"; }, "invalid-value");
	changed(ir => { bundle(ir).aggregate.cycles = "allow"; }, "invalid-value");
	changed(ir => { bundle(ir).aggregate.hidden = true; }, "unknown-property");
	changed(ir => { ir.types.find(type => type.name === "Payload").aggregate = { ...bundle(ir).aggregate }; }, "aggregate-shape");
	changed(ir => { ir.types.find(type => type.name === "BundleAlias").aggregate = { ...bundle(ir).aggregate }; }, "aggregate-shape");
	changed(ir => { bundle(ir).mutability = "write"; }, "aggregate-mutability");
	changed(ir => { bundle(ir).fields[0].mutability = "write"; }, "aggregate-mutability");
});

test("ownership validation follows resource containers through exports and callbacks", () => {
	for(const name of ["echoArray", "echoList", "echoOption", "echoResult", "echoTuple", "echoRecord", "echoAlias", "echoRecursive", "echoNested"])
	{
		for(const direction of ["input", "output"])
			changed(ir => {
				const declaration = ir.declarations.find(declaration => declaration.name === name);
				const site = direction === "input" ? declaration.parameters[0] : declaration.result;
				site.ownership = "copy"; site.lifetime = null;
			}, "aggregate-ownership");
	}
	for(const direction of ["input", "output"])
		changed(ir => {
			const callable = ir.types.find(type => type.kind === "callback").callable;
			const site = direction === "input" ? callable.parameters[0] : callable.result;
			site.ownership = "copy"; site.lifetime = null;
		}, "aggregate-ownership");
	changed(ir => { echo(ir).result.lifetime = null; }, "missing-lifetime");
	changed(ir => { echo(ir).result.lifetime.scope = "call"; }, "lease-lifetime");
});

test("owned type recursion preserves alias termination and known nominal references", () => {
	const ir = ownedAggregateReviewedIr(); assert.equal(validateOwnedAggregateBindingIr(ir), ir);
	changed(ir => { ir.types.find(type => type.name === "BundleAlias").target.id = "lean:Owned.BundleAlias"; }, "alias-cycle");
	changed(ir => { bundle(ir).fields[0].type.id = "lean:Owned.Missing"; }, "unknown-type");
});

test("borrowed aggregate results require a live non-transferred owner", () => {
	const borrow = (declaration, scope = "parameter", anchor = "arg0") => {
		declaration.result.ownership = "borrow";
		declaration.result.lifetime = { scope, anchor };
	};
	const ir = ownedAggregateReviewedIr(); borrow(echo(ir));
	assert.equal(validateOwnedAggregateBindingIr(ir), ir);
	changed(ir => { borrow(echo(ir), "call", null); }, "borrow-result-owner");
	changed(ir => { borrow(ir.declarations.find(declaration => declaration.name === "newTicket")); }, "borrow-result-owner");
	changed(ir => {
		const declaration = echo(ir); borrow(declaration);
		declaration.parameters[0].ownership = "transfer";
		declaration.parameters[0].lifetime = { scope: "explicit", anchor: null };
	}, "borrow-result-transfer");
	changed(ir => { borrow(echo(ir), "parameter", "missing"); }, "borrow-anchor");
	changed(ir => {
		const callable = ir.types.find(type => type.kind === "callback").callable;
		borrow(callable, "call", null);
	}, "borrow-result-owner");
	changed(ir => {
		const callable = ir.types.find(type => type.kind === "callback").callable;
		borrow(callable); callable.parameters[0].ownership = "transfer";
		callable.parameters[0].lifetime = { scope: "call", anchor: null };
	}, "borrow-result-transfer");
});

test("an owned record can anchor a typed resource property without becoming a copied value", () => {
	const ir = ownedAggregateReviewedIr();
	const property = ir.declarations.find(declaration => declaration.name === "primary");
	property.kind = "property"; property.owner = "lean:Owned.Bundle";
	const { type, ownership, lifetime, mutability } = property.parameters[0];
	property.receiver = { type, ownership, lifetime, mutability }; property.parameters = [];
	property.result.ownership = "borrow"; property.result.lifetime = { scope: "receiver", anchor: "receiver" };
	assert.equal(validateOwnedAggregateBindingIr(ir), ir);
	property.receiver.ownership = "transfer";
	property.receiver.lifetime = { scope: "explicit", anchor: null };
	assert.throws(() => validateOwnedAggregateBindingIr(ir), { code: "borrow-result-transfer" });
});
