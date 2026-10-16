/**
 * Independently reconcile retained Node and browser mutual checked-record reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	mutualCheckedRecordBrowserEngines
	, mutualCheckedRecordBrowserPackage
	, mutualCheckedRecordBrowserProfiles
	, validateMutualCheckedRecordBrowserObservation
	, validateMutualCheckedRecordBrowserPhases
} from "./mutual-checked-record-browser-fixture.mjs";
import {
	mutualCheckedRecordNpmExpected
	, mutualCheckedRecordNpmPositions
	, mutualCheckedRecordNpmSelection
} from "./mutual-checked-record-npm-fixture.mjs";

const exactKeys = (value, keys) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort());
const json = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};
const successful = result => {
	exactKeys(result, ["code", "stderr", "stdout"]);
	assert.deepEqual({ code: result.code, stderr: result.stderr }, {
		code: 0, stderr: ""
	});
};

/**
 * Check every retained report input and return its independently derived counts.
 *
 * @param read - Route-relative byte reader.
 * @param options - Exact frozen identities.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Package producer revision.
 * @param options.consumerCommit - Browser consumer revision.
 * @param options.runtime - Node runtime identity.
 */
export const checkMutualCheckedRecordBrowserReport = async (
	read, { route, producerCommit, consumerCommit, runtime }
) => {
	mutualCheckedRecordNpmSelection(route);
	const npmBytes = await read("report.json"), npm = json(npmBytes);
	exactKeys(npm, [
		"schemaVersion", "route", "producerCommit", "runtime"
		, "sourceCommitClean", "independentBuilds", "reproducible"
		, "authorInputsUnchanged", "sourceRemovedBeforeInstallation"
		, "offlineInstall", "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions", "malformedDepthCycleRecovery"
		, "consumerProfiles", "positions", "configuration"
		, "expectedBindingIrSha256", "builds", "callers", "trees"
		, "receipt", "typescript", "observations", "expected"
	]);
	assert.equal(npm.schemaVersion, 1);
	assert.equal(npm.route, route);
	assert.equal(npm.producerCommit, producerCommit);
	assert.deepEqual(npm.runtime, runtime);
	for(const field of [
		"sourceCommitClean", "reproducible", "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions", "malformedDepthCycleRecovery"
	]) assert.equal(npm[field], true, field);
	assert.equal(npm.independentBuilds, 2);
	assert.deepEqual(npm.consumerProfiles, ["node-javascript", "node-typescript"]);
	assert.deepEqual(npm.positions, mutualCheckedRecordNpmPositions);
	assert.deepEqual(npm.expected, mutualCheckedRecordNpmExpected(route));
	assert.deepEqual(npm.configuration, json(await read("configuration.json")));
	const expectedBinding = json(await read("expected.binding-ir.json"));
	assert.equal(hashBindingIr(expectedBinding), npm.expectedBindingIrSha256);
	assert.equal(npm.builds.length, 2);
	assert.deepEqual(npm.builds[0], npm.builds[1]);
	for(const [index, build] of npm.builds.entries())
	{
		exactKeys(build, [
			"authorInputsSha256", "bindingIrFileSha256", "bindingIrSha256"
			, "componentArchiveSha256", "receiptSha256", "runtimeArchiveSha256"
		]);
		const prefix = `build-${index}`;
		const authorInputs = json(await read(`${prefix}/author-inputs.json`));
		const stableInputs = authorInputs.map(({ path, mode, sha256: digest }) => ({
			path, mode, sha256: digest
		}));
		assert.equal(sha256(canonicalJson(stableInputs)), build.authorInputsSha256);
		const binding = await read(`${prefix}/binding/binding-ir.json`);
		assert.equal(sha256(binding), build.bindingIrFileSha256);
		assert.equal(hashBindingIr(json(binding)), build.bindingIrSha256);
		assert.equal(sha256(await read(`${prefix}/component-package-receipt.json`))
			, build.receiptSha256);
	}
	for(const [path, digest] of Object.entries(npm.callers))
		assert.equal(sha256(await read(`callers/${path}`)), digest, path);
	assert.equal(npm.typescript.strict, true);
	assert.equal(npm.typescript.skipLibCheck, false);
	assert.equal(npm.typescript.sourceSha256, npm.callers["index.mts"]);
	assert.equal(npm.typescript.declarationsSha256
		, npm.trees.mutualcheckedrecords["index.d.ts"]);
	const receiptBytes = await read("handoff/component-package-receipt.json");
	assert.equal(sha256(receiptBytes), npm.builds[0].receiptSha256);
	assert.deepEqual(npm.receipt, json(receiptBytes));
	assert.equal(sha256(await read(`handoff/${npm.receipt.package.archive}`))
		, npm.receipt.package.sha256);
	assert.equal(sha256(await read(`handoff/${npm.receipt.runtime.archive}`))
		, npm.receipt.runtime.sha256);
	assert.equal(npm.receipt.package.sha256, npm.builds[0].componentArchiveSha256);
	assert.equal(npm.receipt.runtime.sha256, npm.builds[0].runtimeArchiveSha256);
	assert.equal(npm.observations.length, 2);
	for(const [index, name] of ["installed.json", "relocated.json"].entries())
	{
		const observation = json(await read(name));
		assert.deepEqual(observation, npm.observations[index]);
		assert.equal(observation.relocated, index === 1);
		for(const result of [observation.result, observation.runtime
			, observation.typescript]) successful(result);
		assert.deepEqual(JSON.parse(observation.result.stdout), npm.expected);
		assert.deepEqual(JSON.parse(observation.runtime.stdout), runtime);
		assert.equal(observation.typescript.stdout, "");
	}
	const install = json(await read("install.json"));
	exactKeys(install, ["code", "stderr", "stdout"]);
	assert.equal(install.code, 0);
	assert.equal(typeof install.stderr, "string");
	assert.equal(typeof install.stdout, "string");

	const browserBytes = await read("browser.json"), browser = json(browserBytes);
	exactKeys(browser, [
		"schemaVersion", "route", "producerCommit", "consumerCommit"
		, "requestedEngines", "reports"
	]);
	assert.equal(browser.schemaVersion, 1);
	assert.equal(browser.route, route);
	assert.equal(browser.producerCommit, producerCommit);
	assert.equal(browser.consumerCommit, consumerCommit);
	assert.deepEqual(browser.requestedEngines, mutualCheckedRecordBrowserEngines);
	assert.deepEqual(browser.reports.map(item => item.profile)
		, mutualCheckedRecordBrowserProfiles);
	const browserVersions = {}, executions = [];
	let lifecycleObservations = 0;
	for(const report of browser.reports)
	{
		const prefix = `browser/${report.profile}`;
		assert.deepEqual(report, json(await read(`${prefix}/report.json`)));
		assert.equal(report.schemaVersion, 1);
		assert.equal(report.route, route);
		assert.equal(report.producerCommit, producerCommit);
		assert.equal(report.consumerCommit, consumerCommit);
		assert.equal(report.bindingIrSha256, npm.builds[0].bindingIrSha256);
		assert.equal(report.receiptSha256, npm.builds[0].receiptSha256);
		assert.equal(report.corpusSha256, npm.callers["check.mjs"]);
		assert.equal(report.packageSourceSha256
			, sha256(mutualCheckedRecordBrowserPackage));
		for(const field of [
			"offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"
		]) assert.equal(report[field], true, `${report.profile}/${field}`);
		for(const [path, identity] of Object.entries(report.inputs))
		{
			const bytes = await read(`${prefix}/${path}`);
			assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, identity);
		}
		assert.deepEqual(report.observations
			, json(await read(`${prefix}/observations.json`)));
		validateMutualCheckedRecordBrowserPhases(
			report.observations, report.profile, mutualCheckedRecordBrowserEngines, route
		);
		validateMutualCheckedRecordBrowserObservation(
			report.observation, report.profile, route
		);
		assert.deepEqual(report.browser.requestedEngines
			, mutualCheckedRecordBrowserEngines);
		assert.equal(report.browser.externalNetworkBlocked, true);
		assert.equal(report.browser.installedSourcesRemoved, true);
		assert.equal(report.browser.executions.length
			, report.profile === "browser-react" ? 6 : 3);
		for(const execution of report.browser.executions)
		{
			assert.ok(mutualCheckedRecordBrowserEngines.includes(execution.engine));
			validateMutualCheckedRecordBrowserObservation(
				execution.observation, report.profile, route
			);
			browserVersions[execution.engine] ??= execution.observation.hostVersion;
			assert.equal(browserVersions[execution.engine]
				, execution.observation.hostVersion);
			executions.push(execution);
		}
		const installedBinding = json(await read(`${prefix}/installed-binding-ir.json`));
		assert.equal(hashBindingIr(installedBinding), report.bindingIrSha256);
		assert.equal(sha256(await read(`${prefix}/installed-index.d.ts`))
			, npm.typescript.declarationsSha256);
		lifecycleObservations += report.observations.length;
	}
	assert.equal(lifecycleObservations, 51);
	assert.equal(executions.length, 12);
	assert.deepEqual(Object.keys(browserVersions), mutualCheckedRecordBrowserEngines);
	return {
		route, npmReportSha256: sha256(npmBytes)
		, browserReportSha256: sha256(browserBytes)
		, nodeObservations: npm.observations.length
		, browserExecutions: executions.length, lifecycleObservations
		, browserVersions, expected: npm.expected, receipt: npm.receipt
	};
};
