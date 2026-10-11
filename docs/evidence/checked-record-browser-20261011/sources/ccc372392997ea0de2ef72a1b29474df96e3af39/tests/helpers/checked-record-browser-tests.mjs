/**
 * Independent caller and author-selection controls, not installed execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { checkCheckedRecords, checkedRecordSnapshot } from "../fixtures/checked-record-browser/javascript.mjs";
import { checkedRecordBrowserRoutes, checkedRecordBrowserSelection, checkedRecordBrowserEngines, checkedRecordBrowserExpected, checkedRecordBrowserPackage, checkedRecordBrowserPhases, checkedRecordBrowserProfiles, validateCheckedRecordBrowserObservation, validateCheckedRecordBrowserPhases } from "./checked-record-browser-fixture.mjs";
import { checkedRecordContracts, checkedRecordReview } from "./checked-record-fixture.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { assertJsonSchema, jsonSchemaErrors } from "./json-schema.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { checkedRecordNpmRecordPaths } from "./checked-record-browser-npm-report.mjs";
import { checkedRecordBrowserRecords } from "./checked-record-browser-report.mjs";

const fullCounts = { checks: 16176, rejections: 3031, calls: 8088, snapshots: 8088, recoveries: 3031 };
const resultCounts = { checks: 2011, rejections: 0, calls: 1002, snapshots: 1002, recoveries: 0 };
const refuse = () => { throw new Error("Component recursive call failed (5)"); };
const fields = (value, names) => {
	if(Object.keys(value).sort().join() !== [...names].sort().join()) throw new TypeError("test does not match the declared copied fields");
};
const interval = value => { fields(value, ["lo", "hi"]); if(value.lo > value.hi) refuse(); return value; };
const triple = value => { fields(value, ["data"]); if(value.data.length !== 3) refuse(); return value.data; };
const model = () => ({
	width: value => { interval(value); return value.hi - value.lo; }
	, span: (left, right) => { interval(left); interval(right); return right.hi > left.lo ? right.hi - left.lo : 0n; }
	, total: value => triple(value).reduce((sum, item) => sum + item, 0n)
	, firstOf: value => triple(value)[0]
	, smallest: value => triple(value).reduce((a, b) => a < b ? a : b)
	, scale: (factor, value) => ({ data: triple(value).map(item => item * factor) })
	, repeated: value => ({ data: [value, value, value] })
	, complement: value => { fields(value, ["value"]); if(value.value >= 101n) refuse(); return 100n - value.value; }
});

const observation = (profile, route) => ({
	schemaVersion: 1, profile, module: "checkedrecords"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: { module: "checkedrecords", route, resultOnly: route.startsWith("result-only-"), ...checkedRecordBrowserExpected(route) }
	, hostVersion: "test-only-version" });
const phases = (profile, route) => checkedRecordBrowserEngines.flatMap(engine => (profile === "browser-react" ? ["production", "strict"] : ["production"])
	.flatMap(variant => checkedRecordBrowserPhases(profile).map(phase => ({ engine, variant, phase, observation: observation(profile, route) }))));

test("checked-record browser observations bind complete snapshots and recovery to each author route", () => {
	assert.deepEqual(checkedRecordBrowserProfiles, ["browser-javascript", "browser-react", "browser-worker"]);
	assert.deepEqual(checkedRecordBrowserEngines, ["chromium", "firefox", "webkit"]);
	for(const route of checkedRecordBrowserRoutes) for(const profile of checkedRecordBrowserProfiles)
	{
		assert.deepEqual(checkedRecordBrowserExpected(route), route.startsWith("result-only-") ? resultCounts : fullCounts);
		validateCheckedRecordBrowserObservation(observation(profile, route), profile, route);
		for(const mutate of [...["checks", "rejections", "calls", "snapshots", "recoveries"].map(key => value => { value.results[key]--; })
			, value => { value.results.route = "wrong-route"; }
			, value => { value.results.resultOnly = !value.results.resultOnly; }
			, value => { value.realm = "wrong-realm"; }
			, value => { value.hostVersion = ""; }
			, value => { value.module = "other"; }
			, value => { value.results.module = "other"; }
			, value => { value.profile = "node-javascript"; }
			, value => { value.extra = true; }]) {
			const changed = observation(profile, route); mutate(changed);
			assert.throws(() => validateCheckedRecordBrowserObservation(changed, profile, route));
			}
	}
	assert.throws(() => validateCheckedRecordBrowserObservation(observation("browser-worker", "ordinary-source"), "unknown", "ordinary-source"));
});

test("each checked-record author route requires twelve browser executions and fifty-one lifecycle observations", () => {
	for(const route of checkedRecordBrowserRoutes)
	{
		assert.equal(checkedRecordBrowserProfiles.flatMap(profile => phases(profile, route)).length, 51);
		for(const profile of checkedRecordBrowserProfiles)
		{
			const original = phases(profile, route);
			validateCheckedRecordBrowserPhases(original, profile, checkedRecordBrowserEngines, route);
			for(const index of original.keys())
			{
				const changed = structuredClone(original); changed[index].observation.results.snapshots--;
				assert.throws(() => validateCheckedRecordBrowserPhases(changed, profile, checkedRecordBrowserEngines, route));
				assert.throws(() => validateCheckedRecordBrowserPhases(original.filter((_, at) => at !== index), profile, checkedRecordBrowserEngines, route));
			}
			for(const changed of [[...original, original[0]], [...original].reverse(), original.filter(item => item.variant !== "strict")])
				if(JSON.stringify(changed) !== JSON.stringify(original)) assert.throws(() => validateCheckedRecordBrowserPhases(changed, profile, checkedRecordBrowserEngines, route));
			for(const engines of [[], ["unknown"], ["chromium", "chromium"], ["chromium"], [...checkedRecordBrowserEngines].reverse()])
				assert.throws(() => validateCheckedRecordBrowserPhases(original, profile, engines, route));
		}
	}
});

test("the checked-record browser wrapper executes the shared public caller in every selected mode", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-wrapper-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await saveLakeFile(directory, "browser.mjs", await readFile("tests/fixtures/checked-record-browser/browser.mjs"));
	await saveLakeFile(directory, "check.mjs", await readFile("tests/fixtures/checked-record-browser/javascript.mjs"));
	const { executeCorpus } = await import(pathToFileURL(join(directory, "browser.mjs")).href);
	for(const route of checkedRecordBrowserRoutes) for(const profile of checkedRecordBrowserProfiles)
	{
		const request = { module: "checkedrecords", profile, route, resultOnly: route.startsWith("result-only-") };
		const api = request.resultOnly ? { repeated: model().repeated } : model();
		assert.deepEqual(executeCorpus(request, api), observation(profile, route).results);
		const throwing = new Proxy({}, { get: () => () => { throw new Error("actual public call"); } });
		assert.throws(() => executeCorpus(request, throwing), /actual public call/u);
		for(const change of [{ module: "other" }, { profile: "node-javascript" }, { resultOnly: undefined }, { route: "" }, { resultOnly: !request.resultOnly }])
			assert.throws(() => executeCorpus({ ...request, ...change }, api), /Wrong|Missing/u);
	}
	assert.ok(checkedRecordBrowserPackage.includes('import("checkedrecords")'));
	assert.doesNotMatch(checkedRecordBrowserPackage, /runtime\.call|raw:/u);
});

test("checked-record browser acceptance retains every build, install, relocation and lifecycle original", async () => {
	assert.equal(new Set(checkedRecordBrowserRecords).size, checkedRecordBrowserRecords.length);
	for(const path of checkedRecordNpmRecordPaths) assert.ok(checkedRecordBrowserRecords.includes(path));
	for(const path of ["report.json", "configuration.json", "expected.binding-ir.json", "install.json", "index.mjs", "index.mts", "check.mjs", "installed.json", "relocated.json"])
		assert.ok(checkedRecordNpmRecordPaths.includes(path));
	for(const attempt of [0, 1]) for(const path of ["binding/binding-ir.json", "locks/compiler-adapters.json", "locks/component-build-plan.json", "metadata/provenance.json", "component-package-receipt.json", "CheckedRecords.lean"])
		assert.ok(checkedRecordNpmRecordPaths.includes(`build-${attempt}/${path}`));
	for(const profile of checkedRecordBrowserProfiles) for(const path of ["install.json", "observations.json", "report.json", "inputs.json", "package-lock.json", "request.json", "javascript.mjs", "check.mjs", "installed-index.d.ts", "installed-binding-ir.json", "installed-runtime-identity.json", "installed-runtime-package.json", "installed-component-package.json"])
		assert.ok(checkedRecordBrowserRecords.includes(`${profile}/${path}`));
	const source = await readFile("tests/helpers/checked-record-browser-installed-tests.mjs", "utf8");
	for(const required of ['await rm(author, { recursive: true })', 'await rename(consumer, moved)', '"--skipLibCheck", "false"', 'await checkCheckedRecordNpmReport(original,', 'await checkCheckedRecordBrowserReport(original,'])
		assert.ok(source.includes(required), required);
	const browser = source.lastIndexOf("await checkCheckedRecordBrowsers(");
	assert.ok(browser > source.indexOf("await rename(consumer, moved)"));
	assert.ok(browser > source.indexOf("await checkCheckedRecordNpmReport(original,"));
	assert.ok(source.includes("assert.ok(enabled"));
});

test("checked-record browser selections keep all four full and result-only author routes separate", () => {
	assert.deepEqual(checkedRecordBrowserRoutes, ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"]);
	for(const route of checkedRecordBrowserRoutes)
	{
		const { configuration, expected, resultOnly, reviewed } = checkedRecordBrowserSelection(route);
		validateBindingIr(expected);
		assert.equal(resultOnly, route.startsWith("result-only-"));
		assert.equal(reviewed, route.endsWith("reviewed-ir"));
		assert.deepEqual(configuration.targets, { npm: { name: "checkedrecords", version: "1.0.0" } });
		if(resultOnly)
		{
			assert.deepEqual(expected.declarations.map(item => item.name), ["repeated"]);
			assert.deepEqual(expected.types.map(item => item.name), ["Triple"]);
			assert.equal(expected.declarations[0].source.extensions["lean-lang.org/refinements"], undefined);
		}
		else assert.deepEqual(expected, checkedRecordReview());
		if(reviewed)
		{
			assert.equal(configuration.contracts, undefined); assert.equal(configuration.exports, undefined);
		}
		else
		{
			const contracts = checkedRecordContracts();
			assert.deepEqual(configuration.exports, resultOnly ? ["CheckedRecords.repeated"] : Object.keys(contracts));
			assert.deepEqual(configuration.contracts, Object.fromEntries(configuration.exports.map(name => [name, contracts[name]])));
		}
	}
	for(const route of [undefined, "", "ordinary", "result-only", "reviewed", "unknown"])
		assert.throws(() => checkedRecordBrowserSelection(route), /Unknown checked-record browser route/u);
});

test("every checked-record browser selection preserves constructors and result-only mirrors in compiler plans", async () => {
	for(const route of checkedRecordBrowserRoutes)
	{
		const { expected, resultOnly } = checkedRecordBrowserSelection(route);
		const generated = generateCompilerAdapters({ analysis: {
			bindingIr: { origin: "lean-elaborated", document: expected, semanticSha256: "1".repeat(64) }
			, exportCandidates: expected.declarations.map(declaration => ({ declaration: declaration.source.declaration, sourceModule: "CheckedRecords", status: "exportable" }))
		}
		, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });
		validateCompilerAdapterPlan(generated.plan);
		await assertJsonSchema("compiler-adapter-plan", generated.plan);
		const plan = generated.plan;
		for(const mutate of [value => { value.privateAbi.types[0].erased = []; }
			, value => { value.privateAbi.types[0].erased = ["proof", "proof"]; }
			, value => { value.privateAbi.types[0].erased = ["1proof"]; }
			, value => { value.privateAbi.types[0].erased = [1]; }
			, value => { value.privateAbi.types[0].erased = Array.from({ length: 1025 }, (_, index) => "proof" + index); }
			, value => { value.privateAbi.types[0].fields = []; }
			, value => { value.privateAbi.types[0].proof = true; }
			, value => { const record = value.privateAbi.types[0]; delete record.fields; record.kind = "alias"; record.target = { kind: "primitive", name: "nat" }; }
			, value => { const record = value.privateAbi.types[0]; delete record.fields; record.kind = "variant"; record.cases = [{ name: "some", fields: [] }]; }
			, value => { value.privateAbi.version = 7; value.privateAbi.dispatch = "copied-nominal-frame-v1"; }
			, value => { value.privateAbi.version = 9; value.privateAbi.dispatch = "copied-callable-frame-v1"; value.privateAbi.callbacks = [{ id: "lean:Callback", key: "1".repeat(40), parameters: [{ kind: "primitive", name: "nat" }], result: { kind: "primitive", name: "nat" } }]; }]) {
			const changed = structuredClone(plan); mutate(changed);
			assert.notDeepEqual(changed, plan);
			assert.ok(await jsonSchemaErrors("compiler-adapter-plan", changed));
			assert.throws(() => validateCompilerAdapterPlan(changed));
			}
		const overlap = structuredClone(plan);
		overlap.privateAbi.types[0].erased = [overlap.privateAbi.types[0].fields[0].name];
		// Cross-field name disjointness is a runtime semantic check, not JSON Schema syntax.
		assert.throws(() => validateCompilerAdapterPlan(overlap), /erased proof/u);
		assert.equal(generated.plan.privateAbi.version, 8);
		assert.equal(generated.plan.exports.length, resultOnly ? 1 : 8);
		for(const item of generated.plan.exports)
		{
			const declaration = expected.declarations.find(declaration => declaration.id === item.bindingId);
			assert.deepEqual(item.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const source = generated.files["LeanBridgeGenerated.lean"];
		assert.doesNotMatch(source, /sorry|unsafeCast|axiom/u);
		if(resultOnly)
		{
			assert.equal(generated.plan.exports[0].refinements, undefined);
			assert.match(source, /CheckedRecords\.repeated/u);
			assert.doesNotMatch(source, /CheckedRecords\.(mkInterval|mkTriple|sortedTriple|mkPercent)/u);
		}
		else for(const name of ["mkInterval", "mkTriple", "sortedTriple", "mkPercent"])
			assert.ok(source.includes("_root_.CheckedRecords." + name));
	}
});

test("checked-record installed gates reject partial selections and stale outputs before building", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-browser-gates-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const flags = {
		LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST: "0"
		, LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST: "0"
		, LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES: checkedRecordBrowserRoutes.join(",")
		, LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_OUTPUT: directory
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: checkedRecordBrowserEngines.join(",") };
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT"));
	const run = changes => spawnSync(process.execPath, ["--test", "--test-reporter=tap", "tests/helpers/checked-record-browser-installed-tests.mjs"], {
		env: { ...environment, ...flags, ...changes }
		, encoding: "utf8", timeout: 15_000 });
	const disabled = run({});
	assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
	assert.match(disabled.stdout, /# skipped 4/u);
	for(const changes of [
		{ LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST: "yes" }
		, { LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST: "yes" }
		, { LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST: "1" }
		, { LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES: "" }
		, { LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST: "1", LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST: "1", LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium" }
	]) {
		const result = run(changes);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.doesNotMatch(result.stdout, /npm author/u);
	}
	await mkdir(join(directory, "ordinary-source"));
	const stale = run({ LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST: "1", LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES: "ordinary-source" });
	assert.equal(stale.status, 1, stale.stdout + stale.stderr);
	assert.match(stale.stdout, /Missing expected rejection/u);
	assert.doesNotMatch(stale.stdout, /npm author/u);
});

test("checked-record snapshots preserve every field, value kind, array hole and absent property", () => {
	for(const [left, right] of [[1n, 1], [1n, "1n"], [0, -0], [undefined, null], [Array(1), [undefined]], [{}, { data: undefined }], [{ lo: 1n, hi: 2n }, { lo: 1n, hi: 3n }], [{ data: [1n, 2n, 3n] }, { data: [1n, 2n, 3n], sized: true }]])
		assert.notEqual(checkedRecordSnapshot(left), checkedRecordSnapshot(right));
	let touched = false;
	const getter = { /** Refuse side effects in the snapshot oracle. */ get data() { touched = true; return []; } };
	const cycle = {}; cycle.self = cycle;
	for(const input of [getter, cycle, new Date(), { [Symbol("hidden")]: 1 }]) assert.throws(() => checkedRecordSnapshot(input), /snapshot/iu);
	assert.equal(touched, false);
	assert.equal(checkedRecordSnapshot({ lo: 1n, hi: 2n }), checkedRecordSnapshot({ hi: 2n, lo: 1n }));
});

