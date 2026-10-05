/**
 * Alias termination is distinct from recursion through named data constructors.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { parseBindingIr, canonicalizeBindingIr } from "../src/binding-ir/canonical.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";

const primitive = name => ({ kind: "primitive", name });
const named = name => ({ kind: "named", id: `lean:Shapes.${name}` });
const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const documentation = { summary: "Independent structured type contract.", details: "" };
const definition = (name, kind, properties = {}) => ({
	id: named(name).id, name, kind
	, representation: "copied", mutability: "immutable", typeParameters: []
	, fields: [], target: null, resource: null, callable: null
	, cases: [], host: null, documentation
	, source: { producer: "corpusReview"
		, declaration: `Shapes.${name}`, extensions: {} }
	, assurance: [], ...properties });
const alias = (name, target, representation = "copied") => definition(name, "alias", { target, representation });
const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
const fixture = types => {
	const ir = corpusReviewedIr({ id: "shapes" }, [{ name: "Shapes.answer", parameters: [], result: "uint32" }]);
	ir.types = types; return ir;
};

test("aliases reject direct, mutual and container-hidden cycles with a named diagnostic", () => {
	for(const types of [
		[alias("A", named("A"))]
		, [alias("A", named("B")), alias("B", named("A"))]
		, [alias("A", apply("array", named("B"))), alias("B", apply("option", named("A")))]
		, [alias("A", apply("result", primitive("string"), named("B"))), alias("B", apply("tuple", primitive("unit"), named("A")))]
		, [alias("Prefix", named("A")), alias("A", apply("list", named("B"))), alias("B", named("A"))]
	]) {
		const ir = fixture(types);
		assert.throws(() => validateBindingIr(ir), error => {
			assert.equal(error.code, "alias-cycle");
			assert.equal(error.details.cycle[0], "lean:Shapes.A");
			assert.equal(error.details.cycle.at(-1), "lean:Shapes.A");
			assert.ok(error.details.path.endsWith(".target"));
			assert.ok(!error.details.cycle.includes("lean:Shapes.Prefix"));
			return true;
		});
		assert.throws(() => parseBindingIr(JSON.stringify(ir)), /cycle/);
	}
});

test("long alias chains and shared expansions validate without recursive graph traversal", () => {
	const types = Array.from({ length: 10000 }, (_, index) => alias(`A${index}`, index === 9999 ? primitive("uint32") : named(`A${index + 1}`)));
	types.push(alias("Shared", apply("tuple", named("A0"), named("A5000"))));
	const ir = fixture(types), before = JSON.stringify(ir);
	assert.equal(validateBindingIr(ir), ir); assert.equal(JSON.stringify(ir), before);
	types[9999].target = named("A9000");
	assert.throws(() => validateBindingIr(ir), { code: "alias-cycle" });
});

test("aliases can refer to recursive records and variants without erasing nominal definitions", () => {
	const types = [alias("Forest", apply("list", named("Tree")))
		, definition("Tree", "variant", { cases: [
			{ name: "leaf", fields: [field("value", primitive("uint32"))], documentation }
			, { name: "branch", fields: [field("children", named("Forest"))], documentation }
		] })
		, alias("Box", named("Node"))
		, definition("Node", "record", { fields: [field("next", apply("option", named("Box")))] })];
	const ir = fixture(types);
	assert.equal(validateBindingIr(ir), ir);
	assert.deepEqual(parseBindingIr(canonicalizeBindingIr(ir)).types, ir.types);
	const changed = structuredClone(ir); changed.types[0].target = named("Forest");
	assert.throws(() => validateBindingIr(changed), { code: "alias-cycle" });
});

test("alias graphs preserve target ownership and reject unknown references", () => {
	const resource = definition("Handle", "resource", {
		representation: "identity", mutability: "read"
		, resource: { kindId: "resource:Shapes.Handle", disposal: "required"
			, fallback: "queued-finalizer", cycles: "explicit-cut" } });
	const ir = fixture([resource, alias("Borrowed", named("Handle"), "identity")]);
	assert.equal(validateBindingIr(ir), ir);
	ir.types.push(definition("Packet", "record", { fields: [field("hidden", named("Borrowed"))] }));
	assert.throws(() => validateBindingIr(ir), { code: "record-field-representation" });
	ir.types.pop(); ir.types[1].representation = "copied";
	assert.throws(() => validateBindingIr(ir), { code: "alias-representation" });
	ir.types[1].target = named("Missing");
	assert.throws(() => validateBindingIr(ir), { code: "unknown-type" });
});
