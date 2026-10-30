/**
 * Independently validate retained direct proof-erasure C/C++ acceptance.
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

export const directProofErasureNativeProfiles = Object.freeze(["c", "cpp"]);
const factKeys = [
	"archives", ...directProofErasureNativeComponentFactKeys.slice(0, -1)
	, "packageSetReceiptSha256", "runtimeParameters"
];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);

/**
 * Validate one complete ordinary or reviewed native report.
 *
 * @param report - Parsed canonical report.
 * @param options - Exact producer identity.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const validateDirectProofErasureNativeReport = (report, {
	route, producerCommit
}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, directProofErasureNativeProfiles);
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
		assert.deepEqual(Object.keys(fact.archives).sort()
			, Object.keys(fact.archives));
		assert.ok(Object.keys(fact.archives).length >= 2);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "directprooferasure@1.0.0");
	assert.deepEqual(report.receipt.packages.map(item => item.target).sort()
		, directProofErasureNativeProfiles);
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	assert.deepEqual(report.observations.map(item => item.profile)
		, directProofErasureNativeProfiles);
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
		assert.equal(item.negativeProofArgument.relocated, true);
		assert.match(item.negativeProofArgument.diagnostic
			, /(?:too many arguments|no matching function|requires 1 argument|candidate)/iu);
		for(const key of [
			"consumerSha256", "headerSha256", "executableSha256"
			, "receiptSha256", "packageFileSetSha256"
		]) digest(item[key]);
	}
	return {
		route, producerCommit, profiles: directProofErasureNativeProfiles
		, checks: 2010, executions: 4, rejectedProofArguments: 2
	};
};

/**
 * Authenticate every retained source, compiler plan and installed observation.
 *
 * @param read - Safe reader rooted at one route's records.
 * @param options - Exact route and producer identity.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const checkDirectProofErasureNativeRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateDirectProofErasureNativeReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [directProofErasureModule]
		, ...options.route === "ordinary"
			? { exports: [`${directProofErasureModule}.keep`] } : {}
		, targets: directProofErasureTargetConfiguration(
			directProofErasureNativeProfiles
		)
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
	const patterns = {
		c: {
			header: new RegExp(`directprooferasure_status directprooferasure_keep\\(uint32_t ${options.route === "ordinary" ? "arg0" : "value"}, uint32_t \\*out, directprooferasure_error \\*error\\);`, "u")
			, source: "tests/fixtures/direct-proof-erasure-consumers/c.c"
		}
		, cpp: {
			header: new RegExp(`inline uint32_t keep\\(uint32_t ${options.route === "ordinary" ? "arg0" : "value"}\\)`, "u")
			, source: "tests/fixtures/direct-proof-erasure-consumers/cpp.cpp"
		}
	};
	for(const item of report.observations)
	{
		const selected = patterns[item.profile];
		const source = await read(`${item.profile}/consumer.${item.profile}`);
		assert.deepEqual(source, fixture(selected.source));
		assert.equal(item.consumerSha256, sha256(source));
		const header = await read(`${item.profile}/directprooferasure.h${item.profile === "cpp" ? "pp" : ""}`);
		assert.match(header.toString(), selected.header);
		assert.doesNotMatch(header.toString()
			, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
		assert.equal(item.headerSha256, sha256(header));
		assert.match((await read(`${item.profile}/proof-argument-negative.${item.profile}`)).toString()
			, item.profile === "c" ? /directprooferasure_keep\(true, 0,/u : /api::keep\(true, 0\)/u);
	}
	const handoff = await json("handoff/package-set-receipt.json");
	assert.deepEqual(handoff, report.receipt);
	return result;
};
