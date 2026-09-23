/**
 * Finite Python recursive declarations, runtime annotations and precise stubs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPythonGraphValues } from "../src/backends/python/copied-graph-values.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { recursiveReviewedIr } from "./helpers/recursive-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { pythonTypingWheels } from "./helpers/python-wheel-install.mjs";

const linkedIr = () => {
	const ir = recursiveReviewedIr(), root = { kind: "named", id: "lean:Recursive.Link" };
	const template = ir.types.find(type => type.kind === "record");
	const fields = [
		{ ...template.fields[0], name: "next", type: { kind: "apply", constructor: "option", arguments: [root] } }
		, { ...template.fields[0], name: "value", type: { kind: "primitive", name: "uint32" } }
	];
	ir.types = [{ ...template, id: root.id, name: "Link", fields }];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};
const aliasesIr = () => {
	const ir = recursiveReviewedIr(), base = ir.types.find(type => type.kind === "alias");
	const named = index => ({ kind: "named", id: `lean:Recursive.Alias${index}` });
	ir.types = Array.from({ length: 700 }, (_, index) => ({ ...base
		, id: named(index).id, name: `Alias${index}`
		, target: index ? { kind: "apply", constructor: "tuple", arguments: [named(index - 1), named(index - 1)] } : { kind: "primitive", name: "uint32" } }));
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named(699); ir.declarations[0].result.type = named(699);
	return ir;
};
const fullIr = () => {
	const ir = nativeRecursiveReviewedIr(), alias = ir.types.find(type => type.name === "TreeAlias");
	ir.types.push({ ...alias, id: "lean:Recursive.TreeChain", name: "TreeChain", target: { kind: "named", id: alias.id } });
	return ir;
};

test("Python graph declarations preserve names, exact unions and finite recursive annotations", () => {
	const ir = fullIr(), before = structuredClone(ir), output = generateCopiedPythonGraphValues(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedPythonGraphValues(before), output);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const reordered = generateCopiedPythonGraphValues(reversed);
	assert.equal(reordered.source, output.source); assert.equal(reordered.stub, output.stub);
	for(const source of [output.source, output.stub])
	{
		assert.match(source, /@_dataclass\(frozen=True, slots=True\)\nclass SpineNext:/);
		assert.match(source, /value: Spine/);
		assert.match(source, /Spine: _TypeAlias = SpineNext \| SpineLeaf/);
		assert.match(source, /TreeChain: _TypeAlias = TreeAlias/);
		assert.match(source, /kind: _ClassVar\[_Literal\["next"\]\] = "next"/);
		assert.doesNotMatch(source, /ctypes|Any|c_void_p|lean_object|JSON|constructor_tag/);
	}
	assert.equal(output.types.find(type => type.publicType === "Scalars").fields.length, 19);
	assert.ok(output.exports.includes("Forest")); assert.ok(output.requiresTypeAliases);
	assert.throws(() => compileCopiedPythonModel(ir), /acyclic|recursive/i);
});

test("Python graph declarations reject helper, constructor and escaped field collisions", () => {
	for(const name of ["None", "Some", "list", "SpineNext", "_Graph", "name__private", "spine"])
	{
		const ir = fullIr(); ir.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => generateCopiedPythonGraphValues(ir), /name|identifier|collision/);
	}
	const ir = linkedIr(); ir.types[0].fields[0].name = "from"; ir.types[0].fields[1].name = "from_";
	assert.throws(() => generateCopiedPythonGraphValues(ir), /field name collides|duplicate C field/);
	const variant = fullIr(), branch = variant.types.find(type => type.name === "Tree").cases[0];
	branch.name = "from"; branch.fields[0].name = "from";
	const output = generateCopiedPythonGraphValues(variant);
	assert.match(output.stub, /class TreeFrom:/); assert.match(output.stub, /from_: _Input/);
	branch.fields[0].name = "kind";
	assert.throws(() => generateCopiedPythonGraphValues(variant), /invalid or duplicate field name/);
});

test("Python shared structural aliases retain bounded source rather than expanding a type tree", () => {
	const output = generateCopiedPythonGraphValues(aliasesIr());
	assert.equal(output.types.length, 700); assert.ok(output.source.length < 250000);
	assert.match(output.source, /Alias699: _TypeAlias = _Value\d+/);
	assert.doesNotMatch(output.stub, /TypeAliasType/);
	const linked = generateCopiedPythonGraphValues(linkedIr());
	assert.match(linked.stub, /next: _Input\d+/); assert.match(linked.stub, /Option\[Link\]/);
});

test("Python recursive values execute and typecheck on standard and backported alias runtimes", {
	skip: process.env.LEAN_BRIDGE_PYTHON_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-python-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	const checkerVersion = (await runCopied(checker, ["-I", "-m", "mypy", "--version"], root)).stdout.trim();
	assert.match(checkerVersion, /^mypy 2\.3\.1\b/);
	const generated = { values: generateCopiedPythonGraphValues(fullIr()), linked_values: generateCopiedPythonGraphValues(linkedIr()), deep_values: generateCopiedPythonGraphValues(aliasesIr()) };
	const probes = Object.fromEntries(await Promise.all(["", "-typed", "-invalid"].map(async suffix => [suffix, await readFile(`tests/fixtures/structured-types/recursive-values${suffix}.py`, "utf8")])));
	const reports = [];
	for(const [name, interpreter, typing] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const directory = join(root, name), command = join(directory, "venv/bin/python");
		await saveLakeFile(directory, "probe.py", probes[""]);
		await runCopied(interpreter, ["-I", "-m", "venv", join(directory, "venv")], directory);
		if(typing)
		{
			const wheel = resolve(process.env.LEAN_BRIDGE_PYTHON_TYPING_WHEELS ?? "build/python-typing-wheels", typing, `typing_extensions-${typing}-py3-none-any.whl`);
			assert.equal(sha256(await readFile(wheel)), pythonTypingWheels[typing]);
			await runCopied(command, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-cache-dir", "--no-compile", wheel], directory);
		}
		const site = (await runCopied(command, ["-I", "-c", 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], directory)).stdout.trim();
		assert.ok(site.startsWith(`${directory}/venv/`));
		for(const [module, values] of Object.entries(generated))
		{
			await saveLakeFile(site, `${module}/__init__.py`, values.source);
			await saveLakeFile(site, `${module}/__init__.pyi`, values.stub);
			await saveLakeFile(site, `${module}/py.typed`, "");
		}
		for(const suffix of ["-typed", "-invalid"]) await saveLakeFile(directory, `${suffix.slice(1)}.py`, probes[suffix]);
		const result = await runCopied(command, ["-I", "-B", "probe.py", typing ?? "standard"], directory);
		assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout);
		assert.equal(report.checks, 54); assert.ok(report.python.startsWith(name.slice(0, 4) + "."));
		const check = file => runCopied(checker, ["-I", "-c"
			, 'import resource, runpy, sys; resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3)); sys.argv = ["mypy", *sys.argv[1:]]; runpy.run_module("mypy", run_name="__main__")'
			, "--strict", "--no-incremental", "--cache-dir=/dev/null"
			, "--python-executable", command, file], directory);
		const checked = await check("typed.py");
		assert.equal(checked.stderr, ""); assert.equal(checked.stdout.trim(), "Success: no issues found in 1 source file");
		await assert.rejects(() => check("invalid.py"), error => {
			assert.equal(error.details.stderr, ""); assert.match(error.details.stdout, /Found 10 errors in 1 file/);
			assert.equal(error.details.stdout.split("\n").filter(line => /^invalid\.py:\d+: error:/.test(line)).length, 10);
			assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/); return true;
		});
		await runCopied(command, ["-I", "-B", "typed.py"], directory);
		reports.push({ name, ...report, typing, typedExecuted: true, rejectedCalls: 10 });
		await rm(directory, { recursive: true, force: true });
	}
	await saveLakeFile("build/recursive", "python-values.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false, installedPackage: false, checkerVersion, reports
		, sourceHashes: Object.fromEntries(Object.entries(generated).flatMap(([name, values]) => [[`${name}.py`, sha256(values.source)], [`${name}.pyi`, sha256(values.stub)]]))
		, probeHashes: Object.fromEntries(Object.entries(probes).map(([suffix, text]) => [`recursive-values${suffix}.py`, sha256(text)])) }));
});

test("Python graph declaration acceptance remains required in downstream CI", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_GRAPH_TEST=1 node --test tests/python-copied-graph-values.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/python-values.json"));
	assert.ok(workflow.includes("            build/recursive/python-values.json\n"));
});
