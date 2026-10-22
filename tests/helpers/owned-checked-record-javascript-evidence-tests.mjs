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
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt
	, writePackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	ownedCheckedRecordJavaScriptRoutes
	, verifyOwnedCheckedRecordJavaScriptEvidence
} from "./owned-checked-record-javascript-evidence.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const digest = value => sha256(Buffer.from(value));
const fullObserved = {
	checks: 30, claimRejected: true, bookingRejected: true
	, lateRejected: true, retainedRejected: true
	, transferRejected: true, callbackRejected: true
	, callbackThrown: true, closureRejected: true
	, transferred: true, callbackCalls: 1
};
const resultOnlyObserved = {
	checks: 7, produced: true, fullApiOmitted: true
	, retained: true, disposed: true
};
const browser = resultOnly => {
	const executions = [];
	for(const engine of ["chromium", "firefox", "webkit"])
		for(const profile of ["page", "react", "worker"])
			executions.push({ engine, profile, version: `${engine}-1`, reruns: 2
				, checks: resultOnly ? 7 : 30
				, assets: [digest(`${engine}/${profile}/a`)
					, digest(`${engine}/${profile}/b`)] });
	return { externalNetworkBlocked: true, installedSourcesRemoved: true
		, executions };
};

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-record-js-evidence-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const reports = [];
	for(const route of ownedCheckedRecordJavaScriptRoutes)
	{
		const handoff = join(root, "evidence", route, "handoff");
		const runtimePath = `archives/npm/runtime-${route}.tgz`;
		const componentPath = `archives/npm/component-${route}.tgz`;
		const runtimeBytes = Buffer.from(`runtime ${route}\n`);
		const componentBytes = Buffer.from(`component ${route}\n`);
		await saveLakeFile(handoff, runtimePath, runtimeBytes);
		await saveLakeFile(handoff, componentPath, componentBytes);
		const profile = { id: "javascript-wasm-owned-v1"
			, bindingIrSha256: digest(`${route}/ir`)
			, runtimeIdentity: digest(`${route}/runtime`) };
		const runtime = { target: "npm", ecosystem: "npm"
			, name: "@lean-bridge/runtime", version: "1.0.0"
			, profile: profile.id, role: "runtime"
			, runtimeIdentity: profile.runtimeIdentity
			, runtimeDelivery: "provided", requires: []
			, artifacts: [{ path: runtimePath, bytes: runtimeBytes.length
				, sha256: sha256(runtimeBytes) }] };
		const component = { target: "npm", ecosystem: "npm"
			, name: "@example/owned-records", version: "1.0.0"
			, profile: profile.id, role: "component"
			, runtimeIdentity: profile.runtimeIdentity
			, runtimeDelivery: "dependency"
			, requires: [{ ecosystem: runtime.ecosystem, name: runtime.name
				, version: runtime.version }]
			, artifacts: [{ path: componentPath, bytes: componentBytes.length
				, sha256: sha256(componentBytes) }] };
		const receipt = await writePackageSetReceipt({ root: handoff
			, component: { id: `owned-records-${route}@1.0.0`
				, name: `owned-records-${route}`, version: "1.0.0" }
			, source: { treeSha256: digest(`${route}/source`) }
			, profiles: [profile], packages: [component, runtime] });
		const verified = await readVerifiedPackageSetReceipt({
			receiptPath: join(handoff, packageSetReceiptName)
		});
		const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
		const files = [packageSetReceiptName, `${packageSetReceiptName}.sha256`
			, ...artifacts.map(artifact => artifact.path)].toSorted();
		const resultOnly = route.endsWith("result-only");
		reports.push({ route
			, authorRoute: route.startsWith("ordinary")
				? "ordinary" : "reviewed"
			, mode: resultOnly ? "result-only" : "full"
			, bindingIrSha256: profile.bindingIrSha256
			, componentIdentity: digest(`${route}/component`)
			, sourceIdentity: digest(`${route}/identity`)
			, packageSetReceipt: receipt
			, archives: Object.fromEntries(receipt.packages.map(pkg =>
				[pkg.role, pkg.artifacts[0].sha256]))
			, observed: resultOnly ? resultOnlyObserved : fullObserved
			, retainedPackageSet: { path: `evidence/${route}/handoff`
				, receiptSha256: verified.result.receiptSha256
				, archives: verified.result.archives
				, archiveBytes: artifacts.reduce((sum, artifact) =>
					sum + artifact.bytes, 0)
				, files }
			, installedNode: true, installedTypeScript: true
			, sourceRemovedBeforeInstall: true, relocatedInstallation: true
			, archiveReproduction: true, browser: browser(resultOnly)
			, wasm: { bytes: 4096, sha256: digest(`${route}/wasm`) } });
	}
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
