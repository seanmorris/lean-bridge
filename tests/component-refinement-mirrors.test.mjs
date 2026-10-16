/**
 * Component mirror normalization and generated-source checks. Compiler and installed acceptance are separate gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { componentRefinementMirrors } from "../src/build/component-refinement-mirrors.mjs";
import { refinementCycleTrees, refinementMirrorNames, renderRefinementMirrors } from "../src/build/refinement-mirrors.mjs";
import { generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateComponentRecursiveAdapters } from "../src/build/component-recursive-adapters.mjs";
import { componentRecursiveLeanSource } from "../src/build/component-recursive-lean.mjs";
import {
	componentRefinementMirrorsFixture
	, mutualCheckedComponentRefinementMirrorsFixture
	, mutualComponentRefinementMirrorsFixture
	, recursiveComponentRefinementMirrorsFixture
} from "./helpers/component-refinement-mirrors-fixture.mjs";
import { nominalFinConversionFixture, nominalSubtypeConversionFixture } from "./helpers/nominal-subtype-conversion-fixture.mjs";
import "./helpers/component-refinement-mirrors-source-tests.mjs";
import "./helpers/component-nominal-subtype-tests.mjs";
import "./helpers/component-nominal-subtype-history-tests.mjs";
import "./helpers/nominal-primitive-subtype-tests.mjs";

const render = type => {
	assert.equal(type.kind, "primitive"); assert.equal(type.name, "nat");
	return "_root_.Nat";
};
const normalize = fixture => componentRefinementMirrors(fixture.abi, fixture.exports, render, fixture.nominalRefinements);
const site = (model, name) => model.sites.find(item => item.sourceDeclaration === `NominalConversion.${name}`);

test("component mirrors preserve per-use constructor choices and merge shared Fin bounds", () => {
	const fixture = componentRefinementMirrorsFixture(), before = canonicalJson(fixture), model = normalize(fixture);
	assert.equal(canonicalJson(fixture), before);
	const first = site(model, "first").refinements.parameters[0], second = site(model, "second").refinements.parameters[0];
	assert.equal(first.definition, "NominalConversion.Envelope");
	assert.equal(first.arguments[0].constructor, "NominalConversion.plusOne");
	assert.equal(second.arguments[0].constructor, "NominalConversion.plusTwo");
	assert.deepEqual(first.arguments[1], { kind: "fin", bound: "3" });
	const source = model.lines.join("\n");
	assert.equal((source.match(/structure LbErased.NominalConversion.Envelope where/gu) ?? []).length, 1);
	assert.equal((source.match(/def LbErased.NominalConversion.Envelope.via_/gu) ?? []).length, 2);
	assert.equal((source.match(/def LbErased.NominalConversion.Envelope.erase /gu) ?? []).length, 1);
	assert.match(source, /«payload» := a0, «digit» := a1/u);
	assert.doesNotMatch(source, /unsafeCast|sorry|_root_\.null|_root_\.undefined/u);
});

test("component aliases resolve to the same erased carrier inside structural containers", () => {
	const model = normalize(componentRefinementMirrorsFixture());
	assert.equal(model.renderType({ kind: "named", id: "lean:NominalConversion.Envelopes" }), "(_root_.Array LbErased.NominalConversion.Envelope)");
	const item = site(model, "echoAliases");
	assert.equal(item.parameters[0].leanType, item.leanResultType);
	assert.equal(item.refinements.parameters[0].arguments[0].definition, "NominalConversion.Envelope");
	assert.equal(item.refinements.result.arguments[0].arguments[0].constructor, null);
});

test("shared Fin-bearing children use the same mirror independently and inside a Subtype record", () => {
	const model = normalize(componentRefinementMirrorsFixture()), source = model.lines.join("\n");
	const independent = site(model, "echoDigit").refinements.parameters[0];
	assert.deepEqual(site(model, "withDigit").refinements.parameters[0].arguments[1], independent);
	assert.equal(site(model, "echoDigit").parameters[0].leanType, "LbErased.NominalConversion.Digit");
	assert.deepEqual(independent.arguments[0], { kind: "fin", bound: "3" });
	assert.ok(source.indexOf("structure LbErased.NominalConversion.Digit where") < source.indexOf("structure LbErased.NominalConversion.WithDigit where"));
	assert.match(source, /def LbErased.NominalConversion.Digit.check /u);
	assert.equal(model.renderType({ kind: "named", id: "lean:NominalConversion.DigitAlias" }), "_root_.Nat");
});

test("component variant mirrors retain empty cases and branch-local checked conversions", () => {
	const model = normalize(componentRefinementMirrorsFixture());
	const tree = site(model, "eventFirst").refinements.parameters[0];
	assert.deepEqual(tree.cases[0], { name: "empty", fields: [], arguments: [] });
	assert.equal(tree.cases[1].arguments[0].definition, "NominalConversion.Envelope");
	const source = model.lines.join("\n");
	assert.match(source, /\| «empty»\s*: LbErased.NominalConversion.Event/u);
	assert.match(source, /\| \.«empty»\s+=> do pure \(_root_.NominalConversion.Event.empty\s*\)/u);
	assert.match(source, /\| _root_.Except.error/u);
});

test("constructor-free component results emit projection without checked Subtype converters", () => {
	const fixture = componentRefinementMirrorsFixture();
	fixture.exports = fixture.exports.filter(item => item.sourceDeclaration.includes(".produce"));
	fixture.abi.exports = fixture.abi.exports.filter(item => fixture.exports.some(site => site.bindingId === item.bindingId));
	const model = normalize(fixture), source = model.lines.join("\n");
	assert.match(source, /def LbErased.NominalConversion.Envelope.erase/u);
	assert.match(source, /def LbErased.NominalConversion.Event.erase/u);
	assert.match(source, /structure LbErased.NominalConversion.Pair where\n {2}«left» : LbErased.NominalConversion.Envelope/u);
	assert.doesNotMatch(source, /\.via_|_root_\.null/u);
});

test("reordered exports retain stable component mirror definitions and constructor identities", () => {
	const first = componentRefinementMirrorsFixture(), second = componentRefinementMirrorsFixture();
	second.exports.reverse(); second.abi.exports.reverse();
	const a = normalize(first), b = normalize(second);
	for(const item of a.sites) assert.deepEqual(b.sites.find(other => other.bindingId === item.bindingId), item);
	assert.deepEqual(a.lines, b.lines);
});

test("recursive component mirrors retain per-site checks through finite private backedges", () => {
	const first = recursiveComponentRefinementMirrorsFixture(), second = recursiveComponentRefinementMirrorsFixture();
	second.exports.reverse(); second.abi.exports.reverse();
	const a = normalize(first), b = normalize(second), source = a.lines.join("\n");
	const at = (model, name) => model.sites.find(item => item.sourceDeclaration === `RecursiveMirrors.${name}`).refinements;
	const firstTree = at(a, "first").parameters[0], secondTree = at(a, "second").parameters[0];
	assert.notEqual(firstTree.cycle, secondTree.cycle);
	assert.deepEqual(firstTree.cases[1].arguments[2]
		, { kind: "recursive", definition: "RecursiveMirrors.Chain", cycle: firstTree.cycle });
	assert.deepEqual(firstTree.cases[1].arguments[1], { kind: "fin", bound: "3" });
	assert.equal(a.cycles.size, 3);
	assert.equal((source.match(/def LbErased\.RecursiveMirrors\.Chain\.via_/gu) ?? []).length, 2);
	assert.equal((source.match(/def LbErased\.RecursiveMirrors\.Chain\.erase /gu) ?? []).length, 1);
	assert.match(source, /Chain\.via_[a-f0-9]+ \(a2\)/u);
	assert.match(source, /Chain\.erase \(a2\)/u);
	assert.match(source, /def LbErased\.RecursiveMirrors\.Chain\.validFin/u);
	assert.deepEqual(a.lines, b.lines);
	for(const item of a.sites) assert.deepEqual(b.sites.find(other => other.bindingId === item.bindingId), item);
});

test("mutual component mirrors retain active cases, aliases and structural backedges", () => {
	const first = mutualComponentRefinementMirrorsFixture(), second = mutualComponentRefinementMirrorsFixture();
	second.exports.reverse(); second.abi.exports.reverse();
	const a = normalize(first), b = normalize(second), source = a.lines.join("\n");
	const at = (model, name) => model.sites.find(item => item.sourceDeclaration === `MutualMirrors.${name}`).refinements;
	const tree = at(a, "first").parameters[0], right = tree.arguments[1].arguments[0];
	assert.equal(tree.definition, "MutualMirrors.Left");
	assert.equal(right.definition, "MutualMirrors.Right");
	assert.deepEqual(right.cases[0].arguments, []);
	assert.deepEqual(right.cases[1].arguments[1].arguments[0]
		, { kind: "recursive", definition: "MutualMirrors.Left", cycle: tree.cycle });
	assert.deepEqual(a.mutualGroups, [["MutualMirrors.Left", "MutualMirrors.Right"]]);
	const groups = at(a, "groups").parameters[0];
	assert.equal(groups.kind, "array");
	assert.equal(groups.arguments[0].kind, "option");
	assert.equal(groups.arguments[0].arguments[0].definition, "MutualMirrors.Left");
	assert.equal(a.sites.find(item => item.sourceDeclaration === "MutualMirrors.groups").parameters[0].leanType
		, "(_root_.Array (_root_.Option LbErased.MutualMirrors.Left))");
	assert.equal((source.match(/^mutual$/gmu) ?? []).length, 2);
	assert.match(source, /structure LbErased\.MutualMirrors\.Left where/u);
	assert.match(source, /inductive LbErased\.MutualMirrors\.Right where/u);
	assert.deepEqual(a.lines, b.lines);
	for(const item of a.sites) assert.deepEqual(b.sites.find(other => other.bindingId === item.bindingId), item);
});

test("mutual component mirrors retain checked-record constructors and proof-free backedges", () => {
	const fixture = mutualCheckedComponentRefinementMirrorsFixture();
	const model = normalize(fixture), source = model.lines.join("\n");
	assert.deepEqual(model.mutualGroups, [["MutualChecked.Envelope", "MutualChecked.Step"]]);
	assert.match(source, /structure LbErased\.MutualChecked\.Envelope where/u);
	assert.match(source, /inductive LbErased\.MutualChecked\.Step where/u);
	assert.match(source, /def LbErased\.MutualChecked\.Envelope\.via_[a-f0-9]+/u);
	assert.match(source, /def LbErased\.MutualChecked\.Step\.via_[a-f0-9]+/u);
	assert.match(source, /def LbErased\.MutualChecked\.Envelope\.erase/u);
	assert.match(source, /def LbErased\.MutualChecked\.Step\.erase/u);
	assert.match(source, /def LbErased\.MutualChecked\.Envelope\.validFin/u);
	assert.match(source, /def LbErased\.MutualChecked\.Step\.validFin/u);
	assert.doesNotMatch(source, /\b(?:partial|unsafe|axiom|sorry)\b/u);
});

test("recursive component mirrors reject an explicit selection at an active backedge", () => {
	const fixture = recursiveComponentRefinementMirrorsFixture();
	const first = fixture.exports.find(item => item.sourceDeclaration === "RecursiveMirrors.first");
	const second = fixture.exports.find(item => item.sourceDeclaration === "RecursiveMirrors.second");
	first.refinements.parameters[0].cases[1].fields[2].refinement = structuredClone(second.refinements.parameters[0]);
	assert.throws(() => normalize(fixture), /Refinement does not match its transport type/u);
});

test("recursive refinement tokens identify one complete finite target", () => {
	const target = { kind: "record", definition: "Example.Node", fields: ["value"], arguments: [null], cycle: "cycle-token" };
	const model = { exports: [{ refinements: { parameters: [target], result: null } }] };
	assert.equal(refinementCycleTrees(model).get("cycle-token"), target);
	const conflicting = structuredClone(target); conflicting.arguments[0] = { kind: "fin", bound: "3" };
	assert.throws(() => refinementCycleTrees({ exports: [{ refinements: { parameters: [target, conflicting], result: null } }] })
		, /Conflicting recursive refinement token/u);
});

test("component mirrors refuse malformed, missing and conflicting per-use choices", () => {
	for(const mutate of [
		fixture => { fixture.exports[0].refinements.parameters[0].fields.reverse(); }
		, fixture => { fixture.exports[0].refinements.parameters[0].fields[0].refinement.constructor = null; }
		, fixture => { fixture.exports[0].refinements.parameters[0].fields[1].refinement = { kind: "fin", bound: "4" }; }
		, fixture => { fixture.exports[0].refinements.parameters[0] = null; }
		, fixture => { fixture.exports[0].refinements.parameters[0].name = "NominalConversion.Pair"; }
		, fixture => { fixture.exports[0].refinements.extra = true; }
		, fixture => { fixture.exports[4].refinements.parameters[0].cases.shift(); }
		, fixture => { fixture.exports.reverse(); }
		, fixture => { fixture.nominalRefinements.reverse(); }
	]) {
		const fixture = componentRefinementMirrorsFixture(); mutate(fixture);
		assert.throws(() => normalize(fixture), /Refinement does not match|Invalid component refinement mirrors|Conflicting nominal refinement layouts/u);
	}
});

test("the shared mirror emitter retains the native generator's exact source prefix", () => {
	for(const create of [nominalSubtypeConversionFixture, nominalFinConversionFixture])
	{
		const model = create(), names = refinementMirrorNames(model);
		const typeName = type => {
			if(["record", "variant"].includes(type.kind) && names.has(type.lean)) return `LbErased.${type.lean}`;
			if(type.kind === "primitive") return `_root_.${type.lean}`;
			if(type.kind === "result") return `(_root_.Except ${typeName(type.arguments[1])} ${typeName(type.arguments[0])})`;
			if(type.kind === "tuple") return `(_root_.Prod ${type.arguments.map(typeName).join(" ")})`;
			return `(_root_.${{ array: "Array", list: "List", option: "Option" }[type.kind]} ${typeName(type.element)})`;
		};
		const generated = generateNativeLeanAdapters(model), lines = renderRefinementMirrors(model, names, typeName);
		assert.equal(sha256(canonicalJson(generated)), create === nominalSubtypeConversionFixture
			? "7a2aa0280a7ce3f29aa1b2638c965530ce7a4b3abfb11eb9297710c2b26f7095"
			: "1ce38835771c829da75ad5666d4e1a2aa180be6124b6405dcdc7a9238886fa0c");
		const prefix = ["import NominalConversion", "", `namespace ${generated.module}`, "", ...lines].join("\n");
		assert.ok(generated.leanSource.startsWith(prefix));
	}
});

test("shared mirror and diagnostic modules ship in the published CLI package", async () => {
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	for(const path of [
		"src/build/refinement-mirrors.mjs"
		, "src/build/component-refinement-mirrors.mjs"
		, "src/build/component-recursive-diagnostics.mjs"
		, "src/build/component-fin-guards.mjs"
	])
		assert.ok(manifest.files.includes(path), path);
});

test("component frames check every argument's Fin bounds before any selected constructor", () => {
	const fixture = componentRefinementMirrorsFixture();
	const item = fixture.exports.find(item => item.sourceDeclaration.endsWith(".combine"));
	const source = generateComponentRecursiveAdapters(fixture.abi, fixture);
	const body = source.slice(source.indexOf(`LEAN_EXPORT uint32_t ${item.symbol}(`));
	assert.ok(body.indexOf(`${item.symbol}_fin_guard_0(a0)`) >= 0);
	assert.ok(body.indexOf(`${item.symbol}_fin_guard_1(a1)`) > body.indexOf(`${item.symbol}_fin_guard_0(a0)`));
	assert.ok(body.indexOf(`${item.symbol}_refinement_0(a0)`) > body.indexOf(`${item.symbol}_fin_guard_1(a1)`));
	assert.ok(body.indexOf(`${item.symbol}_refinement_1(a1)`) > body.indexOf(`${item.symbol}_refinement_0(a0)`));
	assert.ok(body.indexOf(`${item.symbol}_lean(a0, a1)`) > body.indexOf(`${item.symbol}_refinement_1(a1)`));
	const lean = componentRecursiveLeanSource(fixture.abi, fixture.exports, render, fixture.nominalRefinements).join("\n");
	const wrapper = lean.slice(lean.indexOf(`def ${item.wrapper} `));
	assert.match(wrapper, /if \(LbErased.NominalConversion.Envelope.validFin \(a0\)\) && \(LbErased.NominalConversion.Envelope.validFin \(a1\)\) then/u);
	assert.ok(wrapper.indexOf("Envelope.validFin") < wrapper.indexOf("Envelope.via_"));
	for(const declaration of lean.split(/(?=^def )/mu).filter(body => body.startsWith("def LbErased.") && body.includes(".validFin (")))
		assert.doesNotMatch(declaration, /plusOne|plusTwo|\.via_/u);
});
