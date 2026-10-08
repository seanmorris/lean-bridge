/**
 * Authenticate ordinary callback-Fin browser observations and their deployed artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { browserCallbackFinExpected, browserCallbackFinProfiles, validateBrowserCallbackFinObservation } from "./browser-callback-fin.mjs";

const directory = "docs/evidence/browser-callback-fin-20261008";
const reportDigest = "e5451a21af08ad66365eb0b47db47abbc294ebe934a5743541d55ea694c44c5f";
const logDigest = "1fc6ca854833f0659b659012c5434b065f1afe9a5a08e021018da1733f3d8363";
const queueDigest = "46364d0fe4b84c3d5dca06fa72a8d8c7f19636288adadaa4e4bae0d758b3ffbf";
const engines = ["chromium", "firefox", "webkit"];
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const identity = ({ bytes, sha256 }) => ({ bytes, sha256 });
const byDigest = values => values.map(identity).sort((a, b) => a.sha256.localeCompare(b.sha256));
const lifecycle = (profile, variant) => profile === "browser-worker" ? { created: 2, terminated: 2, live: 0 }
	: profile === "browser-react" ? variant === "strict" ? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
		: { effects: 3, cleanups: 2, ignored: 0, commits: 3 } : { rerun: true };

const validateReport = report => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.profile, "npm-browser");
	assert.deepEqual(report.requestedEngines, engines);
	assert.deepEqual(report.expected, { checks: 409, rejections: 894 });
	assert.deepEqual(report.expected, browserCallbackFinExpected);
	assert.equal(report.dispatch, "not measured");
	for(const flag of ["reproducible", "sourceRemovedBeforeInstallation", "producerBuildsRemovedBeforeInstallation", "packagesRelocatedBeforeInstallation", "externalNetworkBlocked"])
		assert.equal(report[flag], true, flag);
	for(const name of ["bindingIrSha256", "componentIdentitySha256", "receiptSha256"]) hash(report[name]);
	assert.equal(Object.keys(report.archives).length, 2);
	assert.ok(Object.hasOwn(report.archives, "onboarding-small-1.0.0.tgz"));
	for(const [name, digest] of Object.entries(report.archives))
	{
		assert.match(name, /^(?:onboarding-small-1\.0\.0|lean-bridge-runtime-[a-z0-9.-]+)\.tgz$/u);
		hash(digest);
	}
	assert.deepEqual(report.observations.map(item => item.profile), browserCallbackFinProfiles);
	const firstAssets = report.observations[0].browser.installedAssets;
	for(const { profile, observation, browser } of report.observations)
	{
		validateBrowserCallbackFinObservation(observation, profile);
		assert.deepEqual(observation, browser.executions[0].observation);
		assert.deepEqual(browser.requestedEngines, engines);
		assert.equal(browser.externalNetworkBlocked, true);
		assert.equal(browser.installedSourcesRemoved, true);
		assert.deepEqual(browser.installedAssets, firstAssets);
		assert.equal(browser.installedAssets.length, 2);
		for(const asset of browser.installedAssets)
		{
			hash(asset.sha256); assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
			assert.ok(asset.path.startsWith("node_modules/")); assert.ok(asset.path.endsWith(".wasm"));
		}
		const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
		assert.deepEqual(browser.deployments.map(item => item.variant), variants);
		assert.deepEqual(browser.framework.map(item => item.name), profile === "browser-react" ? ["react", "react-dom", "scheduler"] : []);
		for(const item of browser.framework)
		{
			hash(item.sha256); assert.ok(item.version.length > 0);
		}
		for(const deployment of browser.deployments)
		{
			assert.equal(deployment.sha256, sha256(canonicalJson(deployment.files)));
			assert.deepEqual(byDigest(deployment.files.filter(item => item.path.endsWith(".wasm"))), byDigest(browser.installedAssets));
			assert.equal(new Set(deployment.files.map(item => item.path)).size, deployment.files.length);
			for(const path of deployment.modulePaths)
				assert.ok(path.startsWith("node_modules/") && !path.split("/").includes(".."));
			for(const name of ["onboarding-small", "@lean-bridge/runtime"])
				assert.ok(deployment.modulePaths.includes(`node_modules/${name}/index.mjs`));
		}
		assert.deepEqual(browser.executions.map(item => `${item.engine}/${item.variant}`).sort(), engines.flatMap(engine => variants.map(variant => `${engine}/${variant}`)).sort());
		for(const execution of browser.executions)
		{
			validateBrowserCallbackFinObservation(execution.observation, profile);
			assert.equal(execution.failedAssetRecovery, true);
			assert.deepEqual(execution.lifecycle, lifecycle(profile, execution.variant));
			if(profile === "browser-react") assert.equal(execution.pendingUnmount, true);
			const deployment = browser.deployments.find(item => item.variant === execution.variant);
			assert.equal(execution.assets.length, profile === "browser-worker" ? 4 : 2);
			for(const asset of execution.assets)
			{
				assert.equal(asset.status, 200); assert.equal(asset.mime, "application/wasm");
				assert.ok(asset.path.startsWith("/corpus/nested/"));
				const installed = browser.installedAssets.find(item => item.sha256 === asset.sha256);
				assert.ok(installed); assert.deepEqual(identity(asset), identity(installed));
				const deployed = deployment.files.find(item => `/corpus/nested/${item.path}` === asset.path);
				assert.ok(deployed); assert.deepEqual(identity(asset), identity(deployed));
			}
			for(const asset of browser.installedAssets)
				assert.equal(execution.assets.filter(item => item.sha256 === asset.sha256).length, profile === "browser-worker" ? 2 : 1);
		}
	}
};

test("browser callback-Fin archive authenticates installed identities, realms and lifecycles", async () => {
	const receiptBytes = await readFile(`${directory}/receipt.json`);
	assert.equal(sha256(receiptBytes), "022cd63a5114623b8824c43ee43da061ac5e1db6451c037b21d1681e0fbc1766");
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.revision, "72b7e21853d44d5c718e659b12acb746db2c359d");
	assert.equal(receipt.execution, "local"); assert.equal(receipt.producerEngine, "local");
	assert.deepEqual(receipt.scope, {
		sourcePath: "ordinary-source", profiles: browserCallbackFinProfiles, engines
		, executions: 12, checksPerExecution: 409, rejectionsPerExecution: 894
		, exports: 14, nativeHostReplies: false
		, reviewedContracts: false, dispatch: "not measured"
	});
	assert.equal(receipt.sourceFiles.length, 10);
	for(const source of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	const bytes = await readFile(receipt.report.path);
	assert.equal(receipt.report.sha256, reportDigest); assert.equal(sha256(bytes), reportDigest);
	const report = JSON.parse(bytes);
	validateReport(report);
	for(const [key, value] of Object.entries(receipt.identities)) assert.deepEqual(report[key], value);
	const log = await readFile(receipt.log.path, "utf8");
	assert.equal(receipt.log.sha256, logDigest); assert.equal(sha256(log), logDigest);
	for(const [key, count] of Object.entries({ tests: 4, pass: 4, fail: 0, skipped: 0 }))
		assert.match(log, new RegExp(`^# ${key} ${count}$`, "mu"));
	assert.match(log, /^exit=0$/mu); assert.doesNotMatch(log, /^not ok /mu);
});

test("browser archive rejects missing engines, weakened cases, leaked workers and altered Wasm", async () => {
	const original = JSON.parse(await readFile(`${directory}/ordinary.json`, "utf8"));
	const mutations = [
		report => { report.requestedEngines.pop(); }
		, report => { report.observations.pop(); }
		, report => { report.observations[1].browser.executions.pop(); }
		, report => { report.observations[0].browser.executions[0].observation.results.rejections--; }
		, report => { report.dispatch = "measured"; }
		, report => { report.observations[0].browser.executions[0].observation.realm = "dedicated-worker"; }
		, report => { report.producerBuildsRemovedBeforeInstallation = false; }
		, report => { report.packagesRelocatedBeforeInstallation = false; }
		, report => { report.observations[0].browser.installedSourcesRemoved = false; }
		, report => { report.observations[1].browser.executions[0].pendingUnmount = false; }
		, report => { report.observations[1].browser.executions[1].lifecycle.ignored = 0; }
		, report => { report.observations[2].browser.executions[0].lifecycle.live = 1; }
		, report => { report.observations[0].browser.executions[0].failedAssetRecovery = false; }
		, report => { report.observations[0].browser.executions[0].assets[0].sha256 = "0".repeat(64); }
		, report => { report.observations[0].browser.executions[0].assets[0].path = "/elsewhere.wasm"; }
		, report => { report.observations[0].browser.deployments[0].files[0].bytes++; }
		, report => { report.observations[0].browser.externalNetworkBlocked = false; }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => validateReport(changed));
	}
});

test("the browser callback queue retains its exact producer revision and successful exit", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	const queue = await readFile(receipt.queue.path, "utf8");
	assert.equal(receipt.queue.sha256, queueDigest);
	assert.equal(sha256(queue), queueDigest);
	assert.match(queue, /^revision=72b7e21853d44d5c718e659b12acb746db2c359d$/mu);
	assert.match(queue, /cpu=3 concurrency=1/u);
	assert.match(queue, /^LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit$/mu);
	assert.match(queue, /^end=.* exit=0 # pass 4 # fail 0 # skipped 0/mu);
});
