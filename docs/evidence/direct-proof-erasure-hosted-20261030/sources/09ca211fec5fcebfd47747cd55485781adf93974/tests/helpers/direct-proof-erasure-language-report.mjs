/**
 * Independent retained-record validation for Perl, Python, Ruby and Rust
 * direct proof-erasure packages.
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

export const directProofErasureLanguageProfiles = Object.freeze([
	"perl", "python", "ruby", "rust"
]);
const target = Object.freeze({
	perl: "cpan", python: "pypi", ruby: "rubygems", rust: "cargo"
});
const extension = Object.freeze({
	perl: "pl", python: "py", ruby: "rb", rust: "rs"
});
const negativePattern = Object.freeze({
	perl: /(?:expects 1 arguments|Usage:)/iu
	, python: /(?:takes 1 positional argument but 3 were given|takes exactly one argument)/iu
	, ruby: /wrong number of arguments.*given 3.*expected 1/iu
	, rust: /(?:E0061|takes 1 argument but 3 arguments were supplied)/iu
});
const factKeys = [
	"archives", ...directProofErasureNativeComponentFactKeys.slice(0, -1)
	, "packageSetReceiptSha256", "runtimeParameters"
];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const closureKeys = Object.freeze({
	perl: Object.freeze([
		"installedFilesSha256", "interpreterSha256", "receiptsSha256"
	])
	, python: Object.freeze([
		"baselineSha256", "environmentSha256", "interpreterSha256", "python"
	])
	, ruby: Object.freeze([
		"environmentSha256", "gemspecSha256", "interpreterSha256"
		, "packageFileSetSha256", "receiptSha256"
	])
	, rust: Object.freeze([
		"cargoSha256", "compilerSha256", "executableSha256"
		, "packageFileSetSha256", "receiptSha256"
	])
});

/**
 * Authenticate the exact post-relocation closure for one language package.
 *
 * @param profile - Perl, Python, Ruby or Rust.
 * @param closure - Retained closure observation.
 */
export const validateDirectProofErasureLanguageClosure = (profile, closure) => {
	assert.ok(directProofErasureLanguageProfiles.includes(profile));
	assert.ok(closure && typeof closure === "object" && !Array.isArray(closure));
	assert.deepEqual(Object.keys(closure).sort(), [...closureKeys[profile]].sort());
	for(const [key, value] of Object.entries(closure))
	{
		if(key.endsWith("Sha256")) digest(value);
	}
	if(profile === "python")
		assert.match(closure.python, /^3\.(?:1[1-9]|[2-9][0-9])\.[0-9]+$/u);
	return true;
};

/**
 * Validate one complete installed-language report.
 *
 * @param report - Parsed retained report.
 * @param root0 - Expected workflow identity.
 * @param root0.profile - Exact consumer profile.
 * @param root0.route - Ordinary or reviewed source route.
 * @param root0.producerCommit - Exact tested revision.
 */
export const validateDirectProofErasureLanguageReport = (report, {
	profile, route, producerCommit
}) => {
	assert.ok(directProofErasureLanguageProfiles.includes(profile));
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
		assert.equal(fact.runtimeParameters, 1);
		assert.equal(fact.erasedProofs, 2);
		assert.ok(Object.keys(fact.archives).length >= 1);
		for(const value of Object.values(fact.archives)) digest(value);
	}
	validatePackageSetReceipt(report.receipt);
	assert.equal(report.receipt.component.id, "directprooferasure@1.0.0");
	assert.ok(report.receipt.packages.some(item => item.target === target[profile]
		&& item.role === "component"));
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].bindingIrSha256
		, report.builds[0].bindingIrSha256);
	const item = report.observation;
	assert.equal(item.profile, profile);
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
	assert.match(item.negativeProofArgument.diagnostic, negativePattern[profile]);
	digest(item.consumerSha256);
	validateDirectProofErasureLanguageClosure(profile, item.closure);
	if(profile === "rust")
	{
		assert.equal(report.dependencies.archive, "rust-dependencies.tar.gz");
		digest(report.dependencies.sha256);
		digest(report.dependencies.lockSha256);
		assert.ok(report.dependencies.packages.length >= 2);
	}
	else assert.equal(report.dependencies, null);
	return { profile, route, producerCommit, checks: 1005
		, executions: 2, rejectedProofArguments: 1 };
};

/**
 * Authenticate every retained source, compiler plan and observation.
 *
 * @param read - Safe reader rooted at one route's retained records.
 * @param options - Expected profile, route and producer identity.
 */
export const checkDirectProofErasureLanguageRecords = async (read, options) => {
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const report = await json("report.json");
	const result = validateDirectProofErasureLanguageReport(report, options);
	const expectedConfiguration = {
		schemaVersion: 1, modules: [directProofErasureModule]
		, ...options.route === "ordinary"
			? { exports: [`${directProofErasureModule}.keep`] } : {}
		, targets: directProofErasureTargetConfiguration([options.profile])
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
	const suffix = extension[options.profile];
	const source = await read(`${options.profile}/consumer.${suffix}`);
	assert.deepEqual(source, fixture(
		`tests/fixtures/direct-proof-erasure-consumers/${options.profile}.${suffix}`
	));
	assert.equal(report.observation.consumerSha256, sha256(source));
	const invalid = (await read(
		`${options.profile}/proof-argument-negative.${suffix}`
	)).toString();
	assert.match(invalid, options.profile === "perl" ? /keep\(1, 0, 1\)/u
		: options.profile === "python" ? /keep\(True, 0, True\)/u
			: options.profile === "ruby" ? /keep\(true, 0, true\)/u
				: /keep\(true, 0, true\)/u);
	const handoff = await json("handoff/package-set-receipt.json");
	assert.deepEqual(handoff, report.receipt);
	if(options.profile === "rust")
		assert.equal(sha256(await read(`dependencies/${report.dependencies.archive}`))
			, report.dependencies.sha256);
	return result;
};
