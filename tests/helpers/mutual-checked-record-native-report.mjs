/**
 * Reconcile one complete installed C/C++ mutual checked-record run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordModule, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";

export const mutualCheckedRecordNativeRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const mutualCheckedRecordNativeProfiles = Object.freeze(["c", "cpp"]);
export const mutualCheckedRecordNativeChecks = Object.freeze({ c: 71, cpp: 23 });

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const canonical = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
const digest = value => {
	assert.match(value, /^[a-f0-9]{64}$/u);
	return value;
};
const expectedResult = profile => ({
	code: 0, stderr: ""
	, stdout: `mutual-checked-record-ok:${mutualCheckedRecordNativeChecks[profile]}\n`
});

/**
 * Exact checked-in caller text passed to one installed package.
 *
 * @param profile - C or C++ consumer profile.
 */
export const mutualCheckedRecordNativeConsumer = async profile => {
	assert.ok(mutualCheckedRecordNativeProfiles.includes(profile));
	const source = await readFile(
		`tests/fixtures/mutual-checked-record-consumers/${profile}.${profile}`
		, "utf8");
	return `#define MUTUAL_CHECKED_PARAMETER "arg0"\n${source}`;
};

/**
 * Authenticate all retained records for one ordinary or reviewed route.
 *
 * @param read - Reader relative to the route record directory.
 * @param options - Exact route and producer revision.
 * @param options.route - Ordinary source or reviewed Binding IR.
 * @param options.producerCommit - Exact producing Git commit.
 */
