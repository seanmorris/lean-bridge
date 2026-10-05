/**
 * Bind the two CI dependency regressions to their reproduced causes and checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedPythonTransferHistoricalBytes } from "./owned-python-transfer-history.mjs";

export const ownedConsumerCiModule = "src/backends/native/owned-value-transfers.mjs";
export const ownedConsumerCiCommands = {
	before: "node --test --test-name-pattern='Nix component source boundary|filtered component engine' tests/owned-javascript-nix-installed.test.mjs"
	, after: "node --test --test-name-pattern='Nix component source boundary|filtered component engine' tests/owned-javascript-nix-installed.test.mjs"
	, witBefore: "node --test --test-name-pattern='WIT log checks declare' tests/owned-consumer-ci-repair.test.mjs"
	, witAfter: "node --test --test-name-pattern='WIT log checks declare' tests/owned-consumer-ci-repair.test.mjs"
};
export const ownedConsumerCiScope = Object.freeze({
	staticImportClosure: true, filteredImports: true, missingModuleControl: true
	, nixSourceEvaluation: true, witLogToolDeclared: true
	, nixBuild: false, installedPackage: false, newTypeSupport: false
	, supportTablePromotions: 0
});

/**
 * Check the job which uses rg, not an unrelated job's package installation.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedWitLogTooling = workflow => {
	const job = workflow.split("\n  wasi-consumer:\n")[1]?.split(/\n {2}[a-z][a-z-]+:\n/u)[0];
	assert.ok(job);
	const setup = job.search(/sudo apt-get install -y(?: [a-z0-9+.-]+)* ripgrep(?:\s|$)/u);
	const native = job.indexOf("      - name: Execute owned WIT conversions and compiled Lean imports\n");
	assert.ok(setup >= 0 && setup < native, "WIT must install ripgrep before checking its TAP logs");
	for(const log of ["native", "session", "packaging"])
		assert.ok(job.includes(`rg '^# fail 0$' build/wit-owned-${log}.log`));
};

/**
 * Check observed failure/pass logs without claiming a rebuilt runtime or release.
 *
 * @param record - Source-bound local dependency repair observations.
 */
export const assertOwnedConsumerCiExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedConsumerCiScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedConsumerCiCommands).sort());
	for(const [name, command] of Object.entries(ownedConsumerCiCommands))
	{
		const run = record.runs[name], before = name.toLowerCase().endsWith("before"), wit = name.startsWith("wit"), count = wit ? 1 : 2;
		assert.equal(run.command, command); assert.equal(run.exitCode, before ? 1 : 0);
		assert.equal(run.sha256, sha256(run.text));
		for(const [key, value] of Object.entries({ tests: count, pass: before ? 0 : count, fail: before ? count : 0, cancelled: 0, skipped: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
		if(before) assert.ok(run.text.includes(wit ? "WIT must install ripgrep" : "ERR_MODULE_NOT_FOUND"));
		else assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	}
	const historicalBoundary = async path => JSON.parse(ownedPythonTransferHistoricalBytes(
		path, await readFile(path), record.nixSource.files[path]).toString("utf8"));
	const boundary = await historicalBoundary("nix/component-engine-source-boundary.json");
	const core = await historicalBoundary("nix/core-source-boundary.json");
	assert.ok(boundary.includedFiles.includes(ownedConsumerCiModule));
	const paths = [...new Set([...core.includedFiles, ...boundary.includedFiles, ...boundary.identityFiles])].sort();
	assert.deepEqual(Object.keys(record.nixSource.files).sort(), paths);
	for(const [path, hash] of Object.entries(record.nixSource.files)) assert.equal(hash, sha256(ownedPythonTransferHistoricalBytes(path, await readFile(path), hash)), path);
	assert.equal(record.nixSource.modules, paths.filter(path => path.startsWith("src/") && path.endsWith(".mjs")).length);
	assert.equal(record.nixSource.stdout, "nix-filtered-component-ready\n");
	assert.equal(record.nixSource.allFilesMatch, true);
	assert.equal(record.nixSource.nixBuild, false); assert.equal(record.nixSource.installedPackage, false);
	assert.match(record.nixSource.source, /^\/nix\/store\/[a-z0-9]+-lean-bridge-component-engine-source$/u);
	assert.match(record.nixSource.derivation, /^\/nix\/store\/[a-z0-9]+-lean-bridge-component-engine\.drv$/u);
	assertOwnedWitLogTooling(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
