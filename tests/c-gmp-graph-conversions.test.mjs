/**
 * Execute real GMP values across the finite native copied graph boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCopiedGmpGraphConversions } from "../src/backends/c/gmp-graph-conversions.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const linkedFixture = () => {
	const ir = nativeRecursiveReviewedIr(), record = ir.types.find(type => type.kind === "record"), alias = ir.types.find(type => type.kind === "alias");
	const p = name => ({ kind: "primitive", name }), a = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
	const n = name => ({ kind: "named", id: `lean:Recursive.${name}` });
	ir.component = { ...ir.component, id: "linked@1.0.0", name: "linked" };
	ir.types = [{ ...record, id: n("Link").id, name: "Link"
		, fields: Object.entries({ next: a("option", n("Link")), flags: a("array", p("bool")), values: a("array", p("nat")), outcome: a("result", n("Link"), p("int")) })
			.map(([name, type]) => ({ ...record.fields[0], name, type })) }
	, { ...alias, id: n("Exact").id, name: "Exact", target: p("nat") }];
	const template = ir.declarations[0];
	ir.declarations = [n("Link"), p("nat"), p("int")].map((type, index) => ({ ...structuredClone(template)
		, id: `lean:Recursive.${["tree", "natural", "integer"][index]}`
		, name: ["tree", "natural", "integer"][index]
		, overloadKey: ["tree", "natural", "integer"][index]
		, parameters: [{ ...template.parameters[0], type }]
		, result: { ...template.result, type } }));
	return ir;
};

test("C/GMP graph calls preflight all arguments without mutating the private ABI", () => {
	const ir = nativeRecursiveReviewedIr(), snapshot = structuredClone(ir), raw = generateCopiedCGraphTypes(ir);
	const output = generateCopiedGmpGraphConversions(ir);
	assert.deepEqual(ir, snapshot); assert.deepEqual(raw, generateCopiedCGraphTypes(ir));
	assert.doesNotMatch(output.header, /lean_object|lean_ctor_|lean_alloc_/u);
	assert.match(output.valuesHeader, /typedef mpz_t recursive_gmp_scalar_nat_t/u);
	assert.match(output.valuesHeader, /void \(\*_bridge_release\)\(void \*owner, void \*root\)/u);
	const call = output.header.slice(output.header.indexOf(" recursive_join_trees_gmp_graph("));
	assert.ok(call.indexOf("_check(a1, 0, 1, &budget)") < call.indexOf("_to(a0, &view0, &views)"));
	assert.match(output.header, /depth > 128/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.equal(generateCopiedGmpGraphConversions(reversed).header, output.header);
	assert.match(generateCopiedGmpGraphConversions(ir, { lifecycle: true }).header, /if \(status == 4\) lean_bridge_native_runtime_retire\(\)/u);
	const collision = structuredClone(ir), alias = collision.types.find(node => node.kind === "alias");
	alias.name = "GmpScalars";
	assert.throws(() => generateCopiedGmpGraphConversions(collision), /C\/GMP graph identifier collision: recursive_gmp_scalars_t/u);
});

test("C/GMP graph conversions preserve exact values and clean up every partial owner", { timeout: 240000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-gmp-graph-conversions-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = nativeRecursiveReviewedIr(), linked = linkedFixture();
	const aliases = [];
	for(const input of [ir, linked])
	{
		const generated = generateCopiedGmpGraphConversions(input), p = generated.layout.prefix;
		await saveLakeFile(directory, `${p}-gmp-graph-values.h`, generated.valuesHeader);
		await saveLakeFile(directory, `${p}-graph-types.h`, generateCopiedCGraphTypes(input).header);
		await saveLakeFile(directory, `${p}-gmp-conversions.h`, generated.header);
		const type = id => generated.types.find(node => node.id === id);
		for(const node of generated.types.filter(node => ["lean:Recursive.Link", "lean:Recursive.Envelope"].includes(node.ref.id)))
			for(const field of node.fields) aliases.push(`#define ${p.toUpperCase()}_${field.name.toUpperCase()} ${type(field.type).name}`);
		for(const root of generated.layout.roots)
		{
			const result = type(root.result);
			aliases.push(`#define ${root.name.toUpperCase()}_RESULT ${result.name}`
				, `#define ${root.name.toUpperCase()}_RAW ${generated.layout.nodes.find(node => node.id === root.result).name}`);
		}
	}
	await saveLakeFile(directory, "test-types.h", `${aliases.join("\n")}\n`);
	await saveLakeFile(directory, "check.c", await readFile("tests/fixtures/structured-types/gmp-graph-check.c", "utf8"));
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: directory, timeoutMs: 180000 })
		.catch(error => { throw new Error(error.details?.stderr ?? error.message, { cause: error }); });
	for(const [name, flags] of [["check", ["-Wall", "-Wextra", "-Werror"]], ["check-sanitized", ["-g", "-fsanitize=address,undefined", "-fno-sanitize-recover=all", "-fno-omit-frame-pointer"]]])
	{
		await run("cc", ["-std=c11", "-O1", ...flags, "check.c", "-lgmp", "-o", name]);
		const result = await run(join(directory, name), []);
		assert.match(result.stdout, /^gmp-graphs-ok \d+\n$/u); assert.equal(result.stderr, "");
		t.diagnostic(`${name}: ${result.stdout.trim()}`);
	}
});