test("the checked-record public corpus requires each original operation plus full snapshots and recovery", () => {
	const api = model();
	assert.deepEqual(checkCheckedRecords(api), fullCounts);
	const mutations = [
		{ width: () => 0n }
		, { span: (left, right) => right.hi - left.lo }
		, { span: (left, right) => {
			if(right.lo > right.hi)
			{ left.hi = 999n; refuse(); }
			return api.span(left, right);
		} }
		, { span: (left, right) => {
			if(left.lo > left.hi)
			{ right.lo = 999n; refuse(); }
			return api.span(left, right);
		} }
		, { total: value => value.data.reduce((sum, item) => sum + item, 0n) }
		, { firstOf: value => api.smallest(value) }
		, { smallest: value => api.firstOf(value) }
		, { smallest: value => { value.data.sort((a, b) => a < b ? -1 : a > b ? 1 : 0); return api.smallest(value); } }
		, { smallest: value => {
			if(value.data.length !== 3)
			{ value.data.push(42n); refuse(); }
			return api.smallest(value);
		} }
		, { scale: (factor, value) => { const result = api.scale(factor, value); value.data[0] = 999n; return result; } }
		, { repeated: value => ({ data: [value, value, value], sized: true }) }
		, { repeated: value => ({ data: [Number(value), Number(value), Number(value)] }) }
		, { complement: value => 100n - value.value }
		, { width: value => { if(value.lo > value.hi) throw new Error("Component recursive call failed (1)"); return api.width(value); } }
		, { width: value => { if(Object.hasOwn(value, "ordered")) refuse(); return api.width(value); } }
	];
	for(const mutation of mutations) assert.throws(() => checkCheckedRecords({ ...model(), ...mutation }), /failed:|accepted:/u);
	for(const name of Object.keys(api)) assert.throws(() => checkCheckedRecords({ ...model(), [name]: undefined }), /not a function/u);
});

test("result-only checked-record calls require erased results and no checked-input exports", () => {
	const api = { repeated: model().repeated };
	assert.deepEqual(checkCheckedRecords(api, true), resultCounts);
	for(const changed of [model(), { repeated: value => ({ data: [value, value] }) }, { repeated: value => ({ data: [value, value, value], sized: true }) }, { repeated: value => ({ data: [value, value, BigInt(Number(value))] }) }])
		assert.throws(() => checkCheckedRecords(changed, true), /failed:/u);
	assert.throws(() => checkCheckedRecords(api, "true"), /boolean/u);
});

test("full and result-only checked-record TypeScript consumers keep payload-only declarations", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-browser-types-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const route of checkedRecordBrowserRoutes)
	{
		const { expected, resultOnly } = checkedRecordBrowserSelection(route), directory = join(root, route);
		for(const [path, source] of Object.entries(generateJavaScriptPackage(expected)))
			await saveLakeFile(join(directory, "node_modules/checkedrecords"), path, source);
		await saveLakeFile(directory, "index.mts", await readFile(`tests/fixtures/checked-record-browser/${resultOnly ? "result-only" : "full"}.mts`));
		await runCopied(process.execPath, [resolve("node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"], directory);
	}
});
