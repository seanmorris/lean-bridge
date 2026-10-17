/**
 * Authenticate inherited checked-record packages in pages, React and dedicated workers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	checkInheritedCheckedRecordNpmReport,
	inheritedCheckedRecordNpmRecordPaths
} from "./inherited-checked-record-npm-report.mjs";
import {
	inheritedCheckedRecordNpmExpected,
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordBrowserEngines,
	inheritedCheckedRecordBrowserPackage,
	inheritedCheckedRecordBrowserProfiles,
	validateInheritedCheckedRecordBrowserPhases
} from "./inherited-checked-record-browser-fixture.mjs";

const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const variantsFor = profile => profile === "browser-react"
	? ["production", "strict"] : ["production"];
const lifecycle = (profile, variant) => profile === "browser-worker"
	? { created: 2, terminated: 2, live: 0 }
	: profile === "browser-react"
		? variant === "strict"
			? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
			: { effects: 3, cleanups: 2, ignored: 0, commits: 3 }
		: { rerun: true };
const byHash = files => files.map(({ bytes, sha256: hash }) => ({
	bytes, sha256: hash
})).sort((a, b) => a.sha256.localeCompare(b.sha256));
const profilePaths = profile => {
	const entry = {
		"browser-javascript": "plain", "browser-react": "react"
		, "browser-worker": "worker-main"
	}[profile];
	return [
		"package.json", "package-lock.json", "request.json", "package.mjs"
		, "index.html", "javascript.mjs", "check.mjs", `${entry}.mjs`
		, ...profile === "browser-worker" ? ["worker.mjs"] : []
		, "installed-binding-ir.json", "installed-index.d.ts"
		, "installed-runtime-identity.json", "installed-runtime-package.json"
		, "installed-component-package.json", "inputs.json", "install.json"
		, "observations.json", "report.json"
	].map(path => `browser/${profile}/${path}`);
};

/**
 * Enumerate every npm and browser original required for one accepted route.
 *
 * @param mode - Accepted package mode.
 * @param receipt - Accepted package receipt.
 */
export const inheritedCheckedRecordBrowserRecordPaths = (mode, receipt) => [
	...inheritedCheckedRecordNpmRecordPaths(mode, receipt), "browser.json"
	, ...inheritedCheckedRecordBrowserProfiles.flatMap(profilePaths)
];

const checkInputs = async ({ item, npm, read, json, producer, consumer }) => {
	const { profile } = item, prefix = `browser/${profile}/`;
	const entry = {
		"browser-javascript": "plain", "browser-react": "react"
		, "browser-worker": "worker-main"
	}[profile];
	const names = [
		"package.json", "package-lock.json", "request.json", "package.mjs"
		, "index.html", "javascript.mjs", "check.mjs", `${entry}.mjs`
		, ...profile === "browser-worker" ? ["worker.mjs"] : []
	];
	assert.deepEqual(item.inputs, await json(prefix + "inputs.json"));
	exactKeys(item.inputs, names);
	for(const name of names)
	{
		const bytes = await read(prefix + name);
		assert.deepEqual(item.inputs[name], { bytes: bytes.length, sha256: sha256(bytes) });
	}
	assert.equal((await read(prefix + "package.mjs")).toString()
		, inheritedCheckedRecordBrowserPackage);
	assert.deepEqual(await json(prefix + "request.json"), {
		module: "inheritedcheckedrecords", profile, route: item.route
		, resultOnly: inheritedCheckedRecordNpmSelection(item.route).resultOnly
	});
	assert.equal((await read(prefix + "index.html")).toString()
		, `<!doctype html><meta charset="utf-8"><title>Installed corpus</title><div id="root"><button id="rerun">Run again</button><button id="stop">Stop worker</button><pre id="result" data-status="loading"></pre></div><script type="module" src="./${entry}.mjs"></script>\n`);
	assert.deepEqual(await read(prefix + "javascript.mjs")
		, consumer("tests/fixtures/inherited-checked-record-consumers/browser.mjs"));
	assert.deepEqual(await read(prefix + "check.mjs")
		, producer("tests/fixtures/inherited-checked-record-consumers/javascript.mjs"));
	for(const name of [entry, ...profile === "browser-worker" ? ["worker"] : []])
		assert.deepEqual(await read(prefix + `${name}.mjs`)
			, consumer(`tests/fixtures/type-corpus/consumers/browser/${name}.mjs`));
	assert.equal(hashBindingIr(await json(prefix + "installed-binding-ir.json"))
		, npm.builds[0].bindingIrSha256);
	assert.equal(sha256(await read(prefix + "installed-index.d.ts"))
		, npm.trees.inheritedcheckedrecords["index.d.ts"]);
	for(const [name, module, path] of [
		["installed-runtime-package.json", "@lean-bridge/runtime", "package.json"]
		, ["installed-runtime-identity.json", "@lean-bridge/runtime", "runtime-identity.json"]
		, ["installed-component-package.json", "inheritedcheckedrecords", "package.json"]
	]) assert.equal(sha256(await read(prefix + name)), npm.trees[module][path]);
};

