/**
 * Real C++ copied graph values, independent of compiled transport admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCopiedCppGraphValues } from "../src/backends/cpp/copied-graph-values.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { recursiveReviewedIr } from "./helpers/recursive-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";

const recursiveRecord = () => {
	const ir = recursiveReviewedIr(), primitive = name => ({ kind: "primitive", name });
	const root = { kind: "named", id: "lean:Recursive.Link" }, template = ir.types.find(type => type.kind === "record");
	const fields = [
		{ ...template.fields[0], name: "next", type: { kind: "apply", constructor: "option", arguments: [root] } }
		, { ...template.fields[0], name: "value", type: primitive("uint32") }
	];
	ir.types = [{ ...template, id: root.id, name: "Link", fields }];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};

test("recursive C++ values preserve native containers, named alternatives and deep-copy boxes", () => {
	const ir = recursiveReviewedIr(), before = structuredClone(ir), output = generateCopiedCppGraphValues(ir);
	assert.deepEqual(ir, before);
	assert.match(output.header, /Box<Spine> value/u);
	assert.match(output.header, /std::vector<Tree>/u);
	assert.match(output.header, /std::variant<TreeBranch, TreeLeaf>/u);
	assert.match(output.header, /using TreeAlias = Tree;/u);
	assert.doesNotMatch(output.header, /lean_object|_bridge_owner|uint32_t kind/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.equal(generateCopiedCppGraphValues(reversed).header, output.header);
});

test("C++ graph declarations reject collisions with helpers, alternatives and exports", () => {
	for(const name of ["Box", "Nat", "Graph__private", "TreeLeaf", "tree", "class"])
	{
		const ir = recursiveReviewedIr(); ir.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => generateCopiedCppGraphValues(ir), /name|reserved|collision/u);
	}
});

test("optional recursive fields box the nominal value without boxing the container", () => {
	const output = generateCopiedCppGraphValues(recursiveRecord());
	assert.match(output.header, /using Graph[a-f0-9]+ = std::optional<Box<Link>>;/u);
	assert.doesNotMatch(output.header, /Box<std::optional/u);
	const record = output.types.find(type => type.name === "Link");
	assert.equal(record.fields[0].boxed, false);
});

test("shared structural aliases retain bounded generated C++ declarations", () => {
	const ir = recursiveReviewedIr(), base = ir.types.find(type => type.kind === "alias");
	const named = index => ({ kind: "named", id: `lean:Recursive.Alias${index}` });
	ir.types = Array.from({ length: 700 }, (_, index) => ({ ...base
		, id: named(index).id, name: `Alias${index}`
		, target: index ? { kind: "apply", constructor: "tuple", arguments: [named(index - 1), named(index - 1)] } : { kind: "primitive", name: "uint32" } }));
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named(699); ir.declarations[0].result.type = named(699);
	const output = generateCopiedCppGraphValues(ir);
	assert.equal(output.types.length, 700);
	assert.ok(output.header.length < 200000, `Generated ${output.header.length} characters`);
	assert.match(output.header, /using Alias699 = Graph[a-f0-9]+;/u);
});

test("C++20 compiles recursive alternatives and preserves independent value ownership", { timeout: 180000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-cpp-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, source] of Object.entries(boostSources())) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "include/recursive-values.hpp", generateCopiedCppGraphValues(nativeRecursiveReviewedIr()).header);
	const linked = recursiveRecord(); linked.component = { ...linked.component, id: "linked@1.0.0", name: "linked" };
	await saveLakeFile(root, "include/linked-values.hpp", generateCopiedCppGraphValues(linked).header);
	await saveLakeFile(root, "check.cpp", `#include "recursive-values.hpp"
#include "linked-values.hpp"
#include <cassert>
#include <limits>
namespace api = lean_bridge::recursive;
struct Explosive {
  static inline unsigned live = 0;
  static inline bool fail = false;
  unsigned value;
  explicit Explosive(unsigned v) : value(v) { ++live; }
  Explosive(const Explosive& other) : value(other.value) { if (fail) throw std::runtime_error("copy"); ++live; }
  ~Explosive() { --live; }
};
int main() {
  api::Scalars payload{};
  payload.natural = (api::Nat(1) << 1000) + 7;
  payload.integer = -payload.natural;
  payload.text = std::string("a\\0b", 3);
  payload.bytes = {0, 255, 128};
  payload.char_ = U'🌿';
  payload.word = UINT64_MAX; payload.signed_word = INT64_MIN;
  api::Tree tree = api::TreeBranch{{api::TreeLeaf{payload}}};
  api::Forest forest{tree}; api::TreeAlias alias = tree;
  assert(alias == tree && forest.front() == tree);
  std::get<api::TreeLeaf>(std::get<api::TreeBranch>(alias.value).children.front().value).payload.text = "changed";
  assert(alias != tree);
  assert(std::get<api::TreeLeaf>(std::get<api::TreeBranch>(tree.value).children.front().value).payload == payload);
  api::Spine spine = api::SpineLeaf{41};
  for (unsigned i = 0; i < 127; ++i) spine = api::SpineNext{std::move(spine)};
  api::Spine copy = spine;
  auto* left = &spine; auto* right = &copy;
  for (unsigned i = 0; i < 127; ++i) {
    assert(left != right);
    left = &*std::get<api::SpineNext>(left->value).value;
    right = &*std::get<api::SpineNext>(right->value).value;
  }
  assert(spine == copy);
  std::get<api::SpineLeaf>(right->value).value = 42;
  assert(spine != copy && std::get<api::SpineLeaf>(left->value).value == 41);
  api::Box<api::Spine> box{spine}, empty;
  empty = box; assert(empty == box && &*empty != &*box);
  box = box; assert(box == empty);
  auto moved = std::move(empty); assert(!empty && moved == box);
  try { (void)*empty; assert(false); } catch (const std::logic_error&) {}
  api::LeftTree mutual = api::LeftTreeNext{api::RightTreeMany{{api::LeftTreeLeaf{9}}}};
  assert(mutual == api::LeftTree(mutual));
  api::Envelope envelope{};
  envelope.tree = tree; envelope.alternatives = {forest};
  envelope.fallback = tree;
  envelope.outcome = api::Ok{std::pair{tree, tree}};
  auto envelope_copy = envelope; assert(envelope_copy == envelope);
  envelope_copy.outcome = api::Err{std::string("error")}; assert(envelope_copy != envelope);
  assert(!envelope.marker);
  envelope.marker.emplace(); assert(envelope.marker && !*envelope.marker);
  envelope.marker->emplace(); assert(envelope.marker && *envelope.marker);
  api::Marker none = api::MarkerEmpty{};
  api::Marker unit = api::MarkerUnit{{}};
  assert(none != unit);
  api::Marker next = api::MarkerNext{unit}; assert(next == api::Marker(next));
  assert(api::EmptyRecord{} == api::EmptyRecord{});
  api::Wide wide = api::WideNext{};
  auto& branch = std::get<api::WideNext>(wide.value);
  branch.field254 = UINT16_MAX; branch.child = api::WideLeaf{17};
  assert(wide == api::Wide(wide));
  namespace linked = lean_bridge::linked;
  linked::Link terminal{std::nullopt, 1};
  linked::Link head{linked::Box<linked::Link>{terminal}, 2};
  auto head_copy = head; assert(head_copy == head);
  (**head_copy.next).value = 3; assert(head_copy != head && (**head.next).value == 1);
  {
    api::Box<Explosive> a{Explosive{1}}, b{Explosive{2}};
    assert(Explosive::live == 2);
    Explosive::fail = true;
    try { a = b; assert(false); } catch (const std::runtime_error&) {}
    assert(a->value == 1 && b->value == 2 && Explosive::live == 2);
    Explosive::fail = false;
  }
  assert(Explosive::live == 0);
}
`);
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, timeoutMs: 180000 })
		.catch(error => { throw new Error(error.details?.stderr ?? error.message, { cause: error }); });
	const execute = async path => {
		const observed = await run(join(root, path), []);
		assert.equal(observed.stdout, ""); assert.equal(observed.stderr, "");
	};
	await run("c++", ["-std=c++20", "-O1", "-Wall", "-Wextra", "-Werror", "-I", "include", "check.cpp", "-o", "check"]);
	await execute("check");
	await run("c++", ["-std=c++20", "-O1", "-g", "-fsanitize=address,undefined", "-fno-sanitize-recover=all", "-fno-omit-frame-pointer", "-I", "include", "check.cpp", "-o", "check-sanitized"]);
	await execute("check-sanitized");
});
