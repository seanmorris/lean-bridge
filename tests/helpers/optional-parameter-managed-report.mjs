/**
 * Independently validate retained optional-parameter managed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { validateComponentBuildPlan } from "../../src/build/component-plan.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	assertOptionalParameterIr, optionalParameterExports, optionalParameterModule
} from "./optional-parameter-fixture.mjs";
import { optionalParameterMatrixCases } from "./optional-parameter-matrix.mjs";
import {
	optionalParameterTargetConfiguration
} from "./optional-parameter-packages.mjs";

export const optionalParameterManagedGroups = Object.freeze({
	dotnet: Object.freeze(["dotnet"])
	, jvm: Object.freeze(["java", "kotlin"])
});
const factKeys = [
	"archives", "authenticatedDefaults", "bindingIrFileSha256"
	, "bindingIrSha256", "compilerAdaptersSha256", "declarations"
	, "generatedLeanSha256", "packageSetReceiptSha256"
];
const extension = profile => profile === "dotnet" ? "cs"
	: profile === "java" ? "java" : "kt";
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const diagnostics = Object.freeze({
	dotnet: /(?:CS1503|cannot convert from '<null>'|non-nullable value type)/iu
	, java: /(?:incompatible types|cannot be converted to (?:long|int))/iu
	, kotlin: /(?:null can not be a value of a non-null type|type mismatch)/iu
});

/**
 * Validate one complete ordinary or reviewed managed report.
 *
 * @param report - Parsed canonical report.
 * @param options - Exact producer identity and selected managed group.
 * @param options.group - Dotnet or JVM workflow group.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const validateOptionalParameterManagedReport = (report, {
	group, route, producerCommit
}) => {
	assert.ok(Object.hasOwn(optionalParameterManagedGroups, group));
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.group, group);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, optionalParameterManagedGroups[group]);
	for(const key of [
		"reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"
		, "offlineInstall", "compilerFreePath", "relocatedInstallation"
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
		assert.ok(Object.keys(fact.archives).length >= 1);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "defaults@1.0.0");
	const target = group === "dotnet" ? "nuget" : "maven";
	assert.ok(report.receipt.packages.some(item => item.target === target
		&& item.role === "component"));
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	assert.deepEqual(report.observations.map(item => item.profile)
		, optionalParameterManagedGroups[group]);
	for(const item of report.observations)
	{
		assert.equal(item.checks, 23);
		assert.equal(item.runtimeChecks, 21);
		assert.equal(item.invalidHostValues, 2);
		assert.equal(item.explicitHostNull, true);
		assert.equal(item.offlineInstall, true);
		assert.equal(item.compilerFreePath, true);
		assert.deepEqual(item.executions, [
			{ checks: 21, relocated: false }
			, { checks: 21, relocated: true }
		]);
		assert.equal(item.invalidCompile.rejected, true);
		assert.equal(item.invalidCompile.values, 2);
		assert.match(item.invalidCompile.diagnostic, diagnostics[item.profile]);
		for(const [key, value] of Object.entries(item.closure))
		{
			assert.match(key, /Sha256$/u); digest(value);
		}
		const requiredClosure = item.profile === "dotnet"
			? [
				"receiptSha256", "packageFileSetSha256", "cacheFilesSha256"
				, "buildInputsSha256", "deployedFilesSha256", "interpreterSha256"
			]
			: [
				"receiptSha256", "packageFileSetSha256"
				, "classpathFilesSha256", "interpreterSha256"
			];
		for(const key of requiredClosure) digest(item.closure[key]);
		digest(item.consumerSha256); digest(item.invalidConsumerSha256);
	}
	return {
		lane: `managed-${group}`, route, producerCommit
		, profiles: optionalParameterManagedGroups[group]
		, cases: optionalParameterMatrixCases
		, checks: 23 * optionalParameterManagedGroups[group].length
		, executions: 2 * optionalParameterManagedGroups[group].length
	};
};

/**
 * Authenticate sources, compiler plans, archives and managed observations.
 *
 * @param read - Safe reader rooted at one route's records.
 * @param options - Exact group, route and producer identity.
 */
export const checkOptionalParameterManagedRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateOptionalParameterManagedReport(report, options);
	const profiles = optionalParameterManagedGroups[options.group];
	const expectedConfiguration = {
		schemaVersion: 1, modules: [optionalParameterModule]
		, ...options.route === "ordinary"
			? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration(profiles)
	};
	const fixture = path => execFileSync("git", [
		"show", `${options.producerCommit}:${path}`
	]);
	const leanSource = fixture(
		"tests/fixtures/onboarding/optional-parameters/Defaults.lean"
	);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		assert.deepEqual(await json(prefix + "configuration.json")
			, expectedConfiguration);
		assert.deepEqual(await read(prefix + "Defaults.lean"), leanSource);
		const irBytes = await read(prefix + "binding-ir.json");
		const ir = JSON.parse(irBytes); assertOptionalParameterIr(ir);
		const adaptersBytes = await read(prefix + "compiler-adapters.json");
		const adapters = JSON.parse(adaptersBytes);
		validateCompilerAdapterPlan(adapters);
		assert.equal(adapters.exports.length, 7);
		assert.ok(adapters.exports.every(item => item.parameters.length === 1));
		validateComponentBuildPlan(await json(prefix + "component-build-plan.json"));
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		const receipt = JSON.parse(receiptBytes);
		validatePackageSetReceipt(receipt);
		const leanBytes = await read(prefix + "LeanBridgeGenerated.lean");
		assert.doesNotMatch(leanBytes.toString()
			, /(?:sorry|unsafeCast|\baxiom\b)/u);
		const fact = report.builds[attempt];
		assert.equal(fact.bindingIrFileSha256, sha256(irBytes));
		assert.equal(fact.compilerAdaptersSha256, sha256(adaptersBytes));
		assert.equal(fact.generatedLeanSha256, sha256(leanBytes));
		assert.equal(fact.packageSetReceiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
	}
	for(const name of [
		"binding-ir.json", "compiler-adapters.json", "component-build-plan.json"
		, "LeanBridgeGenerated.lean", "provenance.json"
		, "package-set-receipt.json", "configuration.json", "Defaults.lean"
	]) assert.deepEqual(await read(`build-0/${name}`)
		, await read(`build-1/${name}`), name);
	for(const item of report.observations)
	{
		const suffix = extension(item.profile);
		const source = await read(`${item.profile}/consumer.${suffix}`);
		assert.deepEqual(source, fixture(
			`tests/fixtures/optional-parameter-consumers/${item.profile}.${suffix}`
		));
		assert.equal(item.consumerSha256, sha256(source));
		const invalid = await read(`${item.profile}/invalid.${suffix}`);
		assert.deepEqual(invalid, fixture(
			`tests/fixtures/optional-parameter-consumers/${item.profile}-invalid.${suffix}`
		));
		assert.equal(item.invalidConsumerSha256, sha256(invalid));
	}
	assert.deepEqual(await json("handoff/package-set-receipt.json")
		, report.receipt);
	return result;
};
