/**
 * Differential real-Lean corpus, exact installed archives and explicit gaps.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { corpusCatalog, corpusCoverage, corpusIdentity, corpusProfiles, corpusSelection, validateCorpusObservation } from "./helpers/type-corpus.mjs";
import { runNativeCorpusLibrary } from "./helpers/type-corpus-native.mjs";

const repository = resolve(import.meta.dirname, "..");
const inventory = await readTypeSurface();
const catalog = corpusCatalog(inventory.document);
const profiles = corpusSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_PROFILES);

// Synthetic observations exercise the report validator only. They never become
// installed evidence, and only the real compiler test writes the corpus report.
const validationFixture = (profile = "python", libraryId = "shop") => {
	const library = catalog.libraries.find(library => library.id === libraryId);
	const cases = catalog.cases.filter(entry => entry.library === library.id);
	const oracle = Object.fromEntries(cases.filter(entry => entry.oracleKey !== null)
		.map(entry => [entry.oracleKey, entry.resultEncoding === "value" ? { string: `validator-only:${entry.id}` } : { [entry.resultEncoding]: "0" }]));
	const observation = { schemaVersion: 1, profile
		, module: library[`${profile}Module`]
		, hostVersion: profile === "ruby" ? "3.3.12" : "3.11.2"
		, results: cases.map(entry => entry.expectation.kind === "lean-oracle"
			? { id: entry.id, status: "matched", observed: oracle[entry.oracleKey], independentCopy: entry.checkIndependentCopy }
			: { id: entry.id, status: "rejected-as-expected", exception: corpusProfiles[profile].errors[entry.expectation.category], recovered: true }) };
	return { library: library.id, profile, path: "ordinary-source"
		, archiveSha256: "a".repeat(64)
		, archive: { sha256: "a".repeat(64), target: corpusProfiles[profile].target }
		, runtimeIdentity: "b".repeat(64), bindingIrSha256: "c".repeat(64)
		, oracle, observation };
};

test("corpus cases cover two renamed nested libraries, valid positions and explicit host errors", () => {
	assert.equal(catalog.cases.length, 124);
	assert.equal(catalog.cases.filter(entry => entry.expectation.kind === "lean-oracle").length, 84);
	assert.equal(catalog.cases.filter(entry => entry.expectation.kind === "host-rejection").length, 40);
	assert.equal(new Set(catalog.libraries.flatMap(library => library.operations)).size, 38);
	assert.ok(catalog.libraries.every(library => library.module.includes(".")));
	assert.deepEqual(catalog.libraries.map(library => library.pendingShape), ["option", "result"]);
	assert.ok(catalog.cases.every(entry => entry.coverage.every(claim => !claim.positions.includes("signature"))));
	const changed = structuredClone(inventory.document);
	changed.shapes = changed.shapes.filter(shape => shape.id !== "nat");
	assert.throws(() => corpusCatalog(changed), /Unknown corpus shape: nat/);
});

test("corpus identity binds the cases, consumers, Lean sources, oracles and harness", async () => {
	const identity = await corpusIdentity(repository, catalog);
	assert.match(identity.sha256, /^[a-f0-9]{64}$/);
	assert.equal(identity.files.length, 14);
	assert.equal(new Set(identity.files.map(file => file.path)).size, 14);
	assert.ok(identity.files.every(file => file.bytes > 0 && /^[a-f0-9]{64}$/.test(file.sha256)));
	assert.ok(identity.files.some(file => file.path === "tests/helpers/lake-workspace.mjs"));
	assert.ok(identity.files.some(file => file.path.endsWith("consumers/python.py")));
	assert.ok(identity.files.some(file => file.path.endsWith("consumers/ruby.rb")));
	assert.deepEqual(identity.catalog, catalog);
	assert.deepEqual(await corpusIdentity(repository, catalog), identity);
	const changed = structuredClone(catalog);
	changed.cases[0].arguments[0].integer = "8";
	assert.notEqual((await corpusIdentity(repository, changed)).sha256, identity.sha256);
});

test("every inventoried profile and position remains a gap without executed cases", () => {
	const before = canonicalJson(inventory);
	const cells = corpusCoverage(inventory, catalog);
	assert.equal(cells.length, 6562);
	assert.equal(new Set(cells.map(cell => cell.profile)).size, 17);
	assert.equal(new Set(cells.map(cell => cell.shape)).size, 48);
	assert.ok(cells.every(cell => cell.status === "gap" && cell.cases.length === 0 && cell.owner > 0));
	assert.ok(cells.some(cell => cell.reason === "adapter-not-implemented"));
	assert.ok(cells.some(cell => cell.reason === "source-path-not-implemented"));
	assert.ok(cells.some(cell => cell.reason === "case-not-executed"));
	assert.equal(canonicalJson(inventory), before);
});

test("validator-only observations cannot cross source paths, profiles or uncovered positions", () => {
	const cells = corpusCoverage(inventory, catalog, [validationFixture()]);
	const observed = cells.filter(cell => cell.status === "observed");
	assert.equal(observed.length, 41);
	assert.ok(observed.every(cell => cell.profile === "python" && cell.path === "ordinary-source"));
	assert.ok(observed.every(cell => cell.reason === "scoped-cases-only" && cell.cases.every(id => id.startsWith("shop/"))));
	assert.ok(cells.filter(cell => cell.position.startsWith("callback") || cell.shape === "proof" || cell.shape === "option")
		.every(cell => cell.status === "gap"));
});

for(const [label, change] of [
	["missing case", run => run.observation.results.pop()]
	, ["duplicate case", run => { run.observation.results[0] = run.observation.results[1]; }]
	, ["extra case", run => run.observation.results.push({ id: "unknown" })]
	, ["wrong value", run => { run.observation.results[0].observed = { integer: "0" }; }]
	, ["wrong consumer profile", run => { run.observation.profile = "perl"; }]
	, ["wrong module", run => { run.observation.module = "lean_alpha"; }]
	, ["unverified copy", run => { run.observation.results.find(entry => entry.id === "shop/record").independentCopy = false; }]
	, ["wrong host error", run => { run.observation.results.at(-1).exception = "WrongError"; }]
	, ["failed recovery", run => { run.observation.results.at(-1).recovered = false; }]
	, ["missing oracle result", run => { delete run.oracle.dependency; }]
	, ["extra oracle result", run => { run.oracle.extra = {}; }]
	, ["unimplemented adapter", run => { run.profile = "perl"; }]
	, ["unimplemented source path", run => { run.path = "reviewed-ir"; }]
	, ["unknown library", run => { run.library = "unknown"; }]
	, ["missing runtime identity", run => { delete run.runtimeIdentity; }]
	, ["invalid archive hash", run => { run.archiveSha256 = "not-a-hash"; }]
	, ["different archive hash", run => { run.archive.sha256 = "d".repeat(64); }]
	, ["wrong archive target", run => { run.archive.target = "rubygems"; }]
	, ["cross-profile observation", run => { run.observation = validationFixture("ruby").observation; }]
	, ["incorrect floating-point bits", run => { run.observation.results.find(entry => entry.id === "shop/float32-zero").observed = { float32: "2147483648" }; }]
]) test(`corpus report rejects ${label}`, () => {
	const run = validationFixture();
	change(run);
	assert.throws(() => corpusCoverage(inventory, catalog, [run]));
});

test("the corpus rejects duplicate runs and accepts only complete observations", () => {
	const run = validationFixture();
	validateCorpusObservation(catalog.libraries[0], catalog.cases.filter(entry => entry.library === "shop"), run.oracle, run.observation);
	assert.throws(() => corpusCoverage(inventory, catalog, [run, structuredClone(run)]), /Duplicate corpus run/);
});

test("explicit corpus selections reject absent, misspelled and duplicate adapters", () => {
	assert.deepEqual(corpusSelection(undefined), []);
	assert.deepEqual(corpusSelection("ruby, python"), ["python", "ruby"]);
	for(const selection of ["", "python,", "PYTHON", "python,python", "perl", null, []])
		assert.throws(() => corpusSelection(selection));
});

test("the shared inputs cover all sixteen primitive parameter/result positions", () => {
	const cells = corpusCoverage(inventory, catalog, [validationFixture(), validationFixture("ruby", "telemetry")]);
	assert.equal(cells.filter(cell => cell.status === "observed").length, 82);
	for(const profile of ["python", "ruby"])
	{
		for(const shape of inventory.document.irFacets.primitive)
		{
			for(const position of ["parameter", "result"])
				assert.equal(cells.find(cell => cell.profile === profile && cell.shape === shape && cell.path === "ordinary-source" && cell.position === position).status, "observed");
		}
	}
	assert.ok(cells.filter(cell => cell.profile === "perl").every(cell => cell.status === "gap"));
	for(const shape of ["float32", "float64"])
	{
		const floating = catalog.cases.filter(entry => entry.resultEncoding === shape);
		assert.equal(floating.length, 16);
		assert.ok(floating.every(entry => entry.coverage[0].shape === shape));
		assert.ok(floating.some(entry => entry.arguments[0][shape] === "nan"));
	}
});

test("profile-specific host errors cannot be borrowed from another adapter", () => {
	const ruby = validationFixture("ruby");
	const negative = ruby.observation.results.find(entry => entry.id === "shop/negative-nat");
	assert.equal(negative.exception, "RangeError");
	negative.exception = "ValueError";
	assert.throws(() => corpusCoverage(inventory, catalog, [ruby]));
	const unsupported = validationFixture("ruby");
	unsupported.observation.hostVersion = "3.4.0";
	assert.throws(() => corpusCoverage(inventory, catalog, [unsupported]));
});

test("real Lean corpus matches independently rebuilt archives in source-free consumers", {
	skip: profiles.length === 0, timeout: 900_000
}, async t => {
	const reportName = `${profiles.join("-")}.json`;
	const reportPath = resolve(repository, "build/type-corpus", reportName);
	await rm(reportPath, { force: true });
	const identity = await corpusIdentity(repository, catalog);
	const runs = [];
	try
	{
		for(const library of catalog.libraries) runs.push(...await runNativeCorpusLibrary(t, library, profiles));
	}
	catch(error)
	{
		if(error.details) t.diagnostic(JSON.stringify(error.details));
		throw error;
	}
	assert.notDeepEqual(runs.find(run => run.library === "shop").oracle.dependency, runs.find(run => run.library === "telemetry").oracle.dependency);
	for(const library of catalog.libraries)
	{
		const selected = runs.filter(run => run.library === library.id);
		assert.deepEqual(selected.map(run => run.profile), profiles);
		for(const run of selected)
		{
			assert.deepEqual(run.oracle, selected[0].oracle);
			assert.equal(run.bindingIrSha256, selected[0].bindingIrSha256);
			assert.equal(run.runtimeIdentity, selected[0].runtimeIdentity);
		}
	}
	assert.deepEqual(await corpusIdentity(repository, catalog), identity, "Corpus inputs changed during execution");
	const cells = corpusCoverage(inventory, catalog, runs);
	const observed = cells.filter(cell => cell.status === "observed").length;
	const report = { schemaVersion: 1, kind: "real-lean-type-corpus"
		, scope: "scoped-cases-not-full-type-support"
		, host: { platform: process.platform, architecture: process.arch
			, node: process.version
			, nativeGlibcFloor: process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" }
		, corpus: identity
		, inventorySha256: sha256(canonicalJson(inventory.document))
		, selectedProfiles: profiles
		, summary: { libraries: catalog.libraries.length, profileRuns: runs.length
			, profiles: inventory.document.profiles.length
			, cases: runs.reduce((count, run) => count + run.observation.results.length, 0)
			, observedCells: observed, gapCells: cells.length - observed
			, rejectedBuilds: catalog.libraries.length }
		, runs, cells };
	await mkdir(resolve(reportPath, ".."), { recursive: true });
	await writeFile(reportPath, canonicalJson(report));
	t.diagnostic(`Corpus report: build/type-corpus/${reportName} (${report.summary.cases} cases, ${observed} scoped cells, ${report.summary.gapCells} gaps)`);
});
