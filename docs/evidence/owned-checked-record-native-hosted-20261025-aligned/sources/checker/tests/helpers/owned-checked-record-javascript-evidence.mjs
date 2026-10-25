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
	verifyOwnedJavaScriptBrowserEvidence, verifyOwnedJavaScriptPackageIdentity
} from "./owned-javascript-package-evidence.mjs";
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";

export const ownedCheckedRecordJavaScriptRoutes = Object.freeze([
	"ordinary-full", "ordinary-result-only"
	, "reviewed-full", "reviewed-result-only"
]);

const digest = /^[0-9a-f]{64}$/u;
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

/**
 * Authenticate one complete npm/browser package-evidence directory.
 *
 * @param reportPath - Canonical report path inside the packaging directory.
 * @param options - Historical replay or the current mandatory acceptance version.
 * @param options.minimumVersion - Lowest admitted report version (one for original archives).
 */
export const verifyOwnedCheckedRecordJavaScriptEvidence = async (reportPath, { minimumVersion = 1 } = {}) => {
	assert.ok([1, 2].includes(minimumVersion));
	const bytes = await readFile(reportPath), report = JSON.parse(bytes);
	assert.equal(bytes.toString("utf8"), canonicalJson(report)
		, "Owned checked-record JavaScript report must be canonical");
	assert.deepEqual(Object.keys(report).toSorted()
		, ["profile", "reports", "schemaVersion"]);
	assert.ok([1, 2].includes(report.schemaVersion)
		&& report.schemaVersion >= minimumVersion
	, `Owned JavaScript acceptance requires report version ${minimumVersion} or later`);
	assert.equal(report.profile, "installed-owned-checked-record-javascript");
	assert.deepEqual(report.reports.map(entry => entry.route)
		, ownedCheckedRecordJavaScriptRoutes);
	const root = dirname(reportPath), evidenceFiles = [], routes = [];
	for(const entry of report.reports)
	{
		assert.deepEqual(Object.keys(entry).toSorted(), [
			"archiveReproduction", "archives", "authorRoute", "bindingIrSha256"
			, "browser", "componentIdentity"
			, ...report.schemaVersion === 2 ? ["independentBuilds"] : [], "installedNode"
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
			, entry.wasm.sha256]) assert.match(value, digest);
		assert.ok(entry.sourceIdentity && typeof entry.sourceIdentity === "object"
			&& !Array.isArray(entry.sourceIdentity), "Source identity must be a structured record");
		assert.deepEqual(Object.keys(entry.wasm).toSorted(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.wasm.bytes) && entry.wasm.bytes > 0);
		assert.deepEqual(entry.observed
			, shape.resultOnly ? resultOnlyObserved : fullObserved);
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
		const { assets } = await verifyOwnedJavaScriptPackageIdentity(entry, receipt, retainedRoot);
		if(report.schemaVersion === 2)
			assert.deepEqual(entry.independentBuilds, [0, 1].map(attempt => ({
				authorRoot: `author-${attempt}`, componentIdentity: entry.componentIdentity
				, bindingIrSha256: entry.bindingIrSha256
				, sourceIdentity: entry.sourceIdentity
				, wasm: entry.wasm, archives: entry.archives
				, sourceUnchanged: true, removedBeforeInstall: true
			})), "Both independent author builds must reproduce the retained installed package");
		const browserExecutions = verifyOwnedJavaScriptBrowserEvidence(entry.browser, {
			checks: shape.resultOnly ? 7 : 30, assets, version: report.schemaVersion
		});
		evidenceFiles.push(...files.map(file =>
			`${entry.route}/handoff/${file}`));
		routes.push({ route: entry.route, receiptSha256: result.receiptSha256
			, archives: result.archives, archiveBytes, browserExecutions });
	}
	assert.deepEqual(await regularFiles(join(root, "evidence"))
		, evidenceFiles.toSorted(), "Evidence must contain only retained route sets");
	return { schemaVersion: report.schemaVersion, profile: report.profile, routes };
};
