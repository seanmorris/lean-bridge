/**
 * Match nominal-subtype browser execution to original compiler records and installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { checkNominalSubtypeNpmReport, nominalSubtypeNpmRecordPaths } from "./nominal-subtype-npm-report.mjs";
import { assertNominalSubtypeBrowserHandoff } from "./nominal-subtype-browser-package.mjs";
import { nominalSubtypeBrowserPackage, nominalSubtypeBrowserEntry, nominalSubtypeBrowserSources, nominalSubtypeBrowserProfiles, nominalSubtypeBrowserSelection, nominalSubtypeBrowserExpected, validateNominalSubtypeBrowserPhases } from "./nominal-subtype-browser-fixture.mjs";

const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const engines = ["chromium", "firefox", "webkit"];
/**
 * Require every npm original and every retained browser input and observation.
 *
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalSubtypeBrowserRecords = mode => [
	...nominalSubtypeNpmRecordPaths(mode), "browser.json"
	, ...nominalSubtypeBrowserProfiles.flatMap(profile => {
		const entry = { "browser-javascript": "plain", "browser-react": "react", "browser-worker": "worker-main" }[profile];
		return ["package.json", "package-lock.json", "request.json", "package.mjs"
			, "index.html", "javascript.mjs", ...nominalSubtypeBrowserSources
			, `${entry}.mjs`
			, ...profile === "browser-worker" ? ["worker.mjs"] : []
			, "installed-binding-ir.json", "installed-index.d.ts"
			, "installed-runtime-identity.json", "installed-runtime-package.json"
			, "installed-component-package.json", "inputs.json"
			, "install.json", "observations.json", "report.json"
		].map(path => `${profile}/${path}`);
	})
];
const byHash = files => files.map(({ bytes, sha256 }) => ({ bytes, sha256 })).sort((a, b) => a.sha256.localeCompare(b.sha256));
const variantsFor = profile => profile === "browser-react" ? ["production", "strict"] : ["production"];
const lifecycle = (profile, variant) => profile === "browser-worker" ? { created: 2, terminated: 2, live: 0 }
	: profile === "browser-react" ? variant === "strict" ? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
		: { effects: 3, cleanups: 2, ignored: 0, commits: 3 } : { rerun: true };

const inputs = async (item, npm, read, json, original) => {
	const { profile } = item, prefix = profile + "/";
	const entry = { "browser-javascript": "plain", "browser-react": "react", "browser-worker": "worker-main" }[profile];
	const names = ["package.json", "package-lock.json", "request.json"
		, "package.mjs", "index.html", "javascript.mjs"
		, ...nominalSubtypeBrowserSources, entry + ".mjs"
		, ...profile === "browser-worker" ? ["worker.mjs"] : []];
	assert.deepEqual(item.inputs, await json(prefix + "inputs.json"));
	exactKeys(item.inputs, names);
	for(const name of names)
	{
		const bytes = await read(prefix + name);
		assert.deepEqual(item.inputs[name], { bytes: bytes.length, sha256: sha256(bytes) });
	}
	assert.equal((await read(prefix + "package.mjs")).toString(), nominalSubtypeBrowserPackage);
	assert.deepEqual(await json(prefix + "request.json"), { module: "nominalsubtypes", profile, route: item.route, mode: item.mode, resultOnly: nominalSubtypeBrowserSelection(item.route, item.mode).resultOnly });
	assert.equal((await read(prefix + "index.html")).toString(), `<!doctype html><meta charset="utf-8"><title>Installed corpus</title><div id="root"><button id="rerun">Run again</button><button id="stop">Stop worker</button><pre id="result" data-status="loading"></pre></div><script type="module" src="./${entry}.mjs"></script>\n`);
	assert.equal((await read(prefix + "javascript.mjs")).toString(), nominalSubtypeBrowserEntry);
	const originalBytes = original;
	const originals = [
		...nominalSubtypeBrowserSources.map(path => [path, "tests/" + path])
		, ...[entry, ...profile === "browser-worker" ? ["worker"] : []]
			.map(name => [name + ".mjs", "tests/fixtures/type-corpus/consumers/browser/" + name + ".mjs"])
	];
	for(const [name, original] of originals) assert.deepEqual(await read(prefix + name), originalBytes(original));
	assert.equal(hashBindingIr(await json(prefix + "installed-binding-ir.json")), npm.builds[0].bindingIrSha256);
	assert.equal(sha256(await read(prefix + "installed-index.d.ts")), npm.trees.nominalsubtypes["index.d.ts"]);
	for(const [name, module, path] of [
		["installed-runtime-package.json", "@lean-bridge/runtime", "package.json"]
		, ["installed-runtime-identity.json", "@lean-bridge/runtime", "runtime-identity.json"]
		, ["installed-component-package.json", "nominalsubtypes", "package.json"]
	]) assert.equal(sha256(await read(prefix + name)), npm.trees[module][path]);
};

const packages = async (item, npm, json, original, artifacts) => {
	const { profile, browser } = item, prefix = profile + "/";
	const install = await json(prefix + "install.json");
	assert.equal(install.code, 0);
	assert.match(install.stderr, /^(?:npm notice[^\n]*\n)*$/u);
	assert.match(install.stdout, new RegExp(`^\\nadded ${profile === "browser-react" ? 5 : 2} packages in [0-9]+(?:ms|s)\\n$`, "u"));
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
		, bindingIrSha256: npm.builds[0].bindingIrSha256, sharedRuntime: true });
	const lock = await json(prefix + "package-lock.json"), manifest = await json(prefix + "package.json");
	assert.deepEqual(manifest, { private: true, type: "module", dependencies: manifest.dependencies });
	assert.equal(lock.lockfileVersion, 3); assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
	const frameworkNames = profile === "browser-react" ? ["react", "react-dom", "scheduler"] : [];
	const dependencies = ["@lean-bridge/runtime", "nominalsubtypes", ...frameworkNames];
	exactKeys(lock.packages, ["", ...dependencies.map(name => "node_modules/" + name)]);
	exactKeys(manifest.dependencies, dependencies);
	for(const [metadata, archive] of [[component, npm.receipt.package.archive], [runtime, npm.receipt.runtime.archive]])
	{
		const dependency = lock.packages["node_modules/" + metadata.name];
		assert.equal(dependency.version, metadata.version); assert.equal(dependency.resolved, "file:../handoff/" + archive);
		assert.equal(manifest.dependencies[metadata.name], dependency.resolved);
		assert.equal(dependency.integrity, artifacts[metadata.name].integrity);
		assert.equal(metadata.exports["."].browser, "./index.mjs");
	}
	assert.deepEqual(browser.framework.map(item => item.name), frameworkNames);
	const repositoryLock = JSON.parse(original("package-lock.json"));
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
	assert.match(wasm.path, /^node_modules\/nominalsubtypes\/internal\/wasm\/[^/]+\.wasm$/u);
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
		for(const name of ["nominalsubtypes", "@lean-bridge/runtime"]) assert.ok(deployment.modulePaths.includes("node_modules/" + name + "/index.mjs"));
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
 * @param options - Independently selected route and frozen producer.
 * @param options.route - Ordinary source or independent review.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.runtime - Independently observed producer runtime.
 * @param options.producerCommit - Actual producer revision.
 */