const checkPackages = async ({ item, npm, read, json, consumer }) => {
	const { profile, browser } = item, prefix = `browser/${profile}/`;
	const install = await json(prefix + "install.json"); assert.equal(install.code, 0);
	assert.match(install.stderr, /^(?:npm notice[^\n]*\n)*$/u);
	assert.match(install.stdout, new RegExp(
		`^\\nadded ${profile === "browser-react" ? 5 : 2} packages in [0-9]+(?:ms|s)\\n$`, "u"));
	const runtime = await json(prefix + "installed-runtime-package.json");
	const basis = await json(prefix + "installed-runtime-identity.json");
	assert.equal(runtime.leanBridge.runtimeIdentity, sha256(canonicalJson(basis)));
	assert.equal(`${runtime.name}@${runtime.version}`, npm.receipt.runtime.package);
	const component = await json(prefix + "installed-component-package.json");
	assert.equal(`${component.name}@${component.version}`, npm.receipt.package.package);
	assert.deepEqual(component.dependencies, { "@lean-bridge/runtime": runtime.version });
	assert.deepEqual(component.leanBridge, {
		component: npm.receipt.package.package
		, componentBundleSha256: npm.receipt.componentBundleSha256
		, componentIdentitySha256: npm.receipt.componentIdentitySha256
		, bindingIrSha256: npm.builds[0].bindingIrSha256, sharedRuntime: true
	});
	const manifest = await json(prefix + "package.json");
	const lock = await json(prefix + "package-lock.json");
	assert.deepEqual(manifest, { private: true, type: "module", dependencies: manifest.dependencies });
	assert.equal(lock.lockfileVersion, 3); assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
	const frameworkNames = profile === "browser-react" ? ["react", "react-dom", "scheduler"] : [];
	const dependencies = ["@lean-bridge/runtime", "inheritedcheckedrecords", ...frameworkNames];
	exactKeys(lock.packages, ["", ...dependencies.map(name => `node_modules/${name}`)]);
	exactKeys(manifest.dependencies, dependencies);
	for(const [metadata, archive] of [
		[component, npm.receipt.package.archive]
		, [runtime, npm.receipt.runtime.archive]
	]) {
		const dependency = lock.packages[`node_modules/${metadata.name}`];
		assert.equal(dependency.version, metadata.version);
		assert.equal(dependency.resolved, `file:../handoff/${archive}`);
		assert.equal(manifest.dependencies[metadata.name], dependency.resolved);
		assert.equal(dependency.integrity, "sha512-" + createHash("sha512")
			.update(await read(`handoff/${archive}`)).digest("base64"));
		assert.equal(metadata.exports["."].browser, "./index.mjs");
	}
	assert.deepEqual(browser.framework.map(item => item.name), frameworkNames);
	const repositoryLock = JSON.parse(consumer("package-lock.json"));
	for(const framework of browser.framework)
	{
		assert.equal(framework.version
			, repositoryLock.packages[`node_modules/${framework.name}`].version);
		assert.match(framework.sha256, /^[a-f0-9]{64}$/u);
		assert.equal(framework.archive
			, `framework/${framework.name}-${framework.version}.tgz`);
		const dependency = lock.packages[`node_modules/${framework.name}`];
		assert.equal(dependency.version, framework.version);
		assert.equal(dependency.resolved, `file:${framework.archive}`);
		assert.equal(manifest.dependencies[framework.name], dependency.resolved);
	}
	assert.equal(browser.installedAssets.length, 2);
	const main = browser.installedAssets.find(asset =>
		asset.path === "node_modules/@lean-bridge/runtime/internal/main.wasm");
	assert.equal(main.sha256, basis.files.find(file =>
		file.path === "internal/main.wasm").sha256);
	const wasm = browser.installedAssets.find(asset => asset !== main);
	assert.match(wasm.path
		, /^node_modules\/inheritedcheckedrecords\/internal\/wasm\/[^/]+\.wasm$/u);
	assert.equal(wasm.sha256, npm.receipt.componentArtifactSha256);
};

