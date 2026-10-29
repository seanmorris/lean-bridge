/**
 * Independently validate retained optional-parameter C/C++ acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	optionalParameterExports, optionalParameterModule
} from "./optional-parameter-fixture.mjs";
import {
	optionalParameterMatrixCases
} from "./optional-parameter-matrix.mjs";
import {
	checkOptionalParameterNativeComponentRecords
	, optionalParameterComponentFactKeys, optionalParameterNativeRecordNames
	, optionalParameterTargetConfiguration
} from "./optional-parameter-packages.mjs";

export const optionalParameterNativeProfiles = Object.freeze(["c", "cpp"]);
const checks = Object.freeze({ c: 22, cpp: 21 });
const factKeys = [
	"archives", ...optionalParameterComponentFactKeys
	, "packageSetReceiptSha256"
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
export const validateOptionalParameterNativeReport = (report, {
	route, producerCommit
}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, optionalParameterNativeProfiles);
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
		assert.deepEqual(Object.keys(fact.archives).sort()
			, Object.keys(fact.archives));
		assert.ok(Object.keys(fact.archives).length >= 2);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "defaults@1.0.0");
	assert.deepEqual(report.receipt.packages.map(item => item.target).sort()
		, optionalParameterNativeProfiles);
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	assert.deepEqual(report.observations.map(item => item.profile)
		, optionalParameterNativeProfiles);
	for(const item of report.observations)
	{
		assert.equal(item.checks, checks[item.profile]);
		assert.equal(item.offlineInstall, true);
		assert.equal(item.compilerFreePath, true);
		assert.deepEqual(item.executions, [
			{ checks: checks[item.profile], relocated: false }
			, { checks: checks[item.profile], relocated: true }
		]);
		assert.equal(item.explicitHostNull.rejected, true);
		assert.equal(item.explicitHostNull.mode
			, item.profile === "c" ? "runtime" : "compile");
		if(item.profile === "c") assert.equal(
			item.explicitHostNull.status, "DEFAULTS_STATUS_INVALID_ARGUMENT");
		else assert.match(item.explicitHostNull.diagnostic
			, /(?:no matching function|cannot convert|could not convert|invalid initialization)/iu);
		for(const key of [
			"consumerSha256", "headerSha256", "executableSha256"
			, "receiptSha256", "packageFileSetSha256"
		]) digest(item[key]);
	}
	return {
		lane: "native", route, producerCommit
		, profiles: optionalParameterNativeProfiles
		, cases: optionalParameterMatrixCases
		, checks: 43, rejections: 4, executions: 4
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
export const checkOptionalParameterNativeRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateOptionalParameterNativeReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [optionalParameterModule]
		, ...options.route === "ordinary"
			? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration(
			optionalParameterNativeProfiles
		)
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
		const component = await checkOptionalParameterNativeComponentRecords(
			read, prefix);
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		const receipt = JSON.parse(receiptBytes);
		validatePackageSetReceipt(receipt);
		const fact = report.builds[attempt];
		for(const key of optionalParameterComponentFactKeys)
			assert.equal(fact[key], component[key], key);
		assert.equal(fact.packageSetReceiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
	}
	for(const name of [
		...optionalParameterNativeRecordNames
		, "package-set-receipt.json", "configuration.json", "Defaults.lean"
	]) assert.deepEqual(await read(`build-0/${name}`)
		, await read(`build-1/${name}`), name);
	const selected = {
		c: {
			header: /#define defaults_present\(\.\.\.\).*defaults_present_default_0/u
			, source: "tests/fixtures/optional-parameter-consumers/c.c"
		}
		, cpp: {
			header: /inline std::optional<uint32_t> present\(std::optional<uint32_t> const& value0 =/u
			, source: "tests/fixtures/optional-parameter-consumers/cpp.cpp"
		}
	};
	for(const item of report.observations)
	{
		const expected = selected[item.profile];
		const source = await read(`${item.profile}/consumer.${item.profile}`);
		assert.deepEqual(source, fixture(expected.source));
		assert.equal(item.consumerSha256, sha256(source));
		const header = await read(`${item.profile}/defaults.h${item.profile === "cpp" ? "pp" : ""}`);
		assert.match(header.toString(), expected.header);
		assert.equal(item.headerSha256, sha256(header));
	}
	assert.match((await read("cpp/explicit-null-negative.cpp")).toString()
		, /api::present\(nullptr\)/u);
	const handoff = await json("handoff/package-set-receipt.json");
	assert.deepEqual(handoff, report.receipt);
	return result;
};
