/**
 * Independently reconcile retained zero-payload npm and browser records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	validateZeroPayloadBrowserObservation
	, validateZeroPayloadBrowserPhases
	, zeroPayloadBrowserEngines
	, zeroPayloadBrowserExpected
	, zeroPayloadBrowserPackageSource
	, zeroPayloadBrowserProfiles
	, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadBrowserPositions = Object.freeze([
	"witnessCount.arg0", "absentCount.arg0", "tokenTag.arg0", "markerCount.arg0"
	, "produceWitness.result", "produceToken.result", "witnesses.result[]"
	, "maybeWitness.result.some", "produceMarker.result"
]);

const exactKeys = (value, keys) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort());
const json = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};
const successful = result => {
	exactKeys(result, ["code", "stderr", "stdout"]);
	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
};
const fixturePaths = Object.freeze([
	"LICENSE", "ZeroPayloadCheckedRecords.lean", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);
const original = (commit, path) => execFileSync("git", ["show"
	, `${commit}:tests/fixtures/onboarding/zero-payload-checked-records/${path}`]
, { maxBuffer: 16 * 1024 * 1024 });

/**
 * Check every retained npm record and independently derive its identities.
 *
 * @param read - Route-relative byte reader.
 * @param options - Frozen producer and runtime identities.
 * @param options.route - Exact author route.
 * @param options.producerCommit - Package-producing revision.
 * @param options.runtime - Observed Node identity.
 */
export const checkZeroPayloadNpmReport = async (
	read, { route, producerCommit, runtime }
) => {
	const selection = zeroPayloadBrowserSelection(route);
	const expected = zeroPayloadBrowserExpected(route);
	const report = json(await read("report.json"));
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.runtime, runtime);
	for(const field of [
		"sourceCommitClean", "reproducible", "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"
		, "relocatedInstallation", "immutableCallerAssertions"
	]) assert.equal(report[field], true, field);
	assert.equal(report.independentBuilds, 2);
	assert.deepEqual(report.consumerProfiles, ["node-javascript", "node-typescript"]);
	assert.deepEqual(report.positions, zeroPayloadBrowserPositions);
	assert.deepEqual(report.expected, expected);
	assert.deepEqual(report.configuration, selection.configuration);
	assert.deepEqual(json(await read("configuration.json")), selection.configuration);
	const expectedBinding = json(await read("expected.binding-ir.json"));
	assert.deepEqual(expectedBinding, selection.expected);
	assert.equal(hashBindingIr(expectedBinding), report.expectedBindingIrSha256);
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	for(const [index, build] of report.builds.entries())
	{
		const prefix = `build-${index}`;
		const inputs = json(await read(`${prefix}/author-inputs.json`));
		const expectedInputPaths = [
			...fixturePaths, "lean-bridge.exports.json"
			, ...selection.reviewed ? ["api.binding-ir.json"] : []
		].sort();
		assert.deepEqual(inputs.map(item => item.path).sort(), expectedInputPaths);
		assert.ok(inputs.every(item => item.mode === 33188));
		const stable = inputs.map(({ path, mode, sha256: digest }) => ({
			path, mode, sha256: digest
		}));
		assert.equal(sha256(canonicalJson(stable)), build.authorInputsSha256);
		for(const path of fixturePaths)
		{
			const input = inputs.find(item => item.path === path);
			assert.equal(input.sha256, sha256(original(producerCommit, path)), path);
		}
		const configuration = inputs.find(item => item.path === "lean-bridge.exports.json");
		assert.equal(configuration.sha256, sha256(canonicalJson(selection.configuration)));
		if(selection.reviewed)
		{
			const reviewed = inputs.find(item => item.path === "api.binding-ir.json");
			assert.equal(reviewed.sha256, sha256(canonicalJson(selection.expected)));
		}
		const bindingBytes = await read(`${prefix}/binding/binding-ir.json`);
		const binding = json(bindingBytes);
		assert.equal(reviewedContractDifference(expectedBinding, binding), null);
		assert.equal(sha256(bindingBytes), build.bindingIrFileSha256);
		assert.equal(hashBindingIr(binding), build.bindingIrSha256);
		assert.equal(sha256(await read(`${prefix}/component-package-receipt.json`))
			, build.receiptSha256);
		const lean = inputs.find(item => item.path === "ZeroPayloadCheckedRecords.lean");
		assert.equal(sha256(await read(`${prefix}/ZeroPayloadCheckedRecords.lean`))
			, lean.sha256);
	}
	const receiptBytes = await read("handoff/component-package-receipt.json");
	assert.equal(sha256(receiptBytes), report.builds[0].receiptSha256);
	assert.deepEqual(json(receiptBytes), report.receipt);
	assert.equal(sha256(await read(`handoff/${report.receipt.package.archive}`))
		, report.receipt.package.sha256);
	assert.equal(sha256(await read(`handoff/${report.receipt.runtime.archive}`))
		, report.receipt.runtime.sha256);
	assert.equal(report.receipt.package.sha256
		, report.builds[0].componentArchiveSha256);
	assert.equal(report.receipt.runtime.sha256
		, report.builds[0].runtimeArchiveSha256);
	assert.equal(report.callers["check.mjs"]
		, sha256(await read("callers/check.mjs")));
	assert.equal(report.callers["index.mjs"]
		, sha256(await read("callers/index.mjs")));
	assert.equal(report.callers["index.mts"]
		, sha256(await read("callers/index.mts")));
	assert.deepEqual(report.negativeControls, selection.resultOnly
		? { checkedRefusals: 0, shapeRefusals: 0, recoveries: 0 }
		: { checkedRefusals: 1, shapeRefusals: 7, recoveries: 8 });
	assert.equal(report.observations.length, 2);
	for(const [index, observation] of report.observations.entries())
	{
		successful(observation.result);
		assert.equal(observation.result.stdout, JSON.stringify(expected) + "\n");
		successful(observation.typescript);
		assert.equal(observation.typescript.stdout, "");
		successful(observation.runtime);
		assert.deepEqual(JSON.parse(observation.runtime.stdout), runtime);
		assert.equal(observation.relocated, index === 1);
		assert.deepEqual(json(await read(index ? "relocated.json" : "installed.json"))
			, observation);
	}
	return report;
};

