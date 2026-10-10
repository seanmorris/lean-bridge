/**
 * Match reviewed browser execution to original compiler records and installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { assertReviewedSubtypeNpmRecords } from "./reviewed-subtype-npm-report.mjs";
import { reviewedPackageKeys } from "./reviewed-subtype-package-ci-common.mjs";
import { reviewedSubtypeBrowserPackage, reviewedSubtypeBrowserProfiles, validateReviewedSubtypeBrowserPhases } from "./reviewed-subtype-browser-fixture.mjs";

const engines = ["chromium", "firefox", "webkit"];
const byHash = files => files.map(({ bytes, sha256 }) => ({ bytes, sha256 })).sort((a, b) => a.sha256.localeCompare(b.sha256));
const variantsFor = profile => profile === "browser-react" ? ["production", "strict"] : ["production"];
const lifecycle = (profile, variant) => profile === "browser-worker" ? { created: 2, terminated: 2, live: 0 }
	: profile === "browser-react" ? variant === "strict" ? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
		: { effects: 3, cleanups: 2, ignored: 0, commits: 3 } : { rerun: true };

const inputs = async (item, npm, read, json) => {
	const { profile } = item, prefix = profile + "/";
	const entry = { "browser-javascript": "plain", "browser-react": "react", "browser-worker": "worker-main" }[profile];
	const names = ["package.json", "package-lock.json", "request.json"
		, "package.mjs", "index.html", "javascript.mjs", "check.mjs", entry + ".mjs"
		, ...profile === "browser-worker" ? ["worker.mjs"] : []];
	assert.deepEqual(item.inputs, await json(prefix + "inputs.json"));
	reviewedPackageKeys(item.inputs, names);
	for(const name of names)
	{
		const bytes = await read(prefix + name);
		assert.deepEqual(item.inputs[name], { bytes: bytes.length, sha256: sha256(bytes) });
	}
	assert.equal((await read(prefix + "package.mjs")).toString(), reviewedSubtypeBrowserPackage);
	assert.deepEqual(await json(prefix + "request.json"), { module: "subtypes", profile });
	assert.equal((await read(prefix + "index.html")).toString(), `<!doctype html><meta charset="utf-8"><title>Installed corpus</title><div id="root"><button id="rerun">Run again</button><button id="stop">Stop worker</button><pre id="result" data-status="loading"></pre></div><script type="module" src="./${entry}.mjs"></script>\n`);
	const originals = [
		["check.mjs", "tests/fixtures/reviewed-subtype-consumers/javascript.mjs"]
		, ["javascript.mjs", "tests/fixtures/reviewed-subtype-consumers/browser.mjs"]
		, ...[entry, ...profile === "browser-worker" ? ["worker"] : []]
			.map(name => [name + ".mjs", "tests/fixtures/type-corpus/consumers/browser/" + name + ".mjs"])
	];
	for(const [name, original] of originals) assert.deepEqual(await read(prefix + name), await readFile(original));
	assert.equal(hashBindingIr(await json(prefix + "installed-binding-ir.json")), npm.bindingIrSha256);
	assert.equal(sha256(await read(prefix + "installed-index.d.ts")), npm.typescript.declarationsSha256);
};

const packages = async (item, npm, json) => {
	const { profile, browser } = item, prefix = profile + "/";
	const runtime = await json(prefix + "installed-runtime-package.json"), basis = await json(prefix + "installed-runtime-identity.json");
	assert.equal(runtime.leanBridge.runtimeIdentity, sha256(canonicalJson(basis)));
	assert.equal(runtime.name + "@" + runtime.version, npm.receipt.runtime.package);
	assert.equal(runtime.version, "0.0.0-abi" + basis.metadata.leanBridge.componentScalarAbi + "." + runtime.leanBridge.runtimeIdentity);
	const component = await json(prefix + "installed-component-package.json");
	assert.equal(component.name + "@" + component.version, npm.receipt.package.package);
	assert.deepEqual(component.dependencies, { "@lean-bridge/runtime": runtime.version });
	assert.deepEqual(component.leanBridge, {
		component: npm.receipt.package.package
		, componentBundleSha256: npm.receipt.componentBundleSha256
		, componentIdentitySha256: npm.receipt.componentIdentitySha256
		, bindingIrSha256: npm.bindingIrSha256, sharedRuntime: true });
	const lock = await json(prefix + "package-lock.json"), manifest = await json(prefix + "package.json");
	assert.deepEqual(manifest, { private: true, type: "module", dependencies: manifest.dependencies });
	assert.equal(lock.lockfileVersion, 3); assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
	const frameworkNames = profile === "browser-react" ? ["react", "react-dom", "scheduler"] : [];
	const dependencies = ["@lean-bridge/runtime", "subtypes", ...frameworkNames];
	reviewedPackageKeys(lock.packages, ["", ...dependencies.map(name => "node_modules/" + name)]);
	reviewedPackageKeys(manifest.dependencies, dependencies);
	for(const [metadata, archive] of [[component, npm.receipt.package.archive], [runtime, npm.receipt.runtime.archive]])
	{
		const dependency = lock.packages["node_modules/" + metadata.name];
		assert.equal(dependency.version, metadata.version); assert.equal(dependency.resolved, "file:../handoff/" + archive);
		assert.equal(manifest.dependencies[metadata.name], dependency.resolved);
		assert.match(dependency.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/u);
		assert.equal(metadata.exports["."].browser, "./index.mjs");
	}
	assert.deepEqual(browser.framework.map(item => item.name), frameworkNames);
	const repositoryLock = JSON.parse(await readFile("package-lock.json"));
	for(const framework of browser.framework)
	{
		assert.equal(framework.version, repositoryLock.packages["node_modules/" + framework.name].version);
		assert.match(framework.sha256, /^[a-f0-9]{64}$/u);
		assert.equal(framework.archive, "framework/" + framework.name + "-" + framework.version + ".tgz");
		const dependency = lock.packages["node_modules/" + framework.name];
		assert.equal(dependency.version, framework.version); assert.equal(dependency.resolved, "file:" + framework.archive);
		assert.equal(manifest.dependencies[framework.name], dependency.resolved);
	}
	assert.equal(browser.installedAssets.length, 2);
	const main = browser.installedAssets.find(asset => asset.path === "node_modules/@lean-bridge/runtime/internal/main.wasm");
	assert.equal(main.sha256, basis.files.find(file => file.path === "internal/main.wasm").sha256);
	const wasm = browser.installedAssets.find(asset => asset !== main);
	assert.match(wasm.path, /^node_modules\/subtypes\/internal\/wasm\/[^/]+\.wasm$/u);
	assert.equal(wasm.sha256, npm.receipt.componentArtifactSha256);
};

const executions = item => {
	const { profile, browser } = item, variants = variantsFor(profile);
	assert.deepEqual(browser.deployments.map(item => item.variant), variants);
	for(const deployment of browser.deployments)
	{
		assert.equal(deployment.sha256, sha256(canonicalJson(deployment.files)));
		assert.equal(new Set(deployment.files.map(item => item.path)).size, deployment.files.length);
		assert.deepEqual(byHash(deployment.files.filter(file => file.path.endsWith(".wasm"))), byHash(browser.installedAssets));
		for(const name of ["subtypes", "@lean-bridge/runtime"]) assert.ok(deployment.modulePaths.includes("node_modules/" + name + "/index.mjs"));
		for(const path of deployment.modulePaths) assert.ok(path.startsWith("node_modules/") && !path.split("/").includes(".."));
	}
	assert.deepEqual(browser.executions.map(({ engine, variant }) => ({ engine, variant })), engines.flatMap(engine => variants.map(variant => ({ engine, variant }))));
	assert.deepEqual(item.observation, browser.executions[0].observation);
	for(const execution of browser.executions)
	{
		const observed = item.observations.filter(row => row.engine === execution.engine && row.variant === execution.variant);
		for(const row of observed) assert.deepEqual(row.observation, execution.observation);
		assert.equal(execution.failedAssetRecovery, true);
		assert.deepEqual(execution.lifecycle, lifecycle(profile, execution.variant));
		if(profile === "browser-react") assert.equal(execution.pendingUnmount, true);
		const deployment = browser.deployments.find(item => item.variant === execution.variant);
		assert.equal(execution.assets.length, profile === "browser-worker" ? 4 : 2);
		for(const asset of execution.assets)
		{
			assert.equal(asset.status, 200); assert.equal(asset.mime, "application/wasm");
			assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
			const installed = browser.installedAssets.find(item => item.sha256 === asset.sha256);
			assert.ok(installed); assert.equal(asset.bytes, installed.bytes);
			const deployed = deployment.files.find(item => "/corpus/nested/" + item.path === asset.path);
			assert.ok(deployed); assert.deepEqual(byHash([asset]), byHash([deployed]));
		}
		for(const asset of browser.installedAssets) assert.equal(execution.assets.filter(item => item.sha256 === asset.sha256).length, profile === "browser-worker" ? 2 : 1);
	}
};

/**
 * Require the original npm build records and all browser engines, variants and phases.
 *
 * @param read - Original byte reader, restricted to relative paths in one retained run.
 */
