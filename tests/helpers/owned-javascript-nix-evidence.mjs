/**
 * Require real Nix installed execution and mandatory, observable CI acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedJavaScriptNixTests = ["tests/nix-toolchain-installation.test.mjs", "tests/owned-javascript-nix-installed.test.mjs"];
export const ownedJavaScriptNixCommand = "node --test --test-concurrency=1 " + ownedJavaScriptNixTests.join(" ");
export const ownedJavaScriptNixScope = Object.freeze({
	ordinaryAndReviewed: true, nativeNix: true, installedNode: true
	, producerRemoved: true, injectedTransport: false
	, osSandboxIsolation: false, dockerExecution: false
	, transferredInputs: false, anchoredBorrowedResults: false
	, externalRegistryWrites: false, installedSupportPromotions: 0
});

/**
 * Check the full TAP transcript and both independently compiled source paths.
 *
 * @param record - Source-bound actual Nix acceptance receipt.
 */
export const assertOwnedJavaScriptNixExecution = record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptNixScope);
	assert.deepEqual(Object.keys(record.runs), ["installed"]);
	const run = record.runs.installed;
	assert.equal(run.command, ownedJavaScriptNixCommand);
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	for(const [key, count] of Object.entries({ tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	for(const name of ["leanHost", "node", "emscriptenUpstream"])
		assert.ok(run.text.includes(`- ${name} extracts its archive directly into the final output`));
	const reports = [...run.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.deepEqual(reports, [false, true].map(reviewed => ({ reviewed
		, backend: "native-nix", injectedTransport: false, unusableHostSdk: true
		, sourceUnchanged: true, installedOffline: true, producerRemoved: true
		, nestedResources: true, callbackBorrowExpiry: true
		, returnedClosure: true, callbackException: true })));
};

const step = (job, name) => {
	const result = job.split(`      - name: ${name}\n`)[1]?.split("      - name:")[0];
	assert.ok(result, name); return result;
};
const script = value => {
	assert.doesNotMatch(value, /^ {8}(?:if|continue-on-error):/mu);
	const run = value.split("        run: |\n")[1]; assert.ok(run);
	return run.replaceAll("\\\n", "").split("\n").map(line => line.trim()).filter(Boolean).join("\n").replace(/ {2,}/gu, " ");
};

/**
 * Require live Nix execution, its prerequisites, complete logs and failure propagation.
 *
 * @param workflow - Complete downstream consumer workflow.
 */
export const assertOwnedJavaScriptNixCi = workflow => {
	const job = workflow.match(/^ {2}node-consumers:\n([^]*?)(?=^ {2}[a-z][a-z-]*:)/mu)?.[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.equal(step(job, "Install Nix").trim(), "uses: cachix/install-nix-action@v31");
	assert.equal(step(job, "Install archive acceptance tools").trim(), "run: sudo apt-get update && sudo apt-get install -y xz-utils zstd ripgrep");
	const name = "Build and install owned npm exports through real Nix";
	const execute = step(job, name), log = "build/owned-nix-installed.log";
	assert.match(execute, /^ {10}LEAN_BRIDGE_OWNED_JS_NIX_TEST: "1"$/mu);
	assert.match(execute, /^ {10}LEAN_BRIDGE_NIX_TOOLCHAIN_TEST: "1"$/mu);
	assert.match(execute, /^ {10}LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT: build\/consumer-ci-runtime$/mu);
	assert.ok(job.indexOf("- name: Package and execute clean Node consumers\n") < job.indexOf("- name: " + name));
	assert.match(step(job, "Package and execute clean Node consumers"), /^ {8}run: npm run test:consumer:node$/mu);
	assert.equal(script(execute), ["set -euo pipefail"
		, ownedJavaScriptNixCommand + " 2>&1 | tee " + log, "test -s " + log
		, "rg '^# pass 7$' " + log, "rg '^# fail 0$' " + log
		, "rg '^# skipped 0$' " + log].join("\n"));
	const upload = step(job, "Preserve real Nix owned npm acceptance");
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}name: owned-nix-installed-\$\{\{ github.sha \}\}$/mu);
	assert.match(upload, /^ {10}path: build\/owned-nix-installed.log$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	assert.doesNotMatch(upload, /^ {8}continue-on-error:/mu);
	const summary = workflow.split("  support-summary:\n")[1]; assert.ok(summary);
	assert.ok(summary.split("    runs-on:")[0].includes("      - node-consumers\n"));
	assert.equal(step(summary, "Enforce real Nix owned npm acceptance").trim(), "if: needs.node-consumers.result != 'success'\n        run: exit 1");
};
