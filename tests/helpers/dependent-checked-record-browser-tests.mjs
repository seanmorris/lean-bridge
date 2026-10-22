/**
 * Static contract tests for dependent checked-record npm/browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import {
	generateCompilerAdapters, validateCompilerAdapterPlan
} from "../../src/build/compiler-adapters.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import {
	dependentCheckedRecordBrowserPackage
	, dependentCheckedRecordEngines
	, dependentCheckedRecordExpected
	, dependentCheckedRecordName
	, dependentCheckedRecordProfiles
	, dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
	, validateDependentCheckedRecordObservation
	, validateDependentCheckedRecordPhases
} from "./dependent-checked-record-browser-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkDependentRecords } from "../fixtures/dependent-checked-record-browser/javascript.mjs";

const fields = value => {
	if(Object.keys(value).sort().join() !== "below,bound")
		throw new TypeError("dependent record shape");
};
const checked = (value, parameter) => {
	fields(value);
	if(value.below >= value.bound)
		throw new Error(`${parameter} was rejected by DependentRecords.mkDependent`);
	return value;
};
const model = {
	dependentTotal: value => {
		checked(value, "dependentTotal.arg0");
		return value.bound + value.below;
	}
	, dependentRoundtrip: value => ({
		...checked(value, "dependentRoundtrip.arg0")
	})
	, dependentResult: seed => ({ bound: seed + 1n, below: seed })
};

test("the dependent checked-record caller covers bounds, recovery and results", () => {
	assert.deepEqual(checkDependentRecords(model)
		, dependentCheckedRecordExpected("ordinary-source"));
	assert.deepEqual(checkDependentRecords({
		dependentTotal: value => {
			checked(value, "dependentTotal.value0");
			return value.bound + value.below;
		}
		, dependentRoundtrip: value => ({
			...checked(value, "dependentRoundtrip.value0")
		})
		, dependentResult: model.dependentResult
	}, false, true), dependentCheckedRecordExpected("reviewed-ir"));
	assert.deepEqual(checkDependentRecords({
		dependentResult: model.dependentResult
	}, true), dependentCheckedRecordExpected("result-only-reviewed-ir"));
	assert.throws(() => checkDependentRecords({
		...model
		, dependentTotal: value => {
			checked(value, "arg0");
			return value.bound + value.below;
		}
	}), /wrong refusal: equal bound: arg0 was rejected/u);
	for(const mutate of [
		{ dependentTotal: () => 0n }
		, { dependentRoundtrip: () => ({ bound: 3n, below: 3n }) }
	]) assert.throws(() => checkDependentRecords({ ...model, ...mutate }));
	assert.throws(() => checkDependentRecords({
		dependentResult: seed => ({ bound: seed, below: seed })
	}, true));
});

test("four dependent author selections retain the exact field relation", async () => {
	assert.deepEqual(dependentCheckedRecordRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	for(const route of dependentCheckedRecordRoutes)
	{
		const { configuration, expected, resultOnly, reviewed }
			= dependentCheckedRecordSelection(route);
		validateBindingIr(expected);
		assert.equal(resultOnly, route.startsWith("result-only-"));
		assert.equal(reviewed, route.endsWith("reviewed-ir"));
		assert.deepEqual(configuration.targets
			, { npm: { name: dependentCheckedRecordName, version: "1.0.0" } });
		assert.equal(configuration.contracts === undefined, reviewed);
		assert.deepEqual(expected.types[0].source.extensions[
			"lean-lang.org/nominal-refinements"
		], { kind: "record"
		, fields: [
			null, { kind: "fin-field", field: "bound" }
		] });
		const semanticSha256 = "1".repeat(64);
		const generated = generateCompilerAdapters({
			analysis: {
				bindingIr: {
					origin: "lean-elaborated", document: expected, semanticSha256
				}
				, exportCandidates: expected.declarations.map(declaration => ({
					declaration: declaration.source.declaration
					, sourceModule: "DependentRecords", status: "exportable"
				}))
			}
			, componentPlan: {
				sha256: "2".repeat(64)
				, document: { bindingIr: { semanticSha256 } }
			}
		});
		assert.equal(validateCompilerAdapterPlan(generated.plan), true);
		await assertJsonSchema("compiler-adapter-plan", generated.plan);
		assert.deepEqual(generated.plan.nominalRefinements, [{
			id: "lean:DependentRecords.Dependent"
			, refinement: { kind: "record"
			, fields: [
				null, { kind: "fin-field", field: "bound" }
			] }
		}]);
		const source = generated.files["LeanBridgeGenerated.lean"];
		assert.doesNotMatch(source, /sorry|unsafeCast|axiom|Fin\.mk/u);
		if(resultOnly)
		{
			assert.match(source, /DependentRecords\.dependentResult/u);
			assert.doesNotMatch(source, /DependentRecords\.mkDependent/u);
		}
		else assert.match(source, /DependentRecords\.mkDependent/u);
	}
	for(const route of [undefined, "", "ordinary", "result-only", "unknown"])
		assert.throws(() => dependentCheckedRecordSelection(route)
			, /Unknown dependent checked-record route/u);
});

test("generated JavaScript leaves sibling Fin authority with the selected constructor"
	, async () => {
	const expected = dependentCheckedRecordSelection("ordinary-source").expected;
	const generated = generateJavaScriptPackage(expected);
	const validators = await import(`data:text/javascript,${encodeURIComponent(
		generated["internal/validators.mjs"]
	)}`);
	const refinement = expected.declarations[0].source.extensions[
		"lean-lang.org/refinements"
	].parameters[0];
	assert.doesNotThrow(() => validators.assertNestedFin({
		bound: 3n, below: 2n
	}, refinement, "value"));
	assert.throws(() => validators.assertNestedFin({
		bound: 3n, below: 3n
	}, refinement, "value"), /value\.below must be bigint below 3/u);
	assert.throws(() => validators.assertNestedFin({
		bound: "3", below: 2n
	}, refinement, "value"), /value\.bound must be bigint/u);
	assert.throws(() => validators.assertNestedFin({
		bound: 3n, below: -1n
	}, refinement, "value"), /value\.below must be non-negative bigint/u);
	assert.doesNotThrow(() => validators.assertDependent({
		bound: 3n, below: 2n
	}, "nominal"));
	assert.doesNotThrow(() => validators.assertDependent({
		bound: 3n, below: 3n
	}, "nominal"));
	assert.doesNotThrow(() => validators.assertDependent({
		bound: 0n, below: 0n
	}, "nominal"));
	assert.throws(() => validators.assertDependent({
		bound: "3", below: 2n
	}, "nominal"), /nominal\.bound must be bigint/u);
	}
);

const observation = (profile, route) => ({
	schemaVersion: 1, profile, module: dependentCheckedRecordName
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: {
		module: dependentCheckedRecordName, route
		, resultOnly: route.startsWith("result-only-")
		, ...dependentCheckedRecordExpected(route)
	}
	, hostVersion: "test-browser"
});
const phases = (profile, route) => dependentCheckedRecordEngines.flatMap(
	engine => (profile === "browser-react" ? ["production", "strict"]
		: ["production"]).flatMap(variant => (profile === "browser-react"
		? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker"
			? ["first", "rerun", "worker-restart", "failure-recovery"]
			: ["first", "rerun", "failure-recovery"]
		).map(phase => ({
		engine, variant, phase, observation: observation(profile, route)
		})))
);

test("dependent browser observations require every engine and lifecycle phase", () => {
	assert.deepEqual(dependentCheckedRecordProfiles
		, ["browser-javascript", "browser-react", "browser-worker"]);
	for(const route of dependentCheckedRecordRoutes)
		for(const profile of dependentCheckedRecordProfiles)
		{
			validateDependentCheckedRecordObservation(
				observation(profile, route), profile, route
			);
			const complete = phases(profile, route);
			validateDependentCheckedRecordPhases(
				complete, profile, dependentCheckedRecordEngines, route
			);
			assert.throws(() => validateDependentCheckedRecordPhases(
				complete.slice(1), profile, dependentCheckedRecordEngines, route
			));
			const changed = structuredClone(complete);
			changed[0].observation.results.calls--;
			assert.throws(() => validateDependentCheckedRecordPhases(
				changed, profile, dependentCheckedRecordEngines, route
			));
		}
});

test("the browser wrapper delegates only exact dependent package requests", async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-record-wrapper-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await saveLakeFile(directory, "browser.mjs", await readFile(
		"tests/fixtures/dependent-checked-record-browser/browser.mjs"
	));
	await saveLakeFile(directory, "check.mjs", await readFile(
		"tests/fixtures/dependent-checked-record-browser/javascript.mjs"
	));
	const { executeCorpus } = await import(pathToFileURL(
		join(directory, "browser.mjs")
	).href);
	for(const route of dependentCheckedRecordRoutes)
	{
		const resultOnly = route.startsWith("result-only-");
		const request = {
			module: dependentCheckedRecordName, profile: "browser-javascript"
			, route, resultOnly
		};
		const api = resultOnly ? { dependentResult: model.dependentResult } : model;
		assert.deepEqual(executeCorpus(request, api), {
			module: dependentCheckedRecordName, route, resultOnly
			, ...dependentCheckedRecordExpected(route)
		});
		for(const change of [
			{ module: "other" }, { profile: "node-javascript" }
			, { route: "wrong" }, { resultOnly: !resultOnly }
		]) assert.throws(() => executeCorpus({ ...request, ...change }, api));
	}
	assert.ok(dependentCheckedRecordBrowserPackage
		.includes('import("dependentrecords")'));
	assert.doesNotMatch(dependentCheckedRecordBrowserPackage, /runtime\.call|raw:/u);
});

test("dependent installed gates reject partial selections before building", async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-record-gates-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const flags = {
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NPM_TEST: "0"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_BROWSER_TEST: "0"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_OUTPUT: directory
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: dependentCheckedRecordEngines.join(",")
	};
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("LEAN_BRIDGE_")
			&& key !== "NODE_TEST_CONTEXT"));
	const run = changes => spawnSync(process.execPath, [
		"--test", "--test-reporter=tap"
		, "tests/helpers/dependent-checked-record-browser-installed-tests.mjs"
	], {
		env: { ...environment, ...flags, ...changes }
		, encoding: "utf8", timeout: 15_000
	});
	const disabled = run({});
	assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
	assert.match(disabled.stdout, /# skipped 4/u);
	for(const changes of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NPM_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_BROWSER_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_BROWSER_TEST: "1" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_ROUTES: "" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_ROUTES:
			"ordinary-source,ordinary-source" }
	]) {
		const result = run(changes);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.doesNotMatch(result.stdout, /npm author/u);
	}
	await mkdir(join(directory, "ordinary-source"));
	const stale = run({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NPM_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_ROUTES: "ordinary-source"
	});
	assert.equal(stale.status, 1, stale.stdout + stale.stderr);
	assert.doesNotMatch(stale.stdout, /npm author/u);
});

test("dependent checked-record browser CI requires all four routes", async () => {
	const workflow = await readFile(
		".github/workflows/dependent-checked-record-browser.yml", "utf8"
	);
	const runner = await readFile(
		"scripts/run-dependent-checked-record-browser-ci.sh", "utf8"
	);
	for(const required of [
		"runs-on: ubuntu-24.04", "timeout-minutes: 180"
		, "bash scripts/install-playwright-browsers.sh chromium firefox webkit"
		, "bash scripts/run-dependent-checked-record-browser-ci.sh"
		, "if: always() && steps.acceptance.outcome != 'success'"
		, "retention-days: 30"
	]) assert.ok(workflow.includes(required), required);
	for(const required of [
		"ordinary-source,reviewed-ir,result-only-ordinary-source,result-only-reviewed-ir"
		, "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NPM_TEST=1"
		, "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_BROWSER_TEST=1"
		, "chromium,firefox,webkit"
		, "--test-concurrency=1"
		, 'test -s "$records/$route/report.json"'
		, 'test -s "$records/$route/browser.json"'
	]) assert.ok(runner.includes(required), required);
});
