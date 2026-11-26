/** @file Qualify direct IO in installed PHP-Wasm Ledger packages on both source routes. */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";

const routes = ["ordinary", "reviewed"];
const fixture = "tests/fixtures/php-wasm-sync-io";
const apiPath = "php-wasm/component/io/binding-ir.json";

const buildRoutes = async (root, workspace) => {
	let review;
	for(const route of routes)
	{
		const project = join(workspace, route), output = join(root, route);
		await cp(fixture, project, {recursive: true});
		if(route === "reviewed")
		{
			const path = join(project, "lean-bridge.exports.json");
			const config = JSON.parse(await readFile(path));
			delete config.exports;
			await writeFile(path, canonicalJson(config));
			await writeFile(join(project, "ledger.binding-ir.json"), canonicalJson(review), {flag: "wx"});
		}
		try
		{
			await buildCanonicalProject({projectRoot: project, outputRoot: output, targets: ["php-wasm"]});
		} catch(error)
		{
			throw new Error(route + " Ledger build failed: " + error.message + " " + JSON.stringify(error.details), {cause: error});
		}
		const api = JSON.parse(await readFile(join(output, apiPath)));
		if(route === "ordinary") review = api;
		else assert.deepEqual(api, review);
		await rm(project, {recursive: true});
	}
};

/**
 * Check the actual source route, eight host/loading combinations, and equal
 * public semantics without treating an ordinary release as a reviewed one.
 *
 * @param t - Node test context for cleanup and receipts.
 * @param exercise - Installs and executes one authenticated package set.
 */
export const exercisePhpWasmLedgerRoutes = async (t, exercise) => {
	const workspace = await mkdtemp(join(tmpdir(), "php-wasm-ledger-"));
	t.after(() => rm(workspace, {recursive: true, force: true}));
	const {LEAN_BRIDGE_PHP_WASM_LEDGER_REPLAY: replay, LEAN_BRIDGE_PHP_WASM_LEDGER_KEEP: keep,
		LEAN_BRIDGE_PHP_WASM_LEDGER_RESULTS: results} = process.env;
	assert.ok(!(keep && replay), "choose build retention or replay, not both");
	const root = replay ? resolve(replay) : await mkdtemp(join(keep ?? workspace, "handoffs-"));
	if(!replay) await buildRoutes(root, workspace);
	t.diagnostic("Ledger package sets: " + root);
	const records = [];
	for(const route of routes)
	{
		const record = await exercise(join(root, route), route);
		const expected = [];
		for(const host of ["Node", "Chromium"])
		for(const mode of ["embedded", "composer"])
		for(const loading of ["startup", "lazy"]) expected.push({host, mode, loading, result: "php-api:30"});
		assert.deepEqual(record.observations, expected);
		records.push(record);
		t.diagnostic(route + ": " + record.receiptSha256 + " (eight installed calls of the 30-assertion program)");
	}
	const [ordinary, reviewed] = records;
	assert.equal(ordinary.bindingIrSha256, reviewed.bindingIrSha256);
	assert.equal(ordinary.ledgerSha256, reviewed.ledgerSha256);
	assert.equal(ordinary.runtimeIdentity, reviewed.runtimeIdentity);
	assert.deepEqual(ordinary.clientSha256, reviewed.clientSha256);
	assert.notEqual(ordinary.sourceTreeSha256, reviewed.sourceTreeSha256);
	assert.notEqual(ordinary.receiptSha256, reviewed.receiptSha256);
	if(results)
	{
		await mkdir(results, {recursive: true});
		for(const record of records) await writeFile(join(results, record.route + ".json"), canonicalJson(record));
	}
};
