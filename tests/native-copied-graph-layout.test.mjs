/**
 * Compile finite recursive C/C++ value layouts. These checks exercise public
 * fields and root cleanup, not a Lean adapter or an installed package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedCGraphLayout, generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { recursiveReviewedIr } from "./helpers/recursive-fixture.mjs";

const primitive = name => ({ kind: "primitive", name });
const named = name => ({ kind: "named", id: `lean:Recursive.${name}` });
const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const declaration = (name, kind, values) => {
	const base = recursiveReviewedIr().types[0], documentation = base.documentation;
	const fields = values => Object.entries(values).map(([name, type]) => ({ name, type, mutability: "immutable", documentation }));
	return { ...base
		, id: named(name).id, name, kind
		, fields: kind === "record" ? fields(values) : []
		, cases: kind === "variant" ? Object.entries(values).map(([name, values]) => ({ name, fields: fields(values), documentation })) : []
		, target: kind === "alias" ? values : null
		, source: { ...base.source, declaration: `Recursive.${name}` } };
};
const fixture = (types, root) => {
	const ir = recursiveReviewedIr(); ir.types = types; ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};
const node = (layout, name) => layout.nodes.find(node => node.ref.id === named(name).id);
const table = layout => new Map(layout.nodes.map(node => [node.id, node]));

test("native graph layout preserves all copied shapes without expanding nominal recursion", () => {
	const ir = recursiveReviewedIr(), before = structuredClone(ir), layout = compileCopiedCGraphLayout(ir);
	assert.deepEqual(ir, before);
	assert.equal(layout.nodes.length, 34);
	assert.equal(layout.roots.length, ir.declarations.length);
	assert.equal(layout.nodes.filter(node => node.kind === "primitive").length, 19);
	assert.equal(node(layout, "Spine").cases[0].fields[0].storage, "pointer");
	assert.equal(node(layout, "Never").cases[0].fields[0].storage, "pointer");
	assert.equal(node(layout, "Spine").cases[1].fields[0].storage, "value");
	assert.equal(node(layout, "Tree").cases[0].fields[0].storage, "value");
	assert.equal(node(layout, "LeftTree").cases[0].fields[0].storage, "value");
	assert.equal(node(layout, "RightTree").cases[0].fields[0].storage, "value");
	const types = table(layout), list = types.get(node(layout, "Tree").cases[0].fields[0].type);
	assert.equal(list.kind, "list"); assert.equal(list.element, node(layout, "Tree").id);
	assert.equal(layout.aliases.find(item => item.id === named("Forest").id).target, list.id);
	assert.equal(layout.aliases.find(item => item.id === named("TreeAlias").id).target, node(layout, "Tree").id);
	assert.throws(() => { node(layout, "Spine").cases[0].fields[0].storage = "value"; }, TypeError);
	assert.throws(() => layout.order.push("changed"), TypeError);
});

test("every inline SCC edge is boxed independently of declaration and traversal order", () => {
	const ir = fixture([
		declaration("A", "variant", { next: { other: named("B") }, leaf: {} })
		, declaration("B", "record", { pair: apply("tuple", named("A"), primitive("uint32")) })
	], named("A"));
	const layout = compileCopiedCGraphLayout(ir), types = table(layout);
	assert.equal(layout.boxedGroups.length, 1); assert.equal(layout.boxedGroups[0].length, 3);
	const branch = node(layout, "A").cases[0].fields[0], pair = node(layout, "B").fields[0];
	assert.equal(branch.storage, "pointer"); assert.equal(pair.storage, "pointer");
	assert.equal(types.get(pair.type).fields[0].storage, "pointer");
	assert.equal(types.get(pair.type).fields[1].storage, "value");
	const permuted = structuredClone(ir); permuted.types.reverse();
	assert.deepEqual(compileCopiedCGraphLayout(permuted), layout);
	const header = generateCopiedCGraphTypes(ir).header;
	assert.match(header, /const recursive_b_t \*other;/);
	assert.match(header, /const recursive_a_t \*fst;/);
});

test("optional and result backedges become pointers without flattening tags or payloads", () => {
	const ir = fixture([declaration("Value", "record", {
		next: apply("option", named("Value"))
		, result: apply("result", named("Value"), apply("option", primitive("unit")))
	})], named("Value"));
	const { layout, header } = generateCopiedCGraphTypes(ir), types = table(layout), value = node(layout, "Value");
	assert.equal(layout.boxedGroups[0].length, 3);
	assert.equal(value.fields[0].storage, "pointer"); assert.equal(value.fields[1].storage, "pointer");
	const result = types.get(value.fields[1].type);
	assert.equal(result.fields[0].storage, "pointer"); assert.equal(result.fields[1].storage, "value");
	assert.equal(result.fields[0].name, "ok"); assert.equal(result.fields[1].name, "error");
	assert.match(header, /uint8_t has_value;/); assert.match(header, /uint8_t is_ok;/);
});

test("definition order completes every by-value child, including nested sequences", () => {
	const layout = compileCopiedCGraphLayout(recursiveReviewedIr()), positions = new Map(layout.order.map((id, index) => [id, index]));
	assert.equal(positions.size, layout.nodes.length);
	for(const value of layout.nodes) for(const field of [...value.fields, ...value.cases.flatMap(branch => branch.fields)])
		if(field.storage === "value") assert.ok(positions.get(field.type) < positions.get(value.id), `${value.name}.${field.name}`);
	const reordered = recursiveReviewedIr(); reordered.types.reverse();
	assert.equal(generateCopiedCGraphTypes(reordered).header, generateCopiedCGraphTypes(recursiveReviewedIr()).header);
});

test("source type names remain distinct from scalar carriers and same-named exports", () => {
	const ir = fixture([declaration("String", "record", { text: primitive("string") })], named("String"));
	ir.declarations[0].name = "string";
	const layout = compileCopiedCGraphLayout(ir), types = table(layout), record = node(layout, "String");
	assert.equal(record.name, "recursive_string_t");
	assert.equal(types.get(record.fields[0].type).name, "recursive_scalar_string_t");
	assert.equal(layout.roots[0].name, "recursive_string");
});

test("nine hundred transparent aliases stay finite and share one native layout", () => {
	const types = [declaration("Tree", "variant", { leaf: { value: primitive("uint32") }, next: { child: named("Tree") } })];
	for(let index = 0; index < 900; index++) types.push(declaration(`Alias${index}`, "alias", named(index ? `Alias${index - 1}` : "Tree")));
	const { layout, header } = generateCopiedCGraphTypes(fixture(types, named("Alias899")));
	assert.equal(layout.nodes.length, 2); assert.equal(layout.aliases.length, 900);
	assert.ok(layout.aliases.every(alias => alias.target === node(layout, "Tree").id));
	assert.match(header, /typedef recursive_tree_t recursive_alias899_t;/);
	assert.ok(header.length < 350000);
});

test("aliases inside containers share their target's C type instead of creating incompatible spans", () => {
	const ir = recursiveReviewedIr();
	ir.types.push(declaration("ContainerAliases", "record", {
		direct: apply("array", named("Tree"))
		, aliased: apply("array", named("TreeAlias"))
		, forest: apply("array", named("Forest"))
		, list: apply("array", apply("list", named("Tree")))
	}));
	const layout = compileCopiedCGraphLayout(ir), fields = node(layout, "ContainerAliases").fields;
	assert.equal(fields[0].type, fields[1].type); assert.equal(fields[2].type, fields[3].type);
	const aliases = [declaration("Alias0", "alias", primitive("uint32"))];
	for(let index = 1; index < 700; index++) aliases.push(declaration(`Alias${index}`, "alias", apply("tuple", named(`Alias${index - 1}`), named(`Alias${index - 1}`))));
	const shared = compileCopiedCGraphLayout(fixture(aliases, named("Alias699")));
	assert.equal(shared.aliases.length, 700); assert.equal(shared.nodes.length, 700);
	assert.ok(shared.nodes.every(value => value.id.length < 100));
});

test("large nominal rings do not use the JavaScript recursion stack", () => {
	const types = [];
	for(let index = 0; index < 800; index++) types.push(declaration(`Node${index}`, "variant", { leaf: {}, next: { value: named(`Node${(index + 1) % 800}`) } }));
	const layout = compileCopiedCGraphLayout(fixture(types, named("Node0")));
	assert.equal(layout.nodes.length, 800); assert.equal(layout.boxedGroups.length, 1);
	assert.equal(layout.boxedGroups[0].length, 800);
	assert.ok(layout.nodes.every(value => value.cases[1].fields[0].storage === "pointer"));
});

test("shared acyclic definitions cannot create exponentially large inline C objects", () => {
	const types = [declaration("Node0", "record", { value: primitive("uint32") })];
	for(let index = 1; index < 700; index++) types.push(declaration(`Node${index}`, "record", { left: named(`Node${index - 1}`), right: named(`Node${index - 1}`) }));
	const layout = compileCopiedCGraphLayout(fixture(types, named("Node699")));
	const nodes = table(layout);
	assert.equal(layout.nodes.length, 701); assert.equal(layout.boxedGroups.length, 0);
	assert.ok(layout.nodes.some(value => value.fields.some(field => field.storage === "pointer")));
	const weights = new Map();
	for(const id of layout.order)
	{
		const value = nodes.get(id);
		const weight = 1 + value.fields.reduce((total, field) => total + (field.storage === "pointer" ? 1 : weights.get(field.type)), 0);
		assert.ok(weight <= layout.inlineValueLimit, value.name); weights.set(id, weight);
	}
});

test("C and C++ complete mutually recursive compounds and large shared layouts", { timeout: 30000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-native-graph-complete-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const shared = [declaration("Node0", "record", { value: primitive("uint64") })];
	for(let index = 1; index < 700; index++) shared.push(declaration(`Node${index}`, "record", { left: named(`Node${index - 1}`), right: named(`Node${index - 1}`) }));
	const recursive = [declaration("A", "record", { next: apply("option", named("B")) })
		, declaration("B", "variant", { leaf: {}, more: { result: apply("result", apply("tuple", named("A"), primitive("uint32")), primitive("string")) } })];
	for(const [types, root, outputType] of [[shared, named("Node699"), "recursive_node699_t"], [recursive, named("A"), "recursive_a_t"]])
	{
		const { header } = generateCopiedCGraphTypes(fixture(types, root));
		await writeFile(join(directory, "values.h"), header);
		for(const [compiler, standard, extension, assertion] of [["cc", "c11", "c", "_Static_assert"], ["c++", "c++20", "cpp", "static_assert"]])
		{
			await writeFile(join(directory, `complete.${extension}`), `#include "values.h"\n${assertion}(sizeof(${outputType}) < 4096, "bounded native layout");\n`);
			await processBuildRunner.capture({ command: compiler, cwd: directory
			, args: [
				`-std=${standard}`
				, "-Wall"
				, "-Wextra"
				, "-Werror"
				, "-pedantic"
				, "-fsyntax-only"
				, `complete.${extension}`
			] });
		}
	}
});

for(const [label, types, root] of [
	["alias cycle", [declaration("A", "alias", named("B")), declaration("B", "alias", named("A"))], named("A")]
	, ["record member collision", [declaration("A", "record", { someValue: primitive("unit"), some_value: primitive("unit") })], named("A")]
	, ["constructor collision", [declaration("A", "variant", { someValue: {}, some_value: {} })], named("A")]
	, ["nominal name collision", [declaration("SomeValue", "record", {}), declaration("Some_value", "record", {})], named("SomeValue")]
	, ["alias name collision", [declaration("SomeValue", "record", {}), declaration("Some_value", "alias", primitive("unit"))], named("SomeValue")]
	, ["unsupported root constructor", [], apply("promise", primitive("unit"))]
]) test(`native graph layout rejects ${label}`, () => assert.throws(() => compileCopiedCGraphLayout(fixture(types, root))));

for(const [label, change] of [
	["mutable parameter", ir => { ir.declarations[0].parameters[0].mutability = "mutable"; }]
	, ["borrowed parameter", ir => { ir.declarations[0].parameters[0].ownership = "borrow"; ir.declarations[0].parameters[0].lifetime = { scope: "call", anchor: null }; }]
	, ["optional parameter", ir => { ir.declarations[0].parameters[0].optional = true; }]
	, ["host effects", ir => { ir.declarations[0].effects = ["host-call"]; }]
	, ["identity-containing record", ir => { ir.types[0].representation = "identity"; }]
	, ["function and type collision", ir => { ir.declarations[0].name = "spine_t"; }]
	, ["function and helper collision", ir => { ir.declarations[0].name = "spine_t_init"; }]
]) test(`native graph layout rejects ${label}`, () => {
	const ir = recursiveReviewedIr(); change(ir); assert.throws(() => compileCopiedCGraphLayout(ir));
});

test("C11 and C++20 execute recursive fields and clear an arena without following result pointers", { timeout: 30000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-native-graph-layout-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { header } = generateCopiedCGraphTypes(recursiveReviewedIr());
	await writeFile(join(directory, "values.h"), header);
	const source = `#include "values.h"
#include <assert.h>
#include <stdlib.h>
/* A Lean Tree type and tree function must occupy distinct C identifiers. */
int recursive_tree(const recursive_tree_t *value, recursive_tree_t *result);
static unsigned releases;
struct test_arena { void *children; };
static void release_arena(void *owner) {
  struct test_arena *arena = (struct test_arena *)owner;
  free(arena->children); free(arena); ++releases;
}
int main(void) {
  recursive_spine_t leaf, parent;
  recursive_spine_t_init(&leaf); recursive_spine_t_init(&parent);
  leaf.kind = RECURSIVE_SPINE_T_KIND_LEAF; leaf.cases.leaf.value = 42;
  parent.kind = RECURSIVE_SPINE_T_KIND_NEXT; parent.cases.next.value = &leaf;
  assert(parent.cases.next.value->cases.leaf.value == 42);
  recursive_tree_t trees[2], branch;
  recursive_tree_t_init(&trees[0]); recursive_tree_t_init(&trees[1]); recursive_tree_t_init(&branch);
  trees[0].kind = RECURSIVE_TREE_T_KIND_LEAF; trees[0].cases.leaf.payload.u32 = 99;
  trees[1].kind = RECURSIVE_TREE_T_KIND_BRANCH;
  branch.kind = RECURSIVE_TREE_T_KIND_BRANCH;
  branch.cases.branch.children.data = trees; branch.cases.branch.children.length = 2;
  assert(branch.cases.branch.children.data[0].cases.leaf.payload.u32 == 99);
  recursive_forest_t forest = branch.cases.branch.children;
  assert(forest.length == 2);
  recursive_left_tree_t left; recursive_left_tree_t_init(&left);
  recursive_right_tree_t right; recursive_right_tree_t_init(&right);
  left.kind = RECURSIVE_LEFT_TREE_T_KIND_LEAF; left.cases.leaf.value = 7;
  right.kind = RECURSIVE_RIGHT_TREE_T_KIND_MANY;
  right.cases.many.lefts.data = &left; right.cases.many.lefts.length = 1;
  assert(right.cases.many.lefts.data[0].cases.leaf.value == 7);
  struct test_arena *arena = (struct test_arena *)malloc(sizeof(*arena)); assert(arena);
  arena->children = malloc(64); assert(arena->children);
  parent._bridge_owner = arena; parent._bridge_release = release_arena;
  parent.kind = UINT32_MAX; parent.cases.next.value = (const recursive_spine_t *)(uintptr_t)1;
  recursive_spine_t_clear(&parent); recursive_spine_t_clear(&parent);
  assert(releases == 1); assert(parent.kind == UINT32_MAX); assert(!parent._bridge_owner);
  assert(leaf.cases.leaf.value == 42);
  recursive_tree_alias_t_clear(&branch); recursive_forest_t_clear(&forest);
  recursive_left_tree_t_clear(&left); recursive_right_tree_t_clear(&right);
  recursive_spine_t_clear(&leaf); recursive_spine_t_clear(NULL);
  assert(releases == 1);
  return 0;
}
`;
	for(const [compiler, standard, extension] of [["cc", "c11", "c"], ["c++", "c++20", "cpp"]])
	{
		const input = `consumer.${extension}`, output = `consumer-${extension}`;
		await writeFile(join(directory, input), source);
		await processBuildRunner.capture({ command: compiler, cwd: directory
		, args: [
			`-std=${standard}`
			, "-Wall"
			, "-Wextra"
			, "-Werror"
			, "-pedantic"
			, "-fsanitize=undefined"
			, input
			, "-o"
			, output
		] });
		const result = await processBuildRunner.capture({ command: join(directory, output), cwd: directory, args: [] });
		assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
	}
	assert.equal(await readFile(join(directory, "values.h"), "utf8"), header);
});
