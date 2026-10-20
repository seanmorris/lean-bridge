/**
 * Independently reconcile retained Node and browser value-index records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexBrowserEngines
	, checkedRecordValueIndexBrowserExpected
	, checkedRecordValueIndexBrowserPackageSource
	, checkedRecordValueIndexBrowserProfiles
	, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexPackage
	, validateCheckedRecordValueIndexBrowserObservation
	, validateCheckedRecordValueIndexBrowserPhases
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexPositions = Object.freeze([
	"trueBoolIndex.arg0", "falseBoolIndex.arg0", "abStringIndex.arg0"
	, "emptyStringIndex.arg0", "unicodeStringIndex.arg0", "emptySizedIndex.arg0"
	, "zeroNatIndex.arg0", "wideNatIndex.arg0"
	, "produceTrueBool.result", "produceFalseBool.result", "produceAb.result"
	, "produceEmptyString.result", "produceUnicodeString.result"
	, "produceEmptySized.result", "produceZeroNat.result", "produceWideNat.result"
]);

/**
 * Enumerate the complete route-relative retained-file closure.
 *
 * @param receipt - Prepared component and runtime archive receipt.
 */
export const checkedRecordValueIndexBrowserRecordPaths = receipt => {
	const paths = [
		"browser.json", "configuration.json", "controls.json"
		, "expected.binding-ir.json"
		, "install.json", "installed.json", "relocated.json", "report.json"
		, "callers/check.mjs", "callers/index.mjs", "callers/index.mts"
		, "handoff/component-package-receipt.json"
		, "handoff/verify-component-package-receipt.mjs"
		, `handoff/${receipt.package.archive}`, `handoff/${receipt.runtime.archive}`
	];
	for(const attempt of [0, 1])
		for(const path of [
			"author-inputs.json", "binding/binding-ir.json"
			, "component-package-receipt.json"
			, "locks/compiler-adapters.json", "locks/component-build-plan.json"
			, "metadata/provenance.json", "CheckedRecordValueIndices.lean"
		]) paths.push(`build-${attempt}/${path}`);
	for(const profile of checkedRecordValueIndexBrowserProfiles)
	{
		const entry = {
			"browser-javascript": "plain", "browser-react": "react"
			, "browser-worker": "worker-main"
		}[profile];
		for(const path of [
			"check.mjs", "index.html", "inputs.json", "install.json"
			, "installed-binding-ir.json", "installed-component-package.json"
			, "installed-index.d.ts", "installed-runtime-identity.json"
			, "installed-runtime-package.json", "javascript.mjs", "observations.json"
			, "package-lock.json", "package.mjs", "package.json", "report.json"
			, "request.json", `${entry}.mjs`
			, ...profile === "browser-worker" ? ["worker.mjs"] : []
		]) paths.push(`browser/${profile}/${path}`);
	}
	return paths.sort();
};

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
const primitive = name => ({ kind: "primitive", name });
const value = (name, contents) => ({
	kind: "value", type: primitive(name), value: contents
});
const expectedInstantiations = Object.freeze({
	On: [value("bool", "true")]
	, Off: [value("bool", "false")]
	, Ab: [value("string", "ab")]
	, EmptyToken: [primitive("string"), value("string", "")]
	, UnicodeToken: [primitive("string"), value("string", "λ🌱")]
	, EmptySized: [value("nat", "0")]
	, ZeroToken: [primitive("nat"), value("nat", "0")]
	, WideToken: [
		primitive("nat"), value("nat", "340282366920938463463374607431768211457")
	]
});

/**
 * Require the exact compiler-derived closed index kind and value for every alias.
 *
 * @param ir - Retained build or installed Binding IR.
 */
export const assertCheckedRecordValueIndexProvenance = ir => {
	assert.deepEqual(ir.types.map(type => type.name).sort()
		, Object.keys(expectedInstantiations).sort(), "Exact value-index record set");
	for(const type of ir.types)
	{
		const instantiation = type.source.extensions["lean-lang.org/instantiation"];
		assert.ok(instantiation, `${type.name} has value-index provenance`);
		assert.deepEqual(instantiation.arguments, expectedInstantiations[type.name]
			, `${type.name} preserves its exact closed index kind and value`);
	}
};

