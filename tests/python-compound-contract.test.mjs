/**
 * Closed Python compound admission and precise public/generated signatures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { generatePythonBindingPackage } from "../src/backends/python/generate.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { assertCompoundSourceHash } from "./helpers/compound-source-history.mjs";

test("Python compound evidence binds both installed wheels to independent signatures and consumers", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/python-compounds-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(evidence.signatures), sort(compoundSignatures));
	assert.deepEqual(evidence.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of evidence.runs)
	{
		assert.equal(run.profile, "python"); assert.equal(run.checks, 11293);
		assertCompoundSourceHash("tests/fixtures/compound-consumers/python.py", await readFile("tests/fixtures/compound-consumers/python.py"), run.consumerSha256);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, "pypi");
		for(const artifact of run.packages[0].artifacts) assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
	}
});

test("Python compounds emit lossless variants, binary products and typed nested containers", () => {
	const ir = compoundReviewedIr(), model = compileCopiedPythonModel(ir), files = generateCopiedPythonPackage(ir);
	assert.equal(model.surface.functions.length, 64);
	assert.deepEqual(files, generateCopiedPythonPackage(structuredClone(ir)));
	assert.deepEqual(files, generatePythonBindingPackage(ir));
	assert.equal(auditPythonPackage(ir, files).exports.length, 71);
	const stub = files["lean_compounds/__init__.pyi"], native = files["lean_compounds/_native.py"];
	assert.match(stub, /Option = Some\[_T\] \| None/);
	assert.match(stub, /Result = Ok\[_T\] \| Err\[_E\]/);
	assert.match(stub, /def classify\(value0: Option\[Option\[None\]\]\) -> int:/);
	assert.match(stub, /def flip\(value0: Result\[tuple\[int, Option\[None\]\], Option\[str\]\]\) -> Result\[Option\[str\], tuple\[int, Option\[None\]\]\]:/);
	assert.doesNotMatch(stub, /ctypes|Any|c_void_p|constructor_tag/);
	assert.match(native, /if type\(value\) is not Some:/);
	assert.match(native, /if value.has_value > 1:/);
	assert.match(native, /if value.is_ok > 1:/);
	assert.match(native, /Prod requires exactly two elements/);
	assert.match(native, /finally:\n {8}try:\n {12}_clear/);
});

for(const name of ["Some", "Option", "Ok", "Err", "Result"])
	test(`Python compound constructor name ${name} cannot collide with a record`, () => {
		const record = compoundReviewedIr(); record.types.find(type => type.kind === "record").name = name;
		assert.throws(() => compileCopiedPythonModel(record), /record name collides/);
	});

test("Python compounds do not enable identity-bearing or callable containers", () => {
	const ir = callableReviewedIr();
	ir.types[0].callable.result.type = { kind: "apply", constructor: "option", arguments: [{ kind: "primitive", name: "unit" }] };
	assert.throws(() => compileCopiedPythonModel(ir), /callbacks currently require copied primitive/);
	const nested = compoundReviewedIr();
	nested.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedPythonModel(nested), /copy ownership/);
});
