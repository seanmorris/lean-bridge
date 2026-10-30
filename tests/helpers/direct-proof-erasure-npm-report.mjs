/**
 * Independently validate retained direct proof-erasure npm acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { validateComponentBuildPlan } from "../../src/build/component-plan.mjs";
import {
	validateComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import {
	directProofErasureBrowserProfiles
	, validateDirectProofErasureBrowserPhases
} from "./direct-proof-erasure-browser.mjs";
import {
	assertDirectProofErasureIr
	, directProofErasureModule
	, directProofErasureProofs
} from "./direct-proof-erasure-fixture.mjs";
import {
	directProofErasureTargetConfiguration
} from "./direct-proof-erasure-packages.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const profiles = [
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker"
];
const factKeys = [
	"bindingIrFileSha256", "bindingIrSha256", "compilerAdaptersSha256"
	, "componentArchiveSha256", "erasedProofs", "generatedLeanSha256"
	, "receiptSha256", "runtimeArchiveSha256", "runtimeParameters"
];

/**
 * Require the exact proof-free declaration syntax while allowing documentation
 * to explain why proof parameters are absent.
 *
 * @param source - Complete generated TypeScript declaration source.
 * @param parameter - Exact public runtime parameter name for this author route.
 */
export const assertDirectProofErasureNpmDeclarationSurface = (
	source, parameter
) => {
	assert.equal(typeof source, "string");
	assert.ok(["arg0", "value"].includes(parameter));
	const file = ts.createSourceFile(
		"index.d.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS
	);
	assert.deepEqual(file.parseDiagnostics, []);
	const declarations = file.statements.filter(statement =>
		ts.isFunctionDeclaration(statement)
			&& statement.name?.text === "keep");
	assert.equal(declarations.length, 1);
	const [keep] = declarations;
	assert.equal(keep.parameters.length, 1);
	assert.ok(ts.isIdentifier(keep.parameters[0].name));
	assert.equal(keep.parameters[0].name.text, parameter);
	assert.equal(keep.parameters[0].type?.kind, ts.SyntaxKind.NumberKeyword);
	assert.equal(keep.type?.kind, ts.SyntaxKind.NumberKeyword);
	const forbidden = [];
	const visit = node => {
		if(ts.isIdentifier(node)
			&& /True|proof|_before|_after/u.test(node.text))
			forbidden.push(node.text);
		ts.forEachChild(node, visit);
	};
	visit(file);
	assert.deepEqual(forbidden, []);
	return true;
};

/**
 * Validate the original canonical report and its source-free observations.
 *
 * @param report - Parsed retained report.
 * @param options - Expected route and producer.
 * @param options.route - Ordinary or independently reviewed route.
 * @param options.producerCommit - Exact producer revision.
 * @param options.browserRequired - Whether all browser contexts must be present.
 */
