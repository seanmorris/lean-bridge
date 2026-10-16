/**
 * Source-only controls for the nested checked-record Python caller. No compiled Lean
 * library or installed wheel executes here; the caller runs against a Python oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordPythonCaller
	, nestedCheckedRecordPythonCallerArgs
	, nestedCheckedRecordPythonConfiguration
	, nestedCheckedRecordPythonCounts
	, nestedCheckedRecordPythonExecutables
	, nestedCheckedRecordPythonModes
	, nestedCheckedRecordPythonPackage
	, nestedCheckedRecordPythonReview
	, nestedCheckedRecordPythonRoutes
	, nestedCheckedRecordPythonSelection
	, parseNestedCheckedRecordPythonResult
} from "./nested-checked-record-python-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const pythonNames = [
	"first", "second", "pair", "in_array", "in_list", "in_option"
	, "in_product", "in_except", "in_holder", "in_choice", "echo_array"
	, "produce_option", "produce_array"
];
export const nestedCheckedRecordPythonResultFaults = Object.freeze([
	"produce-offset", "produce-array-length", "produce-list-result"
	, "produce-bare-packet", "accept-bool", "wrong-host-exception"
]);
export const nestedCheckedRecordPythonInputFaults = Object.freeze([
	"missing-fin", "fin-after-constructor", "missing-normalization"
	, "conflated-constructor", "diagnostic-suffix", "wrong-status", "wrong-path"
	, "wrong-choice", "except-swapped", "holder-tag", "echo-normalizes"
	, "echo-list-result", "echo-swapped-fields", "mutate-accepted-input"
	, "mutate-rejected-input", "list-as-array"
]);

test("nested checked-record Python keeps both author contracts and constructor-free results", async () => {
	for(const route of nestedCheckedRecordPythonRoutes) for(const mode of nestedCheckedRecordPythonModes)
	{
		const expected = nestedCheckedRecordConfiguration(route, ["c"], mode);
		const actual = nestedCheckedRecordPythonConfiguration(route, mode); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { pypi: { name: "nestedcheckedrecords", version: "1.0.0" } });
		const review = nestedCheckedRecordPythonReview(mode), before = structuredClone(review); validateBindingIr(review);
		assert.deepEqual(review, nestedCheckedRecordReview(mode));
		const files = generateCopiedPythonPackage(review), source = files[`${nestedCheckedRecordPythonPackage}/__init__.py`];
		assert.deepEqual(review, before);
		const names = mode === "full" ? pythonNames : pythonNames.slice(-2);
		assert.deepEqual([...source.matchAll(/^def ([a-z_]+)\(/gmu)].map(match => match[1]), names);
		assert.equal([...files[`${nestedCheckedRecordPythonPackage}/__init__.pyi`].matchAll(/^def /gmu)].length, names.length);
		assert.match(source, /@_dataclass\(frozen=True, slots=True\)\nclass Packet:\n {4}digit: int\n {4}word: int\n/u);
		if(mode === "full")
		{
			assert.match(source, /class Holder:\n {4}packet: Packet\n {4}tag: int\n/u);
			assert.ok(source.includes("Choice: _TypeAlias = ChoiceEmpty | ChoicePacket"));
		}
		assert.doesNotMatch(source, /typing_extensions/u);
		assert.deepEqual(nestedCheckedRecordPythonCallerArgs(route, mode)
			, [...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []]);
	}
	assert.equal(await nestedCheckedRecordPythonCaller("reviewed"), await nestedCheckedRecordPythonCaller("ordinary"));
	assert.throws(() => nestedCheckedRecordPythonConfiguration("unknown", "full"));
	assert.throws(() => nestedCheckedRecordPythonConfiguration("ordinary", "unknown"));
	assert.throws(() => nestedCheckedRecordPythonCallerArgs("ordinary", "unknown"));
	await assert.rejects(nestedCheckedRecordPythonCaller("unknown"));
	for(const mode of nestedCheckedRecordPythonModes)
	{
		const counts = nestedCheckedRecordPythonCounts[mode];
		assert.deepEqual(parseNestedCheckedRecordPythonResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNestedCheckedRecordPythonResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNestedCheckedRecordPythonResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNestedCheckedRecordPythonResult("{}", "unknown"));
});

test("nested checked-record Python gates reject disabled selections, non-string values and incomplete interpreter floors", () => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nestedCheckedRecordPythonSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nestedCheckedRecordPythonSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nestedCheckedRecordPythonSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => nestedCheckedRecordPythonSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nestedCheckedRecordPythonSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nestedCheckedRecordPythonSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHONS"])
		for(const flag of [undefined, "0"])
			assert.throws(() => nestedCheckedRecordPythonSelection({ [prefix + "TEST"]: flag, [name]: "explicit" }));
	const commands = { "3.11": "/toolchains/python311", "3.12": "/toolchains/python312" };
	assert.deepEqual(nestedCheckedRecordPythonExecutables(JSON.stringify(commands)), commands);
	for(const raw of [undefined, "", "null", "[]", "{}"
		, JSON.stringify({ "3.11": commands["3.11"] })
		, JSON.stringify({ ...commands, "3.13": "/toolchains/python313" })
		, JSON.stringify({ ...commands, "3.12": commands["3.11"] })])
		assert.throws(() => nestedCheckedRecordPythonExecutables(raw));
	for(const command of ["python3", "", null, 0, "/bin/python\0", "/bin/python\n"])
		assert.throws(() => nestedCheckedRecordPythonExecutables(JSON.stringify({ ...commands, "3.11": command })));
});

test("nested checked-record Python caller detects every result, input and selection fault in an oracle", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-python-model-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await nestedCheckedRecordPythonCaller("ordinary"), path = join(root, "consumer.py");
	await saveLakeFile(root, "consumer.py", caller);
	const files = generateCopiedPythonPackage(nestedCheckedRecordPythonReview("full"));
	const generated = join(root, "generated.py");
	await saveLakeFile(root, "generated.py", files[`${nestedCheckedRecordPythonPackage}/__init__.py`]);
	for(const generatedValueClasses of [false, true])
	{
		const args = ["-I", "-B"
			, resolve("tests/helpers/nested-checked-record-python-model.py")
			, path, ...generatedValueClasses ? [generated] : []];
		const run = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", args, root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.installedAcceptance, false);
		assert.equal(result.generatedValueClasses, generatedValueClasses);
		assert.deepEqual(result.results, nestedCheckedRecordPythonModes.flatMap(mode => ["arg", "value"].map(parameterPrefix => ({
			resultOnly: mode === "result-only", parameterPrefix
			, ...nestedCheckedRecordPythonCounts[mode] }))));
		assert.deepEqual(result.rejectedFaults, {
			full: [...nestedCheckedRecordPythonResultFaults, ...nestedCheckedRecordPythonInputFaults]
			, "result-only": [...nestedCheckedRecordPythonResultFaults, "inputs-exported"]
		});
	}
	assert.equal(await readFile(path, "utf8"), caller);
	t.diagnostic("Explicit runtime doubles exercise the caller with independent and generated value classes; no installed Lean library executes.");
});
