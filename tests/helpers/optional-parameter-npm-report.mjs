/**
 * Independently validate retained optional npm/browser acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { validateComponentBuildPlan } from "../../src/build/component-plan.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	validateComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import {
	optionalParameterBrowserProfiles
	, validateOptionalParameterBrowserPhases
} from "./optional-parameter-browser.mjs";
import {
	assertOptionalParameterIr
	, optionalParameterExports
	, optionalParameterModule
} from "./optional-parameter-fixture.mjs";
import {
	optionalParameterTargetConfiguration
} from "./optional-parameter-packages.mjs";
import {
	optionalParameterMatrixCases
} from "./optional-parameter-matrix.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const profiles = [
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker"
];
const factKeys = [
	"authenticatedDefaults", "bindingIrFileSha256", "bindingIrSha256"
	, "compilerAdaptersSha256", "componentArchiveSha256", "declarations"
	, "generatedLeanSha256", "receiptSha256", "runtimeArchiveSha256"
];

/**
 * Validate the original canonical report and source-free observations.
 *
 * @param report - Parsed retained report.
 * @param options - Expected route and producer.
 * @param options.route - Ordinary or independently reviewed route.
 * @param options.producerCommit - Exact producer revision.
 * @param options.browserRequired - Whether all browser contexts must be present.
 */
export const validateOptionalParameterNpmReport = (report, {
	route, producerCommit, browserRequired = true
}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, profiles);
	for(const key of [
		"reproducible", "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
	]) assert.equal(report[key], true, key);
	assert.equal(report.independentBuilds, 2);
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	for(const fact of report.builds)
	{
		assert.deepEqual(Object.keys(fact).sort(), factKeys);
		for(const key of factKeys.filter(key => key.endsWith("Sha256")))
			digest(fact[key]);
		assert.equal(fact.declarations, 7);
		assert.equal(fact.authenticatedDefaults, 7);
	}
	validateComponentPackageReceipt(report.receipt);
	assert.equal(report.receipt.package.package, "optional-parameters@1.0.0");
	assert.equal(report.receipt.bindingIrSha256
		, report.builds[0].bindingIrSha256);
	assert.equal(report.receipt.package.sha256
		, report.builds[0].componentArchiveSha256);
	assert.equal(report.receipt.runtime.sha256
		, report.builds[0].runtimeArchiveSha256);
	assert.deepEqual(Object.keys(report.installedTrees).sort()
		, ["@lean-bridge/runtime", "optional-parameters"]);
	for(const files of Object.values(report.installedTrees))
	{
		assert.ok(Object.keys(files).length > 5);
		assert.ok(Object.hasOwn(files, "package.json"));
		for(const [path, hash] of Object.entries(files))
		{
			assert.ok(!path.startsWith("/")
				&& path.split("/").every(part =>
					part && part !== "." && part !== ".."));
			digest(hash);
		}
	}
	assert.deepEqual(report.node, [
		{ result: { checks: 27, rejections: 7 }
			, typescript: true, relocated: false }
		, { result: { checks: 27, rejections: 7 }
			, typescript: true, relocated: true }
	]);
	digest(report.declarationsSha256);
	digest(report.callerSha256);
	if(browserRequired)
	{
		assert.deepEqual(report.browser.requestedEngines
			, ["chromium", "firefox", "webkit"]);
		assert.deepEqual(report.browser.reports.map(item => item.profile)
			, optionalParameterBrowserProfiles);
		for(const item of report.browser.reports)
		{
			assert.equal(item.route, route);
			for(const key of [
				"sourceRemovedBeforeInstallation", "offlineInstall"
				, "compilerFreePath"
			]) assert.equal(item[key], true, `${item.profile}: ${key}`);
			validateOptionalParameterBrowserPhases(
				item.observations, item.profile
				, report.browser.requestedEngines
			);
			assert.equal(item.browser.installedSourcesRemoved, true);
			assert.equal(item.browser.externalNetworkBlocked, true);
		}
	}
	else assert.equal(report.browser, null);
	return {
		lane: "npm", route, producerCommit, profiles: report.profiles
		, cases: optionalParameterMatrixCases
		, checks: 27, rejections: 7, executions: 2
		, browserProfiles: report.browser?.reports.length ?? 0
	};
};

