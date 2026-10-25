/**
 * Bind owned-Subtype npm acceptance to retained packages and complete browsers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	verifyOwnedJavaScriptBrowserEvidence, verifyOwnedJavaScriptPackageIdentity
} from "./owned-javascript-package-evidence.mjs";
import { verifyOwnedSubtypeRetainedPackages } from "./owned-subtype-retained-packages.mjs";

export const ownedSubtypeJavaScriptObserved = Object.freeze({
	checks: 18, serial: "41", first: true, second: true
	, retainedRejected: true, transferRejected: true, transferred: true
});

const digest = /^[a-f0-9]{64}$/u;

/**
 * Check the current report contract without treating its claims as package bytes.
 *
 * @param report - Parsed current producer report.
 */
export const assertOwnedSubtypeJavaScriptReport = report => {
	assert.deepEqual(Object.keys(report).toSorted()
		, ["profile", "reports", "schemaVersion"]);
	assert.equal(report.schemaVersion, 2, "Owned Subtype acceptance requires report version 2");
	assert.equal(report.profile, "installed-owned-subtype-javascript");
	assert.deepEqual(report.reports.map(entry => entry.reviewed), [false, true]);
	for(const entry of report.reports)
	{
		assert.deepEqual(Object.keys(entry).toSorted(), [
			"archiveReproduction", "archives", "bindingIrSha256", "browser"
			, "componentIdentity", "independentBuilds", "installedNode"
			, "installedTypeScript", "observed", "packageSetReceipt"
			, "relocatedInstallation", "reviewed", "sourceIdentity"
			, "sourceRemovedBeforeInstall", "transferredInputCheckedBeforeHandoff"
			, "wasm"
		]);
		for(const flag of ["archiveReproduction", "installedNode"
			, "installedTypeScript"
			, "relocatedInstallation", "sourceRemovedBeforeInstall"
			, "transferredInputCheckedBeforeHandoff"])
			assert.equal(entry[flag], true, flag);
		assert.deepEqual(entry.observed, ownedSubtypeJavaScriptObserved);
		for(const value of [entry.bindingIrSha256, entry.componentIdentity, entry.wasm.sha256])
			assert.match(value, digest);
		assert.ok(entry.sourceIdentity && typeof entry.sourceIdentity === "object"
			&& !Array.isArray(entry.sourceIdentity), "Source identity must be a structured record");
		assert.deepEqual(Object.keys(entry.wasm).toSorted(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.wasm.bytes) && entry.wasm.bytes > 0);
		assert.deepEqual(entry.independentBuilds, [0, 1].map(attempt => ({
			authorRoot: `author-${attempt}`, componentIdentity: entry.componentIdentity
			, bindingIrSha256: entry.bindingIrSha256
			, sourceIdentity: entry.sourceIdentity
			, wasm: entry.wasm, archives: entry.archives
			, sourceUnchanged: true, removedBeforeInstall: true
		})), "Both independent author builds must reproduce the retained installed package");
	}
};

const constructors = bindingIr => {
	for(const [name, ownership, constructor] of [
		["echoRecord", "borrow", "Owned.checkedCount"]
		, ["echoRecordAlternate", "borrow", "Owned.checkedCountAlternate"]
		, ["transferRecord", "transfer", "Owned.checkedCount"]
	]) {
		const declaration = bindingIr.declarations.find(item => item.name === name);
		assert.ok(declaration, `Missing compiled Subtype API: ${name}`);
		assert.equal(declaration.parameters[0].ownership, ownership);
		assert.equal(declaration.source.extensions["lean-lang.org/refinements"]
			.parameters[0].fields[4].refinement.fields[0].refinement.constructor
		, constructor, `Compiled Subtype constructor: ${name}`);
	}
};

/**
 * Authenticate every retained package, compiler identity and browser execution.
 * Historical reports cannot satisfy this current acceptance contract.
 *
 * @param reportPath - Exact canonical report path beside retained-packages.json.
 */
export const verifyOwnedSubtypeJavaScriptEvidence = async reportPath => {
	const bytes = await readFile(reportPath), report = JSON.parse(bytes);
	assert.equal(bytes.toString("utf8"), canonicalJson(report)
		, "Owned Subtype JavaScript report must be canonical");
	assertOwnedSubtypeJavaScriptReport(report);
	const root = dirname(reportPath);
	const retained = await verifyOwnedSubtypeRetainedPackages(root, report);
	const routes = [];
	for(const entry of report.reports)
	{
		const route = entry.reviewed ? "reviewed" : "ordinary";
		const receipt = entry.packageSetReceipt;
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).toSorted(), ["npm", "npm"]);
		assert.deepEqual(receipt.packages.map(pkg => pkg.role).toSorted(), ["component", "runtime"]);
		assert.ok(receipt.packages.every(pkg => pkg.artifacts.length === 1));
		assert.deepEqual(entry.archives, Object.fromEntries(receipt.packages.map(pkg =>
			[pkg.role, pkg.artifacts[0].sha256])), "Installed archive identities");
		const { assets, bindingIr } = await verifyOwnedJavaScriptPackageIdentity(
			{ ...entry, authorRoute: route }, receipt, join(root, `evidence/${route}/handoff`));
		constructors(bindingIr);
		const browserExecutions = verifyOwnedJavaScriptBrowserEvidence(entry.browser, {
			checks: ownedSubtypeJavaScriptObserved.checks, assets, version: 2
		});
		routes.push({ ...retained.routes.find(item => item.route === route)
			, browserExecutions });
	}
	return { schemaVersion: 2, profile: report.profile
		, reportSha256: sha256(bytes), routes };
};
