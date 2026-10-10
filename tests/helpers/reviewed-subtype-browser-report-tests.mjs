/**
 * Refuse incomplete browser evidence and altered compiler, caller or lifecycle records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeBrowserRecords } from "./reviewed-subtype-browser-report.mjs";
import { assertReviewedSubtypePackageWorkflow } from "./reviewed-subtype-package-ci-workflow.mjs";

const root = "docs/evidence/reviewed-subtype-browser-runs-20261010";
const cli = "scripts/check-reviewed-subtype-browser-reports.mjs";
const args = ["--directory", root, "--tap", join(root, "run.tap")];
const load = async () => {
	const index = JSON.parse(await readFile(join(root, "index.json")));
	const records = new Map();
	for(const entry of index.artifacts.filter(item => item.original.startsWith("build/vo1444-browser-npm-r1-f07c86d-records/")))
		records.set(entry.path, await readFile(join(root, entry.path)));
	assert.equal(records.size, 75); return records;
};
const read = records => async path => {
	assert.ok(records.has(path), "Missing original " + path); return records.get(path);
};
const set = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
const report = records => JSON.parse(records.get("browser.json"));
const mirror = (records, value, row) => {
	set(records, "browser.json", value);
	set(records, row.profile + "/report.json", row);
	set(records, row.profile + "/observations.json", row.observations);
};

test("reviewed browser CI accepts the original run and leaves historical npm-only reports readable", async () => {
	const original = await load(), accepted = await assertReviewedSubtypeBrowserRecords(read(original));
	assert.equal(accepted.reports.flatMap(item => item.observations).length, 51);
	const actual = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
	assert.equal(actual.status, 0, actual.stderr); assert.match(actual.stdout, /12 engine\/build executions, 51 lifecycle observations/u);
	const old = "docs/evidence/reviewed-subtype-package-runs-20261010/npm";
	const npm = spawnSync(process.execPath, ["scripts/check-reviewed-subtype-package-reports.mjs", "--lane", "npm", "--directory", old, "--tap", join(old, "run.tap")], { encoding: "utf8" });
	assert.equal(npm.status, 0, npm.stderr);
	const missing = spawnSync(process.execPath, [cli, "--directory", old, "--tap", join(old, "run.tap")], { encoding: "utf8" });
	assert.equal(missing.status, 1); assert.match(missing.stderr, /browser.json/u);
	for(const options of [[], args.slice(0, 2), [...args, "--lane", "npm"], ["--directory", root, "--directory", root], ["--unknown", root, "--tap", "missing"]])
	{
		const invalid = spawnSync(process.execPath, [cli, ...options], { encoding: "utf8" });
		assert.equal(invalid.status, 1); assert.match(invalid.stderr, /Usage:/u);
	}
});

test("reviewed browser CI requires every one of the seventy-five original records", async () => {
	const original = await load(); await assertReviewedSubtypeBrowserRecords(read(original));
	for(const path of original.keys())
	{
		const records = new Map(original); records.delete(path);
		await assert.rejects(() => assertReviewedSubtypeBrowserRecords(read(records)), undefined, path);
	}
});

test("reviewed browser CI rejects missing engines, changed phases and false isolation even when mirrored", async () => {
	const original = await load(), baseline = report(original); let rejected = 0;
	for(const index of baseline.reports.keys())
	{
		const mutations = [
			row => { row.offlineInstall = false; }
			, row => { row.compilerFreePath = false; }
			, row => { row.sourceRemovedBeforeInstallation = false; }
			, row => { row.bindingIrSha256 = "0".repeat(64); }
			, row => { row.receiptSha256 = "0".repeat(64); }
			, row => { row.browser.installedSourcesRemoved = false; }
			, row => { row.browser.externalNetworkBlocked = false; }
			, row => { row.browser.requestedEngines.pop(); }
			, row => { row.browser.executions.pop(); }
			, row => { row.observations.pop(); }
			, row => { row.observations[0].observation.results.checks--; }
			, row => { row.observations[0].observation.results.rejections--; }
			, row => { row.observations[0].observation.realm = "wrong"; }
			, row => { row.observations[0].observation.hostVersion = ""; }
			, row => { row.observations[0].engine = "unknown"; }
			, row => { row.observations[0].phase = "first-copy"; }
			, row => { row.browser.executions[0].failedAssetRecovery = false; }
			, row => { row.browser.executions[0].assets.pop(); }
			, row => { row.browser.executions[0].assets[0].status = 404; }
			, row => { row.browser.executions[0].assets[0].bytes--; }
			, row => { row.browser.executions[0].assets[0].mime = "text/plain"; }
			, row => { row.browser.executions[0].lifecycle = {}; }
			, row => { row.browser.installedAssets[0].sha256 = "0".repeat(64); }
			, row => { row.browser.deployments[0].modulePaths = []; }
			, row => { row.inventedEvidence = true; }
		];
		if(baseline.reports[index].profile === "browser-react") mutations.push(row => { row.browser.executions[0].pendingUnmount = false; });
		for(const mutate of mutations)
		{
			const value = structuredClone(baseline), row = value.reports[index], records = new Map(original);
			mutate(row); mirror(records, value, row);
			await assert.rejects(() => assertReviewedSubtypeBrowserRecords(read(records))); rejected++;
		}
	}
	assert.equal(rejected, 76);
});

test("reviewed browser CI rejects substituted callers, runtime manifests and installed dependencies", async () => {
	const original = await load(), baseline = report(original);
	for(const index of baseline.reports.keys())
	{
		for(const name of ["javascript.mjs", "index.html", "package.mjs", "check.mjs"])
		{
			const value = structuredClone(baseline), row = value.reports[index], records = new Map(original);
			const bytes = Buffer.from("invented caller returning the expected count\n");
			records.set(row.profile + "/" + name, bytes);
			row.inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
			mirror(records, value, row); set(records, row.profile + "/inputs.json", row.inputs);
			await assert.rejects(() => assertReviewedSubtypeBrowserRecords(read(records)));
		}
		for(const [name, mutate] of [
			["installed-runtime-identity.json", value => { value.files.find(file => file.path === "internal/main.wasm").sha256 = "0".repeat(64); }]
			, ["installed-runtime-package.json", value => { value.version = "1.0.0"; }]
			, ["installed-component-package.json", value => { value.leanBridge.bindingIrSha256 = "0".repeat(64); }]
			, ["installed-component-package.json", value => { value.dependencies["@lean-bridge/runtime"] = "*"; }]
			, ["installed-component-package.json", value => { value.exports["."].browser = "./other.mjs"; }]
		]) {
			const records = new Map(original), path = baseline.reports[index].profile + "/" + name;
			const value = JSON.parse(records.get(path)); mutate(value); set(records, path, value);
			await assert.rejects(() => assertReviewedSubtypeBrowserRecords(read(records)));
		}
	}
});

test("reviewed browser CI remains enforced by the existing npm outcome and original-record upload", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertReviewedSubtypePackageWorkflow(workflow);
	const runner = await readFile("scripts/run-reviewed-subtype-package-ci.sh", "utf8");
	assert.ok(runner.includes("export LEAN_BRIDGE_REVIEWED_SUBTYPE_BROWSER_TEST=1"));
	assert.ok(runner.includes("export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"));
	assert.ok(runner.indexOf("node scripts/check-reviewed-subtype-browser-reports.mjs") > runner.indexOf("node scripts/check-reviewed-subtype-package-reports.mjs"));
});
