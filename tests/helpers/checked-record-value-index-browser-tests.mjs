/**
 * Fast, independent controls for the value-index npm and browser acceptance lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import {
	generateCompilerAdapters, validateCompilerAdapterPlan
} from "../../src/build/compiler-adapters.mjs";
import {
	checkCheckedRecordValueIndices, checkedRecordValueIndexSnapshot
} from "../fixtures/checked-record-value-index-browser/javascript.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import {
	checkedRecordValueIndexBrowserEngines
	, checkedRecordValueIndexBrowserExpected
	, checkedRecordValueIndexBrowserPackageSource
	, checkedRecordValueIndexBrowserPhases
	, checkedRecordValueIndexBrowserProfiles
	, checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexContracts
	, checkedRecordValueIndexFixtureRoot
	, checkedRecordValueIndexInputNames
	, checkedRecordValueIndexModule
	, checkedRecordValueIndexPackage
	, checkedRecordValueIndexResultNames
	, validateCheckedRecordValueIndexBrowserObservation
	, validateCheckedRecordValueIndexBrowserPhases
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	assertCheckedRecordValueIndexBrowserControlsTap
	, assertCheckedRecordValueIndexBrowserTap
	, checkedRecordValueIndexBrowserRequiredControlNames
	, checkCheckedRecordValueIndexBrowserCiRecords
	, parseCheckedRecordValueIndexBrowserCiArgs
} from "./checked-record-value-index-browser-ci-report.mjs";
import {
	assertCheckedRecordValueIndexProvenance
	, checkedRecordValueIndexBrowserRecordPaths
} from "./checked-record-value-index-browser-report.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const fields = (value, names) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| Object.keys(value).sort().join() !== [...names].sort().join())
		throw new TypeError("test does not match the declared copied fields");
};
const count = value => {
	fields(value, ["count"]);
	if(typeof value.count !== "bigint") throw new TypeError("count must be bigint");
	return value.count;
};
const checkedFailure = () => {
	throw new Error("Component recursive call failed (5)");
};
const model = () => ({
	trueBoolIndex: value => {
		const result = count(value);
		if(result !== 0n) checkedFailure();
		return result;
	}
	, falseBoolIndex: value => {
		const result = count(value);
		if(result === 0n) checkedFailure();
		return result;
	}
	, abStringIndex: value => {
		fields(value, ["size"]);
		if(typeof value.size !== "bigint") throw new TypeError("size must be bigint");
		if(value.size !== 2n) checkedFailure();
		return value.size;
	}
	, emptyStringIndex: count, unicodeStringIndex: count
	, emptySizedIndex: value => {
		fields(value, ["data"]);
		if(!Array.isArray(value.data)) throw new TypeError("data must be array");
		if(value.data.length !== 0) checkedFailure();
		return 0n;
	}
	, zeroNatIndex: count, wideNatIndex: count
	, produceTrueBool: () => ({ count: 0n })
	, produceFalseBool: () => ({ count: 1n })
	, produceAb: () => ({ size: 2n })
	, produceEmptyString: value => ({ count: value })
	, produceUnicodeString: value => ({ count: value })
	, produceEmptySized: () => ({ data: [] })
	, produceZeroNat: value => ({ count: value })
	, produceWideNat: value => ({ count: value })
});

const observation = (profile, route) => ({
	schemaVersion: 1, profile, module: checkedRecordValueIndexPackage
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: {
		module: checkedRecordValueIndexPackage, route
		, resultOnly: route.startsWith("result-only-")
		, ...checkedRecordValueIndexBrowserExpected(route)
	}
	, hostVersion: "fixture-browser"
});
const tap = (tests, skipped = 0) => `TAP version 13\n${Array.from({ length: tests }
	, (_, index) => `# Subtest: accepted ${index}\n`
		+ `ok ${index + 1} - accepted ${index}${index >= tests - skipped ? " # SKIP" : ""}\n`
	+ "  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n").join("")}1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${tests - skipped}\n# fail 0\n# cancelled 0\n# skipped ${skipped}\n# todo 0\n# duration_ms 2\n`;
const controlsTap = (
	extra = []
	, passed = checkedRecordValueIndexBrowserRequiredControlNames.passed
) => {
	const skipped = checkedRecordValueIndexBrowserRequiredControlNames.skipped;
	const names = [...passed, ...extra, ...skipped];
	return `TAP version 13\n${names.map((name, index) => `# Subtest: ${name}\n`
		+ `ok ${index + 1} - ${name}${index >= names.length - skipped.length ? " # SKIP" : ""}\n`
		+ "  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n").join("")}1..${names.length}\n# tests ${names.length}\n# suites 0\n# pass ${names.length - skipped.length}\n# fail 0\n# cancelled 0\n# skipped ${skipped.length}\n# todo 0\n# duration_ms 2\n`;
};
const ciOptions = {
	route: "ordinary-source", producer: "a".repeat(40)
	, "npm-checker": "b".repeat(40), consumer: "c".repeat(40)
	, checker: "d".repeat(40), directory: "records"
	, "acceptance-tap": "acceptance.tap", "controls-tap": "controls.tap"
	, runtime: "runtime.json"
};
const ciArgs = options => Object.entries(options)
	.flatMap(([key, value]) => [`--${key}`, value]);

test("value-index author routes preserve kind, value, constructor and result boundaries", () => {
	assert.deepEqual(checkedRecordValueIndexBrowserRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	const expectedIndices = new Set([
		"bool:true", "bool:false", "string:ab", "string:", "string:λ🌱"
		, "nat:0", "nat:340282366920938463463374607431768211457"
	]);
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const selection = checkedRecordValueIndexBrowserSelection(route);
		validateBindingIr(selection.expected);
		assertCheckedRecordValueIndexProvenance(selection.expected);
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.deepEqual(selection.configuration.targets, {
			npm: { name: checkedRecordValueIndexPackage, version: "1.0.0" }
		});
		assert.deepEqual(new Set(selection.expected.types.flatMap(type => {
			const args = type.source.extensions["lean-lang.org/instantiation"].arguments;
			return args.filter(item => item.kind === "value")
				.map(item => `${item.type.name}:${item.value}`);
		})), expectedIndices);
		assert.ok(selection.expected.types.every(type =>
			type.source.extensions["lean-lang.org/erased-proofs"].fields.length === 1));
		const names = selection.expected.declarations.map(item => item.name);
		assert.deepEqual(names, selection.resultOnly
			? checkedRecordValueIndexResultNames
			: [...checkedRecordValueIndexInputNames, ...checkedRecordValueIndexResultNames]);
		for(const declaration of selection.expected.declarations)
		{
			const refinement = declaration.source.extensions["lean-lang.org/refinements"];
			if(checkedRecordValueIndexInputNames.includes(declaration.name))
			{
				assert.equal(refinement.parameters.length, 1);
				assert.equal(refinement.parameters[0].kind, "checked-record");
				assert.match(refinement.parameters[0].constructor
					, new RegExp(`^${checkedRecordValueIndexModule}\\.mk`, "u"));
			}
			else assert.equal(refinement, undefined);
		}
		if(selection.reviewed)
		{
			assert.equal(selection.configuration.exports, undefined);
			assert.equal(selection.configuration.contracts, undefined);
		}
		else
		{
			const contracts = checkedRecordValueIndexContracts();
			const selected = Object.fromEntries(
				selection.configuration.exports.map(name => [name, contracts[name]]));
			assert.deepEqual(selection.configuration.contracts
				, selected);
		}
	}
	for(const route of [undefined, "", "ordinary", "reviewed", "result-only"])
		assert.throws(() => checkedRecordValueIndexBrowserSelection(route)
			, /Unknown value-index browser route/u);
	const baseline = checkedRecordValueIndexBrowserSelection("ordinary-source").expected;
	const mutations = [
		ir => { ir.types.find(type => type.name === "On")
			.source.extensions["lean-lang.org/instantiation"].arguments[0].value = "false"; }
		, ir => { ir.types.find(type => type.name === "UnicodeToken")
			.source.extensions["lean-lang.org/instantiation"].arguments[1].value = "λ"; }
		, ir => { ir.types.find(type => type.name === "ZeroToken")
			.source.extensions["lean-lang.org/instantiation"].arguments[1]
				= { kind: "value", type: { kind: "primitive", name: "string" }, value: "0" }; }
		, ir => { delete ir.types.find(type => type.name === "WideToken")
			.source.extensions["lean-lang.org/instantiation"]; }
		, ir => { ir.types = ir.types.filter(type => type.name !== "Off"); }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(baseline); mutate(changed);
		assert.throws(() => assertCheckedRecordValueIndexProvenance(changed));
	}
});

test("immutable value-index caller covers every function, rejection and recovery", () => {
	const api = model();
	assert.deepEqual(checkCheckedRecordValueIndices(api)
		, checkedRecordValueIndexBrowserExpected("ordinary-source"));
	const resultOnly = Object.fromEntries(checkedRecordValueIndexResultNames.map(name => [
		name, api[name]
	]));
	assert.deepEqual(checkCheckedRecordValueIndices(resultOnly, true)
		, checkedRecordValueIndexBrowserExpected("result-only-reviewed-ir"));
	for(const name of [...checkedRecordValueIndexInputNames
		, ...checkedRecordValueIndexResultNames])
		assert.throws(() => checkCheckedRecordValueIndices({ ...api, [name]: undefined })
			, /failed:|not a function/u, name);
	for(const change of [
		{ produceTrueBool: value => ({ count: value, set: true }) }
		, { produceAb: () => ({ size: 1n }) }
		, { produceWideNat: () => ({ count: 0n }) }
		, { trueBoolIndex: value => { value.count++; return value.count; } }
		, { abStringIndex: value => value.size }
	]) assert.throws(() => checkCheckedRecordValueIndices({ ...api, ...change })
		, /failed:|accepted:/u);
	assert.throws(() => checkCheckedRecordValueIndices(resultOnly, "true"), /boolean/u);
});

test("value-index snapshots distinguish proof fields, scalar kinds and mutations", () => {
	for(const [left, right] of [
		[{ count: 1n }, { count: 1 }]
		, [{ count: 1n }, { count: 1n, fixed: true }]
		, [{ data: [] }, { data: [undefined] }]
		, [Array(1), [undefined]]
	]) assert.notEqual(checkedRecordValueIndexSnapshot(left)
		, checkedRecordValueIndexSnapshot(right));
	let touched = false;
	const getter = {
		/** Detect accidental getter evaluation. */
		get count() { touched = true; return 1n; }
	};
	const cycle = {}; cycle.self = cycle;
	for(const value of [getter, cycle, new Date(), { [Symbol("proof")]: true }])
		assert.throws(() => checkedRecordValueIndexSnapshot(value), /snapshot/iu);
	assert.equal(touched, false);
});

