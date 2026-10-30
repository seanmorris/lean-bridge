/**
 * Independently validate retained direct proof-erasure WIT/WASI acceptance.
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

const factKeys = [
	"archives", ...directProofErasureNativeComponentFactKeys.slice(0, -1)
	, "packageSetReceiptSha256", "runtimeParameters"
];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const proofPattern = /(?:\bTrue\b|\bproof\b|_before|_after)/iu;
const witSignature = route => new RegExp(
	`keep: func\\(${route === "ordinary" ? "arg0" : "value"}: u32\\) -> u32;`
	, "gu"
);

/**
 * Validate one complete ordinary or reviewed WIT report.
 *
 * @param report - Parsed canonical report.
 * @param options - Exact producer identity.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const validateDirectProofErasureWitReport = (report, {
	route, producerCommit
}) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, "wit-wasi");
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
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
		assert.equal(Object.keys(fact.archives).length, 1);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "directprooferasure@1.0.0");
	assert.equal(report.receipt.packages.length, 1);
	assert.equal(report.receipt.packages[0].target, "wit-wasi");
	assert.equal(report.receipt.packages[0].role, "component");
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	const item = report.observation;
	assert.equal(item.profile, "wit-wasi");
	assert.equal(item.checks, 1005);
	assert.equal(item.offlineInstall, true);
	assert.equal(item.compilerFreePath, true);
	assert.equal(item.proofSlots, 0);
	assert.equal(item.runtimeParameters, 1);
	assert.deepEqual(item.executions, [
		{ checks: 1005, relocated: false }
		, { checks: 1005, relocated: true }
	]);
	assert.deepEqual(item.negativeProofArgument, {
		rejected: true, relocated: true, suppliedArguments: 3
		, diagnostic: "Unknown export, invalid WIT input or 16 MiB conversion limit"
	});
	for(const key of [
		"consumerSha256", "headerSha256", "witSha256", "componentWitSha256"
		, "executableSha256"
	]) digest(item[key]);
	assert.deepEqual(Object.keys(item.closure).sort()
		, ["packageFileSetSha256", "receiptSha256"]);
	digest(item.closure.packageFileSetSha256);
	digest(item.closure.receiptSha256);
	return {
		profile: "wit-wasi", route, producerCommit, checks: 1005
		, executions: 2, rejectedProofArguments: 1
	};
};

/**
 * Authenticate every retained source, compiler plan and WIT observation.
 *
 * @param read - Safe reader rooted at one route's retained records.
 * @param options - Exact route and producer identity.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const checkDirectProofErasureWitRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateDirectProofErasureWitReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [directProofErasureModule]
		, ...options.route === "ordinary"
			? { exports: [`${directProofErasureModule}.keep`] } : {}
		, targets: directProofErasureTargetConfiguration(["wit-wasi"])
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
	const source = await read("wit-wasi/consumer.c");
	assert.deepEqual(source, fixture(
		"tests/fixtures/direct-proof-erasure-consumers/wit-wasi.c"
	));
	assert.equal(report.observation.consumerSha256, sha256(source));
	const header = await read("wit-wasi/directprooferasure_wasmtime.h");
	assert.match(header.toString()
		, /directprooferasure_wasmtime_call\([\s\S]*?const wasmtime_component_val_t \*args, size_t count,[\s\S]*?wasmtime_component_val_t \*out\);/u);
	assert.doesNotMatch(header.toString(), proofPattern);
	assert.equal(report.observation.headerSha256, sha256(header));
	const wit = await read("wit-wasi/directprooferasure.wit");
	assert.equal((wit.toString().match(witSignature(options.route)) ?? []).length, 2);
	assert.doesNotMatch(wit.toString(), proofPattern);
	assert.equal(report.observation.witSha256, sha256(wit));
	const componentWit = await read("wit-wasi/component.wit");
	assert.match(componentWit.toString()
		, new RegExp(witSignature(options.route).source, "u"));
	assert.doesNotMatch(componentWit.toString(), proofPattern);
	assert.equal(report.observation.componentWitSha256, sha256(componentWit));
	const negative = (await read(
		"wit-wasi/proof-argument-negative.c"
	)).toString();
	assert.match(negative, /wasmtime_component_val_t args\[3\]/u);
	assert.match(negative
		, /directprooferasure_wasmtime_call\([\s\S]*?args, 3, &output\)/u);
	const handoff = await json("handoff/package-set-receipt.json");
	assert.deepEqual(handoff, report.receipt);
	return result;
};