export const assertNominalSubtypeBrowserRecords = async (read, { route, mode, producerCommit, runtime }) => {
	nominalSubtypeBrowserSelection(route, mode); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		if(["browser.json", "report.json", "inputs.json", "observations.json"].includes(path.split("/").at(-1)))
			assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	await checkNominalSubtypeNpmReport(read, { route, mode, producerCommit, runtime });
	const npm = await json("report.json"), report = await json("browser.json");
	const artifacts = await assertNominalSubtypeBrowserHandoff(read, npm, original);
	exactKeys(report, ["reports", "requestedEngines", "schemaVersion", "route", "mode", "producerCommit", "runtime"]);
	assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.deepEqual(report.runtime, runtime); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.schemaVersion, 1); assert.deepEqual(report.requestedEngines, engines);
	assert.deepEqual(report.reports.map(item => item.profile), nominalSubtypeBrowserProfiles);
	let commonAssets;
	for(const item of report.reports)
	{
		const { profile, browser } = item;
		exactKeys(item, ["bindingIrSha256", "browser", "compilerFreePath"
			, "corpusSha256", "inputs", "observation", "observations", "offlineInstall"
			, "packageSourceSha256", "route", "mode", "producerCommit", "profile"
			, "receiptSha256"
			, "schemaVersion", "sourceRemovedBeforeInstallation"]);
		exactKeys(browser, ["deployments", "executions"
			, "externalNetworkBlocked", "framework", "installedAssets"
			, "installedSourcesRemoved", "requestedEngines"]);
		assert.deepEqual(item, await json(profile + "/report.json"));
		assert.equal(item.mode, mode);
		assert.equal(item.schemaVersion, 1); assert.equal(item.route, route); assert.equal(item.producerCommit, producerCommit);
		assert.equal(item.bindingIrSha256, npm.builds[0].bindingIrSha256);
		assert.equal(item.receiptSha256, npm.builds[0].receiptSha256);
		assert.equal(item.corpusSha256, npm.callers["fixtures/nominal-subtype-consumers/javascript.mjs"]);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(item[key], true);
		assert.equal(item.packageSourceSha256, sha256(nominalSubtypeBrowserPackage));
		assert.deepEqual(item.observations, await json(profile + "/observations.json"));
		validateNominalSubtypeBrowserPhases(item.observations, profile, engines, route, mode);
		assert.deepEqual(browser.requestedEngines, engines);
		assert.equal(browser.installedSourcesRemoved, true); assert.equal(browser.externalNetworkBlocked, true);
		await inputs(item, npm, read, json, original);
		await packages(item, npm, json, original, artifacts); executions(item);
		commonAssets ??= browser.installedAssets; assert.deepEqual(browser.installedAssets, commonAssets);
	}
	return report;
};

/**
 * Reconcile original records and return a bounded archive summary.
 *
 * @param read - Original route-relative record reader.
 * @param options - Explicit route and frozen producer selection.
 * @param options.route - Ordinary source or independent review.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.runtime - Independently observed producer runtime.
 * @param options.producerCommit - Actual producer revision.
 */
export const checkNominalSubtypeBrowserReport = async (read, { route, mode, producerCommit, runtime }) => {
	const report = await assertNominalSubtypeBrowserRecords(read, { route, mode, producerCommit, runtime });
	return { route, mode, producerCommit, runtime, engines: report.requestedEngines
		, profiles: report.reports.map(item => item.profile)
		, nodeExecutions: 2, browserExecutions: 12, lifecycleObservations: 51
		, ...nominalSubtypeBrowserExpected(mode), dispatchObserved: false };
};
