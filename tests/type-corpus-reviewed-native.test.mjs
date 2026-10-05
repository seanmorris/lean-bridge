/**
 * Compile independently reviewed APIs, relocate archives, remove author sources,
 * and compare installed public calls against a separately compiled Lean oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { corpusCatalog, corpusCoverage, corpusProfiles, corpusSelection } from "./helpers/type-corpus.mjs";
import { runNativeCorpusLibrary } from "./helpers/type-corpus-native.mjs";
import { reviewedCorpusIdentity } from "./helpers/type-corpus-reviewed.mjs";

const selection = process.env.LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES;
const profiles = selection ? corpusSelection(selection) : [];
assert.ok(profiles.every(profile => corpusProfiles[profile].transport === "native"));

test("reviewed native corpus executes installed public APIs after compiler reconciliation", {
	skip: !selection, timeout: Math.max(900_000, profiles.length * 120_000)
}, async t => {
	const reportPath = resolve(`build/type-corpus/reviewed-native-${profiles.toSorted().join("-")}.json`);
	await rm(reportPath, { force: true });
	const inventory = await readTypeSurface(), catalog = corpusCatalog(inventory.document);
	const identity = await reviewedCorpusIdentity(catalog), runs = [];
	for(const library of catalog.libraries)
	{
		try
		{ runs.push(...await runNativeCorpusLibrary(t, library, profiles, { path: "reviewed-ir" })); }
		catch(error)
		{ t.diagnostic(JSON.stringify(error.details ?? {})); throw error; }
	}
	const cells = corpusCoverage(inventory, catalog, runs);
	assert.equal(runs.length, catalog.libraries.length * profiles.length);
	assert.ok(cells.some(cell => cell.path === "reviewed-ir" && cell.status === "observed"));
	assert.ok(cells.filter(cell => cell.path !== "reviewed-ir").every(cell => cell.status === "gap"));
	for(const change of [
		value => { value.path = "ordinary-source"; }
		, value => { delete value.reviewed; }
		, value => { value.reviewed.receipt.modelSha256 = "a".repeat(64); }
		, value => { value.reviewed.model.sourceIdentity.reviewedBindingIr.source += " "; }
		, value => { value.reviewed.model.bindingIr.declarations[0].parameters[0].name = "unreviewed"; }
		, value => { value.reviewed.metadata.producer.invocationIdentitySha256 = "b".repeat(64); }
		, value => { value.reviewed.inputs.pop(); }
		, value => { value.isolation.sourcesRemovedBeforeInstall = false; }
	]) {
		const changed = structuredClone(runs[0]); change(changed);
		assert.throws(() => corpusCoverage(inventory, catalog, [changed]));
	}
	assert.deepEqual(await reviewedCorpusIdentity(catalog), identity, "Corpus inputs changed during execution");
	const summary = { libraries: catalog.libraries.length
		, profiles: profiles.length
		, installedRuns: runs.length
		, catalogCases: runs.reduce((count, run) => count + run.observation.results.length, 0)
		, executedCases: runs.reduce((count, run) => count + run.observation.results.filter(result => ["matched", "rejected-as-expected"].includes(result.status)).length, 0)
		, compileRejectedCases: runs.reduce((count, run) => count + run.observation.results.filter(result => result.status === "rejected-at-compile-time").length, 0)
		, observedCells: cells.filter(cell => cell.status === "observed").length
		, gapCells: cells.filter(cell => cell.status === "gap").length };
	await mkdir(join(reportPath, ".."), { recursive: true });
	await writeFile(reportPath, canonicalJson({ schemaVersion: 1
		, kind: "lean-bridge-reviewed-native-corpus", identity
		, environment: { node: process.version, nodeSha256: sha256(await readFile(process.execPath)), platform: process.platform, arch: process.arch }
		, summary, runs, cells }));
	t.diagnostic(`Compiler-checked reviewed native report: ${JSON.stringify(summary)}`);
});
