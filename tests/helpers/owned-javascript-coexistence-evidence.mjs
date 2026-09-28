/**
 * Require exact installed coexistence observations and the reproduced repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedJavaScriptWasmCi, ownedJavaScriptCoexistenceTestCommand } from "./owned-javascript-wasm-ci.mjs";

export const ownedJavaScriptCoexistenceScope = Object.freeze({
	target: "wasm32", sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedNpm: true, strictTypeScript: true, sourceRemoval: true
	, loadOrders: ["owned-first", "copied-first", "concurrent"]
	, browsers: ["chromium", "firefox", "webkit"]
	, contexts: ["page", "react", "worker"], oneRuntimeArchive: true
	, observedMemories: 1, runtimeInitializations: 1, nodeRetirement: true
	, signedPublication: false, nixDockerBuilds: false
	, transferredInputs: false, anchoredResults: false, promotedCells: 0
});
export const ownedJavaScriptCoexistenceCommands = Object.freeze({
	execution: "LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT=/app/build/lean-link-spike-owned-20260928 EMCC_CORES=2 " + ownedJavaScriptCoexistenceTestCommand
	, ci: "node --test tests/owned-javascript-wasm-ci.test.mjs tests/owned-php-wasm-ci.test.mjs"
	, legacy: "EMCC_CORES=2 node --test --test-concurrency=1 tests/component-npm-package.test.mjs tests/package-set-receipt.test.mjs"
});
const live = { heaps: 1, initializations: 1, libraries: 2, components: 1, identities: 0, state: 2 };
const closed = { ...live, components: 0 };
const retired = { ...live, identities: 1, state: 3 };

const assertRun = (run, command, tests, pass, fail) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, fail ? 1 : 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [key, value] of Object.entries({ tests, pass, fail, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(run.text, /# SKIP|# TODO/u);
	if(!fail) assert.doesNotMatch(run.text, /^not ok/mu);
};

/**
 * Authenticate the repaired release and every actual single-heap observation.
 *
 * @param record - Source-bound successor receipt, not a current support claim.
 */
export const assertOwnedJavaScriptCoexistenceExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptCoexistenceScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedJavaScriptCoexistenceCommands).sort());
	for(const [name, count] of [["execution", 4], ["ci", 4], ["legacy", 21]])
		assertRun(record.runs[name], ownedJavaScriptCoexistenceCommands[name], count, count, 0);
	const regression = "node --test tests/component-runtime-package-identity.test.mjs";
	assertRun(record.repair.before, regression, 2, 1, 1);
	assert.match(record.repair.before.text, /^not ok 1 - equivalent copied and owned runtime metadata produces identical npm bytes$/mu);
	assert.match(record.repair.before.text, /One coordinate must identify exactly the same files/u);
	assertRun(record.repair.after, regression, 2, 2, 0);
	const builds = [...record.runs.execution.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(builds.length, 2);
	const runtimeIds = new Set(), archiveIds = new Set();
	for(const [index, build] of builds.entries())
	{
		assert.equal(build.reviewed, index === 1);
		assert.equal(build.runtimeInstallations, 1); assert.equal(build.sourceRemoved, true); assert.equal(build.strictTypeScript, true);
		for(const field of ["runtimeIdentity", "runtimeArchiveSha256"]) assert.match(build[field], /^[a-f0-9]{64}$/u);
		runtimeIds.add(build.runtimeIdentity); archiveIds.add(build.runtimeArchiveSha256);
		assert.deepEqual(build.executions.map(item => [item.order, item.finish]), ownedJavaScriptCoexistenceScope.loadOrders.flatMap(order => ["close", "retire"].map(finish => [order, finish])));
		for(const item of build.executions)
		{
			assert.deepEqual(item.runs, Array(3).fill({ order: item.order, checks: 22, stats: live }));
			assert.deepEqual(item.finished, item.finish === "close" ? closed : retired);
		}
		const browser = build.browser;
		assert.equal(browser.installedSourcesRemoved, true); assert.equal(browser.externalNetworkBlocked, true);
		assert.deepEqual(browser.executions.map(item => [item.engine, item.order, item.profile]), ownedJavaScriptCoexistenceScope.browsers.flatMap(engine => ownedJavaScriptCoexistenceScope.loadOrders.flatMap(order => ownedJavaScriptCoexistenceScope.contexts.map(profile => [engine, order, profile]))));
		const assets = browser.executions[0].assets;
		assert.equal(assets.length, 3); assert.equal(new Set(assets).size, 3);
		for(const item of browser.executions)
		{
			assert.equal(typeof item.version, "string"); assert.ok(item.version.length > 0);
			assert.equal(item.checks, 22); assert.equal(item.reruns, 2);
			assert.deepEqual(item.stats, live); assert.deepEqual(item.finished, closed);
			assert.deepEqual(item.assets, assets);
			for(const digest of item.assets) assert.match(digest, /^[a-f0-9]{64}$/u);
		}
	}
	assert.equal(runtimeIds.size, 1); assert.equal(archiveIds.size, 1);
	assertOwnedJavaScriptWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