export const checkMutualCheckedRecordNativeReport = async (
	read, { route, producerCommit }
) => {
	assert.ok(mutualCheckedRecordNativeRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const bytes = async path => Buffer.from(await read(path));
	const json = async path => canonical(await bytes(path), path);
	const reportBytes = await bytes("report.json");
	const report = canonical(reportBytes, "report.json");
	exactKeys(report, [
		"schemaVersion", "route", "profiles", "builds", "reports"
		, "producerCommit", "expectedBindingIrSha256", "reproducible"
		, "independentBuilds", "relocated", "sourceFree"
	], "report keys");
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.deepEqual(report.profiles, [...mutualCheckedRecordNativeProfiles]);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.expectedBindingIrSha256
		, hashBindingIr(mutualCheckedRecordReview()));
	assert.equal(report.reproducible, true);
	assert.equal(report.independentBuilds, 2);
	assert.equal(report.relocated, true);
	assert.equal(report.sourceFree, true);
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]
		, "Independent author roots must reproduce exact identities");

	const expectedInputs = [
		"LICENSE", `${mutualCheckedRecordModule}.lean`, "lakefile.toml"
		, "lean-bridge.exports.json", "lean-toolchain", "package.json"
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []
	].sort();
	const recordPaths = ["report.json"];
	let receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		const names = [
			`${mutualCheckedRecordModule}.lean`, "author-inputs.json"
			, "lean-bridge.exports.json", "model.json"
			, "package-set-receipt.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []
		];
		recordPaths.push(...names.map(name => prefix + name));
		const modelBytes = await bytes(prefix + "model.json");
		const model = canonical(modelBytes, prefix + "model.json");
		assert.equal(reviewedContractDifference(
			mutualCheckedRecordReview(), model.bindingIr), null);
		assert.equal(model.bindingIrSha256, report.builds[attempt].bindingIrSha256);
		assert.equal(sha256(modelBytes), report.builds[attempt].modelSha256);
		const receiptBytes = await bytes(prefix + "package-set-receipt.json");
		const currentReceipt = canonical(receiptBytes
			, prefix + "package-set-receipt.json");
		assert.equal(validatePackageSetReceipt(currentReceipt), true);
		assert.equal(sha256(receiptBytes), report.builds[attempt].receiptSha256);
		assert.deepEqual(currentReceipt.packages.map(item => item.target).sort()
			, [...mutualCheckedRecordNativeProfiles]);
		assert.deepEqual(
			Object.fromEntries(currentReceipt.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
			, report.builds[attempt].archives
		);
		receipt ??= currentReceipt;
		assert.deepEqual(currentReceipt, receipt);
		const configuration = canonical(
			await bytes(prefix + "lean-bridge.exports.json")
			, prefix + "lean-bridge.exports.json");
		assert.deepEqual(configuration, mutualCheckedRecordConfiguration(route));
		assert.deepEqual(await bytes(prefix + `${mutualCheckedRecordModule}.lean`)
			, await readFile(join(mutualCheckedRecordFixtureRoot
				, `${mutualCheckedRecordModule}.lean`)));
		if(route === "reviewed") assert.deepEqual(
			canonical(await bytes(prefix + "api.binding-ir.json")
				, prefix + "api.binding-ir.json")
			, mutualCheckedRecordReview());
		const inputs = await json(prefix + "author-inputs.json");
		assert.deepEqual(inputs.map(item => item.path), expectedInputs);
		for(const item of inputs)
		{
			exactKeys(item, ["path", "sha256", "mode", "mtime", "ctime"]
				, `${prefix}${item.path}`);
			assert.equal(item.mode, 0o100644);
			digest(item.sha256);
			assert.ok(Number.isFinite(item.mtime) && Number.isFinite(item.ctime));
		}
	}

	const handoffReceiptBytes = await bytes("handoff/package-set-receipt.json");
	assert.deepEqual(handoffReceiptBytes
		, await bytes("build-0/package-set-receipt.json"));
	assert.deepEqual(await bytes("handoff/package-set-receipt.json.sha256")
		, Buffer.from(`${sha256(handoffReceiptBytes)}  package-set-receipt.json\n`));
	recordPaths.push("handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256");
	for(const pkg of receipt.packages) for(const artifact of pkg.artifacts)
	{
		const path = `handoff/${artifact.path}`, archive = await bytes(path);
		assert.equal(archive.length, artifact.bytes, path);
		assert.equal(sha256(archive), artifact.sha256, path);
		recordPaths.push(path);
	}

	assert.equal(report.reports.length, mutualCheckedRecordNativeProfiles.length);
	const observations = [];
	for(const profile of mutualCheckedRecordNativeProfiles)
	{
		const consumerPath = `consumers/${profile}.${profile}`;
		const consumer = await bytes(consumerPath);
		assert.equal(consumer.toString(), await mutualCheckedRecordNativeConsumer(profile));
		const profileReport = await json(`${profile}/report.json`);
		exactKeys(profileReport, [
			"profile", "route", "packages", "checks", "consumerSha256"
			, "relocatedReplay", "closure", "sourceRemovedBeforeInstallation"
			, "offlineInstall", "compilerFreeReplay"
			, "immutableCallerAssertions", "malformedDepthCycleRecovery"
		], `${profile} report keys`);
		assert.deepEqual(profileReport
			, report.reports.find(item => item.profile === profile));
		assert.equal(profileReport.route, route);
		assert.equal(profileReport.checks, mutualCheckedRecordNativeChecks[profile]);
		assert.equal(profileReport.consumerSha256, sha256(consumer));
		assert.deepEqual(profileReport.relocatedReplay, expectedResult(profile));
		assert.deepEqual(profileReport.packages
			, receipt.packages.filter(pkg => pkg.target === profile));
		for(const key of [
			"sourceRemovedBeforeInstallation", "offlineInstall"
			, "compilerFreeReplay", "immutableCallerAssertions"
			, "malformedDepthCycleRecovery"
		]) assert.equal(profileReport[key], true, `${profile}.${key}`);
		exactKeys(profileReport.closure
			, ["packageFileSetSha256", "receiptSha256"], `${profile}.closure`);
		digest(profileReport.closure.packageFileSetSha256);
		digest(profileReport.closure.receiptSha256);
		recordPaths.push(consumerPath, `${profile}/report.json`);
		observations.push(profileReport);
	}
	return {
		route, producerCommit, reportSha256: sha256(reportBytes)
		, bindingIrSha256: report.expectedBindingIrSha256
		, recordPaths: recordPaths.sort(), receipt, observations
		, independentBuilds: report.independentBuilds
	};
};
