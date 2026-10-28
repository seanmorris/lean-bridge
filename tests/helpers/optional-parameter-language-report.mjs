/**
 * Independently validate retained optional-parameter language packages.
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

export const optionalParameterLanguageProfiles = Object.freeze([
	"perl", "python", "ruby", "rust"
]);
const target = Object.freeze({
	perl: "cpan", python: "pypi", ruby: "rubygems", rust: "cargo"
});
const extension = Object.freeze({
	perl: "pl", python: "py", ruby: "rb", rust: "rs"
});
const factKeys = [
	"archives", "authenticatedDefaults", "bindingIrFileSha256"
	, "bindingIrSha256", "compilerAdaptersSha256", "declarations"
	, "generatedLeanSha256", "packageSetReceiptSha256"
];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const apiPatterns = Object.freeze({
	perl: [
		/\*word = sub/u, /push @args, 7 if @args == 0/u
		, /\*present = sub/u, /Some->new\(9\)/u
	]
	, python: [
		/def word\(value0: int = 7\) -> int:/u
		, /def present\(value0: Option\[int\] = Some\(9\)\)/u
	]
	, ruby: [
		/def word\(arg0 = 7\)/u
		, /def present\(arg0 = Some\.new\(9\)\)/u
		, /def unit_value\(arg0 = UNIT\)/u
	]
	, rust: [
		/macro_rules! word/u, /\$crate::word\(7\)/u
		, /macro_rules! present/u, /Some\(9\)/u
	]
});

/**
 * Validate one retained ordinary or reviewed report.
 *
 * @param report - Parsed retained report.
 * @param root0 - Exact expected profile, author route and revision.
 * @param root0.profile - Perl, Python, Ruby or Rust profile.
 * @param root0.route - Ordinary or independently reviewed author route.
 * @param root0.producerCommit - Exact package producer revision.
 */
export const validateOptionalParameterLanguageReport = (report, {
	profile, route, producerCommit
}) => {
	assert.ok(optionalParameterLanguageProfiles.includes(profile));
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, profile);
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
		assert.ok(Object.keys(fact.archives).length >= 1);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "defaults@1.0.0");
	assert.ok(report.receipt.packages.some(item => item.target === target[profile]
		&& item.role === "component"));
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	const item = report.observation;
	assert.equal(item.profile, profile);
	assert.equal(item.checks, 23);
	assert.equal(item.runtimeChecks, profile === "rust" ? 21 : 23);
	assert.equal(item.invalidHostValues, 2);
	assert.equal(item.explicitHostNull, true);
	assert.equal(item.offlineInstall, true);
	assert.equal(item.compilerFreePath, true);
	assert.deepEqual(item.executions, [
		{ checks: item.runtimeChecks, relocated: false }
		, { checks: item.runtimeChecks, relocated: true }
	]);
	digest(item.consumerSha256); digest(item.apiSha256);
	assert.ok(item.closure && typeof item.closure === "object");
	for(const [key, value] of Object.entries(item.closure))
	{
		assert.match(key, /Sha256$/u); digest(value);
	}
	for(const key of profile === "perl"
		? ["installedFilesSha256", "interpreterSha256", "receiptsSha256"]
		: profile === "python"
			? ["receiptSha256", "packageFileSetSha256", "environmentSha256", "interpreterSha256"]
			: profile === "ruby"
				? ["receiptSha256", "packageFileSetSha256", "environmentSha256", "interpreterSha256", "gemspecSha256"]
				: ["receiptSha256", "packageFileSetSha256", "compilerSha256", "cargoSha256", "executableSha256"])
		digest(item.closure[key]);
	if(profile === "rust")
	{
		assert.equal(item.invalidCompile.rejected, true);
		assert.match(item.invalidCompile.diagnostic
			, /(?:E0308|mismatched types|expected u32)/u);
		assert.equal(report.dependencies.archive, "rust-dependencies.tar.gz");
		digest(report.dependencies.sha256); digest(report.dependencies.lockSha256);
		assert.ok(report.dependencies.packages.length >= 2);
	}
	else
	{
		assert.equal(item.invalidCompile, null);
		assert.equal(report.dependencies, null);
	}
	return {
		lane: `language-${profile}`, route, producerCommit, profiles: [profile]
		, cases: optionalParameterMatrixCases, checks: 23, executions: 2
	};
};

/**
 * Authenticate sources, compiler plans, archives and public API defaults.
 *
 * @param read - Safe reader rooted at one retained route.
 * @param options - Exact expected profile, author route and revision.
 */
export const checkOptionalParameterLanguageRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateOptionalParameterLanguageReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [optionalParameterModule]
		, ...options.route === "ordinary"
			? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration([options.profile])
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
	const suffix = extension[options.profile];
	const source = await read(`${options.profile}/consumer.${suffix}`);
	assert.deepEqual(source, fixture(
		`tests/fixtures/optional-parameter-consumers/${options.profile}.${suffix}`
	));
	assert.equal(report.observation.consumerSha256, sha256(source));
	const api = await read(`${options.profile}/api.txt`);
	for(const pattern of apiPatterns[options.profile])
		assert.match(api.toString(), pattern);
	assert.equal(report.observation.apiSha256, sha256(api));
	assert.deepEqual(await json("handoff/package-set-receipt.json")
		, report.receipt);
	if(options.profile === "rust")
	{
		assert.deepEqual(await read("rust/invalid.rs"), fixture(
			"tests/fixtures/optional-parameter-consumers/rust-invalid.rs"));
		assert.equal(sha256(await read(`dependencies/${report.dependencies.archive}`))
			, report.dependencies.sha256);
	}
	return result;
};
