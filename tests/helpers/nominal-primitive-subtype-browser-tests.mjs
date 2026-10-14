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
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeCallerModel } from "./nominal-primitive-subtype-caller-model.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalPrimitiveSubtypeNpmRecordPaths } from "./nominal-primitive-subtype-npm-report.mjs";
import { nominalPrimitiveSubtypeBrowserRecords } from "./nominal-primitive-subtype-browser-report.mjs";
import { executeCorpus } from "../fixtures/nominal-primitive-subtype-consumers/browser.mjs";
import { nominalPrimitiveSubtypeBrowserRoutes, nominalPrimitiveSubtypeBrowserModes, nominalPrimitiveSubtypeBrowserProfiles, nominalPrimitiveSubtypeBrowserEngines, nominalPrimitiveSubtypeBrowserEnabled, nominalPrimitiveSubtypeBrowserSelection, nominalPrimitiveSubtypeBrowserExpected, nominalPrimitiveSubtypeBrowserPhases, validateNominalPrimitiveSubtypeBrowserObservation, validateNominalPrimitiveSubtypeBrowserPhases } from "./nominal-primitive-subtype-browser-fixture.mjs";

test("primitive-base browser selection requires installed npm acceptance and all three engines", () => {
	const environment = { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST: "1"
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium,firefox,webkit" };
	assert.equal(nominalPrimitiveSubtypeBrowserEnabled(environment), true);
	assert.equal(nominalPrimitiveSubtypeBrowserEnabled({}), false);
	assert.equal(nominalPrimitiveSubtypeBrowserEnabled({ LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST: "0" }), false);
	for(const value of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypeBrowserEnabled({ ...environment, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST: value }));
	for(const value of [undefined, "0", "", true])
		assert.throws(() => nominalPrimitiveSubtypeBrowserEnabled({ ...environment, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST: value }));
	for(const value of [undefined, "", "chromium", "firefox,webkit", "webkit,firefox,chromium", "chromium,firefox,webkit,chromium", "chromium,firefox,unknown"])
		assert.throws(() => nominalPrimitiveSubtypeBrowserEnabled({ ...environment, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: value }));
});

test("primitive-base browser selections retain both complete author contracts and constructor-free APIs", () => {
	for(const route of nominalPrimitiveSubtypeBrowserRoutes) for(const mode of nominalPrimitiveSubtypeBrowserModes)
	{
		const selected = nominalPrimitiveSubtypeBrowserSelection(route, mode);
		assert.equal(selected.resultOnly, mode === "result-only");
		assert.equal(selected.route, route); assert.equal(selected.mode, mode);
		validateBindingIr(selected.expected); validateExportConfiguration(selected.configuration);
		assert.deepEqual(selected.expected, nominalPrimitiveSubtypeReview(selected.resultOnly));
		assert.deepEqual(selected.configuration, nominalPrimitiveSubtypeConfiguration(route, ["npm"], selected.resultOnly));
		assert.equal(selected.expected.declarations.length, selected.resultOnly ? 6 : 14);
		assert.deepEqual(nominalPrimitiveSubtypeBrowserExpected(mode), selected.resultOnly ? { checks: 578, rejections: 0, rounds: 256, wordBits: 32 } : { checks: 1213, rejections: 283, rounds: 256, wordBits: 32 });
		if(route === "reviewed" || selected.resultOnly) assert.equal(selected.configuration.contracts, undefined);
		for(const declaration of selected.expected.declarations)
		{
			const refinements = declaration.source.extensions["lean-lang.org/refinements"];
			if(declaration.id.endsWith(".wordBits")) assert.equal(refinements, undefined);
			else
			{
				assert.ok(refinements?.result);
				const constructors = [];
				const visit = value => {
					if(value && typeof value === "object")
					{
						if(value.kind === "subtype") constructors.push(value.constructor);
						for(const item of Object.values(value)) visit(item);
					}
				};
				visit(refinements.result); assert.ok(constructors.length > 0);
				assert.deepEqual(constructors, Array(constructors.length).fill(null));
			}
		}
	}
	for(const invalid of [undefined, "", "unknown", "ordinary-source", "result-only-reviewed-ir", false])
		assert.throws(() => nominalPrimitiveSubtypeBrowserSelection(invalid, "full"));
	for(const invalid of [undefined, "", "unknown", false, "results"])
	{
		assert.throws(() => nominalPrimitiveSubtypeBrowserSelection("ordinary", invalid));
		assert.throws(() => nominalPrimitiveSubtypeBrowserExpected(invalid));
	}
});

const observation = (profile, route, mode) => ({ schemaVersion: 1, profile
	, module: "nominalprimitivesubtypes"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, hostVersion: "synthetic-control-only"
	, results: { module: "nominalprimitivesubtypes", route, mode
		, resultOnly: mode === "result-only"
		, ...nominalPrimitiveSubtypeBrowserExpected(mode) } });

test("primitive-base browser phases require 204 complete lifecycle observations across the four selections", t => {
	let total = 0, refused = 0;
	for(const route of nominalPrimitiveSubtypeBrowserRoutes) for(const mode of nominalPrimitiveSubtypeBrowserModes) for(const profile of nominalPrimitiveSubtypeBrowserProfiles)
	{
		const value = observation(profile, route, mode);
		validateNominalPrimitiveSubtypeBrowserObservation(value, profile, route, mode);
		const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
		const rows = nominalPrimitiveSubtypeBrowserEngines.flatMap(engine => variants.flatMap(variant => nominalPrimitiveSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase, observation: structuredClone(value) }))));
		validateNominalPrimitiveSubtypeBrowserPhases(rows, profile, nominalPrimitiveSubtypeBrowserEngines, route, mode);
		total += rows.length;
		for(const index of rows.keys())
		{
			assert.throws(() => validateNominalPrimitiveSubtypeBrowserPhases(rows.filter((_, at) => at !== index), profile, nominalPrimitiveSubtypeBrowserEngines, route, mode)); refused++;
			const duplicate = structuredClone(rows); duplicate.splice(index, 0, structuredClone(rows[index]));
			assert.throws(() => validateNominalPrimitiveSubtypeBrowserPhases(duplicate, profile, nominalPrimitiveSubtypeBrowserEngines, route, mode)); refused++;
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
			, item => { item.observation.results.extra = true; }
			, item => { item.observation.results.rounds++; }
			, item => { item.observation.results.wordBits = 64; }];
		for(const change of changes)
		{
			const changed = structuredClone(rows); change(changed[0]);
			assert.throws(() => validateNominalPrimitiveSubtypeBrowserPhases(changed, profile, nominalPrimitiveSubtypeBrowserEngines, route, mode)); refused++;
		}
		assert.throws(() => validateNominalPrimitiveSubtypeBrowserPhases(rows.slice().reverse(), profile, nominalPrimitiveSubtypeBrowserEngines, route, mode)); refused++;
		assert.throws(() => validateNominalPrimitiveSubtypeBrowserPhases(rows, profile, ["chromium"], route, mode)); refused++;
	}
	assert.equal(total, 204); assert.equal(refused, 624);
	t.diagnostic(`${refused} missing, duplicated or altered synthetic observations rejected; no browser execution claim`);
});

