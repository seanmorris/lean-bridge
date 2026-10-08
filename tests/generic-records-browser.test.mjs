/**
 * Alias-named generic records of installed npm packages in browser pages, React effects and workers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import "./helpers/component-package-handoff-tests.mjs";
import "./helpers/generic-record-browser-source-history-tests.mjs";
import "./helpers/generic-record-browser-evidence-tests.mjs";
import "./helpers/generic-record-browser-archive-source-history-tests.mjs";
import "./helpers/browser-generic-promotion-source-history-tests.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { genericRecordInstantiations, genericRecordProvenanceOnly } from "./helpers/generic-record-packages.mjs";
import { checkGenericRecordBrowserPackages, genericRecordArrayExports, genericRecordArrayInstantiations, genericRecordBrowserConfiguration, genericRecordBrowserExpected, genericRecordBrowserInstantiations, genericRecordBrowserProfiles, genericRecordBrowserSource, genericRecordBrowserSpecializations, validateGenericRecordBrowserObservation } from "./helpers/generic-record-browser.mjs";
import { executeCorpus } from "./fixtures/generic-record-browser/javascript.mjs";

const enabled = process.env.LEAN_BRIDGE_GENERIC_RECORD_BROWSER_TEST === "1";
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
const fixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-record-browser-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	return { directory, root };
};
const build = (root, outputRoot) => buildCanonicalProject({ projectRoot: root, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() });

// A host-side model of the installed API: exact Lean results behind the package's shape checks.
const natural = value => { if(typeof value !== "bigint" || value < 0n) throw new TypeError("Nat"); return value; };
const string = value => { if(typeof value !== "string") throw new TypeError("String"); return value; };
const record = fields => value => {
	if(typeof value !== "object" || value === null || Object.keys(value).sort().join() !== Object.keys(fields).sort().join()) throw new TypeError("record");
	return Object.fromEntries(Object.entries(fields).map(([name, check]) => [name, check(value[name])]));
};
const array = element => value => { if(!Array.isArray(value)) throw new TypeError("Array"); return value.map(element); };
const option = element => value => value?.tag === "none" ? value : value?.tag === "some" ? { tag: "some", value: element(value.value) } : (() => { throw new TypeError("Option"); })();
const natBox = record({ value: natural, count: natural }), textBox = record({ value: string, count: natural });
const specializedEcho = { echoNatBox: natBox, echoAgain: natBox, echoTextBox: textBox, echoLeft: natBox, echoRight: natBox };
Object.assign(specializedEcho, { echoBoxes: array(natBox), echoOptionalBoxes: option(array(natBox)), echoNats: array(natural), echoOptionalNat: option(natural) });
const faithfulApi = () => ({
	bump: value => (box => ({ value: box.value + 1n, count: box.count + 1n }))(natBox(value))
	, again: value => (box => ({ value: box.value * 2n, count: box.count }))(natBox(value))
	, shout: value => (box => ({ value: `${box.value}!`, count: box.count }))(textBox(value))
	, swapNamed: value => (pair => ({ first: `${pair.first}!`, second: pair.second + 1n }))(record({ first: string, second: natural })(value))
	, orZero: value => (box => (box.value.tag === "some" ? box.value.value : 0n) + box.count)(record({ value: option(natural), count: natural })(value))
	, total: value => array(natBox)(value).reduce((sum, box) => sum + box.value, 0n)
	, firstBoxes: count => natural(count) === 0n ? { tag: "none" } : { tag: "some", value: Array.from({ length: Number(count) }, (_, n) => ({ value: BigInt(n), count })) }
	, unpair: value => (pair => pair.first.value + BigInt([...pair.second.value].length))(record({ first: natBox, second: textBox })(value))
	, retag: value => (tagged => ({ tag: `${tagged.tag}#`, payload: tagged.payload + 1n }))(record({ tag: string, payload: natural })(value))
	, relabel: value => ({ label: `${record({ label: string })(value).label}?` })
	, pushCount: value => (box => ({ value: [...box.value, box.count], count: box.count + 1n }))(record({ value: array(natural), count: natural })(value))
	, rowTotal: value => array(natBox)(value).reduce((sum, box) => sum + box.value * box.count, 0n)
	, rowOf: count => Array.from({ length: Number(natural(count)) }, (_, n) => ({ value: BigInt(n), count }))
	, rowBoxSum: value => (box => box.value.reduce((sum, item) => sum + item.value, box.count))(record({ value: array(natBox), count: natural })(value))
	// Each specialization of echo returns its checked argument.
	, ...specializedEcho });
// The descriptor's record definitions, as the compiler emits them for this fixture.
const descriptor = () => {
	const fields = () => [{ name: "value" }, { name: "count" }];
	const extensions = instantiation => instantiation ? { "lean-lang.org/instantiation": instantiation } : {};
	const types = Object.entries(genericRecordBrowserInstantiations()).map(([id, instantiation]) => ({ id, kind: "record", fields: fields(), source: { extensions: extensions(instantiation) } }));
	const site = type => ({ type });
	const tag = { kind: "named", id: "lean:OnboardingSmall.MarkerTag" };
	const marker = { id: "lean:OnboardingSmall.relabel", typeParameters: [], source: { declaration: "OnboardingSmall.relabel" }, parameters: [site(tag)], result: site(tag) };
	const specialized = Object.entries(genericRecordBrowserSpecializations()).map(([id, type]) => ({ id, typeParameters: [], source: { declaration: "OnboardingSmall.echo" }, parameters: [site(type)], result: site(type) }));
	const declarations = [marker, ...specialized];
	return { bindingIr: { types, declarations } };
};

test("the shared browser generic-record checks fail on a permissive API, wrong values or a changed origin", () => {
	const request = { module: "onboarding-small" };
	const result = executeCorpus(request, { ...faithfulApi(), descriptor: descriptor() });
	assert.deepEqual(result, { module: "onboarding-small", ...genericRecordBrowserExpected, instantiations: genericRecordBrowserInstantiations(), specializations: genericRecordBrowserSpecializations() });
	// Every rejection must come from the package: an API that accepts anything fails the first check.
	const permissive = new Proxy({}, { get: (_, name) => name === "descriptor" ? descriptor() : () => 0n });
	assert.throws(() => executeCorpus(request, permissive), /failed: bump/u);
	// An API without shape checks on Array elements is caught by the element cases.
	const unchecked = { ...faithfulApi(), descriptor: descriptor(), rowTotal: value => value.reduce((sum, box) => sum + (box.value ?? 0n) * (box.count ?? 0n), 0n) };
	assert.throws(() => executeCorpus(request, unchecked), /accepted: row element 0/u);
	// A result that mutates its caller's Array fails, because callers pass frozen values.
	assert.throws(() => executeCorpus(request, { ...faithfulApi(), descriptor: descriptor(), pushCount: value => { value.value.push(value.count); return value; } }));
	// Two aliases that drift apart, or a phantom argument in a signature, fail the identity checks.
	const drifted = descriptor();
	drifted.bindingIr.types.find(type => type.id.endsWith(".NatBoxAgain")).fields.reverse();
	assert.throws(() => executeCorpus(request, { ...faithfulApi(), descriptor: drifted }), /failed: two aliases of one application keep two definitions/u);
	const generic = descriptor();
	generic.bindingIr.declarations.push({ ...generic.bindingIr.declarations[1], id: "lean:OnboardingSmall.echo" });
	assert.throws(() => executeCorpus(request, { ...faithfulApi(), descriptor: generic }), /failed: the generic declaration is not exported/u);
	const exposed = descriptor();
	exposed.bindingIr.declarations[0].parameters[0].type.id = "lean:OnboardingSmall.Marker";
	assert.throws(() => executeCorpus(request, { ...faithfulApi(), descriptor: exposed }), /failed: the phantom argument is never a signature type/u);
});

test("each browser observation must carry every record's exact origin from its own realm", () => {
	const results = { module: "onboarding-small", ...genericRecordBrowserExpected, instantiations: genericRecordBrowserInstantiations(), specializations: genericRecordBrowserSpecializations() };
	for(const profile of genericRecordBrowserProfiles)
	{
		const realm = profile === "browser-worker" ? "dedicated-worker" : "window";
		const observation = { schemaVersion: 1, profile, module: "onboarding-small", realm, results, hostVersion: "1.0" };
		validateGenericRecordBrowserObservation(observation, profile);
		assert.throws(() => validateGenericRecordBrowserObservation({ ...observation, realm: realm === "window" ? "dedicated-worker" : "window" }, profile));
		assert.throws(() => validateGenericRecordBrowserObservation({ ...observation, results: { ...results, checks: results.checks - 1 } }, profile));
		const changed = structuredClone(results);
		changed.instantiations["lean:OnboardingSmall.RowBox"].arguments[0].arguments[0].id = "lean:OnboardingSmall.NatBoxAgain";
		assert.throws(() => validateGenericRecordBrowserObservation({ ...observation, results: changed }, profile));
	}
	// The expected origins name every fixture alias, both Array-field aliases and the phantom-only Marker.
	assert.deepEqual(Object.keys(genericRecordBrowserInstantiations()).map(id => id.split(".").at(-1)).sort()
		, [...Object.keys(genericRecordInstantiations), "LeftBox", "RightBox", ...Object.keys(genericRecordArrayInstantiations), ...genericRecordProvenanceOnly].sort());
	// Every configured specialization is a public export, and its observed closed type is pinned.
	const configuration = genericRecordBrowserConfiguration("OnboardingSmall");
	assert.deepEqual(Object.keys(genericRecordBrowserSpecializations()), configuration.specializations.map(item => `lean:${item.name}`).sort());
	assert.ok(configuration.specializations.every(item => configuration.exports.includes(item.name)));
	assert.ok(genericRecordArrayExports.every(name => configuration.exports.includes(`OnboardingSmall.${name}`)));
});

test("the Array-field declarations extend the shared fixture without changing it", async () => {
	const shared = await readFile("tests/fixtures/onboarding/generic-records/GenericRecords.lean", "utf8");
	const source = await genericRecordBrowserSource("GenericRecords");
	assert.ok(source.startsWith(shared));
	for(const name of Object.keys(genericRecordArrayInstantiations)) assert.match(source, new RegExp(`^abbrev ${name} := Box \\(Array `, "mu"));
	for(const name of genericRecordArrayExports) assert.match(source, new RegExp(`^def ${name} `, "mu"));
});

test("CI runs the browser generic-record gate in all three engines and keeps its report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split(/(?=^ {6}- )/mu).find(item => item.includes("id: generic_record_browser\n"));
	// The gate variable is set, so the installed test cannot skip, and an empty report fails the step.
	const gate = "LEAN_BRIDGE_GENERIC_RECORD_BROWSER_TEST: \"1\"", engines = "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit";
	const engine = "LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine";
	const command = "node --test --test-concurrency=1 tests/generic-records-browser.test.mjs\n          test -s build/generic-records/browser.json\n";
	for(const line of [gate, engines, engine, command]) assert.ok(step?.includes(line), line);
	assert.doesNotMatch(step, /continue-on-error/u);
	assert.ok(workflow.includes("name: generic-records-browser-${{ github.sha }}\n          path: build/generic-records/browser.json\n          if-no-files-found: error\n"));
	// The locked engine and the three Playwright engines are prepared earlier in the same job.
	const position = workflow.indexOf("id: generic_record_browser\n"), job = workflow.lastIndexOf("\n  node-consumers:\n", position);
	assert.ok(job > 0);
	assert.doesNotMatch(workflow.slice(job + "\n  node-consumers:\n".length, position), /^ {2}[a-z][\w-]*:$/mu, "the step belongs to the node-consumers job");
	for(const prerequisite of ["bash scripts/install-playwright-browsers.sh chromium firefox webkit", "nix build .#component-build-engine --out-link build/locked-lake-engine"])
		assert.ok(workflow.lastIndexOf(prerequisite, position) > job, prerequisite);
});

test("installed npm generic records run in browser pages, React effects and dedicated workers", { skip: !enabled, timeout: 3_600_000 }, async t => {
	const observation = await checkGenericRecordBrowserPackages(t, { fixture, build, runtimeRoot });
	for(const profile of genericRecordBrowserProfiles)
	{
		const item = observation.observations.find(entry => entry.profile === profile);
		assert.deepEqual(item.browser.executions.map(execution => execution.engine), observation.requestedEngines.flatMap(engine => profile === "browser-react" ? [engine, engine] : [engine]), profile);
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_GENERIC_RECORD_BROWSER_REPORT ?? "build/generic-records/browser.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm-browser", ...observation }));
});
