/**
 * Exact acceptance scope for installed owned npm packages and their author CLI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedJavaScriptWasmCi, ownedJavaScriptNpmTestCommand } from "./owned-javascript-wasm-ci.mjs";

export const ownedJavaScriptNpmScope = Object.freeze({
	target: "wasm32", privateAbi: 10
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedCli: true, installedNpm: true, strictTypeScript: true
	, compilerInputsBundled: true, reproducibleArchives: true
	, installedBrowser: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"]
	, combinedNative: "c", sourceRemoval: true, externalBrowserNetwork: false
	, nixDockerBuilds: false, signedPublication: false
	, transferredInputs: false, anchoredResults: false, promotedCells: 0
});
export const ownedJavaScriptNpmEvidenceCommands = Object.freeze({
	execution: "LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT=/app/build/lean-link-spike-owned-20260928 EMCC_CORES=2 " + ownedJavaScriptNpmTestCommand
	, ci: "node --test tests/owned-javascript-wasm-ci.test.mjs tests/owned-php-wasm-ci.test.mjs"
});

/**
 * Check enabled executions, both source paths and every installed browser case.
 *
 * @param record - Source-bound execution receipt.
 */
export const assertOwnedJavaScriptNpmExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptNpmScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedJavaScriptNpmEvidenceCommands).sort());
	for(const [name, count] of [["execution", 10], ["ci", 4]])
	{
		const run = record.runs[name]; assert.equal(run.command, ownedJavaScriptNpmEvidenceCommands[name]);
		assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
		for(const [key, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
		assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
		const cases = [...run.text.matchAll(/^ok (\d+) - ([^\n]+)$/gmu)];
		assert.deepEqual(cases.map(match => Number(match[1])), Array.from({ length: count }, (_, index) => index + 1));
		assert.equal(new Set(cases.map(match => match[2])).size, count);
	}
	const observations = [...record.runs.execution.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(observations.length, 3);
	const author = observations[0]; assert.match(author.compilerInputsIdentity, /^[a-f0-9]{64}$/u);
	assert.deepEqual(author.reports, [false, true].map(reviewed => ({ reviewed
		, component: `@owned/${reviewed ? "reviewed" : "ordinary"}`
		, sourceRemoved: true, installedCli: true, installedConsumer: true
		, combinedNative: reviewed })));
	const runtimeIdentities = new Set();
	for(const [index, build] of observations.slice(1).entries())
	{
		assert.equal(build.reviewed, index === 1); assert.equal(build.rejected, 12);
		assert.ok(build.wasmBytes > 0); assert.match(build.identity, /^[a-f0-9]{64}$/u);
		const installed = build.installed;
		for(const field of ["archiveReproduction", "installedNode", "installedTypeScript"]) assert.equal(installed[field], true, field);
		assert.match(installed.runtimeIdentity, /^[a-f0-9]{64}$/u); runtimeIdentities.add(installed.runtimeIdentity);
		const browser = installed.browser;
		assert.equal(browser.installedSourcesRemoved, true); assert.equal(browser.externalNetworkBlocked, true);
		assert.deepEqual(browser.executions.map(item => [item.engine, item.profile]), ["chromium", "firefox", "webkit"].flatMap(engine => ["page", "react", "worker"].map(profile => [engine, profile])));
		const assets = browser.executions[0].assets;
		assert.equal(assets.length, 2); assert.equal(new Set(assets).size, 2);
		for(const item of browser.executions)
		{
			assert.equal(typeof item.version, "string"); assert.ok(item.version.length);
			assert.equal(item.checks, 16); assert.equal(item.reruns, 2);
			assert.deepEqual(item.assets, assets);
			for(const hash of item.assets) assert.match(hash, /^[a-f0-9]{64}$/u);
		}
	}
	assert.equal(runtimeIdentities.size, 1, "Both APIs must use the same shared runtime package");
	assertOwnedJavaScriptWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
