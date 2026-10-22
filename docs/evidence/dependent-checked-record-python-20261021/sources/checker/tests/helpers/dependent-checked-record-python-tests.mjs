/**
 * Static controls for dependent checked-record Python package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { auditPythonPackage } from "../../src/backends/python/package-audit.mjs";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	assertDependentCheckedRecordPythonCiTap
	, dependentCheckedRecordPythonCiTestName
	, parseDependentCheckedRecordPythonCiArgs
} from "./dependent-checked-record-python-ci-report.mjs";
import {
	dependentCheckedRecordPythonCaller
	, dependentCheckedRecordPythonCallerArgs
	, dependentCheckedRecordPythonExecutables
	, dependentCheckedRecordPythonExpected
	, dependentCheckedRecordPythonMinors
	, dependentCheckedRecordPythonPackage
	, dependentCheckedRecordPythonRoutes
	, dependentCheckedRecordPythonRunSelection
	, dependentCheckedRecordPythonSelection
	, dependentCheckedRecordPythonTarget
	, parseDependentCheckedRecordPythonResult
} from "./dependent-checked-record-python-fixture.mjs";
import {
	assertDependentCheckedRecordPythonIdentity
	, dependentCheckedRecordPythonNativeEvidence
} from "./dependent-checked-record-python-wheel.mjs";

const run = promisify(execFile);

test("dependent Python selections close all four author and API routes", () => {
	assert.equal(dependentCheckedRecordPythonPackage, "lean_dependentrecords");
	assert.deepEqual(dependentCheckedRecordPythonTarget, {
		name: "dependentrecords", version: "1.0.0"
	});
	assert.deepEqual(dependentCheckedRecordPythonRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	for(const route of dependentCheckedRecordPythonRoutes)
	{
		const selection = dependentCheckedRecordPythonSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			pypi: dependentCheckedRecordPythonTarget
		});
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.deepEqual(dependentCheckedRecordPythonCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.throws(() => dependentCheckedRecordPythonSelection("ordinary"));
	assert.deepEqual(dependentCheckedRecordPythonRunSelection({}), {
		enabled: false, routes: dependentCheckedRecordPythonRoutes
	});
	assert.deepEqual(dependentCheckedRecordPythonRunSelection({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_ROUTES: "ordinary-source"
	}), { enabled: true, routes: ["ordinary-source"] });
	for(const environment of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "2" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_ROUTES:
				"ordinary-source,ordinary-source" }
	]) assert.throws(() => dependentCheckedRecordPythonRunSelection(environment));
	assert.deepEqual(dependentCheckedRecordPythonExecutables(JSON.stringify({
		"3.11": "/opt/python311", "3.12": "/opt/python312"
	})), { "3.11": "/opt/python311", "3.12": "/opt/python312" });
	for(const value of ["{}"
		, JSON.stringify({
		"3.11": "/same", "3.12": "/same"
		})
		, JSON.stringify({
		"3.11": "relative", "3.12": "/opt/python312"
		})
	]) assert.throws(() => dependentCheckedRecordPythonExecutables(value));
	assert.deepEqual(dependentCheckedRecordPythonMinors, ["3.11", "3.12"]);
});

test("dependent Python generation retains erased proof and dynamic field dependency", () => {
	for(const route of dependentCheckedRecordPythonRoutes)
	{
		const { expected, resultOnly } = dependentCheckedRecordPythonSelection(route);
		assert.equal(expected.types.length, 1);
		assert.deepEqual(expected.types[0].source.extensions, {
			"lean-lang.org/erased-proofs": { fields: ["valid"] }
			, "lean-lang.org/nominal-refinements": {
				kind: "record", fields: [null, { kind: "fin-field", field: "bound" }]
			}
		});
		assert.deepEqual(expected.declarations.map(item => item.name)
			, resultOnly ? ["dependentResult"]
				: ["dependentTotal", "dependentRoundtrip", "dependentResult"]);
		const files = generateCopiedPythonPackage(expected);
		const publicSource = files[`${dependentCheckedRecordPythonPackage}/__init__.py`];
		const nativeSource = files[`${dependentCheckedRecordPythonPackage}/_native.py`];
		assert.equal(auditPythonPackage(expected, files).bindingIrSha256
			, hashBindingIr(expected));
		assert.match(publicSource, /class Dependent:/u);
		assert.match(publicSource, /bound: int/u);
		assert.match(publicSource, /below: int/u);
		assert.match(nativeSource, /_check\(_fn0\(/u);
		if(resultOnly) assert.doesNotMatch(publicSource, /def dependent_total\(/u);
		else assert.match(publicSource, /def dependent_total\(/u);
	}
});

test("dependent Python wheel identity rejects substituted package evidence", () => {
	const model = {
		bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }
		, sourceIdentity: { fixture: true }
	};
	const pkg = {
		target: "pypi", ecosystem: "pypi", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "dependentrecords", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path:
			"archives/dependentrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl" }]
	};
	const receipt = {
		schemaVersion: 1, kind: "lean-bridge-ordinary-python-package"
		, ecosystem: "pypi", moduleName: dependentCheckedRecordPythonPackage
		, name: pkg.name, version: pkg.version
		, runtimeIdentity: pkg.runtimeIdentity, bindingIrSha256: model.bindingIrSha256
		, component: model.component, sourceIdentity: model.sourceIdentity
		, glibcMinimumVersion: "2.38", tag: "py3-none-manylinux_2_38_x86_64"
	};
	assertDependentCheckedRecordPythonIdentity(receipt, pkg, model, "2.38");
	for(const key of Object.keys(receipt))
		assert.throws(() => assertDependentCheckedRecordPythonIdentity(
			{ ...receipt, [key]: "changed" }, pkg, model, "2.38"));
	assert.throws(() => assertDependentCheckedRecordPythonIdentity(
		receipt, { ...pkg, artifacts: [] }, model, "2.38"));
	const runtime = { files: {}, value: 1 };
	const component = {
		runtimeIdentity: "c".repeat(64), bindingIrSha256: "d".repeat(64)
		, library: "component.so", nativeLibrary: { sha256: "e".repeat(64) }
	};
	const adapter = {
		runtimeIdentity: component.runtimeIdentity
		, bindingIrSha256: component.bindingIrSha256
		, componentReceiptSha256: "h".repeat(64), library: "adapter.so"
		, files: { "lib/adapter.so": { sha256: "f".repeat(64) } }
	};
	assert.throws(() => dependentCheckedRecordPythonNativeEvidence({
		runtimeIdentity: "g".repeat(64), bindingIrSha256: component.bindingIrSha256
		, files: {}
	}, component, adapter, runtime));
});

test("dependent Python hosted checker binds one complete original TAP route", () => {
	const options = {
		route: "ordinary-source", producer: "a".repeat(40), directory: "records"
		, tap: "original.tap", glibc: "2.38"
	};
	const args = Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]);
	assert.deepEqual(parseDependentCheckedRecordPythonCiArgs(args), options);
	const name = dependentCheckedRecordPythonCiTestName(options.route);
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
	assert.doesNotThrow(() => assertDependentCheckedRecordPythonCiTap(
		tap, options.route));
	for(const changed of [tap.replace("# fail 0", "# fail 1")
		, tap.replace("ok 1", "not ok 1")
		, tap.replace("# skipped 0", "# skipped 1")])
		assert.throws(() => assertDependentCheckedRecordPythonCiTap(
			changed, options.route));
});

test("dependent Python workflow preserves all routes, floors and failures", async () => {
	const workflow = await readFile(
		".github/workflows/dependent-checked-record-python.yml", "utf8");
	const runner = await readFile(
		"scripts/run-dependent-checked-record-python-ci.sh", "utf8");
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "runs-on: ubuntu-24.04", "timeout-minutes: 210"
		, "python-version: \"3.11\"", "python-version: \"3.12\""
		, "persist-credentials: false"
		, "bash scripts/run-dependent-checked-record-python-ci.sh"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if-no-files-found: error"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
	assert.doesNotMatch(workflow, /continue-on-error:|strategy:|matrix:|needs:/u);
	for(const route of dependentCheckedRecordPythonRoutes)
		assert.ok(runner.includes(route), route);
	for(const required of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST=1"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-dependent-checked-record-python-ci.mjs"
	]) assert.ok(runner.includes(required), required);
	assert.doesNotMatch(runner, /curl|pip install .*https?:/u);
});

test("dependent Python caller enforces results, refusals and recovery independently", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-checked-record-python-caller-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const caller = await dependentCheckedRecordPythonCaller();
	assert.match(caller, /def check_dependent_records\(api/u);
	assert.match(caller, /import lean_dependentrecords as installed/u);
	assert.match(caller, /1 << 130/u);
	const path = join(root, "caller.py"); await writeFile(path, caller);
	const model = resolve("tests/helpers/dependent-checked-record-python-model.py");
	const result = await run(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", [
		"-I", "-B", model, path
	]);
	assert.equal(result.stderr, "");
	const values = JSON.parse(result.stdout);
	assert.deepEqual(values.results, dependentCheckedRecordPythonRoutes.map(route => ({
		route, ...dependentCheckedRecordPythonExpected(route)
	})));
	assert.deepEqual(values.rejectedFaults, {
		full: ["accept-invalid", "wrong-status", "wrong-message", "mutate-input"
			, "wrong-produced", "wrong-roundtrip", "missing-producer"]
		, "result-only": ["wrong-produced", "missing-producer", "inputs-exported"]
	});
	for(const route of dependentCheckedRecordPythonRoutes)
		assert.deepEqual(parseDependentCheckedRecordPythonResult(
			`${JSON.stringify(dependentCheckedRecordPythonExpected(route))}\n`, route)
			, dependentCheckedRecordPythonExpected(route));
	assert.throws(() => parseDependentCheckedRecordPythonResult(
		"{}\n", "ordinary-source"));
	assert.equal(await dependentCheckedRecordPythonCaller(), caller);
});

test("dependent Python installed gate refuses ambient or partial selections", () => {
	const base = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith(
			"LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_"
		) && key !== "NODE_TEST_CONTEXT"));
	const invoke = changes => spawnSync(process.execPath, [
		"--test", "--test-reporter=tap"
		, "tests/helpers/dependent-checked-record-python-installed-tests.mjs"
	], { env: { ...base, ...changes }, encoding: "utf8", timeout: 15_000 });
	const disabled = invoke({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "0"
	});
	assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
	assert.match(disabled.stdout, /# skipped 4/u);
	for(const changes of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "0"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_ROUTES: "ordinary" }
	]) {
		const result = invoke(changes);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.doesNotMatch(result.stdout, /dependent checked-record Python author/u);
	}
});