const checkExecutions = (item, browserVersions) => {
	const { profile, browser } = item, variants = variantsFor(profile);
	assert.deepEqual(browser.deployments.map(value => value.variant), variants);
	for(const deployment of browser.deployments)
	{
		assert.equal(deployment.sha256, sha256(canonicalJson(deployment.files)));
		assert.equal(new Set(deployment.files.map(value => value.path)).size
			, deployment.files.length);
		assert.deepEqual(byHash(deployment.files.filter(file => file.path.endsWith(".wasm")))
			, byHash(browser.installedAssets));
		for(const name of ["inheritedcheckedrecords", "@lean-bridge/runtime"])
			assert.ok(deployment.modulePaths.includes(`node_modules/${name}/index.mjs`));
		for(const path of deployment.modulePaths)
			assert.ok(path.startsWith("node_modules/") && !path.split("/").includes(".."));
	}
	assert.deepEqual(browser.executions.map(({ engine, variant }) => ({ engine, variant }))
		, inheritedCheckedRecordBrowserEngines.flatMap(engine =>
			variants.map(variant => ({ engine, variant }))));
	assert.deepEqual(item.observation, browser.executions[0].observation);
	for(const execution of browser.executions)
	{
		browserVersions[execution.engine] ??= execution.observation.hostVersion;
		assert.equal(execution.observation.hostVersion, browserVersions[execution.engine]);
		const observed = item.observations.filter(row =>
			row.engine === execution.engine && row.variant === execution.variant);
		for(const row of observed) assert.deepEqual(row.observation, execution.observation);
		assert.equal(execution.failedAssetRecovery, true);
		assert.deepEqual(execution.lifecycle, lifecycle(profile, execution.variant));
		if(profile === "browser-react") assert.equal(execution.pendingUnmount, true);
		const deployment = browser.deployments.find(value => value.variant === execution.variant);
		assert.equal(execution.assets.length, profile === "browser-worker" ? 4 : 2);
		for(const asset of execution.assets)
		{
			assert.equal(asset.status, 200); assert.match(asset.mime, /^application\/wasm/u);
			assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
			const installed = browser.installedAssets.find(value => value.sha256 === asset.sha256);
			assert.ok(installed); assert.equal(asset.bytes, installed.bytes);
			const deployed = deployment.files.find(value =>
				`/corpus/nested/${value.path}` === asset.path);
			assert.ok(deployed); assert.deepEqual(byHash([asset]), byHash([deployed]));
		}
		for(const asset of browser.installedAssets)
			assert.equal(execution.assets.filter(value => value.sha256 === asset.sha256).length
				, profile === "browser-worker" ? 2 : 1);
	}
};