/**
 * Check every retained real-browser observation without trusting the producer.
 *
 * @param read - Route-relative byte reader.
 * @param options - Frozen producer/consumer identities.
 * @param options.route - Exact author route.
 * @param options.producerCommit - Package-producing revision.
 * @param options.consumerCommit - Browser-consuming revision.
 */
export const checkZeroPayloadBrowserReport = async (
	read, { route, producerCommit, consumerCommit }
) => {
	const report = json(await read("browser.json"));
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.consumerCommit, consumerCommit);
	assert.deepEqual(report.requestedEngines, zeroPayloadBrowserEngines);
	assert.equal(report.reports.length, zeroPayloadBrowserProfiles.length);
	for(const [index, profile] of zeroPayloadBrowserProfiles.entries())
	{
		const item = report.reports[index];
		assert.equal(item.profile, profile);
		assert.equal(item.route, route);
		assert.equal(item.producerCommit, producerCommit);
		assert.equal(item.consumerCommit, consumerCommit);
		assert.equal(item.offlineInstall, true);
		assert.equal(item.compilerFreePath, true);
		assert.equal(item.sourceRemovedBeforeInstallation, true);
		assert.equal(item.corpusSha256, sha256(await read("callers/check.mjs")));
		assert.equal(item.packageSourceSha256, sha256(zeroPayloadBrowserPackageSource));
		assert.deepEqual(item.browser.requestedEngines, zeroPayloadBrowserEngines);
		assert.equal(item.browser.installedSourcesRemoved, true);
		assert.equal(item.browser.externalNetworkBlocked, true);
		assert.deepEqual(item.observation, item.observations[0].observation);
		validateZeroPayloadBrowserObservation(item.observation, profile, route);
		validateZeroPayloadBrowserPhases(
			item.observations, profile, zeroPayloadBrowserEngines, route);
		for(const [path, identity] of Object.entries(item.inputs))
		{
			const bytes = await read(`browser/${profile}/${path}`);
			assert.deepEqual(identity, { bytes: bytes.length, sha256: sha256(bytes) });
		}
		const retained = json(await read(`browser/${profile}/report.json`));
		assert.deepEqual(retained, item);
		assert.deepEqual(json(await read(`browser/${profile}/observations.json`))
			, item.observations);
	}
	return report;
};
