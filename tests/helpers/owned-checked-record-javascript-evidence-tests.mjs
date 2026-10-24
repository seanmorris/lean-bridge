/**
 * Fail-closed checks for retained npm/browser owned checked-record evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
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