/**
 * Require original npm records and every browser engine, context and lifecycle phase.
 *
 * @param read - Route-relative original byte reader.
 * @param options - Independently selected producer, consumer and runtime identities.
 */
export const checkInheritedCheckedRecordBrowserReport = async (read, options) => {
	const { route, producerCommit, consumerCommit, runtime } = options;
	const selection = inheritedCheckedRecordNpmSelection(route);
	for(const commit of [producerCommit, consumerCommit]) assert.match(commit, /^[a-f0-9]{40}$/u);
	const git = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`], {
		maxBuffer: 32 * 1024 * 1024
	});
	const producer = path => git(producerCommit, path);
	const consumer = path => git(consumerCommit, path);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		if(["browser.json", "report.json", "inputs.json", "observations.json"]
			.includes(path.split("/").at(-1))) assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	await checkInheritedCheckedRecordNpmReport(read, { route, producerCommit, runtime });
	const npm = await json("report.json"), report = await json("browser.json");
	exactKeys(report, [
		"schemaVersion", "route", "producerCommit", "consumerCommit"
		, "requestedEngines", "reports"
	]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.consumerCommit, consumerCommit);
	assert.deepEqual(report.requestedEngines, inheritedCheckedRecordBrowserEngines);
	assert.deepEqual(report.reports.map(item => item.profile)
		, inheritedCheckedRecordBrowserProfiles);
	let commonAssets;
	const browserVersions = {};
	for(const item of report.reports)
	{
		const { profile, browser } = item;
		exactKeys(item, [
			"schemaVersion", "profile", "route", "producerCommit", "consumerCommit"
			, "bindingIrSha256", "receiptSha256", "corpusSha256"
			, "packageSourceSha256", "offlineInstall", "compilerFreePath"
			, "sourceRemovedBeforeInstallation", "inputs", "observations"
			, "observation", "browser"
		]);
		exactKeys(browser, [
			"requestedEngines", "installedAssets", "framework", "deployments"
			, "executions", "installedSourcesRemoved", "externalNetworkBlocked"
		]);
		assert.deepEqual(item, await json(`browser/${profile}/report.json`));
		assert.equal(item.schemaVersion, 1); assert.equal(item.route, route);
		assert.equal(item.producerCommit, producerCommit);
		assert.equal(item.consumerCommit, consumerCommit);
		assert.equal(item.bindingIrSha256, npm.builds[0].bindingIrSha256);
		assert.equal(item.receiptSha256, npm.builds[0].receiptSha256);
		assert.equal(item.corpusSha256, npm.callers["check.mjs"]);
		assert.equal(item.packageSourceSha256, sha256(inheritedCheckedRecordBrowserPackage));
		for(const key of [
			"offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"
		]) assert.equal(item[key], true);
		assert.deepEqual(item.observations
			, await json(`browser/${profile}/observations.json`));
		validateInheritedCheckedRecordBrowserPhases(
			item.observations, profile, inheritedCheckedRecordBrowserEngines, route);
		assert.deepEqual(browser.requestedEngines, inheritedCheckedRecordBrowserEngines);
		assert.equal(browser.installedSourcesRemoved, true);
		assert.equal(browser.externalNetworkBlocked, true);
		await checkInputs({ item, npm, read, json, producer, consumer });
		await checkPackages({ item, npm, read, json, consumer });
		checkExecutions(item, browserVersions);
		commonAssets ??= browser.installedAssets;
		assert.deepEqual(browser.installedAssets, commonAssets);
	}
	exactKeys(browserVersions, inheritedCheckedRecordBrowserEngines);
	return {
		route, mode: selection.mode, producerCommit, consumerCommit
		, engines: report.requestedEngines
		, profiles: report.reports.map(item => item.profile)
		, browserVersions
		, browserExecutions: 12, lifecycleObservations: 51
		, ...inheritedCheckedRecordNpmExpected(route)
	};
};
