/**
 * Source-only controls for the independent inherited checked-record Python
 * caller. No installed wheel or compiled Lean library executes here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import {
	inheritedCheckedRecordPythonCaller
	, inheritedCheckedRecordPythonCallerArgs
	, inheritedCheckedRecordPythonConfiguration
	, inheritedCheckedRecordPythonCounts
	, inheritedCheckedRecordPythonExecutables
	, inheritedCheckedRecordPythonModes
	, inheritedCheckedRecordPythonPackage
	, inheritedCheckedRecordPythonReview
	, inheritedCheckedRecordPythonRoutes
	, inheritedCheckedRecordPythonSelection
	, parseInheritedCheckedRecordPythonResult
} from "./inherited-checked-record-python-fixture.mjs";
import { inheritedCheckedRecordReview } from "./inherited-checked-record-fixture.mjs";
import {
	assertInheritedCheckedRecordPythonResources
} from "./inherited-checked-record-python-resources.mjs";
import {
	assertInheritedCheckedRecordPythonIdentity
} from "./inherited-checked-record-python-wheel.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

const fullNames = [
	"first", "normalized", "pair", "aliased", "nested", "echo"
	, "produce", "produce_stamped"
];

test("inherited checked-record Python preserves both author contracts and result-only records", async () => {
	for(const route of inheritedCheckedRecordPythonRoutes)
		for(const mode of inheritedCheckedRecordPythonModes)
		{
			const configuration
				= inheritedCheckedRecordPythonConfiguration(route, mode);
			validateExportConfiguration(configuration);
			assert.deepEqual(configuration.targets, {
				pypi: { name: "inheritedcheckedrecords", version: "1.0.0" }
			});
			const review = inheritedCheckedRecordPythonReview(mode);
			const before = structuredClone(review);
			validateBindingIr(review);
			const files = generateCopiedPythonPackage(review);
			assert.deepEqual(review, before);
			const source = files[`${inheritedCheckedRecordPythonPackage}/__init__.py`];
			const stub = files[`${inheritedCheckedRecordPythonPackage}/__init__.pyi`];
			const names = mode === "full" ? fullNames : fullNames.slice(-2);
			assert.deepEqual([...source.matchAll(/^def ([a-z_]+)\(/gmu)]
				.map(match => match[1]), names);
			assert.equal([...stub.matchAll(/^def /gmu)].length, names.length);
			for(const declaration of [source, stub])
			{
				assert.match(declaration
					, /class Span:\n {4}lo: int\n {4}hi: int\n/u);
				assert.match(declaration
					, /class Ticket:\n {4}to_span: Span\n {4}word: int\n/u);
				assert.match(declaration
					, /class Stamped:\n {4}to_ticket: Ticket\n {4}mark: int\n/u);
				assert.doesNotMatch(declaration, /ordered|linked|stamped:|typing_extensions/u);
			}
			if(mode === "full")
				assert.match(source, /TicketAlias: _TypeAlias = Ticket/u);
			else assert.doesNotMatch(source, /TicketAlias|def first/u);
			assert.deepEqual(inheritedCheckedRecordPythonCallerArgs(route, mode), [
				...mode === "result-only" ? ["--result-only"] : []
				, ...route === "reviewed" ? ["--reviewed"] : []
			]);
		}
	assert.deepEqual(inheritedCheckedRecordPythonReview("full")
		, inheritedCheckedRecordReview());
	assert.equal(await inheritedCheckedRecordPythonCaller("ordinary")
		, await inheritedCheckedRecordPythonCaller("reviewed"));
	assert.throws(() => inheritedCheckedRecordPythonConfiguration(
		"unknown", "full"));
	assert.throws(() => inheritedCheckedRecordPythonConfiguration(
		"ordinary", "unknown"));
	assert.throws(() => inheritedCheckedRecordPythonReview("unknown"));
	assert.throws(() => inheritedCheckedRecordPythonCallerArgs(
		"ordinary", "unknown"));
	await assert.rejects(inheritedCheckedRecordPythonCaller("unknown"));
});

test("inherited checked-record Python gates close routes, modes, floors, and load ceilings", () => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PYTHON_";
	const enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(inheritedCheckedRecordPythonSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"], maxLoad: 10
	});
	assert.equal(inheritedCheckedRecordPythonSelection({ CI: "true" }).maxLoad, 6);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => inheritedCheckedRecordPythonSelection({
			[prefix + "TEST"]: flag
		}));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => inheritedCheckedRecordPythonSelection({
				...enabled, [prefix + name]: raw
			}));
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordPythonSelection({
				[prefix + "TEST"]: flag, [prefix + name]: valid
			}));
	}
	for(const name of [
		prefix + "OUTPUT", prefix + "MAX_LOAD"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PYTHONS"
	]) for(const flag of [undefined, "0"])
		assert.throws(() => inheritedCheckedRecordPythonSelection({
			[prefix + "TEST"]: flag, [name]: "explicit"
		}));
	const commands = {
		"3.11": "/toolchains/python311", "3.12": "/toolchains/python312"
	};
	assert.deepEqual(inheritedCheckedRecordPythonExecutables(
		JSON.stringify(commands)), commands);
	for(const raw of [
		undefined, "", "null", "[]", "{}"
		, JSON.stringify({ "3.11": commands["3.11"] })
		, JSON.stringify({ ...commands, "3.13": "/toolchains/python313" })
		, JSON.stringify({ ...commands, "3.12": commands["3.11"] })
	]) assert.throws(() => inheritedCheckedRecordPythonExecutables(raw));
	for(const command of ["python3", "", null, 0, "/bin/python\0", "/bin/python\n"])
		assert.throws(() => inheritedCheckedRecordPythonExecutables(
			JSON.stringify({ ...commands, "3.11": command })));
	for(const maxLoad of [6, 8, 10, 12])
		assert.equal(inheritedCheckedRecordPythonSelection({
			...enabled, [prefix + "MAX_LOAD"]: String(maxLoad)
		}).maxLoad, maxLoad);
	for(const maxLoad of ["", "4", "7", "16", "Infinity", "six", null])
		assert.throws(() => inheritedCheckedRecordPythonSelection({
			...enabled, [prefix + "MAX_LOAD"]: maxLoad
		}));
});

test("inherited checked-record Python resource records preserve the selected load ceiling", () => {
	const GiB = 1024 ** 3;
	const admitted = {
		freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 9.5
	};
	assertInheritedCheckedRecordPythonResources({
		observations: [admitted], waits: 0
	}, 10);
	assertInheritedCheckedRecordPythonResources({
		observations: [{ ...admitted, load: 12.5 }, admitted], waits: 1
	}, 12);
	for(const changed of [
		{ observations: [{ ...admitted, freeBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, availableBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, load: 10 }], waits: 0 }
		, { observations: [admitted], waits: 1 }
		, { observations: [admitted], waits: 0, extra: true }
	]) assert.throws(() => assertInheritedCheckedRecordPythonResources(
		changed, 10));
	for(const maxLoad of [4, 16, 24, Infinity])
		assert.throws(() => assertInheritedCheckedRecordPythonResources({
			observations: [admitted], waits: 0
		}, maxLoad));
});

test("inherited checked-record Python wheel identity rejects changed authority", () => {
	const model = {
		bindingIrSha256: "a".repeat(64)
		, component: { id: "synthetic" }, sourceIdentity: { fixture: true }
	};
	const pkg = {
		target: "pypi", ecosystem: "pypi", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded"
		, requires: [], name: "inheritedcheckedrecords", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{
			path: "archives/inheritedcheckedrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl"
		}]
	};
	const receipt = {
		schemaVersion: 1, kind: "lean-bridge-ordinary-python-package"
		, ecosystem: "pypi", moduleName: inheritedCheckedRecordPythonPackage
		, name: pkg.name, version: pkg.version
		, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.38"
		, tag: "py3-none-manylinux_2_38_x86_64"
	};
	assertInheritedCheckedRecordPythonIdentity(receipt, pkg, model, "2.38");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertInheritedCheckedRecordPythonIdentity({
			...receipt, [key]: "changed"
		}, pkg, model, "2.38"));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertInheritedCheckedRecordPythonIdentity(
			missing, pkg, model, "2.38"));
	}
	for(const key of Object.keys(pkg))
		assert.throws(() => assertInheritedCheckedRecordPythonIdentity(
			receipt, { ...pkg, [key]: "changed" }, model, "2.38"));
	assert.throws(() => assertInheritedCheckedRecordPythonIdentity(
		receipt, { ...pkg, artifacts: [] }, model, "2.38"));
	assert.throws(() => assertInheritedCheckedRecordPythonIdentity(
		receipt, pkg, model, "2.36"));
});

test("independent inherited checked-record Python caller covers every closed selection", async () => {
	const caller = await inheritedCheckedRecordPythonCaller("ordinary");
	const callerPath = resolve(
		"tests/fixtures/inherited-checked-record-consumers/python.py");
	const model = resolve(
		"tests/helpers/inherited-checked-record-python-model.py");
	for(const route of inheritedCheckedRecordPythonRoutes)
		for(const mode of inheritedCheckedRecordPythonModes)
		{
			const run = await runCopied(
				process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3"
				, ["-I", "-B", model, callerPath
					, ...inheritedCheckedRecordPythonCallerArgs(route, mode)]
				, process.cwd()
			);
			assert.equal(run.code, 0, run.stderr);
			assert.equal(run.stderr, "");
			assert.deepEqual(parseInheritedCheckedRecordPythonResult(
				run.stdout, mode), inheritedCheckedRecordPythonCounts[mode]);
		}
	assert.equal(await readFile(callerPath, "utf8"), caller);
	for(const mode of inheritedCheckedRecordPythonModes)
	{
		const counts = inheritedCheckedRecordPythonCounts[mode];
		for(const key of Object.keys(counts))
			assert.throws(() => parseInheritedCheckedRecordPythonResult(
				JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseInheritedCheckedRecordPythonResult(
			JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseInheritedCheckedRecordPythonResult(
		"{}", "unknown"));
});