test("primitive-base browser entry runs the unchanged caller and refuses invalid requests before dispatch", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-browser-caller-control-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of nominalPrimitiveSubtypeBrowserModes)
	{
		const directory = join(root, mode), resultOnly = mode === "result-only";
		const files = generateJavaScriptPackage(nominalPrimitiveSubtypeReview(resultOnly));
		for(const path of ["index.mjs", "internal/validators.mjs"]) await saveLakeFile(directory, path, files[path]);
		await saveLakeFile(directory, "internal/runtime.mjs", "export const control = { api: null, calls: 0 }; export const runtime = { call(id, args) { control.calls++; return control.api[id.split('.').at(-1)](...args); } };\n");
		const { control } = await import(pathToFileURL(join(directory, "internal/runtime.mjs")));
		control.api = nominalPrimitiveSubtypeCallerModel();
		const api = await import(pathToFileURL(join(directory, "index.mjs")));
		for(const route of nominalPrimitiveSubtypeBrowserRoutes) for(const profile of nominalPrimitiveSubtypeBrowserProfiles)
		{
			const request = { module: "nominalprimitivesubtypes", profile, route, mode, resultOnly };
			assert.deepEqual(executeCorpus(request, api), { module: request.module, route, mode, resultOnly, ...nominalPrimitiveSubtypeBrowserExpected(mode) });
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

test("primitive-base browser records keep both npm modes and complete source-free browser callers", async () => {
	for(const mode of nominalPrimitiveSubtypeBrowserModes)
	{
		const receipt = JSON.parse(await readFile(`docs/evidence/nominal-primitive-subtype-npm-20261014/ordinary/${mode}/records/build-0/component-package-receipt.json`));
		const paths = nominalPrimitiveSubtypeBrowserRecords(mode, receipt);
		assert.equal(new Set(paths).size, paths.length);
		for(const path of nominalPrimitiveSubtypeNpmRecordPaths(mode, receipt)) assert.ok(paths.includes(path));
		assert.equal(paths.includes("callers/index.mts"), mode === "full");
		for(const profile of nominalPrimitiveSubtypeBrowserProfiles)
		{
			for(const path of ["installed-binding-ir.json", "installed-index.d.ts"
				, "installed-runtime-identity.json", "installed-runtime-package.json"
				, "installed-component-package.json", "install.json", "inputs.json"
				, "observations.json", "report.json", "request.json"
				, "fixtures/nominal-primitive-subtype-consumers/browser.mjs"
				, "fixtures/nominal-primitive-subtype-consumers/javascript.mjs"]
			) assert.ok(paths.includes(profile + "/" + path));
			assert.equal(paths.includes(profile + "/worker.mjs"), profile === "browser-worker");
		}
	}
	const source = await readFile("tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs", "utf8");
	for(const step of ["await checkNominalPrimitiveSubtypeNpmReport(original,", "await checkNominalPrimitiveSubtypeBrowsers({", "await checkNominalPrimitiveSubtypeBrowserReport(original,"])
		assert.ok(source.indexOf(step) > source.indexOf("await rename(consumer, moved)"));
	assert.ok(source.indexOf("complete = true") > source.indexOf("await checkNominalPrimitiveSubtypeBrowserReport(original,"));
	assert.ok(source.includes('await cp(handoff, join(output, "handoff")'));
});

test("primitive-base browser producer refuses invalid engines and stale outputs before building", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-browser-gates-"));
	t.after(() => rm(directory, { recursive: true }));
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT"));
	const flags = { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST: "1"
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium,firefox,webkit"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES: "ordinary"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES: "full"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT: directory };
	const run = changes => spawnSync(process.execPath, ["--test", "--test-reporter=tap", "tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs"], { env: { ...environment, ...flags, ...changes }, encoding: "utf8", timeout: 15_000 });
	for(const changes of [{ LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium" }
		, { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST: "0" }]
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
