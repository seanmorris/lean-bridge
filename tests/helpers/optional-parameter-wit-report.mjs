/**
 * Independently validate retained optional-parameter WIT/WASI acceptance.
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

const factKeys = [
	"archives", "authenticatedDefaults", "bindingIrFileSha256"
	, "bindingIrSha256", "compilerAdaptersSha256", "declarations"
	, "generatedLeanSha256", "packageSetReceiptSha256"
];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const witPatterns = Object.freeze([
	/word: func\(value0: u32\) -> u32;/u
	, /word-default: func\(\) -> u32;/u
	, /natural-default: func\(\) -> bridge-value-/u
	, /text-default: func\(\) -> string;/u
	, /character-default: func\(\) -> char;/u
	, /maybe-default: func\(\) -> bridge-value-/u
	, /present-default: func\(\) -> bridge-value-/u
	, /unit-value-default: func\(\) -> bridge-value-/u
]);

/**
 * Validate one complete ordinary or reviewed WIT report.
 *
 * @param report - Parsed canonical report.
 * @param options - Exact producer identity.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact tested revision.
 */
export const validateOptionalParameterWitReport = (report, {
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
		assert.equal(fact.declarations, 7);
		assert.equal(fact.authenticatedDefaults, 7);
		assert.equal(Object.keys(fact.archives).length, 1);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "defaults@1.0.0");
	assert.equal(report.receipt.packages.length, 1);
	assert.equal(report.receipt.packages[0].target, "wit-wasi");
	assert.equal(report.receipt.packages[0].role, "component");
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	const item = report.observation;
	assert.equal(item.profile, "wit-wasi");
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
	assert.deepEqual(item.refusals, [
		{
			kind: "explicit-host-null"
			, diagnostic: "Invalid WIT call arguments or unavailable session"
		}
		, {
			kind: "wrong-host-type"
			, diagnostic: "Unknown export, invalid WIT input or 16 MiB conversion limit"
		}
	]);
	for(const key of [
		"consumerSha256", "headerSha256", "witSha256", "componentWitSha256"
		, "executableSha256"
	]) digest(item[key]);
	assert.deepEqual(Object.keys(item.closure).sort()
		, ["packageFileSetSha256", "receiptSha256"]);
	digest(item.closure.packageFileSetSha256);
	digest(item.closure.receiptSha256);
	return {
		lane: "wit", route, producerCommit, profiles: ["wit-wasi"]
		, cases: optionalParameterMatrixCases, checks: 23, executions: 2
	};
};

/**
 * Authenticate every retained source, compiler plan and WIT observation.
 *
 * @param read - Safe reader rooted at one route's retained records.
 * @param options - Exact route and producer identity.
 */
export const checkOptionalParameterWitRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateOptionalParameterWitReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [optionalParameterModule]
		, ...options.route === "ordinary"
			? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration(["wit-wasi"])
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
	const source = await read("wit-wasi/consumer.c");
	assert.deepEqual(source, fixture(
		"tests/fixtures/optional-parameter-consumers/wit-wasi.c"
	));
	assert.equal(report.observation.consumerSha256, sha256(source));
	assert.match(source.toString()
		, /defaults_wasmtime_call\(\s*session, name, args, count, &output\)/u);
	assert.match(source.toString()
		, /refused\("word", NULL, 1,[\s\S]*?Invalid WIT call arguments/u);
	const header = await read("wit-wasi/defaults_wasmtime.h");
	assert.match(header.toString()
		, /defaults_wasmtime_call\([\s\S]*?const wasmtime_component_val_t \*args, size_t count,[\s\S]*?wasmtime_component_val_t \*out\);/u);
	assert.equal(report.observation.headerSha256, sha256(header));
	for(const name of ["wit-wasi/defaults.wit", "wit-wasi/component.wit"])
	{
		const wit = await read(name);
		for(const pattern of witPatterns) assert.match(wit.toString(), pattern);
		const key = name.endsWith("component.wit")
			? "componentWitSha256" : "witSha256";
		assert.equal(report.observation[key], sha256(wit));
	}
	assert.deepEqual(await json("handoff/package-set-receipt.json")
		, report.receipt);
	return result;
};
