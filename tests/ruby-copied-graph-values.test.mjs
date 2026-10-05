/**
 * Ruby recursive declarations execute as idiomatic, finite value classes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedRubyGraphValues } from "../src/backends/ruby/copied-graph-values.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { recursiveReviewedIr } from "./helpers/recursive-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const renamed = (ir, name) => {
	ir.component.id = `${name}@1.0.0`; ir.component.name = name; return ir;
};
const linkedIr = () => {
	const ir = renamed(recursiveReviewedIr(), "linked"), template = ir.types.find(type => type.kind === "record");
	const root = { kind: "named", id: "lean:Recursive.Link" };
	ir.types = [{ ...template, id: root.id, name: "Link"
		, fields: [
			{ ...template.fields[0], name: "tail", type: { kind: "apply", constructor: "option", arguments: [root] } }
			, { ...template.fields[0], name: "value", type: { kind: "primitive", name: "uint32" } }
		]
	}];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};
const aliasesIr = () => {
	const ir = renamed(recursiveReviewedIr(), "deep"), base = ir.types.find(type => type.kind === "alias");
	const named = index => ({ kind: "named", id: `lean:Recursive.Alias${index}` });
	ir.types = Array.from({ length: 700 }, (_, index) => ({ ...base
		, id: named(index).id, name: `Alias${index}`
		, target: index ? { kind: "apply", constructor: "tuple", arguments: [named(index - 1), named(index - 1)] } : { kind: "primitive", name: "uint32" } }));
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named(699); ir.declarations[0].result.type = named(699);
	return ir;
};

test("Ruby graph values retain recursive families, keyword fields and alias identities", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), model = generateCopiedRubyGraphValues(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedRubyGraphValues(ir), model);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.equal(generateCopiedRubyGraphValues(reversed).source, model.source);
	assert.equal(model.namespace, "LeanBridge::Recursive");
	assert.equal(model.functions.length, 18);
	assert.match(model.source, /class Spine\n\s*private_class_method :new/);
	assert.match(model.source, /class Spine::Next < Spine\n\s*public_class_method :new/);
	assert.match(model.source, /# value: Spine\n\s*attr_reader :value\n\s*def initialize\(value:\)/);
	assert.match(model.source, /class EmptyRecord/);
	assert.match(model.source, /GraphValues::FIELD.bind_call/);
	assert.match(model.source, /Some = ::Data.define\(:value\)/);
	assert.match(model.source, /# Forest = list<Tree>; Ruby: Array/);
	assert.deepEqual(model.aliases.find(alias => alias.name === "TreeAlias"), {
		id: "lean:Recursive.TreeAlias"
		, name: "TreeAlias"
		, target: { kind: "named", id: "lean:Recursive.Tree" }
		, contractType: "Tree", rubyType: "LeanBridge::Recursive::Tree"
	});
	assert.ok(model.exports.includes("Tree::Leaf")); assert.ok(!model.exports.includes("Forest"));
	assert.doesNotMatch(model.source, /Fiddle|constructor_tag|\.pack\(|\.unpack|lean_object|JSON|^\s*(?:Forest|TreeAlias) =/m);
	assert.throws(() => compileCopiedRubyModel(ir), /acyclic|recursive/i);
});

test("Ruby graph names reject helper and member collisions before generation", () => {
	for(const name of ["Native", "GraphValues", "UNIT", "Some", "Array", "Spine", "Recursive"])
	{
		const ir = nativeRecursiveReviewedIr(); ir.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => generateCopiedRubyGraphValues(ir), /reserved|duplicat|collision|invalid/i);
	}
	for(const field of ["freeze", "hash", "initialize", "deconstruct_keys", "end", "next"])
	{
		const ir = linkedIr(); ir.types[0].fields[0].name = field;
		assert.throws(() => generateCopiedRubyGraphValues(ir), /reserved|duplicat|invalid/i);
	}
	for(const name of ["graph-values", "native", "some"])
		assert.throws(() => generateCopiedRubyGraphValues(renamed(nativeRecursiveReviewedIr(), name)), /reserved/);
	const duplicate = nativeRecursiveReviewedIr(), spine = duplicate.types.find(type => type.name === "Spine");
	spine.cases[1].name = "Next";
	assert.throws(() => generateCopiedRubyGraphValues(duplicate), /duplicat|collision/);
	const helper = nativeRecursiveReviewedIr();
	helper.types.find(type => type.name === "Spine").cases[0].name = "graph_values";
	assert.throws(() => generateCopiedRubyGraphValues(helper), /reserved/);
	const underscored = nativeRecursiveReviewedIr();
	underscored.types.find(type => type.name === "Marker").cases[0].name = "empty_";
	assert.match(generateCopiedRubyGraphValues(underscored).source, /class Marker::Empty_ < Marker/);
	for(const name of ["next", "inspect"])
	{
		const ir = linkedIr(); ir.declarations[0].name = name;
		assert.equal(generateCopiedRubyGraphValues(ir).functions[0].publicName, name);
	}
});

test("Ruby shared structural aliases remain finite and do not manufacture constants", () => {
	const output = generateCopiedRubyGraphValues(aliasesIr());
	assert.equal(output.types.length, 700); assert.equal(output.aliases.length, 700);
	assert.ok(output.source.length < 100000);
	assert.match(output.source, /# Alias699 = tuple<Alias698, Alias698>; Ruby: Array/);
	assert.doesNotMatch(output.source, /class Alias|Alias699 = ::/);
	const linked = generateCopiedRubyGraphValues(linkedIr());
	assert.match(linked.source, /# tail: option<Link>/);
	assert.match(linked.source, /def initialize\(tail:, value:\)/);
});

test("Ruby recursive declarations execute equality, matching and compound value semantics", {
	skip: process.env.LEAN_BRIDGE_RUBY_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const command = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const probe = await readFile("tests/fixtures/structured-types/recursive-values.rb", "utf8");
	const generated = { recursive: generateCopiedRubyGraphValues(nativeRecursiveReviewedIr())
		, linked: generateCopiedRubyGraphValues(linkedIr())
		, deep: generateCopiedRubyGraphValues(aliasesIr()) };
	for(const [name, model] of Object.entries(generated)) await saveLakeFile(root, `${name}.rb`, model.source);
	await saveLakeFile(root, "check.rb", probe);
	const result = await runCopied(command, ["--disable-gems", "-w", "check.rb"], root);
	assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout);
	assert.match(report.ruby, /^3\.3\./); assert.ok(report.checks >= 60);
	assert.equal(report.wideFields, 256); assert.equal(report.aliasConstants, 0);
	await saveLakeFile("build/recursive", "ruby-values.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, report
		, probeSha256: sha256(probe)
		, sourceHashes: Object.fromEntries(Object.entries(generated).map(([name, model]) => [`${name}.rb`, sha256(model.source)])) }));
});

test("Ruby recursive declaration execution remains required in downstream CI", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_GRAPH_TEST=1 node --test tests/ruby-copied-graph-values.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/ruby-values.json"));
	assert.ok(workflow.includes("            build/recursive/ruby-values.json\n"));
});
