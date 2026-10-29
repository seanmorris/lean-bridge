/**
 * Independently validate retained optional-parameter PHP acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	optionalParameterExports, optionalParameterModule
} from "./optional-parameter-fixture.mjs";
import { optionalParameterMatrixCases } from "./optional-parameter-matrix.mjs";
import {
	checkOptionalParameterPhpComponentRecords
	, optionalParameterNativeRecordNames, optionalParameterPhpComponentFact
	, optionalParameterPhpComponentFactKeys, optionalParameterPhpWasmRecordNames
	, optionalParameterTargetConfiguration
} from "./optional-parameter-packages.mjs";

export const optionalParameterPhpProfiles = Object.freeze([
	"php-native", "php-wasm"
]);
const factKeys = [
	"archives", ...optionalParameterPhpComponentFactKeys
	, "packageSetReceiptSha256"
].sort();
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const apiPatterns = [
	/function word\(mixed \$value0 = 7\): int/u
	, /function natural\(mixed \$value0 = null\)/u
	, /function present\(mixed \$value0 = null\)/u
	, /\$value0 = new Some\(9\)/u
	, /function unit_value\(mixed \$value0 = null\): null/u
];

/**
 * Validate one ordinary or reviewed retained report.
 *
 * @param report - Parsed retained report.
 * @param options - Exact expected route and revision.
 * @param options.route - Ordinary or independently reviewed route.
 * @param options.producerCommit - Exact tested Git revision.
 */
export const validateOptionalParameterPhpReport = (report, {
	route, producerCommit
}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, optionalParameterPhpProfiles);
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
		assert.ok(Object.keys(fact.archives).length >= 4);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "defaults@1.0.0");
	assert.deepEqual([...new Set(report.receipt.packages.map(item => item.target))]
		.sort(), optionalParameterPhpProfiles);
	assert.equal(report.receipt.profiles.length, 2);
	for(const profile of report.receipt.profiles)
		assert.equal(profile.bindingIrSha256, report.builds[0].bindingIrSha256);
	assert.deepEqual(report.observations.map(item => item.profile)
		, optionalParameterPhpProfiles);
	const native = report.observations[0], wasm = report.observations[1];
	for(const item of report.observations)
	{
		assert.equal(item.checks, 23);
		assert.equal(item.offlineInstall, true);
		assert.equal(item.compilerFreePath, true);
		for(const key of ["apiSha256", "consumerSha256"]) digest(item[key]);
	}
	assert.deepEqual(native.executions, [
		{ checks: 23, mode: "strict", relocated: false }
		, { checks: 23, mode: "weak", relocated: false }
		, { checks: 23, mode: "weak", relocated: true }
		, { checks: 23, mode: "strict", relocated: true }
	]);
	assert.equal(native.invalidHostValuesPerExecution, 2);
	assert.equal(wasm.executions.length, 12);
	assert.deepEqual([...new Set(wasm.executions.map(item => item.realm))].sort()
		, ["chromium", "node"]);
	assert.deepEqual([...new Set(wasm.executions.map(item => item.mode))].sort()
		, ["strict", "weak"]);
	assert.deepEqual([...new Set(wasm.executions.map(item => item.loading))].sort()
		, ["lazy", "startup"]);
	assert.ok(wasm.executions.every(item => item.checks === 23
		&& item.libraries === 2));
	assert.equal(wasm.invalidHostValuesPerExecution, 2);
	assert.equal(wasm.preloadRejection, true);
	digest(wasm.driverSha256);
	assert.match(wasm.browserVersion, /^\d+(?:\.\d+){2,3}$/u);
	return {
		lane: "php", route, producerCommit
		, profiles: optionalParameterPhpProfiles
		, cases: optionalParameterMatrixCases
		, checks: 46, rejections: 44, executions: 16
	};
};

/**
 * Authenticate sources, compiler plans, package archives and surfaces.
 *
 * @param read - Safe reader rooted at one route's retained evidence.
 * @param options - Exact route, producer and evidence root.
 */
export const checkOptionalParameterPhpRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateOptionalParameterPhpReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [optionalParameterModule]
		, ...options.route === "ordinary"
			? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration(optionalParameterPhpProfiles)
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
		const components = await checkOptionalParameterPhpComponentRecords(
			read, prefix);
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		const receipt = JSON.parse(receiptBytes);
		validatePackageSetReceipt(receipt);
		const fact = report.builds[attempt];
		const componentFact = optionalParameterPhpComponentFact(components);
		for(const key of optionalParameterPhpComponentFactKeys)
			assert.equal(fact[key], componentFact[key], key);
		assert.equal(fact.packageSetReceiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
	}
	for(const name of [
		...optionalParameterNativeRecordNames.map(value => `native/${value}`)
		, ...optionalParameterPhpWasmRecordNames.map(value => `php-wasm/${value}`)
		, "package-set-receipt.json", "configuration.json", "Defaults.lean"
	]) assert.deepEqual(await read(`build-0/${name}`)
		, await read(`build-1/${name}`), name);
	const nativeConsumer = await read("php-native/consumer.php");
	assert.deepEqual(nativeConsumer, fixture(
		"tests/fixtures/optional-parameter-consumers/php.php"
	));
	assert.equal(report.observations[0].consumerSha256, sha256(nativeConsumer));
	const wasmConsumer = await read("php-wasm/consumer.php");
	assert.equal(wasmConsumer.toString(), nativeConsumer.toString()
		.replace("require 'vendor/autoload.php';", ""));
	assert.equal(report.observations[1].consumerSha256, sha256(wasmConsumer));
	for(const item of report.observations)
	{
		const api = await read(`${item.profile}/Api.php`);
		for(const pattern of apiPatterns) assert.match(api.toString(), pattern);
		assert.equal(item.apiSha256, sha256(api));
		const pkg = report.receipt.packages.find(value =>
			value.target === item.profile && value.ecosystem === "composer");
		assert.ok(pkg);
		const archive = join(options.directory, "handoff", pkg.artifacts[0].path);
		assert.deepEqual(execFileSync("unzip", ["-p", archive, "src/Api.php"])
			, api);
	}
	assert.equal(report.observations[1].driverSha256
		, sha256(await read("php-wasm/driver.mjs")));
	assert.deepEqual(await json("handoff/package-set-receipt.json"), report.receipt);
	return result;
};