/**
 * Validate every retained compiler, author and report record.
 *
 * @param read - Reader of original run records.
 * @param options - Expected route and producer.
 * @param options.route - Ordinary or independently reviewed route.
 * @param options.producerCommit - Exact producer revision.
 * @param options.browserRequired - Whether browser records are required.
 */
export const checkOptionalParameterNpmRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateOptionalParameterNpmReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [optionalParameterModule]
		, ...options.route === "ordinary"
			? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration(profiles)
	};
	const source = execFileSync("git", ["show"
		, `${options.producerCommit}:tests/fixtures/onboarding/optional-parameters/Defaults.lean`]);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		assert.deepEqual(await json(prefix + "configuration.json")
			, expectedConfiguration);
		assert.deepEqual(await read(prefix + "Defaults.lean"), source);
		const irBytes = await read(prefix + "binding-ir.json");
		const ir = JSON.parse(irBytes);
		assertOptionalParameterIr(ir);
		const adaptersBytes = await read(prefix + "compiler-adapters.json");
		const adapters = JSON.parse(adaptersBytes);
		validateCompilerAdapterPlan(adapters);
		assert.equal(adapters.exports.length, 7);
		assert.ok(adapters.exports.every(item => item.parameters.length === 1));
		const plan = await json(prefix + "component-build-plan.json");
		validateComponentBuildPlan(plan);
		const receiptBytes = await read(
			prefix + "component-package-receipt.json");
		const receipt = JSON.parse(receiptBytes);
		validateComponentPackageReceipt(receipt);
		const leanBytes = await read(prefix + "LeanBridgeGenerated.lean");
		assert.doesNotMatch(leanBytes.toString()
			, /(?:sorry|unsafeCast|\baxiom\b)/u);
		const fact = report.builds[attempt];
		assert.equal(fact.bindingIrFileSha256, sha256(irBytes));
		assert.equal(fact.compilerAdaptersSha256, sha256(adaptersBytes));
		assert.equal(fact.generatedLeanSha256, sha256(leanBytes));
		assert.equal(fact.receiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
	}
	for(const name of [
		"binding-ir.json", "compiler-adapters.json", "component-build-plan.json"
		, "LeanBridgeGenerated.lean", "provenance.json"
		, "component-package-receipt.json", "configuration.json"
		, "Defaults.lean"
	]) assert.deepEqual(
		await read(`build-0/${name}`), await read(`build-1/${name}`), name
	);
	const expectedCaller = `import * as api from "optional-parameters";
import {checkOptionalParameters} from "./check.mjs";
console.log(JSON.stringify(checkOptionalParameters(api)));
`;
	assert.equal((await read("index.mjs")).toString(), expectedCaller);
	assert.equal(report.callerSha256, sha256(await read("index.mjs")));
	assert.equal(report.declarationsSha256, sha256(await read("index.d.ts")));
	for(const signature of [
		/word\(value0\?: number\): number;/u
		, /natural\(value0\?: bigint\): bigint;/u
		, /unitValue\(value0\?: void\): void;/u
	]) assert.match((await read("index.d.ts")).toString(), signature);
	const handoff = await json("handoff/component-package-receipt.json");
	assert.deepEqual(handoff, report.receipt);
	for(const item of [handoff.runtime, handoff.package])
		assert.equal(sha256(await read(`handoff/${item.archive}`))
			, item.sha256, item.archive);
	assert.match((await read(
		"handoff/verify-component-package-receipt.mjs"
	)).toString(), /verifyComponentPackageReceipt/u);
	return result;
};