test("value-index browser routes close every engine and lifecycle", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-wrapper-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "browser.mjs", await readFile(
		"tests/fixtures/checked-record-value-index-browser/browser.mjs"));
	await saveLakeFile(root, "check.mjs", await readFile(
		"tests/fixtures/checked-record-value-index-browser/javascript.mjs"));
	const { executeCorpus } = await import(pathToFileURL(join(root, "browser.mjs")).href);
	for(const route of checkedRecordValueIndexBrowserRoutes)
		for(const profile of checkedRecordValueIndexBrowserProfiles)
		{
			const value = observation(profile, route);
			validateCheckedRecordValueIndexBrowserObservation(value, profile, route);
			const variants = profile === "browser-react"
				? ["production", "strict"] : ["production"];
			const observations = checkedRecordValueIndexBrowserEngines.flatMap(engine =>
				variants.flatMap(variant => checkedRecordValueIndexBrowserPhases(profile)
					.map(phase => ({ engine, variant, phase, observation: value }))));
			validateCheckedRecordValueIndexBrowserPhases(
				observations, profile, checkedRecordValueIndexBrowserEngines, route);
			assert.throws(() => validateCheckedRecordValueIndexBrowserPhases(
				observations.slice(1), profile, checkedRecordValueIndexBrowserEngines, route));
			const request = {
				module: checkedRecordValueIndexPackage, profile, route
				, resultOnly: route.startsWith("result-only-")
			};
			const api = request.resultOnly
				? Object.fromEntries(checkedRecordValueIndexResultNames.map(name => [
					name, model()[name]
				])) : model();
			assert.deepEqual(executeCorpus(request, api), value.results);
		}
	assert.ok(checkedRecordValueIndexBrowserPackageSource.includes(
		'import("checkedrecordvalueindices")'));
	assert.doesNotMatch(checkedRecordValueIndexBrowserPackageSource
		, /runtime\.call|raw:/u);
});