export const validateDirectProofErasureNpmReport = (report, {
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
		assert.equal(fact.runtimeParameters, 1);
		assert.equal(fact.erasedProofs, 2);
	}
	validateComponentPackageReceipt(report.receipt);
	assert.equal(report.receipt.package.package, "direct-proof-erasure@1.0.0");
	assert.equal(report.receipt.bindingIrSha256, report.builds[0].bindingIrSha256);
	assert.equal(report.receipt.package.sha256
		, report.builds[0].componentArchiveSha256);
	assert.equal(report.receipt.runtime.sha256
		, report.builds[0].runtimeArchiveSha256);
	assert.deepEqual(Object.keys(report.installedTrees).sort()
		, ["@lean-bridge/runtime", "direct-proof-erasure"]);
	for(const files of Object.values(report.installedTrees))
	{
		assert.ok(Object.keys(files).length > 5);
		assert.ok(Object.hasOwn(files, "package.json"));
		for(const [path, hash] of Object.entries(files))
		{
			assert.ok(!path.startsWith("/")
				&& path.split("/").every(part => part && part !== "." && part !== ".."));
			digest(hash);
		}
	}
	assert.deepEqual(report.node, [
		{ result: { checks: 1005, rejections: 4 }, typescript: true, relocated: false }
		, { result: { checks: 1005, rejections: 4 }, typescript: true, relocated: true }
	]);
	digest(report.declarationsSha256); digest(report.callerSha256);
	if(browserRequired)
	{
		assert.deepEqual(report.browser.requestedEngines
			, ["chromium", "firefox", "webkit"]);
		assert.deepEqual(report.browser.reports.map(item => item.profile)
			, directProofErasureBrowserProfiles);
		for(const item of report.browser.reports)
		{
			assert.equal(item.route, route);
			for(const key of [
				"sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"
			]) assert.equal(item[key], true, `${item.profile}: ${key}`);
			validateDirectProofErasureBrowserPhases(
				item.observations, item.profile, report.browser.requestedEngines
			);
			assert.equal(item.browser.installedSourcesRemoved, true);
			assert.equal(item.browser.externalNetworkBlocked, true);
		}
	}
	else assert.equal(report.browser, null);
	return {
		route, producerCommit, profiles: report.profiles
		, checks: 1005, rejections: 4, executions: 2
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
export const checkDirectProofErasureNpmRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateDirectProofErasureNpmReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [directProofErasureModule]
		, ...options.route === "ordinary"
			? { exports: [`${directProofErasureModule}.keep`] } : {}
		, targets: directProofErasureTargetConfiguration(profiles)
	};
	const source = execFileSync("git", ["show"
		, `${options.producerCommit}:tests/fixtures/onboarding/direct-proof-erasure/DirectProofErasure.lean`]);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		assert.deepEqual(await json(prefix + "configuration.json")
			, expectedConfiguration);
		assert.deepEqual(await read(prefix + "DirectProofErasure.lean"), source);
		const irBytes = await read(prefix + "binding-ir.json");
		const ir = JSON.parse(irBytes); assertDirectProofErasureIr(ir);
		const adaptersBytes = await read(prefix + "compiler-adapters.json");
		const adapters = JSON.parse(adaptersBytes); validateCompilerAdapterPlan(adapters);
		assert.equal(adapters.exports.length, 1);
		assert.equal(adapters.exports[0].parameters.length, 1);
		assert.deepEqual(adapters.exports[0].erasedProofs
			, directProofErasureProofs);
		const plan = await json(prefix + "component-build-plan.json");
		validateComponentBuildPlan(plan);
		const receiptBytes = await read(prefix + "component-package-receipt.json");
		const receipt = JSON.parse(receiptBytes);
		validateComponentPackageReceipt(receipt);
		const lean = (await read(prefix + "LeanBridgeGenerated.lean")).toString();
		assert.match(lean
			, /keep _root_\.True\.intro value _root_\.True\.intro/u);
		assert.doesNotMatch(lean, /(?:sorry|unsafeCast|\baxiom\b)/u);
		const fact = report.builds[attempt];
		assert.equal(fact.bindingIrFileSha256, sha256(irBytes));
		assert.equal(fact.compilerAdaptersSha256, sha256(adaptersBytes));
		assert.equal(fact.generatedLeanSha256
			, sha256(await read(prefix + "LeanBridgeGenerated.lean")));
		assert.equal(fact.receiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
	}
	for(const name of [
		"binding-ir.json", "compiler-adapters.json", "component-build-plan.json"
		, "LeanBridgeGenerated.lean", "provenance.json"
		, "component-package-receipt.json", "configuration.json"
		, "DirectProofErasure.lean"
	]) assert.deepEqual(await read(`build-0/${name}`), await read(`build-1/${name}`), name);
	assert.equal((await read("index.mjs")).toString()
		, 'import * as api from "direct-proof-erasure";\nimport {checkDirectProofErasure} from "./check.mjs";\nconsole.log(JSON.stringify(checkDirectProofErasure(api)));\n');
	assert.equal(report.callerSha256, sha256(await read("index.mjs")));
	const declarations = await read("index.d.ts");
	assert.equal(report.declarationsSha256, sha256(declarations));
	assertDirectProofErasureNpmDeclarationSurface(
		declarations.toString(), options.route === "ordinary" ? "arg0" : "value"
	);
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
