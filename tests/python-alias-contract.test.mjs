/**
 * Public Python aliases preserve named copied types without runtime wrappers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { aliasPrimitives, nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";

test("Python alias evidence binds offline installed wheels, relocated values and strict stubs", async () => {
	const record = JSON.parse(await readFile("docs/evidence/python-aliases-20260921.json"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeAliasReviewedIr())));
	assert.deepEqual(record.signatures, nativeAliasSignatures);
	assert.deepEqual(record.primitives, aliasPrimitives);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.runs.map(run => `${run.path}/${run.profile}`), ["ordinary-source/python", "reviewed-ir/python"]);
	for(const run of record.runs)
	{
		assert.equal(run.checks, 4460);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/alias-consumers/python.py")));
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"])
			assert.equal(run[flag], true, `${run.path}/${flag}`);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "installedFilesSha256"])
			assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.match(run.strictTypecheck.version, /^mypy 1\.17\.1\b/);
		assert.equal(run.strictTypecheck.repeatedAfterRelocation, true);
		assert.equal(run.strictTypecheck.rejectedCalls, 8);
		assert.equal(run.strictTypecheck.sourceSha256, sha256(await readFile("tests/fixtures/alias-consumers/python-typed.py")));
		assert.equal(run.strictTypecheck.rejectionSourceSha256, sha256(await readFile("tests/fixtures/alias-consumers/python-invalid.py")));
		assert.equal(run.packages.length, 1);
		const [pkg] = run.packages;
		assert.equal(pkg.target, "pypi"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/aliases_api-1.0.0-py3-none-manylinux_2_36_x86_64.whl");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/);
		assert.ok(pkg.artifacts[0].bytes > 0);
		assert.equal(Object.keys(run.nativeLibraries).length, 4);
		for(const file of Object.values(run.nativeLibraries))
		{ assert.ok(file.bytes > 0); assert.match(file.sha256, /^[a-f0-9]{64}$/); }
	}
	assert.deepEqual(record.runs[0].nativeLibraries, record.runs[1].nativeLibraries);
});

test("Python alias installed evidence promotes only six copied positions and runs in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("python-aliases-installed"));
	assert.equal(observed.length, 6);
	for(const cell of observed)
	{
		assert.equal(cell.shape, "alias"); assert.equal(cell.profile, "python");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["python-aliases-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /mypy==1\.17\.1/);
	assert.match(workflow, /LEAN_BRIDGE_PYTHON_ALIAS_TEST=1 node --test tests\/python-aliases.test.mjs/);
	assert.match(workflow, /test -s build\/aliases\/python.json/);
	assert.match(workflow, /path: \|[^]*?build\/aliases\/python.json/);
});

test("Python exports named aliases in source, stubs, signatures and copied fields", () => {
	const ir = nativeAliasReviewedIr(), files = generateCopiedPythonPackage(ir);
	const names = auditPythonPackage(ir, files).exports;
	for(const type of ir.types.filter(type => type.kind === "alias"))
	{
		assert.ok(names.includes(type.name), type.name);
		for(const suffix of ["py", "pyi"])
			assert.ok(files[`lean_aliases/__init__.${suffix}`].includes(`${type.name}: _TypeAlias = `), type.name);
	}
	const stub = files["lean_aliases/__init__.pyi"];
	assert.match(stub, /AUnit: _TypeAlias = None/);
	assert.match(stub, /ANat: _TypeAlias = int/);
	assert.match(stub, /ScalarsView: _TypeAlias = Scalars/);
	assert.match(stub, /Rows: _TypeAlias = tuple\[tuple\[int, \.\.\.\], \.\.\.\]/);
	assert.match(stub, /v_uint32: AU32/);
	assert.match(stub, /def increment\(value0: Count\) -> OtherCount:/);
	assert.match(stub, /def reverse_rows\(value0: Rows \| _Array\d+\) -> Rows:/);
	assert.doesNotMatch(stub, /NewType|ctypes|Any|c_void_p/);
});

test("Python aliases cannot shadow builtins, records, functions or compound helpers", () => {
	for(const name of ["list", "int", "None", "Some", "Option", "Ok", "Result", "Scalars", "increment", "LeanBridgeError"])
	{
		const ir = nativeAliasReviewedIr(); ir.types.find(type => type.name === "Count").name = name;
		assert.throws(() => compileCopiedPythonModel(ir), /alias.*colli|collision/i, name);
	}
});
