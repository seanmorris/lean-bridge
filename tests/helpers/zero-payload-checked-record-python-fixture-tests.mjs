/**
 * Cheap compiler-model controls for zero-payload checked records in Python.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { auditPythonPackage } from "../../src/backends/python/package-audit.mjs";
import { erasedProofsKey } from "./zero-payload-checked-record-fixture.mjs";
import {
	assertZeroPayloadPythonIdentity, zeroPayloadPythonNativeEvidence
} from "./zero-payload-checked-record-python-wheel.mjs";
import {
	assertZeroPayloadPythonCiTap, parseZeroPayloadPythonCiArgs
	, zeroPayloadPythonCiTestName
} from "./zero-payload-checked-record-python-ci-report.mjs";
import {
	parseZeroPayloadPythonResult, zeroPayloadPythonCaller
	, zeroPayloadPythonCallerArgs, zeroPayloadPythonEnvironment
	, zeroPayloadPythonExecutables, zeroPayloadPythonExpected
	, zeroPayloadPythonMinors, zeroPayloadPythonPackage, zeroPayloadPythonRoutes
	, zeroPayloadPythonSelection, zeroPayloadPythonTarget
} from "./zero-payload-checked-record-python-fixture.mjs";

const run = promisify(execFile);
const inputs = ["witness_count", "absent_count", "token_tag", "marker_count", "mark_count"];
const results = [
	"produce_witness", "produce_token", "witnesses", "maybe_witness"
	, "produce_marker", "produce_mark"
];

test("zero-payload Python selections retain every independent author route", () => {
	assert.equal(zeroPayloadPythonPackage, "lean_zeropayloadcheckedrecords");
	assert.deepEqual(zeroPayloadPythonTarget, {
		name: "zeropayloadcheckedrecords", version: "1.0.0"
	});
	assert.deepEqual(zeroPayloadPythonRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	for(const route of zeroPayloadPythonRoutes)
	{
		const selection = zeroPayloadPythonSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			pypi: zeroPayloadPythonTarget
		});
		assert.deepEqual(selection.configuration.modules, ["ZeroPayloadCheckedRecords"]);
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 6 : 11);
		assert.equal(Object.hasOwn(selection.configuration, "contracts"), !selection.reviewed);
		assert.equal(selection.expected.declarations.length, selection.resultOnly ? 6 : 11);
		assert.deepEqual(selection.expected.types.map(type => type.name)
			, ["Witness", "Token", "Marker", "Mark"]);
		assert.deepEqual(zeroPayloadPythonCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.throws(() => zeroPayloadPythonSelection("ordinary"));
	assert.deepEqual(zeroPayloadPythonEnvironment({}), {
		enabled: false, routes: zeroPayloadPythonRoutes
	});
	assert.deepEqual(zeroPayloadPythonEnvironment({
		LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_ROUTES: "ordinary-source"
	}), { enabled: true, routes: ["ordinary-source"] });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_TEST: "2" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_OUTPUT: "build/out" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PYTHONS: "{}" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_ROUTES: "ordinary-source,ordinary-source" }
	]) assert.throws(() => zeroPayloadPythonEnvironment(environment));
	assert.deepEqual(zeroPayloadPythonExecutables(JSON.stringify({
		"3.11": "/opt/python311", "3.12": "/opt/python312"
	})), { "3.11": "/opt/python311", "3.12": "/opt/python312" });
	for(const value of ["{}", JSON.stringify({ "3.11": "/same", "3.12": "/same" })
		, JSON.stringify({ "3.11": "relative", "3.12": "/opt/python312" })
		, JSON.stringify({ "3.11": "/opt/python311", "3.12": "/opt/python312", "3.13": "/opt/python313" })])
		assert.throws(() => zeroPayloadPythonExecutables(value));
	assert.deepEqual(zeroPayloadPythonMinors, ["3.11", "3.12"]);
});

test("zero-payload Python carriers preserve empty, Unit, Option, array and variant identity", () => {
	for(const route of zeroPayloadPythonRoutes)
	{
		const { expected, resultOnly } = zeroPayloadPythonSelection(route);
		const files = generateCopiedPythonPackage(expected);
		const publicSource = files[`${zeroPayloadPythonPackage}/__init__.py`];
		const nativeSource = files[`${zeroPayloadPythonPackage}/_native.py`];
		const audited = auditPythonPackage(expected, files);
		assert.equal(audited.bindingIrSha256, hashBindingIr(expected));
		assert.match(publicSource, /@_dataclass\(frozen=True, slots=True\)\nclass Witness:\n {4}pass\n/u);
		assert.match(publicSource, /class Token:\n {4}tag: None\n/u);
		assert.match(publicSource, /class Marker:\n {4}pass\n/u);
		assert.match(publicSource, /class MarkBlank:\n {4}kind: _ClassVar\[_Literal\["blank"\]\] = "blank"\n/u);
		assert.match(publicSource, /class MarkMarked:\n {4}kind: _ClassVar\[_Literal\["marked"\]\] = "marked"\n {4}witness: Witness\n/u);
		assert.match(publicSource, /Mark: _TypeAlias = MarkBlank \| MarkMarked/u);
		assert.match(publicSource, /def witnesses\(value0: int\) -> tuple\[Witness, \.\.\.\]:/u);
		assert.match(publicSource, /def maybe_witness\(value0: bool\) -> Option\[Witness\]:/u);
		assert.doesNotMatch(publicSource, /\b(?:positive|fresh)\b/u);
		for(const name of results)
			assert.match(publicSource, new RegExp(`\\ndef ${name}\\(`, "u"));
		for(const name of inputs)
			assert.equal(new RegExp(`\\ndef ${name}\\(`, "u").test(publicSource), !resultOnly, name);
		assert.match(nativeSource, /if type\(value\) is not Witness: raise TypeError\("Expected Witness"\)/u);
		assert.match(nativeSource, /if value is not None: raise TypeError\("Unit requires None"\)/u);
		assert.match(nativeSource, /if type\(value\) is not Some: raise TypeError\("Option requires None or Some\(value\)"\)/u);
		assert.match(nativeSource, /raise TypeError\("Expected a named Mark constructor"\)/u);
		if(!resultOnly)
			assert.match(publicSource, /value0 checked by ZeroPayloadCheckedRecords\.mkAbsent/u);
		const changed = structuredClone(expected);
		changed.types.find(type => type.name === "Witness").source.extensions[erasedProofsKey]
			= { fields: [] };
		assert.notEqual(hashBindingIr(changed), hashBindingIr(expected));
		assert.throws(() => auditPythonPackage(changed, files), { code: "binding-ir-drift" });
		// The declared Token record is admitted; undeclared token machinery is still refused.
		const leaked = { ...files };
		leaked[`${zeroPayloadPythonPackage}/__init__.py`] += "\ndef token(): pass\n";
		assert.throws(() => auditPythonPackage(expected, leaked), error =>
			error.code === "generic-dispatch" && error.details.declaration === "def token");
	}
});

test("zero-payload Python wheel identity rejects changed package and native evidence", () => {
	const model = {
		bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }
		, sourceIdentity: { fixture: true }
	};
	const pkg = {
		target: "pypi", ecosystem: "pypi", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "zeropayloadcheckedrecords", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/zeropayloadcheckedrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl" }]
	};
	const receipt = {
		schemaVersion: 1, kind: "lean-bridge-ordinary-python-package"
		, ecosystem: "pypi", moduleName: zeroPayloadPythonPackage
		, name: pkg.name, version: pkg.version
		, runtimeIdentity: pkg.runtimeIdentity, bindingIrSha256: model.bindingIrSha256
		, component: model.component, sourceIdentity: model.sourceIdentity
		, glibcMinimumVersion: "2.38", tag: "py3-none-manylinux_2_38_x86_64"
	};
	assertZeroPayloadPythonIdentity(receipt, pkg, model, "2.38");
	for(const key of Object.keys(receipt))
		assert.throws(() => assertZeroPayloadPythonIdentity(
			{ ...receipt, [key]: "changed" }, pkg, model, "2.38"));
	for(const key of Object.keys(pkg))
		assert.throws(() => assertZeroPayloadPythonIdentity(
			receipt, { ...pkg, [key]: "changed" }, model, "2.38"));
	assert.throws(() => assertZeroPayloadPythonIdentity(
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
	assert.throws(() => zeroPayloadPythonNativeEvidence({
		runtimeIdentity: "g".repeat(64), bindingIrSha256: component.bindingIrSha256
		, files: {}
	}, component, adapter, runtime));
});

test("zero-payload Python hosted checker closes its route and complete TAP stream", () => {
	const options = {
		route: "ordinary-source", producer: "a".repeat(40), directory: "records"
		, tap: "original.tap", glibc: "2.38"
	};
	const args = Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]);
	assert.deepEqual(parseZeroPayloadPythonCiArgs(args), options);
	const name = zeroPayloadPythonCiTestName(options.route);
	assert.equal(name, "installed zero-payload records reproduce and relocate in Python for ordinary-source");
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
	assertZeroPayloadPythonCiTap(tap, options.route);
	for(const changed of [
		args.slice(2), [...args, "--route", options.route]
		, args.with(1, "ordinary"), args.with(args.indexOf("--glibc") + 1, "latest")
	]) assert.throws(() => parseZeroPayloadPythonCiArgs(changed));
	for(const changed of [tap.replace("# fail 0", "# fail 1")
		, tap.replace("ok 1", "not ok 1"), tap.replace("# skipped 0", "# skipped 1")
		, tap.replace(name, "other")])
		assert.throws(() => assertZeroPayloadPythonCiTap(changed, options.route));
});

test("zero-payload Python workflow retains every route, both floors and failures", async () => {
	const workflow = await readFile(".github/workflows/zero-payload-checked-record-python.yml", "utf8");
	const runner = await readFile("scripts/run-zero-payload-checked-record-python-ci.sh", "utf8");
	const verifyWorkflow = source => {
		assert.ok(source.startsWith("name: Zero-payload checked records in Python\n"));
		for(const required of [
			"on:\n  workflow_dispatch:\n"
			, "runs-on: ubuntu-24.04", "timeout-minutes: 210"
			, "timeout-minutes: 110", "python-version: \"3.11\""
			, "python-version: \"3.12\"", "persist-credentials: false"
			, "bash scripts/run-zero-payload-checked-record-python-ci.sh"
			, "if: always()\n        uses: actions/upload-artifact@v7"
			, "if-no-files-found: error"
			, "if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1"
		]) assert.ok(source.includes(required), required);
		assert.doesNotMatch(source, /continue-on-error:|strategy:|matrix:|needs:/u);
	};
	verifyWorkflow(workflow);
	for(const changed of [
		workflow.replace("workflow_dispatch:\n", "")
		, workflow.replace("persist-credentials: false", "persist-credentials: true")
		, workflow.replace("if-no-files-found: error", "if-no-files-found: warn")
		, workflow.replace("timeout-minutes: 110", "timeout-minutes: 10")
	]) assert.throws(() => verifyWorkflow(changed));
	assert.match(runner, /set -euo pipefail/u);
	assert.match(runner, /ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir/u);
	assert.match(runner, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.38/u);
	assert.match(runner, /--producer "\$revision" --directory "\$output\/records\/\$route"/u);
	assert.match(runner, /--glibc 2\.38/u);
	assert.doesNotMatch(runner, /curl|pip install .*https?:/u);
});

test("zero-payload Python caller keeps source routes, refusals and result-only boundaries independent", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-python-caller-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const caller = await zeroPayloadPythonCaller();
	assert.match(caller, /def check_zero_payload_records\(api/u);
	assert.match(caller, /import lean_zeropayloadcheckedrecords as installed/u);
	assert.match(caller, /was rejected by ZeroPayloadCheckedRecords\.' \+ constructor/u);
	for(const probe of [
		"refuse('absent_count', (Witness(),), 'mkAbsent'"
		, "host_refuse('witness_count', (None,)"
		, "host_refuse('witness_count', (Marker(),)"
		, "host_refuse('mark_count', (MarkMarked(None),)"
		, "invoke('maybe_witness', (False,), None)"
		, "invoke('maybe_witness', (True,), Some(Witness()))"
		, "invoke('witnesses', (0,), ())"
		, "invoke('produce_mark', (True,), MarkMarked(Witness()))"
	]) assert.ok(caller.includes(probe), probe);
	const path = join(root, "caller.py"); await writeFile(path, caller);
	const model = resolve("tests/helpers/zero-payload-checked-record-python-model.py");
	const result = await run(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", [
		"-I", "-B", model, path
	]);
	assert.equal(result.stderr, "");
	const values = JSON.parse(result.stdout);
	assert.deepEqual(values.results, zeroPayloadPythonRoutes.map(route => {
		const expected = { route, ...zeroPayloadPythonExpected(route) };
		assert.deepEqual(parseZeroPayloadPythonResult(
			`${JSON.stringify(zeroPayloadPythonExpected(route))}\n`, route)
			, zeroPayloadPythonExpected(route));
		return expected;
	}));
	assert.deepEqual(values.rejectedFaults, {
		full: ["accept-invalid", "wrong-status", "wrong-message"
			, "wrong-produced", "missing-producer", "option-collapsed"
			, "array-length", "host-accepts-none"]
		, "result-only": ["wrong-produced", "missing-producer"
			, "inputs-exported", "option-collapsed", "array-length"]
	});
	for(const route of zeroPayloadPythonRoutes)
		for(const field of Object.keys(zeroPayloadPythonExpected(route)))
		{
			const changed = { ...zeroPayloadPythonExpected(route) };
			changed[field] += 1;
			assert.throws(() => parseZeroPayloadPythonResult(`${JSON.stringify(changed)}\n`, route));
		}
	assert.throws(() => parseZeroPayloadPythonResult("{}\n", "ordinary-source"));
	assert.throws(() => parseZeroPayloadPythonResult("{}", "ordinary-source"));
	assert.equal(await zeroPayloadPythonCaller(), caller);
});
