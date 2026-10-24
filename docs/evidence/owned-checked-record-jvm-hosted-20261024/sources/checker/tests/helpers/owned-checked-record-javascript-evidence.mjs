/**
 * Independently verify the npm/browser owned checked-record report and every
 * package byte installed by its four author/API routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";

export const ownedCheckedRecordJavaScriptRoutes = Object.freeze([
	"ordinary-full", "ordinary-result-only"
	, "reviewed-full", "reviewed-result-only"
]);

const digest = /^[0-9a-f]{64}$/u;
const engines = Object.freeze(["chromium", "firefox", "webkit"]);
const browserProfiles = Object.freeze(["page", "react", "worker"]);
const fullObserved = Object.freeze({
	checks: 30, claimRejected: true, bookingRejected: true
	, lateRejected: true, retainedRejected: true
	, transferRejected: true, callbackRejected: true
	, callbackThrown: true, closureRejected: true
	, transferred: true, callbackCalls: 1
});
const resultOnlyObserved = Object.freeze({
	checks: 7, produced: true, fullApiOmitted: true
	, retained: true, disposed: true
});

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		const information = await lstat(join(root, path));
		if(information.isDirectory())
		{
			const nested = await regularFiles(root, path);
			assert.ok(nested.length > 0
				, `Retained packages must not contain empty directories: ${path}`);
			files.push(...nested);
		}
		else
		{
			assert.ok(information.isFile()
				, `Retained packages must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

const routeShape = route => {
	const matched = /^(ordinary|reviewed)-(full|result-only)$/u.exec(route);
	assert.ok(matched, route);
	return { authorRoute: matched[1], mode: matched[2]
		, resultOnly: matched[2] === "result-only" };
};

const verifyBrowser = (browser, resultOnly) => {
	assert.deepEqual(Object.keys(browser).toSorted()
		, ["executions", "externalNetworkBlocked", "installedSourcesRemoved"]);
	assert.equal(browser.externalNetworkBlocked, true);
	assert.equal(browser.installedSourcesRemoved, true);
	assert.equal(browser.executions.length, engines.length * browserProfiles.length);
	const cells = [];
	for(const execution of browser.executions)
	{
		assert.deepEqual(Object.keys(execution).toSorted()
			, ["assets", "checks", "engine", "profile", "reruns", "version"]);
		assert.ok(engines.includes(execution.engine), execution.engine);
		assert.ok(browserProfiles.includes(execution.profile), execution.profile);
		assert.equal(typeof execution.version, "string");
		assert.ok(execution.version.length > 0);
		assert.equal(execution.reruns, 2);
		assert.equal(execution.checks, resultOnly ? 7 : 30);
		assert.ok(Array.isArray(execution.assets) && execution.assets.length === 2);
		for(const asset of execution.assets) assert.match(asset, digest);
		cells.push(`${execution.engine}/${execution.profile}`);
	}
	assert.deepEqual(cells.toSorted(), engines.flatMap(engine =>
		browserProfiles.map(profile => `${engine}/${profile}`)).toSorted());
	return cells.length;
};

/**
 * Authenticate one complete npm/browser package-evidence directory.
 *
 * @param reportPath - Canonical report path inside the packaging directory.
 */
export const verifyOwnedCheckedRecordJavaScriptEvidence = async reportPath => {
	const bytes = await readFile(reportPath), report = JSON.parse(bytes);
	assert.equal(bytes.toString("utf8"), canonicalJson(report)
		, "Owned checked-record JavaScript report must be canonical");
	assert.deepEqual(Object.keys(report).toSorted()
		, ["profile", "reports", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, "installed-owned-checked-record-javascript");
	assert.deepEqual(report.reports.map(entry => entry.route)
		, ownedCheckedRecordJavaScriptRoutes);
	const root = dirname(reportPath), evidenceFiles = [], routes = [];
	for(const entry of report.reports)
	{
		assert.deepEqual(Object.keys(entry).toSorted(), [
			"archiveReproduction", "archives", "authorRoute", "bindingIrSha256"
			, "browser", "componentIdentity", "installedNode"
			, "installedTypeScript", "mode", "observed", "packageSetReceipt"
			, "relocatedInstallation", "retainedPackageSet", "route"
			, "sourceIdentity", "sourceRemovedBeforeInstall", "wasm"
		]);
		const shape = routeShape(entry.route);
		assert.equal(entry.authorRoute, shape.authorRoute);
		assert.equal(entry.mode, shape.mode);
		for(const key of ["archiveReproduction", "installedNode"
			, "installedTypeScript", "relocatedInstallation"
			, "sourceRemovedBeforeInstall"])
			assert.equal(entry[key], true, `${entry.route}: ${key}`);
		for(const value of [entry.bindingIrSha256, entry.componentIdentity
			, entry.sourceIdentity, entry.wasm.sha256]) assert.match(value, digest);
		assert.deepEqual(Object.keys(entry.wasm).toSorted(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.wasm.bytes) && entry.wasm.bytes > 0);
		assert.deepEqual(entry.observed
			, shape.resultOnly ? resultOnlyObserved : fullObserved);
		const browserExecutions = verifyBrowser(entry.browser, shape.resultOnly);
		const path = `evidence/${entry.route}/handoff`;
		assert.equal(entry.retainedPackageSet.path, path);
		const retainedRoot = join(root, path);
		const { receipt, result } = await readVerifiedPackageSetReceipt({
			receiptPath: join(retainedRoot, packageSetReceiptName)
		});
		assert.deepEqual(entry.packageSetReceipt, receipt
			, `${entry.route}: report receipt must be the retained receipt`);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).toSorted()
			, ["npm", "npm"]);
		assert.deepEqual(receipt.packages.map(pkg => pkg.role).toSorted()
			, ["component", "runtime"]);
		const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
		assert.ok(artifacts.length === 2
			&& receipt.packages.every(pkg => pkg.artifacts.length === 1));
		const files = [packageSetReceiptName, `${packageSetReceiptName}.sha256`
			, ...artifacts.map(artifact => artifact.path)].toSorted();
		assert.deepEqual(await regularFiles(retainedRoot), files
			, `${entry.route}: retained packages must be the exact receipt set`);
		const archiveBytes = artifacts.reduce((total, artifact) =>
			total + artifact.bytes, 0);
		assert.deepEqual(entry.retainedPackageSet, { path
			, receiptSha256: result.receiptSha256, archives: result.archives
			, archiveBytes, files });
		assert.deepEqual(entry.archives, Object.fromEntries(
			receipt.packages.map(pkg => [pkg.role, pkg.artifacts[0].sha256])
		));
		evidenceFiles.push(...files.map(file =>
			`${entry.route}/handoff/${file}`));
		routes.push({ route: entry.route, receiptSha256: result.receiptSha256
			, archives: result.archives, archiveBytes, browserExecutions });
	}
	assert.deepEqual(await regularFiles(join(root, "evidence"))
		, evidenceFiles.toSorted(), "Evidence must contain only retained route sets");
	return { schemaVersion: 1, profile: report.profile, routes };
};
