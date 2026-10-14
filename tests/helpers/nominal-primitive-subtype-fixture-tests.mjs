/**
 * Static author-contract checks only; no Lean or installed-runtime claim.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentScalarTypes } from "../../src/abi/component-scalars.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { nominalPrimitiveSubtypeFields as fields, nominalPrimitiveSubtypeModule as moduleName, nominalPrimitiveSubtypeReview as reviewedFixture, nominalPrimitiveSubtypeConfiguration as configuration } from "./nominal-primitive-subtype-fixture.mjs";

const exportNamed = (document, name) => document.declarations.find(item => item.name === name);
const trees = declaration => declaration.source.extensions["lean-lang.org/refinements"];
const leaves = tree => tree === null ? [] : tree.kind === "subtype" ? [tree]
	: tree.kind === "fin" ? [] : tree.kind === "record" ? tree.fields.flatMap(field => leaves(field.refinement))
		: tree.kind === "variant" ? tree.cases.flatMap(branch => branch.fields.flatMap(field => leaves(field.refinement)))
			: tree.arguments.flatMap(leaves);

test("nominal primitive independent primitive catalog covers all nineteen bases and the late Fin sibling", () => {
	assert.deepEqual(fields.map(field => field.primitive), componentScalarTypes);
	assert.equal(fields.length, 19);
	assert.equal(new Set(fields.map(field => field.name)).size, 19);
	const document = reviewedFixture();
	validateBindingIr(document);
	const packet = document.types.find(type => type.name === "Packet");
	const raw = document.types.find(type => type.name === "RawPacket");
	assert.equal(packet.fields.length, 20);
	assert.deepEqual(packet.fields.map(field => [field.name, field.type]), [
		...fields.map(field => [field.name, { kind: "primitive", name: field.primitive }])
		, ["digit", { kind: "primitive", name: "nat" }]
	]);
	assert.deepEqual(raw.fields, packet.fields);
	assert.equal(raw.source.extensions["lean-lang.org/nominal-refinements"], undefined);
	assert.deepEqual(packet.source.extensions["lean-lang.org/nominal-refinements"], {
		kind: "record"
		, fields: [...fields.map(() => null), { kind: "fin", bound: "3" }]
	});
});

test("nominal primitive ordinary and reviewed author routes agree independently for both API selections", () => {
	for(const resultOnly of [false, true])
	{
		const document = reviewedFixture(resultOnly);
		validateBindingIr(document);
		const ordinary = configuration("ordinary", ["c", "cpp", "npm"], resultOnly);
		const reviewed = configuration("reviewed", ["npm"], resultOnly);
		validateExportConfiguration(ordinary);
		validateExportConfiguration(reviewed);
		assert.equal(document.declarations.length, resultOnly ? 6 : 14);
		assert.deepEqual(ordinary.exports, document.declarations.map(item => item.source.declaration));
		assert.deepEqual(reviewedSubtypeContracts(document), ordinary.contracts);
		assert.equal(Object.hasOwn(reviewed, "exports"), false);
		assert.equal(Object.hasOwn(reviewed, "contracts"), false);
		assert.equal(trees(exportNamed(document, "wordBits")), undefined);
		if(resultOnly) assert.equal(Object.hasOwn(ordinary, "contracts"), false);
	}
});

test("nominal primitive same nominal fields keep distinct constructor choices at every input site", () => {
	const document = reviewedFixture();
	const first = trees(exportNamed(document, "echoA")).parameters[0];
	const second = trees(exportNamed(document, "echoB")).parameters[0];
	for(const [index, field] of fields.entries())
	{
		assert.equal(first.fields[index].refinement.constructor, `${moduleName}.${field.constructor}A`);
		assert.equal(second.fields[index].refinement.constructor, `${moduleName}.${field.constructor}B`);
	}
	assert.deepEqual(trees(exportNamed(document, "combine")).parameters, [first, second]);
	const refused = trees(exportNamed(document, "refuseUnit")).parameters[0];
	assert.equal(refused.fields[0].refinement.constructor, `${moduleName}.unitReject`);
	assert.deepEqual(refused.fields.slice(1), first.fields.slice(1));
});

test("nominal primitive result-only producers keep every refined payload with no constructor selection", () => {
	const document = reviewedFixture(true);
	for(const declaration of document.declarations)
	{
		const refinement = trees(declaration);
		if(declaration.name === "wordBits")
		{
			assert.equal(refinement, undefined);
			continue;
		}
		assert.deepEqual(refinement.parameters, [null]);
		const values = leaves(refinement.result);
		assert.ok(values.length >= 19, declaration.name);
		assert.ok(values.every(value => value.constructor === null), declaration.name);
	}
	assert.equal(reviewedSubtypeContracts(document), undefined);
});

test("nominal primitive nominal member and case mutations cannot silently alter the reviewed decision", () => {
	const original = reviewedFixture();
	const changes = [
		tree => { tree.name = "Other.Packet"; }
		, tree => { tree.fields.reverse(); }
		, tree => { tree.fields.pop(); }
		, tree => { tree.fields.push(tree.fields[0]); }
		, tree => { tree.fields[0].name = "missingUnit"; }
		, tree => { tree.fields[0].refinement.constructor = null; }
	];
	for(const change of changes)
	{
		const document = structuredClone(original);
		change(trees(exportNamed(document, "echoA")).parameters[0]);
		assert.throws(() => reviewedSubtypeContracts(document));
	}
	for(const change of [tree => tree.cases.reverse(), tree => tree.cases.pop()])
	{
		const document = structuredClone(original);
		change(trees(exportNamed(document, "echoEventA")).parameters[0]);
		assert.throws(() => reviewedSubtypeContracts(document));
	}
	for(const [index, field] of fields.entries())
	{
		const document = structuredClone(original);
		trees(exportNamed(document, "echoB")).parameters[0].fields[index].refinement.constructor = `${moduleName}.${field.constructor}A`;
		assert.notDeepEqual(reviewedSubtypeContracts(document), configuration("ordinary", ["npm"]).contracts);
	}
});

test("nominal primitive result and width-query mutations cannot invent hidden input constructors", () => {
	const original = reviewedFixture(true);
	const document = structuredClone(original);
	leaves(trees(exportNamed(document, "produce")).result)[0].constructor = `${moduleName}.unitA`;
	assert.notEqual(reviewedSubtypeContracts(document), undefined);
	const empty = structuredClone(original);
	exportNamed(empty, "wordBits").source.extensions["lean-lang.org/refinements"] = { parameters: [], result: null };
	assert.throws(() => reviewedSubtypeContracts(empty));
});

test("nominal primitive configurations refuse invalid routes, targets and non-boolean API selection", () => {
	for(const [route, profiles, resultOnly] of [
		["unknown", ["npm"], false], ["ordinary", [], false]
		, ["ordinary", ["npm", "npm"], false], ["ordinary", ["unknown"], false]
		, ["ordinary", ["npm"], "true"]
	]) assert.throws(() => configuration(route, profiles, resultOnly));
});