test("value-index compiler plans keep checked inputs and constructor-free results separate", () => {
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const { expected, resultOnly } = checkedRecordValueIndexBrowserSelection(route);
		const generated = generateCompilerAdapters({
			analysis: {
				bindingIr: {
					origin: "lean-elaborated", document: expected
					, semanticSha256: "1".repeat(64)
				}
				, exportCandidates: expected.declarations.map(declaration => ({
					declaration: declaration.source.declaration
					, sourceModule: checkedRecordValueIndexModule, status: "exportable"
				}))
			}
			, componentPlan: {
				sha256: "2".repeat(64)
				, document: { bindingIr: { semanticSha256: "1".repeat(64) } }
			}
		});
		validateCompilerAdapterPlan(generated.plan);
		assert.equal(generated.plan.exports.length, resultOnly ? 8 : 16);
		assert.doesNotMatch(generated.files["LeanBridgeGenerated.lean"]
			, /sorry|unsafeCast|axiom/u);
		for(const name of checkedRecordValueIndexResultNames)
		{
			const item = generated.plan.exports.find(candidate =>
				candidate.bindingId.endsWith(`.${name}`));
			assert.equal(item.refinements, undefined, name);
		}
		if(!resultOnly) for(const name of checkedRecordValueIndexInputNames)
		{
			const item = generated.plan.exports.find(candidate =>
				candidate.bindingId.endsWith(`.${name}`));
			assert.equal(item.refinements.parameters[0].kind, "checked-record", name);
		}
	}
});

