/**
 * Independently verify the npm/browser owned checked-record report and every
 * package byte installed by its four author/API routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../../src/binding-ir/canonical.mjs";
import { validateOwnedAggregateBindingIr } from "../../src/binding-ir/contract.mjs";
import { readClosedPackageTarGz } from "./closed-package-tar.mjs";
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

const verifyBrowser = (browser, resultOnly, assets, version) => {
	assert.deepEqual(Object.keys(browser).toSorted()
		, ["executions", "externalNetworkBlocked", "installedSourcesRemoved"]);
	assert.equal(browser.externalNetworkBlocked, true);
	assert.equal(browser.installedSourcesRemoved, true);
	const expectedCells = engines.flatMap(engine => version === 1
		? browserProfiles.map(profile => `${engine}/${profile}`)
		: [...browserProfiles.map(profile => `${engine}/${profile}/production`)
			, `${engine}/react/strict`]);
	assert.equal(browser.executions.length, expectedCells.length);
	const cells = [];
	for(const execution of browser.executions)
	{
		assert.deepEqual(Object.keys(execution).toSorted()
			, ["assets", "checks", "engine", "profile", "reruns"
				, ...version === 2 ? ["variant"] : [], "version"]);
		assert.ok(engines.includes(execution.engine), execution.engine);
		assert.ok(browserProfiles.includes(execution.profile), execution.profile);
		assert.equal(typeof execution.version, "string");
		assert.ok(execution.version.length > 0);
		assert.equal(execution.reruns, 2);
		assert.equal(execution.checks, resultOnly ? 7 : 30);
		assert.ok(Array.isArray(execution.assets) && execution.assets.length === 2);
		for(const asset of execution.assets) assert.match(asset, digest);
		assert.deepEqual(execution.assets.toSorted(), assets.toSorted()
			, "Browser assets must be the retained component and runtime Wasm");
		cells.push(`${execution.engine}/${execution.profile}`
			+ (version === 2 ? `/${execution.variant}` : ""));
	}
	assert.deepEqual(cells.toSorted(), expectedCells.toSorted()
		, "Browser cells must include every required profile and React variant");
	return cells.length;
};


const packageIdentity = async (entry, receipt, root) => {
	const component = receipt.packages.find(pkg => pkg.role === "component");
	const runtime = receipt.packages.find(pkg => pkg.role === "runtime");
	const archive = async pkg => {
		const artifact = pkg.artifacts[0];
		const bytes = await readFile(join(root, artifact.path));
		assert.equal(bytes.length, artifact.bytes, "Retained archive size");
		assert.equal(sha256(bytes), artifact.sha256, "Retained archive identity");
		return readClosedPackageTarGz(bytes, { root: "package"
			, maxInput: 64 * 1024 ** 2, maxBytes: 64 * 1024 ** 2 });
	};
	const files = await archive(component), runtimeFiles = await archive(runtime);
	const member = (members, path) => {
		const bytes = members.get(path);
		assert.ok(Buffer.isBuffer(bytes), "Missing retained package member: " + path);
		return bytes;
	};
	const json = (members, path) => {
		const bytes = member(members, path), value = JSON.parse(bytes);
		assert.equal(bytes.toString("utf8"), canonicalJson(value)
			, "Retained metadata must be canonical: " + path);
		return value;
	};
	const compilerPath = "metadata/compiler/javascript-wasm-component.json";
	const compiler = json(files, compilerPath);
	assert.equal(sha256(member(files, compilerPath)), entry.componentIdentity
		, "Compiled component identity");
	assert.equal(compiler.schemaVersion, 1);
	assert.equal(compiler.profile, "javascript-wasm-owned-v1");
	assert.equal(compiler.pointerBits, 32);
	assert.deepEqual(entry.sourceIdentity, compiler.sourceIdentity
		, "Report source identity must match retained compiler metadata");
	assert.match(entry.sourceIdentity.sourceTreeSha256, digest);
	assert.equal(receipt.source.treeSha256, entry.sourceIdentity.sourceTreeSha256
		, "Package-set source tree");
	assert.equal(Boolean(entry.sourceIdentity.reviewedBindingIr)
		, entry.authorRoute === "reviewed", "Compiled author route");
	assert.equal(compiler.bindingIrSha256, entry.bindingIrSha256
		, "Compiled binding IR identity");
	const model = json(files, "metadata/compiler/model.json");
	assert.equal(sha256(member(files, "metadata/compiler/model.json"))
		, compiler.modelSha256, "Compiled model identity");
	assert.deepEqual(model.component, receipt.component, "Compiled component coordinate");
	assert.deepEqual(model.sourceIdentity, entry.sourceIdentity, "Compiled model source");
	assert.equal(model.bindingIrSha256, entry.bindingIrSha256);
	const bindingIr = json(files, "metadata/compiler/binding-ir.json");
	validateOwnedAggregateBindingIr(bindingIr);
	assert.deepEqual(model.bindingIr, bindingIr, "Compiled model binding IR");
	assert.equal(sha256(canonicalizeJsonValue(bindingIr))
		, entry.bindingIrSha256, "Retained binding IR identity");
	assert.deepEqual(receipt.profiles, [{ id: "javascript-wasm-owned-v1"
		, bindingIrSha256: entry.bindingIrSha256
		, runtimeIdentity: runtime.runtimeIdentity }], "Installed package profile");
	const metadata = json(files, "package.json");
	assert.equal(metadata.name, component.name);
	assert.equal(metadata.version, component.version);
	assert.deepEqual(metadata.leanBridge, {
		component: receipt.component.id, profile: "javascript-wasm-owned-v1"
		, bindingIrSha256: entry.bindingIrSha256
		, componentIdentitySha256: entry.componentIdentity
		, runtimeIdentity: runtime.runtimeIdentity, sharedRuntime: true
	}, "Installed component metadata");
	const runtimeMetadata = json(runtimeFiles, "package.json");
	assert.equal(runtimeMetadata.name, runtime.name);
	assert.equal(runtimeMetadata.version, runtime.version);
	assert.equal(runtimeMetadata.leanBridge.runtimeIdentity, runtime.runtimeIdentity);
	assert.equal(runtimeMetadata.leanBridge.sharedRuntime, true);
	assert.equal(runtimeMetadata.leanBridge.profile, "side-lazy");
	assert.equal(compiler.library, "lib/component.so.wasm");
	const side = member(files, "internal/component.so.wasm");
	assert.deepEqual(side, member(files, "metadata/compiler/lib/component.so.wasm")
		, "Installed Wasm must be the retained compiled binary");
	assert.deepEqual(compiler.wasmLibrary, entry.wasm, "Compiled Wasm identity");
	assert.deepEqual(entry.wasm, { bytes: side.length, sha256: sha256(side) }
		, "Installed Wasm identity");
	return [entry.wasm.sha256, sha256(member(runtimeFiles, "internal/main.wasm"))];
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
		const assets = await packageIdentity(entry, receipt, retainedRoot);
		if(report.schemaVersion === 2)
			assert.deepEqual(entry.independentBuilds, [0, 1].map(attempt => ({
				authorRoot: `author-${attempt}`, componentIdentity: entry.componentIdentity
				, bindingIrSha256: entry.bindingIrSha256
				, sourceIdentity: entry.sourceIdentity
				, wasm: entry.wasm, archives: entry.archives
				, sourceUnchanged: true, removedBeforeInstall: true
			})), "Both independent author builds must reproduce the retained installed package");
		const browserExecutions = verifyBrowser(entry.browser, shape.resultOnly, assets, report.schemaVersion);
		evidenceFiles.push(...files.map(file =>
			`${entry.route}/handoff/${file}`));
		routes.push({ route: entry.route, receiptSha256: result.receiptSha256
			, archives: result.archives, archiveBytes, browserExecutions });
	}
	assert.deepEqual(await regularFiles(join(root, "evidence"))
		, evidenceFiles.toSorted(), "Evidence must contain only retained route sets");
	return { schemaVersion: report.schemaVersion, profile: report.profile, routes };
};
