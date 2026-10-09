/**
 * Source contracts for the additive native Fin zero-bound and nested-position supplement.
 * No source-only check below claims installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compilePrimitiveCppModel, renderPrimitiveCppPackage } from "../src/backends/cpp/primitives.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finContainerEdgeConsumer, finContainerEdgeProfiles, finContainerEdgeRefinements, finContainerEdgeReviewedIr, finContainerEdgeSource, implementedFinContainerEdgeProfiles, insertFinContainerEdgeFragment } from "./helpers/fin-container-edges.mjs";
import { finContainerRefinements } from "./helpers/fin-container-install.mjs";
import { finContainerReviewedIr } from "./helpers/reviewed-fin-container-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("the edge fixture preserves the eight original exports and adds four explicit round trips", async () => {
	const original = await readFile("tests/fixtures/onboarding/native-fin-containers/FinContainers.lean", "utf8");
	const supplement = await readFile("tests/fixtures/fin-container-edges.lean", "utf8");
	const combined = await finContainerEdgeSource();
	assert.equal(combined, original + "\n" + supplement);
	assert.equal((combined.match(/^def /gmu) ?? []).length, 12);
	for(const signature of ["emptyArray (values : Array (Fin 0)) : Array (Fin 0)"
		, "emptyList (values : List (Fin 0)) : List (Fin 0)"
		, "emptyOption (value : Option (Fin 0)) : Option (Fin 0)"
		, "optionalDigits (values : Option (List Digit)) : Option (List Digit)"])
		assert.ok(supplement.includes(`def ${signature} :=`), signature);
	assert.doesNotMatch(combined, /\b(sorry|axiom|unsafe)\b/u);
});

test("the edge refinement contract keeps the original trees and checks both sides of every addition", () => {
	for(const [name, tree] of Object.entries(finContainerRefinements)) assert.deepEqual(finContainerEdgeRefinements[name], tree);
	const extra = Object.entries(finContainerEdgeRefinements).filter(([name]) => !Object.hasOwn(finContainerRefinements, name));
	assert.equal(extra.length, 4);
	for(const [name, tree] of extra)
	{
		assert.deepEqual(tree.parameters, [tree.result], name);
		assert.equal(tree.result.kind, { emptyArray: "array", emptyList: "list", emptyOption: "option", optionalDigits: "option" }[name.split(".").at(-1)]);
		const leaf = name.endsWith("optionalDigits") ? tree.result.arguments[0].arguments[0] : tree.result.arguments[0];
		assert.deepEqual(leaf, { kind: "fin", bound: name.endsWith("optionalDigits") ? "10" : "0" });
	}
	const before = finContainerReviewedIr(), after = finContainerEdgeReviewedIr();
	assert.deepEqual(after.types, before.types);
	for(const entry of before.declarations) assert.deepEqual(after.declarations.find(item => item.id === entry.id), entry);
	assert.equal(after.declarations.length, before.declarations.length + 4);
	for(const entry of after.declarations.filter(item => !before.declarations.some(prior => prior.id === item.id)))
	{
		assert.deepEqual(entry.source.extensions["lean-lang.org/refinements"], finContainerEdgeRefinements[entry.source.declaration]);
		assert.deepEqual(entry.parameters.map(parameter => parameter.type), [entry.result.type]);
	}
});

test("edge insertion refuses missing, empty, repeated and fragment-supplied markers", () => {
	assert.equal(insertFinContainerEdgeFragment("before\nprint\nafter", "print", "extra"), "before\nextra\nprint\nafter");
	for(const [source, marker, fragment] of [["none", "print", "extra"], ["print print", "print", "extra"], ["print", "", "extra"], ["print", "print", "print"]])
		assert.throws(() => insertFinContainerEdgeFragment(source, marker, fragment));
	assert.equal(insertFinContainerEdgeFragment("print", "print", "$& $` $'"), "$& $` $'\nprint");
});

test("the development slice does not erase the remaining native hosts or replace old consumers", async () => {
	assert.deepEqual(finContainerEdgeProfiles, ["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi"]);
	assert.deepEqual(implementedFinContainerEdgeProfiles, ["c", "cpp", "python"]);
	for(const profile of ["c", "cpp", "python"])
	{
		const extension = { c: "c", cpp: "cpp", python: "py" }[profile];
		const base = await readFile(`tests/fixtures/fin-container-consumers/${profile}.${extension}`, "utf8");
		const fragment = await readFile(`tests/fixtures/fin-container-edge-consumers/${profile}.${extension}`, "utf8");
		const combined = await finContainerEdgeConsumer(profile);
		assert.equal(combined.split(fragment).length, 2);
		assert.equal(combined.replace(fragment + "\n", ""), base);
		for(const method of ["empty_array", "empty_list", "empty_option", "optional_digits", "present", "flatten"])
			assert.ok(fragment.includes(method), `${profile}: ${method}`);
		assert.match(fragment, /1000/u);
	}
	await assert.rejects(finContainerEdgeConsumer("perl"), /not implemented/u);
	await assert.rejects(finContainerEdgeConsumer("rust"), /not implemented/u);
});

const sourceChecks = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
test("fresh Lean elaborates all twelve composed Fin container declarations", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-source-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "FinContainers.lean", await finContainerEdgeSource());
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const result = await runCopied(lean, ["FinContainers.lean"], root, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" });
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete C edge consumer compiles against generated GMP headers with strict warnings", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-header-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const projected = generateGmpProjection(finContainerEdgeReviewedIr());
	for(const [path, source] of Object.entries(projected.files)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "consumer.c", await finContainerEdgeConsumer("c"));
	const result = await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.c"], root);
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete Python edge consumer parses without executing a mock algorithm", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-python-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "consumer.py", await finContainerEdgeConsumer("python"));
	const result = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", ["-I", "-c", "import ast; ast.parse(open('consumer.py').read())"], root);
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete C++ edge consumer compiles against generated public types with strict warnings", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-cpp-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = finContainerEdgeReviewedIr();
	const sources = { ...generateCBindingPackage(ir), ...renderPrimitiveCppPackage(compilePrimitiveCppModel(ir)), ...boostSources() };
	for(const [path, source] of Object.entries(sources)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "consumer.cpp", await finContainerEdgeConsumer("cpp"));
	const result = await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.cpp"], root);
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});
