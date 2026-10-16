/**
 * Source-only controls for the recursive checked-record Python caller. No compiled Lean
 * library or installed wheel executes here; the caller runs against a Python oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedPythonGraphPackage } from "../../src/backends/python/copied-graph-package.mjs";
import { auditPythonPackage } from "../../src/backends/python/package-audit.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { mutualCheckedRecordConfiguration } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordConfiguration } from "./recursive-checked-record-fixture.mjs";
import {
	loadRecursiveCheckedRecordPythonCaller
	, parseRecursiveCheckedRecordPythonResult
	, recursiveCheckedRecordPythonCallerArgs
	, recursiveCheckedRecordPythonConfiguration
	, recursiveCheckedRecordPythonCounts
	, recursiveCheckedRecordPythonExecutables
	, recursiveCheckedRecordPythonFixtures
	, recursiveCheckedRecordPythonPackage
	, recursiveCheckedRecordPythonReview
	, recursiveCheckedRecordPythonRoutes
	, recursiveCheckedRecordPythonSelection
} from "./recursive-checked-record-python-fixture.mjs";
import { recursiveCheckedRecordPythonInstalls } from "./recursive-checked-record-python-install.mjs";
import { assertRecursiveCheckedRecordPythonResources } from "./recursive-checked-record-python-resources.mjs";
import { assertRecursiveCheckedRecordPythonIdentity } from "./recursive-checked-record-python-wheel.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const pythonNames = ["first", "second", "echo", "groups", "echo_groups", "produce"];
export const recursiveCheckedRecordPythonFaults = Object.freeze([
	"produce-offset", "produce-single", "produce-digits", "accept-bool"
	, "wrong-host-exception", "alias-copy", "missing-fin", "missing-normalization"
	, "conflated-constructor", "diagnostic-suffix", "wrong-status", "wrong-path"
	, "root-only", "echo-unnormalized", "echo-drops-tail", "mutate-accepted-input"
	, "mutate-rejected-input", "cycle-as-lean", "depth-unbounded"
	, "shared-as-cycle", "groups-drop-none", "echo-groups-drops-none"
	, "poison-after-reject"
]);
export const recursiveCheckedRecordPythonModuleFaults = Object.freeze({
	recursive: Object.freeze(["second-normalizes-root-only"])
	, mutual: Object.freeze(["stop-as-none"])
});
const base = { recursive: recursiveCheckedRecordConfiguration, mutual: mutualCheckedRecordConfiguration };

test("recursive checked-record Python keeps both author contracts and typed recursive carriers", async () => {
	for(const route of recursiveCheckedRecordPythonRoutes) for(const fixture of recursiveCheckedRecordPythonFixtures)
	{
		const { name, version, moduleName } = recursiveCheckedRecordPythonPackage(fixture);
		const expected = base[fixture](route);
		const actual = recursiveCheckedRecordPythonConfiguration(route, fixture); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { pypi: { name, version } });
		const review = recursiveCheckedRecordPythonReview(fixture), before = structuredClone(review);
		validateBindingIr(review);
		const files = generateCopiedPythonGraphPackage(review, null, { refinementDiagnostics: true });
		assert.deepEqual(review, before); auditPythonPackage(review, files);
		const source = files[`${moduleName}/__init__.py`];
		assert.deepEqual([...source.matchAll(/^def ([a-z_]+)\(/gmu)].map(match => match[1]), pythonNames);
		assert.equal([...files[`${moduleName}/__init__.pyi`].matchAll(/^def /gmu)].length, pythonNames.length);
		if(fixture === "recursive")
			assert.match(source, /@_dataclass\(frozen=True, slots=True\)\nclass Packet:\n {4}value: int\n {4}digit: int\n {4}tail: _Input\d+\n/u);
		else
		{
			assert.match(source, /@_dataclass\(frozen=True, slots=True\)\nclass Envelope:\n {4}value: int\n {4}mode: int\n {4}next: _Input\d+\n/u);
			assert.ok(source.includes("Step: _TypeAlias = StepStop | StepMore"));
		}
		// Container aliases need TypeAliasType, which Python 3.11 takes from typing_extensions.
		assert.match(source, /from typing_extensions import TypeAliasType as _TypeAliasType/u);
		assert.match(files[`${moduleName}/_native.py`]
			, new RegExp(`_GraphAssets\\._LIBRARY\\["${name}_graph_error"\\]`, "u"));
		assert.deepEqual(recursiveCheckedRecordPythonCallerArgs(fixture), [fixture]);
	}
	assert.throws(() => recursiveCheckedRecordPythonConfiguration("unknown", "recursive"));
	assert.throws(() => recursiveCheckedRecordPythonConfiguration("ordinary", "unknown"));
	assert.throws(() => recursiveCheckedRecordPythonCallerArgs("unknown"));
	assert.throws(() => recursiveCheckedRecordPythonPackage("unknown"));
	const installs = recursiveCheckedRecordPythonInstalls.map(item =>
		[item.name, item.minor, item.typingVersion]);
	assert.deepEqual(installs, [
		["3.11-minimum", "3.11", "4.6.0"]
		, ["3.11-current", "3.11", "4.16.0"]
		, ["3.12-standard", "3.12", null]
	]);
	for(const fixture of recursiveCheckedRecordPythonFixtures)
	{
		const counts = recursiveCheckedRecordPythonCounts[fixture];
		const stdout = `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()))
			.replaceAll(",", ", ").replaceAll(":", ": ")}\n`;
		assert.deepEqual(parseRecursiveCheckedRecordPythonResult(stdout, fixture), counts);
		assert.throws(() => parseRecursiveCheckedRecordPythonResult(JSON.stringify(counts), fixture));
		for(const key of Object.keys(counts).filter(key => key !== "module"))
			assert.throws(() => parseRecursiveCheckedRecordPythonResult(stdout.replace(`"${key}": ${counts[key]}`
				, `"${key}": ${counts[key] + 1}`), fixture));
		assert.throws(() => parseRecursiveCheckedRecordPythonResult(stdout.replace("{", "{\"extra\": 1, "), fixture));
		assert.throws(() => parseRecursiveCheckedRecordPythonResult(stdout
			, recursiveCheckedRecordPythonFixtures.find(item => item !== fixture)));
	}
	assert.throws(() => parseRecursiveCheckedRecordPythonResult("{}", "unknown"));
});

test("recursive checked-record Python gates reject disabled selections, non-string values and incomplete interpreter floors", () => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(recursiveCheckedRecordPythonSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, fixtures: ["recursive", "mutual"], maxLoad: 8
	});
	assert.equal(recursiveCheckedRecordPythonSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => recursiveCheckedRecordPythonSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["FIXTURES", "mutual"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => recursiveCheckedRecordPythonSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordPythonSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(recursiveCheckedRecordPythonSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()]
			, [valid]);
	}
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD", "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHONS"])
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordPythonSelection({ [prefix + "TEST"]: flag, [name]: "explicit" }));
	const commands = { "3.11": "/toolchains/python311", "3.12": "/toolchains/python312" };
	assert.deepEqual(recursiveCheckedRecordPythonExecutables(JSON.stringify(commands)), commands);
	for(const raw of [undefined, "", "null", "[]", "{}"
		, JSON.stringify({ "3.11": commands["3.11"] })
		, JSON.stringify({ ...commands, "3.13": "/toolchains/python313" })
		, JSON.stringify({ ...commands, "3.12": commands["3.11"] })])
		assert.throws(() => recursiveCheckedRecordPythonExecutables(raw));
	for(const command of ["python3", "", null, 0, "/bin/python\0", "/bin/python\n"])
		assert.throws(() => recursiveCheckedRecordPythonExecutables(JSON.stringify({ ...commands, "3.11": command })));
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(recursiveCheckedRecordPythonSelection({ ...enabled, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad
			, maxLoad);
	for(const maxLoad of ["", "6", "10", "24", "Infinity", "eight", null])
		assert.throws(() => recursiveCheckedRecordPythonSelection({ ...enabled, [prefix + "MAX_LOAD"]: maxLoad }));
});

test("recursive checked-record Python resource records preserve the selected load ceiling", () => {
	const GiB = 1024 ** 3, admitted = { freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 7.5 };
	assertRecursiveCheckedRecordPythonResources({ observations: [admitted], waits: 0 }, 8);
	assertRecursiveCheckedRecordPythonResources({ observations: [{ ...admitted, load: 20.5 }, admitted], waits: 1 }, 20);
	for(const changed of [
		{ observations: [{ ...admitted, freeBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, availableBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, load: 8 }], waits: 0 }
		, { observations: [admitted], waits: 1 }
		, { observations: [admitted], waits: 0, extra: true }
	]) assert.throws(() => assertRecursiveCheckedRecordPythonResources(changed, 8));
	for(const maxLoad of [6, 10, 24, Infinity])
		assert.throws(() => assertRecursiveCheckedRecordPythonResources({ observations: [admitted], waits: 0 }, maxLoad));
});

test("recursive checked-record Python caller detects every result, input and cycle fault in an oracle", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-python-model-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await loadRecursiveCheckedRecordPythonCaller(), path = join(root, "consumer.py");
	await saveLakeFile(root, "consumer.py", caller);
	const generated = [];
	for(const fixture of recursiveCheckedRecordPythonFixtures)
	{
		const { moduleName } = recursiveCheckedRecordPythonPackage(fixture);
		const files = generateCopiedPythonGraphPackage(recursiveCheckedRecordPythonReview(fixture)
			, null, { refinementDiagnostics: true });
		generated.push(join(root, `${fixture}.py`));
		await saveLakeFile(root, `${fixture}.py`, files[`${moduleName}/__init__.py`]);
	}
	for(const generatedValueClasses of [false, true])
	{
		const model = resolve("tests/helpers/recursive-checked-record-python-model.py");
		const args = ["-I", "-B", model, path, ...generatedValueClasses ? generated : []];
		const run = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", args, root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.installedAcceptance, false);
		assert.equal(result.generatedValueClasses, generatedValueClasses);
		assert.deepEqual(result.results, recursiveCheckedRecordPythonFixtures.map(fixture =>
			recursiveCheckedRecordPythonCounts[fixture]));
		assert.deepEqual(result.rejectedFaults, Object.fromEntries(recursiveCheckedRecordPythonFixtures.map(fixture =>
			[fixture, [...recursiveCheckedRecordPythonFaults, ...recursiveCheckedRecordPythonModuleFaults[fixture]]])));
	}
	assert.equal(await readFile(path, "utf8"), caller);
	t.diagnostic("Explicit runtime doubles exercise the caller with independent and generated value classes; no installed Lean library executes.");
});

test("recursive checked-record Python wheel identity rejects changed coordinates, compiler authority and runtime", () => {
	for(const fixture of recursiveCheckedRecordPythonFixtures)
	{
		const { name, moduleName } = recursiveCheckedRecordPythonPackage(fixture);
		const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
		const pkg = { target: "pypi", ecosystem: "pypi", role: "component"
			, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
			, name, version: "1.0.0", runtimeIdentity: "b".repeat(64)
			, artifacts: [{ path: `archives/${name}-1.0.0-py3-none-manylinux_2_36_x86_64.whl` }] };
		const receipt = {
			schemaVersion: 1, kind: "lean-bridge-ordinary-python-package"
			, ecosystem: "pypi", moduleName, name: pkg.name, version: pkg.version
			, runtimeIdentity: pkg.runtimeIdentity
			, ...model
			, glibcMinimumVersion: "2.36", tag: "py3-none-manylinux_2_36_x86_64"
		};
		assertRecursiveCheckedRecordPythonIdentity(receipt, pkg, model, "2.36", fixture);
		for(const key of Object.keys(receipt))
		{
			assert.throws(() => assertRecursiveCheckedRecordPythonIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36", fixture));
			const missing = { ...receipt }; delete missing[key];
			assert.throws(() => assertRecursiveCheckedRecordPythonIdentity(missing, pkg, model, "2.36", fixture));
		}
		for(const key of Object.keys(pkg))
			assert.throws(() => assertRecursiveCheckedRecordPythonIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36", fixture));
		assert.throws(() => assertRecursiveCheckedRecordPythonIdentity(receipt, { ...pkg, artifacts: [] }, model, "2.36", fixture));
		assert.throws(() => assertRecursiveCheckedRecordPythonIdentity(receipt, pkg, model, "2.38", fixture));
		assert.throws(() => assertRecursiveCheckedRecordPythonIdentity(receipt, pkg, model, "2.36"
			, recursiveCheckedRecordPythonFixtures.find(item => item !== fixture)));
	}
});
