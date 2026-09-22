/**
 * C++ copied graph conversions preserve values and release every partial owner.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCopiedCppGraphConversions } from "../src/backends/cpp/copied-graph-conversions.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const optionalFixture = () => {
	const ir = nativeRecursiveReviewedIr(), template = ir.types.find(type => type.kind === "record");
	const named = { kind: "named", id: "lean:Recursive.Link" };
	const p = name => ({ kind: "primitive", name }), a = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
	ir.component = { ...ir.component, id: "linked@1.0.0", name: "linked" };
	ir.types = [{ ...template, id: named.id, name: "Link"
		, fields: Object.entries({
			next: a("option", named), flags: a("array", p("bool"))
			, options: a("array", a("option", p("unit")))
			, outcome: a("result", named, p("unit"))
		}).map(([name, type]) => ({ ...template.fields[0], name, type })) }];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named; ir.declarations[0].result.type = named;
	return ir;
};

test("C++ graph calls validate every argument before constructing views", () => {
	const ir = nativeRecursiveReviewedIr(), snapshot = structuredClone(ir);
	const output = generateCopiedCppGraphConversions(ir);
	assert.deepEqual(ir, snapshot);
	assert.doesNotMatch(output.header, /lean_object|lean_ctor_|lean_alloc_/u);
	const call = output.header.slice(output.header.indexOf(" graph_call_join_trees("));
	assert.ok(call.indexOf("(arg1, 0, true, budget)") < call.indexOf(" view0(arg0)"));
	assert.match(call, /GraphOwned<recursive_tree_t, recursive_tree_t_clear>/u);
	assert.match(output.header, /source\.size\(\) > budget\.nodes/u);
	assert.match(output.header, /depth > 128/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.equal(generateCopiedCppGraphConversions(reversed).header, output.header);
});

test("C++ graph conversions execute bounds, round trips and allocation-failure cleanup", { timeout: 240000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-cpp-graph-conversions-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = nativeRecursiveReviewedIr(), generated = generateCopiedCppGraphConversions(ir);
	for(const [path, content] of Object.entries(boostSources())) await saveLakeFile(directory, path, content);
	await saveLakeFile(directory, "include/recursive-values.hpp", generated.valuesHeader);
	await saveLakeFile(directory, "include/recursive-graph-types.h", generateCopiedCGraphTypes(ir).header);
	await saveLakeFile(directory, "include/recursive-conversions.hpp", generated.header);
	const optional = optionalFixture(), linked = generateCopiedCppGraphConversions(optional);
	await saveLakeFile(directory, "include/linked-values.hpp", linked.valuesHeader);
	await saveLakeFile(directory, "include/linked-graph-types.h", generateCopiedCGraphTypes(optional).header);
	await saveLakeFile(directory, "include/linked-conversions.hpp", linked.header);
	await saveLakeFile(directory, "check.cpp", await readFile("tests/fixtures/structured-types/cpp-graph-check.cpp", "utf8"));
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: directory, timeoutMs: 180000 })
		.catch(error => { throw new Error(error.details?.stderr ?? error.message, { cause: error }); });
	for(const [name, flags] of [["check", ["-Wall", "-Wextra", "-Werror"]], ["check-sanitized", ["-g", "-fsanitize=address,undefined", "-fno-sanitize-recover=all", "-fno-omit-frame-pointer"]]])
	{
		await run("c++", ["-std=c++20", "-O1", ...flags, "-I", "include", "check.cpp", "-o", name]);
		const result = await run(join(directory, name), []);
		assert.match(result.stdout, /^cpp-graphs-ok \d+\n$/u); assert.equal(result.stderr, "");
		t.diagnostic(`${name}: ${result.stdout.trim()}`);
	}
});