test("generated full and result-only TypeScript expose payload fields only", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-types-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const { expected, resultOnly } = checkedRecordValueIndexBrowserSelection(route);
		const directory = join(root, route);
		for(const [path, source] of Object.entries(generateJavaScriptPackage(expected)))
			await saveLakeFile(join(directory, "node_modules"
				, checkedRecordValueIndexPackage), path, source);
		await saveLakeFile(directory, "index.mts", await readFile(join(
			"tests/fixtures/checked-record-value-index-browser"
			, resultOnly ? "result-only.mts" : "full.mts")));
		await runCopied(process.execPath, [
			resolve("node_modules/typescript/lib/tsc.js")
			, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022"
			, "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext"
			, "--moduleResolution", "NodeNext", "index.mts"
		], directory);
	}
});

test("value-index installed gates reject partial selections and stale outputs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-gates-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
		!key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT"));
	const base = {
		LEAN_BRIDGE_VALUE_INDEX_NPM_TEST: "0"
		, LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST: "0"
		, LEAN_BRIDGE_VALUE_INDEX_BROWSER_OUTPUT: root
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS:
			checkedRecordValueIndexBrowserEngines.join(",")
	};
	const run = changes => spawnSync(process.execPath, [
		"--test", "--test-reporter=tap"
		, "tests/helpers/checked-record-value-index-browser-installed-tests.mjs"
	], {
		env: { ...environment, ...base, ...changes }
		, encoding: "utf8", timeout: 15_000
	});
	const disabled = run({});
	assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
	assert.match(disabled.stdout, /# skipped 4/u);
	for(const changes of [
		{ LEAN_BRIDGE_VALUE_INDEX_NPM_TEST: "yes" }
		, { LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST: "yes" }
		, { LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST: "1" }
		, { LEAN_BRIDGE_VALUE_INDEX_ROUTES: "" }
		, { LEAN_BRIDGE_VALUE_INDEX_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_VALUE_INDEX_ROUTES: "ordinary-source,ordinary-source" }
		, {
			LEAN_BRIDGE_VALUE_INDEX_NPM_TEST: "1"
			, LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST: "1"
			, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium"
		}
	]) {
		const result = run(changes);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.doesNotMatch(result.stdout, /value-index author/u);
	}
	await mkdir(join(root, "ordinary-source"));
	const stale = run({
		LEAN_BRIDGE_VALUE_INDEX_NPM_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_ROUTES: "ordinary-source"
	});
	assert.equal(stale.status, 1, stale.stdout + stale.stderr);
	assert.match(stale.stdout, /Missing expected rejection/u);
	assert.doesNotMatch(stale.stdout, /value-index author/u);
});

