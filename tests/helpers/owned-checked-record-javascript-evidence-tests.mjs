/**
 * Fail-closed checks for retained npm/browser owned checked-record evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	appendFile, mkdir, mkdtemp, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { packageSetReceiptName } from "../../src/release/package-set-receipt.mjs";
import {
	ownedCheckedRecordJavaScriptRoutes
	, verifyOwnedCheckedRecordJavaScriptEvidence
} from "./owned-checked-record-javascript-evidence.mjs";
import { writeSyntheticOwnedCheckedRecordJavaScriptRoute } from "./owned-checked-record-javascript-evidence-fixture.mjs";
import { ownedJavaScriptBrowserBuilds } from "./owned-javascript-npm-browser.mjs";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-record-js-evidence-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const reports = [];
	for(const route of ownedCheckedRecordJavaScriptRoutes)
		reports.push(await writeSyntheticOwnedCheckedRecordJavaScriptRoute(root, route));
	const reportPath = join(root, "report.json");
	await writeFile(reportPath, canonicalJson({ schemaVersion: 1
		, profile: "installed-owned-checked-record-javascript", reports }));
	return { root, reportPath };
};

test("owned checked-record JavaScript evidence authenticates every retained route", async t => {
	const selected = await fixture(t);
	const result = await verifyOwnedCheckedRecordJavaScriptEvidence(
		selected.reportPath);
	assert.deepEqual(result.routes.map(route => route.route)
		, ownedCheckedRecordJavaScriptRoutes);
	assert.ok(result.routes.every(route =>
		route.archives === 2 && route.archiveBytes > 0
		&& route.browserExecutions === 9));
});

test("owned checked-record JavaScript evidence binds source and execution identities", async t => {
	const cases = [
		[entry => { entry.sourceIdentity = "0".repeat(64); }, /structured record/u]
		, [entry => { entry.sourceIdentity = null; }, /structured record/u]
		, [entry => { entry.sourceIdentity = []; }, /structured record/u]
		, [entry => { entry.sourceIdentity.extractorSha256 = "0".repeat(64); }, /source identity/u]
		, [entry => { entry.sourceIdentity.unrecorded = true; }, /source identity/u]
		, [entry => { entry.sourceIdentity.reviewedBindingIr = {}; }, /source identity/u]
		, [entry => { entry.componentIdentity = "0".repeat(64); }, /Compiled component identity/u]
		, [entry => { entry.bindingIrSha256 = "0".repeat(64); }, /Compiled binding IR/u]
		, [entry => { entry.wasm.sha256 = "0".repeat(64); }, /Compiled Wasm identity/u]
		, [entry => { entry.wasm.bytes++; }, /Compiled Wasm identity/u]
		, [entry => { entry.browser.executions[0].assets[0] = "0".repeat(64); }, /Browser assets/u]
	];
	for(const [mutate, pattern] of cases)
	{
		const { reportPath } = await fixture(t);
		const report = JSON.parse(await readFile(reportPath));
		mutate(report.reports[0]);
		await writeFile(reportPath, canonicalJson(report));
		await assert.rejects(verifyOwnedCheckedRecordJavaScriptEvidence(reportPath), pattern);
	}
});

test("owned checked-record JavaScript evidence binds rehashed receipts to compiled packages", async t => {
	for(const [mutate, pattern] of [
		[receipt => { receipt.source.treeSha256 = "0".repeat(64); }, /Package-set source tree/u]
		, [receipt => { receipt.profiles[0].bindingIrSha256 = "0".repeat(64); }, /Installed package profile/u]
		, [receipt => { receipt.component.name = "forged"; }, /Compiled component coordinate/u]
	]) {
		const { root, reportPath } = await fixture(t);
		const report = JSON.parse(await readFile(reportPath));
		const entry = report.reports[0], receipt = entry.packageSetReceipt;
		mutate(receipt);
		const bytes = canonicalJson(receipt);
		const handoff = join(root, entry.retainedPackageSet.path);
		await writeFile(join(handoff, packageSetReceiptName), bytes);
		await writeFile(join(handoff, packageSetReceiptName + ".sha256")
			, sha256(bytes) + "  " + packageSetReceiptName + "\n");
		entry.retainedPackageSet.receiptSha256 = sha256(bytes);
		await writeFile(reportPath, canonicalJson(report));
		await assert.rejects(verifyOwnedCheckedRecordJavaScriptEvidence(reportPath), pattern);
	}
});

test("owned checked-record JavaScript evidence rejects altered or wider trees", async t => {
	const rejects = async (change, pattern) => {
		const selected = await fixture(t);
		await change(selected);
		await assert.rejects(verifyOwnedCheckedRecordJavaScriptEvidence(
			selected.reportPath), pattern);
	};
	await rejects(({ root }) => appendFile(join(root
		, "evidence/ordinary-full/handoff/archives/npm/component-ordinary-full.tgz")
	, "x"), /Archive differs|archive-mismatch/u);
	await rejects(({ root }) => writeFile(join(root
		, "evidence/reviewed-full/handoff/extra"), "x")
	, /exact receipt set/u);
	await rejects(({ root }) => mkdir(join(root
		, "evidence/ordinary-result-only/handoff/empty"))
	, /must not contain empty directories/u);
	await rejects(async ({ reportPath }) => {
		const report = JSON.parse(await readFile(reportPath));
		report.reports[0].packageSetReceipt.component.name = "forged";
		await writeFile(reportPath, canonicalJson(report));
	}, /report receipt must be the retained receipt/u);
	await rejects(async ({ reportPath }) => {
		const report = JSON.parse(await readFile(reportPath));
		report.reports[0].browser.executions.pop();
		await writeFile(reportPath, canonicalJson(report));
	}, /8 !== 9|Expected values to be strictly equal/u);
	await rejects(async ({ reportPath }) => {
		const report = JSON.parse(await readFile(reportPath));
		await writeFile(reportPath, JSON.stringify(report));
	}, /must be canonical/u);
});

test("current owned JavaScript acceptance refuses the older single-build browser contract", async t => {
	const { reportPath } = await fixture(t);
	await assert.rejects(verifyOwnedCheckedRecordJavaScriptEvidence(
		reportPath, { minimumVersion: 2 }
	), /version 2/u);
});

const completeFixture = async t => {
	const selected = await fixture(t);
	const report = JSON.parse(await readFile(selected.reportPath));
	report.schemaVersion = 2;
	for(const entry of report.reports)
	{
		entry.independentBuilds = [0, 1].map(attempt => ({
			authorRoot: `author-${attempt}`, componentIdentity: entry.componentIdentity
			, bindingIrSha256: entry.bindingIrSha256
			, sourceIdentity: entry.sourceIdentity
			, wasm: entry.wasm, archives: entry.archives
			, sourceUnchanged: true, removedBeforeInstall: true
		}));
		entry.browser.executions = entry.browser.executions.flatMap(execution => [
			{ ...execution, variant: "production" }
			, ...execution.profile === "react"
				? [{ ...execution, variant: "strict" }] : []
		]);
	}
	await writeFile(selected.reportPath, canonicalJson(report));
	return selected;
};

test("complete owned JavaScript evidence binds two author builds and both React variants", async t => {
	const { reportPath } = await completeFixture(t);
	const result = await verifyOwnedCheckedRecordJavaScriptEvidence(reportPath, { minimumVersion: 2 });
	assert.equal(result.schemaVersion, 2);
	assert.equal(result.routes.length, 4);
	assert.ok(result.routes.every(route => route.archives === 2 && route.browserExecutions === 12));
	const child = spawnSync(process.execPath, ["scripts/check-owned-checked-record-javascript-ci.mjs", "--report", reportPath]
		, { encoding: "utf8", timeout: 20_000 });
	assert.equal(child.status, 0, child.stderr);
	assert.deepEqual(JSON.parse(child.stdout), result);
});

test("complete owned JavaScript evidence refuses incomplete rebuilds and React cells", async t => {
	const cases = [
		[entry => { entry.independentBuilds.pop(); }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].authorRoot = "author-0"; }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].componentIdentity = "0".repeat(64); }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].bindingIrSha256 = "0".repeat(64); }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].sourceIdentity = {}; }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].wasm.sha256 = "0".repeat(64); }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].archives.component = "0".repeat(64); }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].sourceUnchanged = false; }, /independent author builds/u]
		, [entry => { entry.independentBuilds[1].removedBeforeInstall = false; }, /independent author builds/u]
		, [entry => { entry.browser.executions.pop(); }, /11 !== 12/u]
		, [entry => { entry.browser.executions.find(item => item.profile === "react" && item.variant === "production").variant = "strict"; }, /React variant/u]
		, [entry => { entry.browser.executions.find(item => item.variant === "strict").variant = "production"; }, /React variant/u]
		, [entry => { entry.browser.executions[0].variant = "development"; }, /React variant/u]
		, [entry => { entry.browser.executions[0].engine = "unknown"; }, /unknown/u]
		, [entry => { entry.browser.executions[0].assets[0] = "0".repeat(64); }, /Browser assets/u]
	];
	for(const [mutate, pattern] of cases)
	{
		const { reportPath } = await completeFixture(t);
		const report = JSON.parse(await readFile(reportPath));
		mutate(report.reports[0]);
		await writeFile(reportPath, canonicalJson(report));
		await assert.rejects(verifyOwnedCheckedRecordJavaScriptEvidence(reportPath, { minimumVersion: 2 }), pattern);
	}
});

test("current owned JavaScript CLI cannot accept a historical report", async t => {
	const { reportPath } = await fixture(t);
	const child = spawnSync(process.execPath, ["scripts/check-owned-checked-record-javascript-ci.mjs", "--report", reportPath]
		, { encoding: "utf8", timeout: 20_000 });
	assert.notEqual(child.status, 0);
	assert.match(child.stderr, /report version 2/u);
	assert.equal(child.stdout, "");
});

test("owned browser build modes preserve history and select real production React", () => {
	assert.deepEqual(ownedJavaScriptBrowserBuilds(), [{
		variant: "strict", mode: "development", directory: "dist"
		, profiles: ["page", "react", "worker"] }]);
	assert.deepEqual(ownedJavaScriptBrowserBuilds(true), [
		{ variant: "production", mode: "production", directory: "dist-production", profiles: ["page", "react", "worker"] }
		, { variant: "strict", mode: "development", directory: "dist-strict", profiles: ["react"] }
	]);
	assert.throws(() => ownedJavaScriptBrowserBuilds("production"));
});