export const assertReviewedSubtypeBrowserRecords = async read => {
	const json = async path => JSON.parse(await read(path));
	const npm = await assertReviewedSubtypeNpmRecords(read), report = await json("browser.json");
	reviewedPackageKeys(report, ["reports", "requestedEngines", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.deepEqual(report.requestedEngines, engines);
	assert.deepEqual(report.reports.map(item => item.profile), reviewedSubtypeBrowserProfiles);
	let commonAssets;
	for(const item of report.reports)
	{
		const { profile, browser } = item;
		reviewedPackageKeys(item, ["bindingIrSha256", "browser", "compilerFreePath"
			, "corpusSha256", "inputs", "observation", "observations", "offlineInstall"
			, "packageSourceSha256", "path", "profile", "receiptSha256"
			, "schemaVersion", "sourceRemovedBeforeInstallation"]);
		reviewedPackageKeys(browser, ["deployments", "executions"
			, "externalNetworkBlocked", "framework", "installedAssets"
			, "installedSourcesRemoved", "requestedEngines"]);
		assert.deepEqual(item, await json(profile + "/report.json"));
		assert.equal(item.schemaVersion, 1); assert.equal(item.path, "reviewed-source");
		for(const key of ["bindingIrSha256", "receiptSha256", "corpusSha256"]) assert.equal(item[key], npm[key]);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(item[key], true);
		assert.equal(item.packageSourceSha256, sha256(reviewedSubtypeBrowserPackage));
		assert.deepEqual(item.observations, await json(profile + "/observations.json"));
		validateReviewedSubtypeBrowserPhases(item.observations, profile, engines);
		assert.deepEqual(browser.requestedEngines, engines);
		assert.equal(browser.installedSourcesRemoved, true); assert.equal(browser.externalNetworkBlocked, true);
		await inputs(item, npm, read, json); await packages(item, npm, json); executions(item);
		commonAssets ??= browser.installedAssets; assert.deepEqual(browser.installedAssets, commonAssets);
	}
	return report;
};
