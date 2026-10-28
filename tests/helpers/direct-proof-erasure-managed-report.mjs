/**
 * Independently validate retained .NET/Java/Kotlin direct proof-erasure
 * acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { directProofErasureModule } from "./direct-proof-erasure-fixture.mjs";
import {
	checkDirectProofErasureNativeComponentRecords
	, directProofErasureNativeComponentFactKeys
	, directProofErasureNativeRecordNames
	, directProofErasureTargetConfiguration
} from "./direct-proof-erasure-packages.mjs";

export const directProofErasureManagedGroups = Object.freeze({
	dotnet: Object.freeze(["dotnet"])
	, jvm: Object.freeze(["java", "kotlin"])
});
const factKeys = [
	"archives", ...directProofErasureNativeComponentFactKeys.slice(0, -1)
	, "packageSetReceiptSha256", "runtimeParameters"
];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const extension = profile => profile === "dotnet" ? "cs"
	: profile === "java" ? "java" : "kt";

/**
 * Validate one complete ordinary or reviewed managed report.
 *
 * @param report - Parsed canonical report.
 * @param options - Exact producer identity and selected managed group.
 * @param options.group - Dotnet or JVM workflow group.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const validateDirectProofErasureManagedReport = (report, {
	group, route, producerCommit
}) => {
	assert.ok(Object.hasOwn(directProofErasureManagedGroups, group));
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.group, group);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, directProofErasureManagedGroups[group]);
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
		assert.equal(fact.runtimeParameters, 1);
		assert.equal(fact.erasedProofs, 2);
		assert.ok(Object.keys(fact.archives).length >= 1);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "directprooferasure@1.0.0");
	const target = group === "dotnet" ? "nuget" : "maven";
	assert.ok(report.receipt.packages.some(item => item.target === target
		&& item.role === "component"));
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	assert.deepEqual(report.observations.map(item => item.profile)
		, directProofErasureManagedGroups[group]);
	for(const item of report.observations)
	{
		assert.equal(item.checks, 1005);
		assert.equal(item.offlineInstall, true);
		assert.equal(item.compilerFreePath, true);
		assert.equal(item.proofSlots, 0);
		assert.equal(item.runtimeParameters, 1);
		assert.deepEqual(item.executions, [
			{ checks: 1005, relocated: false }
			, { checks: 1005, relocated: true }
		]);
		assert.equal(item.negativeProofArgument.rejected, true);
		assert.equal(item.negativeProofArgument.relocated, false);
		assert.match(item.negativeProofArgument.diagnostic, item.profile === "dotnet"
			? /(?:No overload for method 'Keep' takes 3 arguments|does not have a parameter named '_before')/iu
			: item.profile === "java"
				? /(?:method keep.*cannot be applied|actual and formal argument lists differ)/isu
				: /(?:cannot find a parameter with this name: _before|too many arguments for)/iu);
		for(const key of [
			"consumerSha256", "receiptSha256", "packageFileSetSha256"
			, "interpreterSha256"
		]) digest(item[key]);
	}
	return {
		group, route, producerCommit, profiles: directProofErasureManagedGroups[group]
		, checks: 1005 * directProofErasureManagedGroups[group].length
		, executions: 2 * directProofErasureManagedGroups[group].length
		, rejectedProofArguments: directProofErasureManagedGroups[group].length
	};
};

/**
 * Authenticate every retained source, compiler plan and installed observation.
 *
 * @param read - Safe reader rooted at one route's records.
 * @param options - Exact group, route and producer identity.
 * @param options.group - Dotnet or JVM workflow group.
 * @param options.route - Ordinary or reviewed route.
 * @param options.producerCommit - Exact tested revision.
 */
export const checkDirectProofErasureManagedRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateDirectProofErasureManagedReport(report, options);
	const profiles = directProofErasureManagedGroups[options.group];
	const expectedConfiguration = {
		schemaVersion: 1, modules: [directProofErasureModule]
		, ...options.route === "ordinary"
			? { exports: [`${directProofErasureModule}.keep`] } : {}
		, targets: directProofErasureTargetConfiguration(profiles)
	};
	const fixture = path => execFileSync("git", [
		"show", `${options.producerCommit}:${path}`
	]);
	const leanSource = fixture(
		"tests/fixtures/onboarding/direct-proof-erasure/DirectProofErasure.lean"
	);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		assert.deepEqual(await json(prefix + "configuration.json")
			, expectedConfiguration);
		assert.deepEqual(await read(prefix + "DirectProofErasure.lean"), leanSource);
		const component = await checkDirectProofErasureNativeComponentRecords(
			read, prefix
		);
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		const receipt = JSON.parse(receiptBytes);
		validatePackageSetReceipt(receipt);
		const fact = report.builds[attempt];
		for(const key of directProofErasureNativeComponentFactKeys)
			assert.equal(fact[key], component[key], key);
		assert.equal(fact.packageSetReceiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
	}
	for(const name of [
		...directProofErasureNativeRecordNames
		, "package-set-receipt.json", "configuration.json"
		, "DirectProofErasure.lean"
	]) assert.deepEqual(await read(`build-0/${name}`)
		, await read(`build-1/${name}`), name);
	for(const item of report.observations)
	{
		const suffix = extension(item.profile);
		const source = await read(`${item.profile}/consumer.${suffix}`);
		assert.deepEqual(source, fixture(
			`tests/fixtures/direct-proof-erasure-consumers/${item.profile}.${suffix}`
		));
		assert.equal(item.consumerSha256, sha256(source));
		const invalid = (await read(
			`${item.profile}/proof-argument-negative.${suffix}`
		)).toString();
		assert.match(invalid, item.profile === "dotnet" ? /_before: true/u
			: item.profile === "java" ? /Api\.keep\(true, 0L, true\)/u
				: /_before = true/u);
	}
	const handoff = await json("handoff/package-set-receipt.json");
	assert.deepEqual(handoff, report.receipt);
	return result;
};