test("value-index hosted checker closes arguments and complete TAP streams", () => {
	assert.deepEqual(parseCheckedRecordValueIndexBrowserCiArgs(ciArgs(ciOptions))
		, ciOptions);
	assertCheckedRecordValueIndexBrowserTap(tap(1), 1);
	assertCheckedRecordValueIndexBrowserTap(tap(15, 4), 15, 4);
	assert.deepEqual(assertCheckedRecordValueIndexBrowserControlsTap(
		controlsTap()), { fastPasses: 11, skippedInstalledRoutes: 4 });
	assert.deepEqual(assertCheckedRecordValueIndexBrowserControlsTap(
		controlsTap(["later authenticated reader"])
	), { fastPasses: 11, skippedInstalledRoutes: 4 });
	assert.throws(() => assertCheckedRecordValueIndexBrowserControlsTap(
		controlsTap([], checkedRecordValueIndexBrowserRequiredControlNames.passed.slice(1))));
	const paths = checkedRecordValueIndexBrowserRecordPaths({
		package: { archive: "component.tgz" }, runtime: { archive: "runtime.tgz" }
	});
	assert.equal(new Set(paths).size, paths.length);
	for(const path of [
		"browser.json", "handoff/component.tgz", "handoff/runtime.tgz"
		, "browser/browser-javascript/report.json"
		, "browser/browser-react/react.mjs", "browser/browser-worker/worker.mjs"
	]) assert.ok(paths.includes(path), path);
	for(const key of Object.keys(ciOptions))
	{
		const missing = Object.fromEntries(Object.entries(ciOptions)
			.filter(([name]) => name !== key));
		assert.throws(() => parseCheckedRecordValueIndexBrowserCiArgs(ciArgs(missing)));
		assert.throws(() => parseCheckedRecordValueIndexBrowserCiArgs([
			...ciArgs(ciOptions), `--${key}`, ciOptions[key]
		]));
	}
	for(const changed of [
		{ route: "unknown" }, { producer: "HEAD" }, { "npm-checker": "a".repeat(39) }
		, { consumer: "a".repeat(41) }, { checker: "A".repeat(40) }
		, { unknown: "value" }
	]) assert.throws(() => parseCheckedRecordValueIndexBrowserCiArgs(
		ciArgs({ ...ciOptions, ...changed })));
	for(const changed of [
		tap(1).replace("ok 1 -", "not ok 1 -")
		, tap(1).replace("# pass 1", "# pass 0")
		, tap(1).replace("# skipped 0", "# skipped 1")
		, tap(1).replace("1..1\n", "")
		, `${tap(1)}Bail out! late\n`
	]) assert.throws(() => assertCheckedRecordValueIndexBrowserTap(changed, 1));
});

