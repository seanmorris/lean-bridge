/**
 * Execute compiler-checked reviewed npm and PHP-Wasm releases without sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { corpusCatalog, corpusCoverage, corpusProfiles, corpusSelection } from "./helpers/type-corpus.mjs";
import { runNpmCorpusLibrary } from "./helpers/type-corpus-node.mjs";
import { runPhpWasmCorpusLibrary } from "./helpers/type-corpus-php-wasm.mjs";
import { reviewedCorpusIdentity } from "./helpers/type-corpus-reviewed.mjs";

const selection = process.env.LEAN_BRIDGE_REVIEWED_WASM_PROFILES;
const profiles = selection ? corpusSelection(selection) : [];
assert.ok(profiles.every(profile => corpusProfiles[profile].transport !== "native"));

test("reviewed Wasm corpus executes installed Node, browser, worker and PHP public APIs", {
	skip: !selection, timeout: 1_200_000
}, async t => {
	const reportPath = resolve(`build/type-corpus/reviewed-wasm-${profiles.toSorted().join("-")}.json`);
	await rm(reportPath, { force: true });
	const inventory = await readTypeSurface(), catalog = corpusCatalog(inventory.document);
	const identity = await reviewedCorpusIdentity(catalog), runs = [];
	for(const library of catalog.libraries)
	{
		const npm = profiles.filter(profile => corpusProfiles[profile].transport === "wasm");
		try
		{
			if(npm.length) runs.push(...await runNpmCorpusLibrary(t, library, npm, { path: "reviewed-ir" }));
			if(profiles.includes("php-wasm")) runs.push(...await runPhpWasmCorpusLibrary(t, library, { path: "reviewed-ir" }));
		}
		catch(error)
		{ t.diagnostic(JSON.stringify(error.details ?? {})); throw error; }
	}
	const cells = corpusCoverage(inventory, catalog, runs);
	assert.equal(runs.length, catalog.libraries.length * profiles.length);
	assert.ok(cells.some(cell => cell.path === "reviewed-ir" && cell.status === "observed"));
	assert.ok(cells.filter(cell => cell.path !== "reviewed-ir").every(cell => cell.status === "gap"));
	for(const original of runs) for(const change of [
		value => { value.path = "ordinary-source"; }
		, value => { delete value.reviewed; }
		, value => { value.reviewed.receipt.bindingIrSha256 = "a".repeat(64); }
		, value => {
			const source = value.reviewed.elaboration ?? value.reviewed.model.sourceIdentity;
			source.reviewedBindingIr.source += " ";
		}
		, value => {
			const source = value.reviewed.elaboration ?? value.reviewed.model.sourceIdentity;
			delete source.reviewedBindingIr;
		}
		, value => { value.isolation.sourcesRemovedBeforeInstall = false; }
	]) {
		const changed = structuredClone(original); change(changed);
		assert.throws(() => corpusCoverage(inventory, catalog, [changed]));
	}
	assert.deepEqual(await reviewedCorpusIdentity(catalog), identity, "Corpus inputs changed during execution");
	const summary = { libraries: catalog.libraries.length
		, profiles: profiles.length, installedRuns: runs.length
		, catalogCases: runs.reduce((count, run) => count + run.observation.results.length, 0)
		, executedCases: runs.reduce((count, run) => count + run.observation.results.filter(result => ["matched", "rejected-as-expected"].includes(result.status)).length, 0)
		, unsupportedCases: runs.reduce((count, run) => count + run.observation.results.filter(result => result.status === "unsupported").length, 0)
		, observedCells: cells.filter(cell => cell.status === "observed").length
		, gapCells: cells.filter(cell => cell.status === "gap").length };
	await mkdir(dirname(reportPath), { recursive: true });
	await writeFile(reportPath, canonicalJson({ schemaVersion: 1
		, kind: "lean-bridge-reviewed-wasm-corpus", identity
		, environment: { node: process.version, nodeSha256: sha256(await readFile(process.execPath)), platform: process.platform, arch: process.arch }
		, summary, runs, cells }));
	t.diagnostic(`Compiler-checked reviewed Wasm report: ${JSON.stringify(summary)}`);
});
