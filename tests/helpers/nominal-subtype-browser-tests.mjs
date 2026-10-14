/**
 * Browser selection and public-caller controls, without installed browser claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeCallerModel } from "./nominal-subtype-caller-model.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalSubtypeNpmRecordPaths } from "./nominal-subtype-npm-report.mjs";
import { nominalSubtypeBrowserRecords } from "./nominal-subtype-browser-report.mjs";
import { executeCorpus } from "../fixtures/nominal-subtype-consumers/browser.mjs";
import { nominalSubtypeBrowserRoutes, nominalSubtypeBrowserModes, nominalSubtypeBrowserProfiles, nominalSubtypeBrowserEngines, nominalSubtypeBrowserEnabled, nominalSubtypeBrowserSelection, nominalSubtypeBrowserExpected, nominalSubtypeBrowserPhases, validateNominalSubtypeBrowserObservation, validateNominalSubtypeBrowserPhases } from "./nominal-subtype-browser-fixture.mjs";
import "./nominal-subtype-browser-package-tests.mjs";
import "./nominal-subtype-browser-evidence-tests.mjs";

test("nominal browser selection requires installed npm acceptance and all three engines", () => {
	const environment = { LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST: "1"
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium,firefox,webkit" };
	assert.equal(nominalSubtypeBrowserEnabled(environment), true);
	assert.equal(nominalSubtypeBrowserEnabled({}), false);
	assert.equal(nominalSubtypeBrowserEnabled({ LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST: "0" }), false);
	for(const value of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalSubtypeBrowserEnabled({ ...environment, LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST: value }));
	for(const value of [undefined, "0", "", true])
		assert.throws(() => nominalSubtypeBrowserEnabled({ ...environment, LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST: value }));
	for(const value of [undefined, "", "chromium", "firefox,webkit", "webkit,firefox,chromium", "chromium,firefox,webkit,chromium", "chromium,firefox,unknown"])
		assert.throws(() => nominalSubtypeBrowserEnabled({ ...environment, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: value }));
});

test("nominal browser selections retain both complete author contracts and constructor-free APIs", () => {
	for(const route of nominalSubtypeBrowserRoutes) for(const mode of nominalSubtypeBrowserModes)
	{
		const selected = nominalSubtypeBrowserSelection(route, mode);
		assert.equal(selected.resultOnly, mode === "result-only");
		assert.equal(selected.route, route); assert.equal(selected.mode, mode);
		validateBindingIr(selected.expected); validateExportConfiguration(selected.configuration);
		assert.deepEqual(selected.expected, nominalSubtypeInstalledReview(selected.resultOnly));
		assert.deepEqual(selected.configuration, nominalSubtypeInstalledConfiguration(route, ["npm"], selected.resultOnly));
		assert.equal(selected.expected.declarations.length, selected.resultOnly ? 13 : 26);
		assert.deepEqual(nominalSubtypeBrowserExpected(mode), selected.resultOnly ? { checks: 2078, rejections: 0 } : { checks: 3172, rejections: 1032 });
		if(route === "reviewed" || selected.resultOnly) assert.equal(selected.configuration.contracts, undefined);
		for(const declaration of selected.expected.declarations)
			assert.doesNotMatch(JSON.stringify(declaration.source.extensions["lean-lang.org/refinements"].result), /plusOne|plusTwo/u);
	}
	for(const invalid of [undefined, "", "unknown", "ordinary-source", "result-only-reviewed-ir", false])
		assert.throws(() => nominalSubtypeBrowserSelection(invalid, "full"));
	for(const invalid of [undefined, "", "unknown", false, "results"])
	{
		assert.throws(() => nominalSubtypeBrowserSelection("ordinary", invalid));
		assert.throws(() => nominalSubtypeBrowserExpected(invalid));
	}
});

const observation = (profile, route, mode) => ({ schemaVersion: 1, profile
	, module: "nominalsubtypes"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, hostVersion: "synthetic-control-only"
	, results: { module: "nominalsubtypes", route, mode
		, resultOnly: mode === "result-only"
		, ...nominalSubtypeBrowserExpected(mode) } });

test("nominal browser phases require 204 complete lifecycle observations across the four selections", t => {
	let total = 0, refused = 0;
	for(const route of nominalSubtypeBrowserRoutes) for(const mode of nominalSubtypeBrowserModes) for(const profile of nominalSubtypeBrowserProfiles)
	{
		const value = observation(profile, route, mode);
		validateNominalSubtypeBrowserObservation(value, profile, route, mode);
		const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
		const rows = nominalSubtypeBrowserEngines.flatMap(engine => variants.flatMap(variant => nominalSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase, observation: structuredClone(value) }))));
		validateNominalSubtypeBrowserPhases(rows, profile, nominalSubtypeBrowserEngines, route, mode);
		total += rows.length;
		for(const index of rows.keys())
		{
			assert.throws(() => validateNominalSubtypeBrowserPhases(rows.filter((_, at) => at !== index), profile, nominalSubtypeBrowserEngines, route, mode)); refused++;
			const duplicate = structuredClone(rows); duplicate.splice(index, 0, structuredClone(rows[index]));
			assert.throws(() => validateNominalSubtypeBrowserPhases(duplicate, profile, nominalSubtypeBrowserEngines, route, mode)); refused++;
		}
		const changes = [item => { item.engine = "unknown"; }
			, item => { item.variant = "unknown"; }
			, item => { item.phase = "unknown"; }, item => { item.extra = true; }
			, item => { item.observation.hostVersion = ""; }
			, item => { item.observation.realm = "unknown"; }
			, item => { item.observation.profile = "node-javascript"; }
			, item => { item.observation.module = "checkedrecords"; }
			, item => { item.observation.results.route = "unknown"; }
			, item => { item.observation.results.mode = "unknown"; }
			, item => { item.observation.results.resultOnly = !item.observation.results.resultOnly; }
			, item => { item.observation.results.checks++; }
			, item => { item.observation.results.rejections++; }
			, item => { item.observation.results.extra = true; }];
		for(const change of changes)
		{
			const changed = structuredClone(rows); change(changed[0]);
			assert.throws(() => validateNominalSubtypeBrowserPhases(changed, profile, nominalSubtypeBrowserEngines, route, mode)); refused++;
		}
		assert.throws(() => validateNominalSubtypeBrowserPhases(rows.slice().reverse(), profile, nominalSubtypeBrowserEngines, route, mode)); refused++;
		assert.throws(() => validateNominalSubtypeBrowserPhases(rows, profile, ["chromium"], route, mode)); refused++;
	}
	assert.equal(total, 204); assert.equal(refused, 600);
	t.diagnostic(`${refused} missing, duplicated or altered synthetic observations rejected; no browser execution claim`);
});

test("nominal browser entry runs the unchanged caller and refuses invalid requests before dispatch", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-browser-caller-control-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of nominalSubtypeBrowserModes)
	{
		const directory = join(root, mode), resultOnly = mode === "result-only";
		const files = generateJavaScriptPackage(nominalSubtypeInstalledReview(resultOnly));
		for(const path of ["index.mjs", "internal/validators.mjs"]) await saveLakeFile(directory, path, files[path]);
		await saveLakeFile(directory, "internal/runtime.mjs", "export const control = { api: null, calls: 0 }; export const runtime = { call(id, args) { control.calls++; return control.api[id.split('.').at(-1)](...args); } };\n");
		const { control } = await import(pathToFileURL(join(directory, "internal/runtime.mjs")));
		control.api = nominalSubtypeCallerModel();
		const api = await import(pathToFileURL(join(directory, "index.mjs")));
		for(const route of nominalSubtypeBrowserRoutes) for(const profile of nominalSubtypeBrowserProfiles)
		{
			const request = { module: "nominalsubtypes", profile, route, mode, resultOnly };
			assert.deepEqual(executeCorpus(request, api), { module: request.module, route, mode, resultOnly, ...nominalSubtypeBrowserExpected(mode) });
			const before = control.calls;
			for(const changed of [undefined, null, [], {}, { ...request, extra: true }
				, { ...request, module: "checkedrecords" }
				, { ...request, profile: "node-javascript" }
				, { ...request, route: "unknown" }, { ...request, mode: "unknown" }
				, { ...request, resultOnly: !resultOnly }
				, { ...request, resultOnly: "true" }]
			)
				assert.throws(() => executeCorpus(changed, api));
			for(const key of Object.keys(request))
			{
				const changed = { ...request }; delete changed[key];
				assert.throws(() => executeCorpus(changed, api));
			}
			assert.equal(control.calls, before);
		}
	}
	t.diagnostic("Generated public APIs use explicit runtime doubles; no Lean or browser execution claim");
});

test("nominal browser records keep both npm modes and complete source-free browser callers", async () => {
	for(const mode of nominalSubtypeBrowserModes)
	{
		const paths = nominalSubtypeBrowserRecords(mode);
		assert.equal(new Set(paths).size, paths.length);
		for(const path of nominalSubtypeNpmRecordPaths(mode)) assert.ok(paths.includes(path));
		assert.equal(paths.includes("callers/index.mts"), mode === "full");
		for(const profile of nominalSubtypeBrowserProfiles)
		{
			for(const path of ["installed-binding-ir.json", "installed-index.d.ts"
				, "installed-runtime-identity.json", "installed-runtime-package.json"
				, "installed-component-package.json", "install.json", "inputs.json"
				, "observations.json", "report.json", "request.json"
				, "fixtures/nominal-subtype-consumers/browser.mjs"
				, "fixtures/nominal-subtype-consumers/javascript.mjs"
				, "fixtures/structural-subtype-consumers/javascript.mjs"]
			) assert.ok(paths.includes(profile + "/" + path));
			assert.equal(paths.includes(profile + "/worker.mjs"), profile === "browser-worker");
		}
	}
	const source = await readFile("tests/helpers/nominal-subtype-npm-installed-tests.mjs", "utf8");
	for(const step of ["await checkNominalSubtypeNpmReport(original,", "await checkNominalSubtypeBrowsers({", "await checkNominalSubtypeBrowserReport(original,"])
		assert.ok(source.indexOf(step) > source.indexOf("await rename(consumer, moved)"));
	assert.ok(source.indexOf("complete = true") > source.indexOf("await checkNominalSubtypeBrowserReport(original,"));
	assert.ok(source.includes('await cp(handoff, join(output, "handoff")'));
});

test("nominal browser producer refuses invalid engines and stale outputs before building", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-browser-gates-"));
	t.after(() => rm(directory, { recursive: true }));
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT"));
	const flags = { LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST: "1"
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium,firefox,webkit"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES: "ordinary"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES: "full"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT: directory };
	const run = changes => spawnSync(process.execPath, ["--test", "--test-reporter=tap", "tests/helpers/nominal-subtype-npm-installed-tests.mjs"], { env: { ...environment, ...flags, ...changes }, encoding: "utf8", timeout: 15_000 });
	for(const changes of [{ LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium" }
		, { LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST: "0" }]
	) {
		const result = run(changes);
		assert.equal(result.signal, null); assert.equal(result.status, 1);
		assert.match(result.stdout + result.stderr, /AssertionError/u);
		assert.deepEqual(await readdir(directory), []);
	}
	const output = join(directory, "ordinary/full"); await mkdir(output, { recursive: true });
	const result = run({});
	assert.equal(result.signal, null); assert.equal(result.status, 1);
	assert.match(result.stdout, /Missing expected rejection/u);
	assert.deepEqual(await readdir(output), []);
});
