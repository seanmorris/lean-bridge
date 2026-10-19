/**
 * Cheap compiler-model controls for Python value-index checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { auditPythonPackage } from "../../src/backends/python/package-audit.mjs";
import {
	checkedRecordValueIndexPythonPackage, checkedRecordValueIndexPythonRoutes
	, checkedRecordValueIndexPythonCaller, checkedRecordValueIndexPythonCallerArgs
	, checkedRecordValueIndexPythonExpected, parseCheckedRecordValueIndexPythonResult
	, checkedRecordValueIndexPythonExecutables, checkedRecordValueIndexPythonMinors
	, checkedRecordValueIndexPythonRunSelection, checkedRecordValueIndexPythonSelection
	, checkedRecordValueIndexPythonTarget
} from "./checked-record-value-index-python-fixture.mjs";

const run = promisify(execFile);

const instantiation = "lean-lang.org/instantiation";
const erasedProofs = "lean-lang.org/erased-proofs";
const expectedIndices = Object.freeze({
	On: ["Flagged", [{ kind: "value", type: { kind: "primitive", name: "bool" }, value: "true" }]]
	, Off: ["Flagged", [{ kind: "value", type: { kind: "primitive", name: "bool" }, value: "false" }]]
	, Ab: ["Labeled", [{ kind: "value", type: { kind: "primitive", name: "string" }, value: "ab" }]]
	, EmptySized: ["Sized", [{ kind: "value", type: { kind: "primitive", name: "nat" }, value: "0" }]]
	, ZeroToken: ["Token", [
		{ kind: "primitive", name: "nat" }
		, { kind: "value", type: { kind: "primitive", name: "nat" }, value: "0" }
	]]
	, WideToken: ["Token", [
		{ kind: "primitive", name: "nat" }
		, { kind: "value", type: { kind: "primitive", name: "nat" }, value: "340282366920938463463374607431768211457" }
	]]
	, EmptyToken: ["Token", [
		{ kind: "primitive", name: "string" }
		, { kind: "value", type: { kind: "primitive", name: "string" }, value: "" }
	]]
	, UnicodeToken: ["Token", [
		{ kind: "primitive", name: "string" }
		, { kind: "value", type: { kind: "primitive", name: "string" }, value: "λ🌱" }
	]]
});

test("value-index Python selections retain every independent author route", () => {
	assert.equal(checkedRecordValueIndexPythonPackage, "lean_checkedrecordvalueindices");
	assert.deepEqual(checkedRecordValueIndexPythonTarget, {
		name: "checkedrecordvalueindices", version: "1.0.0"
	});
	assert.deepEqual(checkedRecordValueIndexPythonRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	for(const route of checkedRecordValueIndexPythonRoutes)
	{
		const selection = checkedRecordValueIndexPythonSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			pypi: checkedRecordValueIndexPythonTarget
		});
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.deepEqual(checkedRecordValueIndexPythonCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.throws(() => checkedRecordValueIndexPythonSelection("ordinary"));
	assert.deepEqual(checkedRecordValueIndexPythonRunSelection({}), {
		enabled: false, routes: checkedRecordValueIndexPythonRoutes
	});
	assert.deepEqual(checkedRecordValueIndexPythonRunSelection({
		LEAN_BRIDGE_VALUE_INDEX_PYTHON_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_PYTHON_ROUTES: "ordinary-source"
	}), { enabled: true, routes: ["ordinary-source"] });
	for(const environment of [
		{ LEAN_BRIDGE_VALUE_INDEX_PYTHON_TEST: "2" }
		, { LEAN_BRIDGE_VALUE_INDEX_PYTHON_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_VALUE_INDEX_PYTHON_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_PYTHON_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_VALUE_INDEX_PYTHON_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_PYTHON_ROUTES: "ordinary-source,ordinary-source" }
	]) assert.throws(() => checkedRecordValueIndexPythonRunSelection(environment));
	assert.deepEqual(checkedRecordValueIndexPythonExecutables(JSON.stringify({
		"3.11": "/opt/python311", "3.12": "/opt/python312"
	})), { "3.11": "/opt/python311", "3.12": "/opt/python312" });
	for(const value of ["{}", JSON.stringify({ "3.11": "/same", "3.12": "/same" })
		, JSON.stringify({ "3.11": "relative", "3.12": "/opt/python312" })])
		assert.throws(() => checkedRecordValueIndexPythonExecutables(value));
	assert.deepEqual(checkedRecordValueIndexPythonMinors, ["3.11", "3.12"]);
});

test("Python copied bindings retain closed value-index provenance in their authenticated IR", () => {
	for(const route of checkedRecordValueIndexPythonRoutes)
	{
		const { expected, resultOnly } = checkedRecordValueIndexPythonSelection(route);
		assert.equal(expected.types.length, Object.keys(expectedIndices).length);
		assert.equal(expected.declarations.length, resultOnly ? 8 : 16);
		for(const definition of expected.types)
		{
			const [structure, arguments_] = expectedIndices[definition.name];
			assert.deepEqual(definition.source.extensions[instantiation], {
				structure: `CheckedRecordValueIndices.${structure}`
				, arguments: arguments_
			});
			assert.ok(Array.isArray(definition.source.extensions[erasedProofs].fields));
		}
	}
});

test("Python copied bindings generate every checked-record value-index surface and bind its IR", () => {
	for(const route of checkedRecordValueIndexPythonRoutes)
	{
		const { expected, resultOnly } = checkedRecordValueIndexPythonSelection(route);
		const files = generateCopiedPythonPackage(expected);
		const publicSource = files[`${checkedRecordValueIndexPythonPackage}/__init__.py`];
		const nativeSource = files[`${checkedRecordValueIndexPythonPackage}/_native.py`];
		const audited = auditPythonPackage(expected, files);
		assert.equal(audited.bindingIrSha256, hashBindingIr(expected));
		assert.ok(publicSource.includes("@_dataclass(frozen=True, slots=True)"));
		for(const record of Object.keys(expectedIndices))
			assert.match(publicSource, new RegExp(`class ${record}:`, "u"));
		for(const declaration of expected.declarations)
			assert.match(publicSource, new RegExp(`def ${declaration.name.replace(/([A-Z])/gu, "_$1").toLowerCase()}\\(`, "u"));
		assert.match(nativeSource, /_check\(_fn0\(/u);
		const changed = structuredClone(expected);
		changed.types.find(type => type.name === "On").source.extensions[instantiation]
			.arguments[0].value = "false";
		assert.notEqual(hashBindingIr(changed), hashBindingIr(expected));
		assert.throws(() => auditPythonPackage(changed, files), {
			code: "binding-ir-drift"
		});
		if(resultOnly) assert.doesNotMatch(publicSource, /def true_bool_index\(/u);
		else assert.match(publicSource, /def true_bool_index\(/u);
	}
});

test("value-index Python caller keeps source routes, recovery and result-only boundaries independent", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-python-caller-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const caller = await checkedRecordValueIndexPythonCaller();
	assert.match(caller, /def check_value_index_records\(api/u);
	assert.match(caller, /import lean_checkedrecordvalueindices as installed/u);
	const path = join(root, "caller.py"); await writeFile(path, caller);
	const model = resolve("tests/helpers/checked-record-value-index-python-model.py");
	const result = await run(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", [
		"-I", "-B", model, path
	]);
	assert.equal(result.stderr, "");
	const values = JSON.parse(result.stdout);
	assert.deepEqual(values.results, checkedRecordValueIndexPythonRoutes.map(route => {
		const expected = { route, ...checkedRecordValueIndexPythonExpected(route) };
		assert.deepEqual(parseCheckedRecordValueIndexPythonResult(
			`${JSON.stringify(checkedRecordValueIndexPythonExpected(route))}\n`, route)
			, checkedRecordValueIndexPythonExpected(route));
		return expected;
	}));
	assert.deepEqual(values.rejectedFaults, {
		full: ["accept-invalid", "wrong-status", "wrong-message", "mutate-input", "wrong-produced", "missing-producer"]
		, "result-only": ["wrong-produced", "missing-producer", "inputs-exported"]
	});
	assert.throws(() => parseCheckedRecordValueIndexPythonResult("{}\n", "ordinary-source"));
	assert.throws(() => parseCheckedRecordValueIndexPythonResult(
		"{}", "ordinary-source"));
	assert.equal(await checkedRecordValueIndexPythonCaller(), caller);
});
