/**
 * Python List containers retain semantic identities, typed APIs and admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { generatePythonBindingPackage } from "../src/backends/python/generate.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test("Python List evidence binds both installed wheels to independent signatures and consumers", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/python-lists-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(evidence.signatures), sort(listSignatures));
	assert.deepEqual(evidence.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of evidence.runs)
	{
		assert.equal(run.profile, "python"); assert.equal(run.checks, 78423);
		assert.deepEqual(sort(run.signatures), sort(listSignatures));
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/list-consumers/python.py")));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, "pypi");
		assert.equal(run.packages[0].artifacts.length, 1);
		assert.match(run.packages[0].artifacts[0].path, /\.whl$/);
		assert.match(run.packages[0].artifacts[0].sha256, /^[a-f0-9]{64}$/);
	}
});

test("Python Lists preserve distinct List/Array identities and precise copied signatures", () => {
	const ir = listReviewedIr(), model = compileCopiedPythonModel(ir), files = generateCopiedPythonPackage(ir);
	assert.equal(model.surface.functions.length, 27);
	assert.deepEqual(files, generateCopiedPythonPackage(structuredClone(ir)));
	assert.deepEqual(files, generatePythonBindingPackage(ir));
	assert.equal(auditPythonPackage(ir, files).exports.length, 34);
	const stub = files["lean_lists/__init__.pyi"], native = files["lean_lists/_native.py"];
	assert.match(stub, /def reverse_uint32\(value0: _Array\d+\) -> tuple\[int, \.\.\.\]:/);
	assert.match(stub, /_Array\d+ = tuple\[int, \.\.\.\] \| list\[int\]/);
	assert.match(stub, /def swap\(value0: Result\[tuple\[_Array\d+, _Array\d+\], _Array\d+\]\) -> Result\[tuple\[str, \.\.\.\], tuple\[tuple\[int, \.\.\.\], tuple\[int, \.\.\.\]\]\]:/);
	assert.doesNotMatch(stub, /ctypes|Any|c_void_p|constructor_tag/);
	assert.match(native, /if type\(value\) not in \(tuple, list\)/);
	assert.match(native, /scope\.charge\(len\(value\), 8\)/);
	assert.match(native, /finally:\n {8}try:\n {12}_clear/);
	const word = { kind: "primitive", name: "uint32" };
	const list = model.surface.copy({ kind: "apply", constructor: "list", arguments: [word] });
	const array = model.surface.copy({ kind: "apply", constructor: "array", arguments: [word] });
	assert.notEqual(list.name, array.name); assert.notEqual(list.ctype, array.ctype);
	assert.equal(list.publicType, array.publicType);
	assert.match(files["README.md"], /Lean List values accept exact Python lists or tuples/);
});

test("Python Lists reject callbacks, borrowed ownership and source-name collisions", () => {
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		const list = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "uint32" }] };
		if(position === "parameter") callback.callable.parameters[0].type = list;
		else callback.callable.result.type = list;
		assert.throws(() => compileCopiedPythonModel(ir), /callbacks currently require copied primitive/);
	}
	const borrowed = listReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedPythonModel(borrowed), /copy ownership/);
	const collision = listReviewedIr(); collision.types[0].name = "list";
	assert.throws(() => compileCopiedPythonModel(collision), /record name collides/);
});
