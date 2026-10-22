/**
 * Installed PHP-Wasm acceptance for owned checked records, host callbacks and
 * returned Lean closures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkOwnedPhpWasmPackages } from "./helpers/owned-php-wasm-packages.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_PHP_WASM_TEST === "1";
const modeVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_PHP_WASM_MODES";
const allModes = Object.freeze(["full", "result-only"]);
const modes = process.env[modeVariable]?.split(",") ?? [...allModes];
assert.ok(modes.length && modes.every(mode => allModes.includes(mode)));
assert.equal(new Set(modes).size, modes.length);
const output = resolve("build/owned-checked-record-php-wasm");
const reports = [];

test.before(async () => {
	if(enabled) await rm(output, { recursive: true, force: true });
});

test.after(async () => {
	if(!enabled || reports.length !== modes.length) return;
	await saveLakeFile(output, "packages.json", canonicalJson({
		schemaVersion: 1
		, profile: "installed-owned-checked-record-php-wasm"
		, reports: reports.toSorted((left, right) => left.mode.localeCompare(right.mode))
	}));
});

for(const mode of modes) test(`installed PHP-Wasm ${mode} owned checked records execute in Node and Chromium`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-owned-checked-record-php-wasm-${mode}-`));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Retained failed ${mode} owned checked-record PHP-Wasm inputs: ${directory}`);
	});
	const report = await checkOwnedPhpWasmPackages(directory, message => {
		t.diagnostic(message); process.stderr.write(message + "\n");
	}, {
		checkedRecords: true, resultOnly: mode === "result-only"
		, evidenceRoot: join(output, "evidence", mode)
	});
	assert.equal(report.mode, mode);
	assert.equal(report.observations.length, 2);
	await saveLakeFile(output, `${mode}.json`, canonicalJson(report));
	reports.push(report); complete = true;
});

test("owned checked-record PHP-Wasm acceptance remains a separate recurring gate", async () => {
	const workflow = await readFile(".github/workflows/owned-checked-record-php-wasm.yml", "utf8");
	const cli = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	for(const dependency of [
		"src/abi/owned-refinement-model.mjs"
		, "src/build/owned-refinement-carriers.mjs"
	]) assert.ok(cli.files.includes(dependency), dependency);
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-checked-record-php-wasm"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-checked-record-php-wasm/packages.json"
		, "build/owned-checked-record-php-wasm/evidence"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
	assert.doesNotMatch(workflow, /continue-on-error:\s*true/u);
});