test("value-index hosted checker rejects scope before retained-record reads", async () => {
	let reads = 0;
	const original = {
		acceptanceTap: tap(1), controlsTap: controlsTap()
		, runtime: { node: process.version, platform: "linux", arch: "x64" }
		, paths: []
		, read: async () => {
			reads++;
			throw new Error("records required");
		}
	};
	await assert.rejects(checkCheckedRecordValueIndexBrowserCiRecords(
		{ ...ciOptions, route: "unknown" }, original), assert.AssertionError);
	assert.equal(reads, 0);
	await assert.rejects(checkCheckedRecordValueIndexBrowserCiRecords(
		ciOptions, { ...original, controlsTap: controlsTap([]
			, checkedRecordValueIndexBrowserRequiredControlNames.passed.slice(1)) }
	), assert.AssertionError);
	assert.equal(reads, 0);
	await assert.rejects(checkCheckedRecordValueIndexBrowserCiRecords(
		ciOptions, original), /records required/u);
	assert.equal(reads, 1);
});

test("value-index hosted workflow requires every route and retains failures", async t => {
	const workflow = await readFile(
		".github/workflows/checked-record-value-index-browser.yml", "utf8");
	const assertWorkflow = source => {
		assert.ok(source.startsWith(
			"name: Value-indexed checked records in npm and browsers\n"));
		assert.ok(source.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
		assert.ok(source.includes("permissions:\n  contents: read\n"));
		assert.ok(source.includes("runs-on: ubuntu-24.04"));
		assert.ok(source.includes("timeout-minutes: 240"));
		assert.ok(source.includes("fetch-depth: 0"));
		assert.ok(source.includes("persist-credentials: false"));
		assert.ok(source.includes('node-version: "22"'));
		assert.ok(source.includes(
			"bash scripts/install-playwright-browsers.sh chromium firefox webkit"));
		assert.ok(source.includes("nix build .#component-build-engine"));
		assert.ok(source.includes("bash scripts/build-lean-link-spike.sh"));
		assert.ok(source.includes(
			'bash scripts/run-checked-record-value-index-browser-ci.sh "$PWD/build/lean-link-spike/lazy"'));
		assert.ok(source.includes(
			"if: always() && steps.acceptance.outcome != 'success'"));
		assert.ok(source.includes("if-no-files-found: error"));
		assert.ok(source.includes("run: exit 1"));
		assert.doesNotMatch(source
			, /continue-on-error:|needs:|strategy:|LEAN_BRIDGE_LAKE_RUNTIME_ROOT:/u);
	};
	assertWorkflow(workflow);
	const shell = await readFile(
		"scripts/run-checked-record-value-index-browser-ci.sh", "utf8");
	for(const required of [
		"for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do"
		, "export LEAN_BRIDGE_VALUE_INDEX_NPM_TEST=1"
		, "export LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST=1"
		, "export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"
		, "node scripts/check-checked-record-value-index-browser-ci.mjs"
		, 'export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"'
	]) assert.ok(shell.includes(required), required);
	execFileSync("bash", ["-n", "scripts/run-checked-record-value-index-browser-ci.sh"]);
	const replacements = [
		["  push:\n", ""], ["  pull_request:\n", ""]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["chromium firefox webkit", "chromium"]
		, ["nix build .#component-build-engine", "true missing-engine"]
		, ["bash scripts/build-lean-link-spike.sh", "true missing-runtime"]
		, [
			'bash scripts/run-checked-record-value-index-browser-ci.sh "$PWD/build/lean-link-spike/lazy"'
			, "true missing-matrix"
		]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unknown.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 240", "timeout-minutes: 1"]
	];
	for(const [before, after] of replacements)
	{
		const changed = workflow.replace(before, after);
		assert.notEqual(changed, workflow);
		assert.throws(() => assertWorkflow(changed));
	}
	t.diagnostic(`${replacements.length} workflow bypasses refused`);
});

test("value-index onboarding fixture is self-contained and source-identifiable", async () => {
	const source = await readFile(join(checkedRecordValueIndexFixtureRoot
		, `${checkedRecordValueIndexModule}.lean`), "utf8");
	for(const text of [
		"Token Nat 0", "340282366920938463463374607431768211457"
		, "Flagged false", 'Token String ""', 'Token String "λ🌱"'
		, "Option EmptySized", "Option Ab"
	]) assert.ok(source.includes(text), text);
	assert.doesNotMatch(source, /\bsorry\b|unsafeCast|\baxiom\b/u);
});