const fixturePaths = Object.freeze([
	"CheckedRecordValueIndices.lean", "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);
const original = (commit, path) => {
	const target
		= `${commit}:tests/fixtures/onboarding/checked-record-value-indices/${path}`;
	return execFileSync("git", ["show", target], { maxBuffer: 16 * 1024 * 1024 });
};

/**
 * Check every retained npm record and independently derive its identities.
 *
 * @param read - Route-relative byte reader.
 * @param options - Frozen producer and runtime identities.
 * @param options.route - Exact author route.
 * @param options.producerCommit - Package-producing revision.
 * @param options.runtime - Observed Node identity.
 */
export const checkCheckedRecordValueIndexNpmReport = async (
	read, { route, producerCommit, runtime }
) => {
	const selection = checkedRecordValueIndexBrowserSelection(route);
	const expectedResult = checkedRecordValueIndexBrowserExpected(route);
	const reportBytes = await read("report.json"), report = json(reportBytes);
	exactKeys(report, [
		"schemaVersion", "route", "producerCommit", "runtime"
		, "sourceCommitClean", "independentBuilds", "reproducible"
		, "authorInputsUnchanged", "sourceRemovedBeforeInstallation"
		, "offlineInstall", "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions", "negativeControls", "consumerProfiles"
		, "positions", "configuration", "expectedBindingIrSha256", "expected"
		, "builds", "callers", "trees", "receipt", "typescript", "observations"
	]);
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
	assert.deepEqual(report.negativeControls, {
		checkedRefusals: 4, shapeRefusals: 2, recoveries: 6
	});
	assert.deepEqual(report.consumerProfiles, ["node-javascript", "node-typescript"]);
	assert.deepEqual(report.positions, checkedRecordValueIndexPositions);
	assert.deepEqual(report.configuration, selection.configuration);
	assert.deepEqual(report.expected, expectedResult);
	assert.deepEqual(report.configuration, json(await read("configuration.json")));
	const expectedBinding = json(await read("expected.binding-ir.json"));
	assert.deepEqual(expectedBinding, selection.expected);
	assert.equal(hashBindingIr(expectedBinding), report.expectedBindingIrSha256);
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[0], report.builds[1]);
	for(const [index, build] of report.builds.entries())
	{
		exactKeys(build, [
			"authorInputsSha256", "bindingIrFileSha256", "bindingIrSha256"
			, "componentArchiveSha256", "receiptSha256", "runtimeArchiveSha256"
		]);
		const prefix = `build-${index}`;
		const authorInputs = json(await read(`${prefix}/author-inputs.json`));
		const expectedInputPaths = [
			...fixturePaths, "lean-bridge.exports.json"
			, ...(selection.reviewed ? ["api.binding-ir.json"] : [])
		].sort();
		assert.deepEqual(authorInputs.map(item => item.path).sort(), expectedInputPaths);
		assert.ok(authorInputs.every(item => item.mode === 33188));
		const stable = authorInputs.map(({ path, mode, sha256: digest }) => ({
			path, mode, sha256: digest
		}));
		assert.equal(sha256(canonicalJson(stable)), build.authorInputsSha256);
		const leanPath = "CheckedRecordValueIndices.lean";
		const leanInput = authorInputs.find(item => item.path === leanPath);
		assert.ok(leanInput);
		assert.equal(sha256(await read(`${prefix}/${leanPath}`)), leanInput.sha256);
		for(const path of fixturePaths)
		{
			const input = authorInputs.find(item => item.path === path);
			assert.equal(input.sha256, sha256(original(producerCommit, path)), path);
		}
		const configurationInput = authorInputs.find(item =>
			item.path === "lean-bridge.exports.json");
		assert.equal(configurationInput.sha256
			, sha256(canonicalJson(selection.configuration)));
		if(selection.reviewed)
		{
			const reviewedInput = authorInputs.find(item => item.path === "api.binding-ir.json");
			assert.equal(reviewedInput.sha256, sha256(canonicalJson(selection.expected)));
		}
		const binding = await read(`${prefix}/binding/binding-ir.json`);
		const bindingIr = json(binding);
		assertCheckedRecordValueIndexProvenance(bindingIr);
		assert.equal(reviewedContractDifference(expectedBinding, bindingIr), null
			, `${prefix} independently reconciles with reviewed Binding IR`);
		assert.equal(sha256(binding), build.bindingIrFileSha256);
		assert.equal(hashBindingIr(bindingIr), build.bindingIrSha256);
		assert.equal(sha256(await read(`${prefix}/component-package-receipt.json`))
			, build.receiptSha256);
	}
	for(const [path, digest] of Object.entries(report.callers))
		assert.equal(sha256(await read(`callers/${path}`)), digest, path);
	assert.equal(report.typescript.strict, true);
	assert.equal(report.typescript.skipLibCheck, false);
	assert.equal(report.typescript.sourceSha256, report.callers["index.mts"]);
	assert.equal(report.typescript.declarationsSha256
		, report.trees[checkedRecordValueIndexPackage]["index.d.ts"]);
	const receiptBytes = await read("handoff/component-package-receipt.json");
	assert.equal(sha256(receiptBytes), report.builds[0].receiptSha256);
	assert.deepEqual(report.receipt, json(receiptBytes));
	assert.equal(sha256(await read(`handoff/${report.receipt.package.archive}`))
		, report.receipt.package.sha256);
	assert.equal(sha256(await read(`handoff/${report.receipt.runtime.archive}`))
		, report.receipt.runtime.sha256);
	assert.equal(report.receipt.package.sha256
		, report.builds[0].componentArchiveSha256);
	assert.equal(report.receipt.runtime.sha256
		, report.builds[0].runtimeArchiveSha256);
	assert.ok(!Object.values(report.trees).some(tree =>
		Object.keys(tree).some(path => path.endsWith(".lean"))));
	assert.equal(report.observations.length, 2);
	for(const [index, name] of ["installed.json", "relocated.json"].entries())
	{
		const observation = json(await read(name));
		assert.deepEqual(observation, report.observations[index]);
		assert.equal(observation.relocated, index === 1);
		for(const result of [
			observation.result, observation.runtime, observation.typescript
		]) successful(result);
		assert.deepEqual(JSON.parse(observation.result.stdout), expectedResult);
		assert.deepEqual(JSON.parse(observation.runtime.stdout), runtime);
	}
	const install = json(await read("install.json"));
	exactKeys(install, ["code", "stderr", "stdout"]);
	assert.equal(install.code, 0);
	return {
		route, npmReportSha256: sha256(reportBytes), expected: expectedResult
		, receipt: report.receipt, bindingIrSha256: report.builds[0].bindingIrSha256
		, declarationsSha256: report.typescript.declarationsSha256
		, trees: report.trees, nodeObservations: report.observations.length
	};
};

/**
 * Reconcile every retained real-browser profile against its npm producer.
 *
 * @param read - Route-relative byte reader.
 * @param options - Frozen producer, consumer and runtime identities.
 * @param options.route - Exact author route.
 * @param options.producerCommit - Package-producing revision.
 * @param options.consumerCommit - Browser-consuming revision.
 * @param options.runtime - Observed Node identity.
 */
export const checkCheckedRecordValueIndexBrowserReport = async (
	read, { route, producerCommit, consumerCommit, runtime }
) => {
	const npm = await checkCheckedRecordValueIndexNpmReport(read, {
		route, producerCommit, runtime
	});
	const browserBytes = await read("browser.json"), browser = json(browserBytes);
	exactKeys(browser, [
		"schemaVersion", "route", "producerCommit", "consumerCommit"
		, "requestedEngines", "reports"
	]);
	assert.equal(browser.schemaVersion, 1);
	assert.equal(browser.route, route);
	assert.equal(browser.producerCommit, producerCommit);
	assert.equal(browser.consumerCommit, consumerCommit);
	assert.deepEqual(browser.requestedEngines, checkedRecordValueIndexBrowserEngines);
	assert.deepEqual(browser.reports.map(item => item.profile)
		, checkedRecordValueIndexBrowserProfiles);
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
		assert.equal(report.bindingIrSha256, npm.bindingIrSha256);
		assert.equal(report.receiptSha256, sha256(await read(
			"handoff/component-package-receipt.json")));
		assert.equal(report.corpusSha256, sha256(await read("callers/check.mjs")));
		assert.equal(report.packageSourceSha256
			, sha256(checkedRecordValueIndexBrowserPackageSource));
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
		assert.equal(report.inputs["check.mjs"].sha256, report.corpusSha256);
		validateCheckedRecordValueIndexBrowserPhases(
			report.observations, report.profile, checkedRecordValueIndexBrowserEngines
			, route);
		validateCheckedRecordValueIndexBrowserObservation(
			report.observation, report.profile, route);
		assert.deepEqual(report.browser.requestedEngines
			, checkedRecordValueIndexBrowserEngines);
		assert.equal(report.browser.externalNetworkBlocked, true);
		assert.equal(report.browser.installedSourcesRemoved, true);
		assert.equal(report.browser.executions.length
			, report.profile === "browser-react" ? 6 : 3);
		for(const execution of report.browser.executions)
		{
			assert.ok(checkedRecordValueIndexBrowserEngines.includes(execution.engine));
			validateCheckedRecordValueIndexBrowserObservation(
				execution.observation, report.profile, route);
			browserVersions[execution.engine] ??= execution.observation.hostVersion;
			assert.equal(browserVersions[execution.engine]
				, execution.observation.hostVersion);
			executions.push(execution);
		}
		const installedBinding = json(await read(
			`${prefix}/installed-binding-ir.json`));
		assertCheckedRecordValueIndexProvenance(installedBinding);
		assert.equal(reviewedContractDifference(
			checkedRecordValueIndexBrowserSelection(route).expected, installedBinding), null);
		assert.equal(hashBindingIr(installedBinding), report.bindingIrSha256);
		assert.equal(sha256(await read(`${prefix}/installed-index.d.ts`))
			, npm.declarationsSha256);
		assert.equal(sha256(await read(`${prefix}/installed-component-package.json`))
			, npm.trees[checkedRecordValueIndexPackage]["package.json"]);
		assert.equal(sha256(await read(`${prefix}/installed-runtime-identity.json`))
			, npm.trees["@lean-bridge/runtime"]["runtime-identity.json"]);
		assert.equal(sha256(await read(`${prefix}/installed-runtime-package.json`))
			, npm.trees["@lean-bridge/runtime"]["package.json"]);
		lifecycleObservations += report.observations.length;
	}
	assert.equal(lifecycleObservations, 51);
	assert.equal(executions.length, 12);
	assert.deepEqual(Object.keys(browserVersions), checkedRecordValueIndexBrowserEngines);
	return {
		route, npmReportSha256: npm.npmReportSha256
		, browserReportSha256: sha256(browserBytes)
		, nodeObservations: npm.nodeObservations, browserExecutions: executions.length
		, lifecycleObservations, browserVersions, expected: npm.expected
		, receipt: npm.receipt
	};
};
