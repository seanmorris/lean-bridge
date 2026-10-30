/**
 * Independently validate retained native PHP and PHP-Wasm proof-erasure evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	directProofErasureModule
} from "./direct-proof-erasure-fixture.mjs";
import {
	checkDirectProofErasurePhpComponentRecords
	, directProofErasurePhpComponentFact
	, directProofErasurePhpComponentFactKeys
	, directProofErasureNativeRecordNames
	, directProofErasurePhpWasmRecordNames
	, directProofErasureTargetConfiguration
} from "./direct-proof-erasure-packages.mjs";

export const directProofErasurePhpProfiles = Object.freeze([
	"php-native", "php-wasm"
]);
const factKeys = [
	"archives", ...directProofErasurePhpComponentFactKeys
	, "packageSetReceiptSha256"
];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const apiPattern = /function keep\(mixed \$value\): int/u;
const forbiddenProof = /(?:\bTrue\b|\bproof\b|_before|_after)/iu;

/**
 * Validate one complete ordinary or reviewed PHP report.
 *
 * @param report - Parsed canonical report.
 * @param options - Exact route and producer identity.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const validateDirectProofErasurePhpReport = (report, {
	route, producerCommit
}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, directProofErasurePhpProfiles);
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
		assert.ok(Object.keys(fact.archives).length >= 4);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "directprooferasure@1.0.0");
	assert.deepEqual([...new Set(report.receipt.packages.map(item => item.target))].sort()
		, directProofErasurePhpProfiles);
	assert.equal(report.receipt.profiles.length, 2);
	for(const profile of report.receipt.profiles)
		assert.equal(profile.bindingIrSha256, report.builds[0].bindingIrSha256);
	assert.deepEqual(report.observations.map(item => item.profile)
		, directProofErasurePhpProfiles);
	const native = report.observations[0], wasm = report.observations[1];
	for(const item of report.observations)
	{
		assert.equal(item.checks, 1005);
		assert.equal(item.offlineInstall, true);
		assert.equal(item.compilerFreePath, true);
		assert.equal(item.proofSlots, 0);
		assert.equal(item.runtimeParameters, 1);
		assert.equal(item.negativeProofArgument.rejected, true);
		assert.equal(item.negativeProofArgument.namedArguments
			, "_before,value,_after");
		for(const key of ["apiSha256", "consumerSha256"]) digest(item[key]);
	}
	assert.deepEqual(native.executions, [
		{ checks: 1005, mode: "strict", relocated: false }
		, { checks: 1005, mode: "weak", relocated: false }
		, { checks: 1005, mode: "weak", relocated: true }
		, { checks: 1005, mode: "strict", relocated: true }
	]);
	assert.equal(native.negativeProofArgument.attempts, 4);
	assert.equal(wasm.executions.length, 12);
	assert.deepEqual([...new Set(wasm.executions.map(item => item.realm))].sort()
		, ["chromium", "node"]);
	assert.deepEqual([...new Set(wasm.executions.map(item => item.mode))].sort()
		, ["strict", "weak"]);
	assert.deepEqual([...new Set(wasm.executions.map(item => item.loading))].sort()
		, ["lazy", "startup"]);
	assert.ok(wasm.executions.every(item => item.checks === 1005
		&& item.libraries === 2));
	assert.equal(wasm.negativeProofArgument.attempts, 24);
	digest(wasm.driverSha256);
	assert.match(wasm.browserVersion, /^\d+(?:\.\d+){2,3}$/u);
	return {
		route, producerCommit, profiles: directProofErasurePhpProfiles
		, checks: 2010, executions: 16, rejectedProofArguments: 28
	};
};

/**
 * Authenticate sources, compiler plans, package archives and installed surfaces.
 *
 * @param read - Safe reader rooted at one route's records.
 * @param options - Exact route, producer identity and evidence root.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 * @param options.directory - Absolute retained evidence root.
 */
export const checkDirectProofErasurePhpRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateDirectProofErasurePhpReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [directProofErasureModule]
		, ...options.route === "ordinary"
			? { exports: [`${directProofErasureModule}.keep`] } : {}
		, targets: directProofErasureTargetConfiguration(
			directProofErasurePhpProfiles
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
		const components = await checkDirectProofErasurePhpComponentRecords(
			read, prefix);
		const componentFact = directProofErasurePhpComponentFact(components);
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		const receipt = JSON.parse(receiptBytes);
		validatePackageSetReceipt(receipt);
		const fact = report.builds[attempt];
		for(const key of directProofErasurePhpComponentFactKeys)
			assert.deepEqual(fact[key], componentFact[key], key);
		assert.equal(fact.packageSetReceiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
	}
	for(const name of [
		...directProofErasureNativeRecordNames.map(value => `native/${value}`)
		, ...directProofErasurePhpWasmRecordNames.map(value => `php-wasm/${value}`)
		, "package-set-receipt.json", "configuration.json", "DirectProofErasure.lean"
	]) assert.deepEqual(await read(`build-0/${name}`)
		, await read(`build-1/${name}`), name);
	const nativeConsumer = await read("php-native/consumer.php");
	assert.deepEqual(nativeConsumer, fixture(
		"tests/fixtures/direct-proof-erasure-consumers/php.php"
	));
	assert.match(nativeConsumer.toString()
		, /keep\(_before: true, value: 0, _after: true\)/u);
	assert.equal(report.observations[0].consumerSha256, sha256(nativeConsumer));
	const wasmConsumer = await read("php-wasm/consumer.php");
	assert.equal(wasmConsumer.toString(), nativeConsumer.toString()
		.replace("require 'vendor/autoload.php';", ""));
	assert.equal(report.observations[1].consumerSha256, sha256(wasmConsumer));
	for(const item of report.observations)
	{
		const api = await read(`${item.profile}/Api.php`);
		assert.match(api.toString(), apiPattern);
		assert.doesNotMatch(api.toString(), forbiddenProof);
		assert.equal(item.apiSha256, sha256(api));
		const pkg = item.profile === "php-native"
			? report.receipt.packages.find(value => value.target === item.profile
				&& value.ecosystem === "composer")
			: report.receipt.packages.find(value => value.target === item.profile
				&& value.ecosystem === "composer");
		assert.ok(pkg);
		const archive = join(options.directory, "handoff", pkg.artifacts[0].path);
		assert.deepEqual(execFileSync("unzip", ["-p", archive, "src/Api.php"]), api);
	}
	assert.equal(report.observations[1].driverSha256
		, sha256(await read("php-wasm/driver.mjs")));
	assert.deepEqual(await json("handoff/package-set-receipt.json"), report.receipt);
	return result;
};
