/**
 * Reconstruct installed PHP-Wasm ownership artifacts and check executed scopes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { sourceApiIdentity } from "../../src/analyze/semantic-model.mjs";
import { createOwnedPhpWasmModel, generateOwnedPhpWasmLeanAdapters } from "../../src/build/php-wasm-owned-model.mjs";
import { generateCompiledPhpWasmOwned } from "../../src/build/php-wasm-owned-component.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedPhpZendExtension } from "../../src/backends/php/owned-zend-extension.mjs";
import { ownedZendGeneratedProbe } from "./owned-php-zend-generated-probe.mjs";
import { assertOwnedPhpWasmCi, ownedPhpWasmCiCommands } from "./owned-php-wasm-ci.mjs";
import { assertOwnedPhpCi } from "./owned-php-ci.mjs";
import { ownedPhpWasmCoexistenceProgram } from "./owned-php-wasm-coexistence.mjs";

export const ownedPhpWasmScope = {
	profiles: ["php-wasm"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedCli: true, installedNpm: true, installedComposer: true
	, browserCoexistence: true, nativeAndWasmRelease: true, freshRuntime: true
	, primitives: 19, publicExports: 51, callbackSignatures: 27
	, transferredInputs: false, anchoredResults: false, promotedCells: 0
};
export const ownedPhpWasmEvidenceCommands = {
	values: ownedPhpWasmCiCommands[0], layers: ownedPhpWasmCiCommands[1]
	, packages: ownedPhpWasmCiCommands[2]
	, multiDocumentation: "LEAN_BRIDGE_OWNED_PHP_WASM_MULTI_PROFILE_TEST=1 LEAN_BRIDGE_OWNED_PHP_WASM_DOCUMENTATION_TEST=1 node --test --test-concurrency=1 tests/owned-php-wasm-multi-profile.test.mjs tests/owned-php-wasm-documentation.test.mjs"
};
const hash = value => sha256(canonicalJson(value));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const modelSummary = model => ({
	pointerBits: model.pointerBits, schemaVersion: model.schemaVersion
	, bindingIrSha256: model.bindingIrSha256, modelSha256: hash(model)
	, sourceApiSha256: sourceApiIdentity(model.bindingIr, { ownedGraphs: true }).sha256
	, exports: model.exports.map(fn => fn.bindingId)
});

/**
 * Avoid repeating reconstructible models in the frozen execution record.
 *
 * @param name - Select the installed-package or combined-profile projection.
 * @param report - Unmodified JSON written by the enabled execution test.
 */
export const compactOwnedPhpWasmReport = (name, report) => {
	const result = structuredClone(report);
	if(name === "packages") for(const observation of result.observations)
	{
		observation.modelSha256 = hash(observation.model); delete observation.model;
	}
	if(name === "multi") for(const observation of result.observations)
		for(const field of ["nativeModel", "wasmModel"]) observation[field] = modelSummary(observation[field]);
	return result;
};

const snapshot = (state, components) => {
	assert.equal(state.runtimeState, 2); assert.equal(state.runtimeInitRuns, 1);
	assert.equal(state.componentInitRuns, components); assert.equal(state.liveIdentities, 0);
};
const coexistence = run => {
	flags(run, ["callbackAcrossPackages", "requestRecovery"]);
	assert.equal(run.coldCallbackRejections, run.peerMode === "lazy" ? 2 : 0);
	assert.equal(run.libraries.length, 3); assert.equal(new Set(run.libraries).size, 3);
	assert.equal(run.libraries.filter(name => name.startsWith("liblean_bridge_php_wasm_copied_")).length, 1);
	snapshot(run.cleaned, 2); snapshot(run.refreshed, 2);
};
const verifyHandoff = observation => {
	assert.equal(observation.verification.status, "ok");
	assert.equal(observation.verification.result.verificationType, "local-package-set");
	assert.equal(observation.verification.result.receiptSha256, hash(observation.packageSetReceipt));
	assert.equal(observation.verification.result.verified, true);
};
const apiRun = run => {
	assert.deepEqual(run.observed, { checks: 169, phpBits: 32, scalars: 19, structured: 23 });
	assert.equal(run.requestRecovery, true); snapshot(run.cleaned, 1); snapshot(run.refreshed, 1);
};
const browserCases = browser => {
	digest(browser.executableSha256); assert.ok(browser.version);
	assert.deepEqual(browser.executions.map(run => [run.loading, run.mode]),
		["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [loading, mode])));
	for(const run of browser.executions)
	{
		assert.equal(run.realm, "chromium"); assert.ok(run.requests.length > 0);
		for(const request of run.requests)
		{
			assert.ok(!request.path.startsWith("/") && !request.path.split("/").includes(".."));
			assert.ok(Number.isSafeInteger(request.bytes) && request.bytes >= 0); digest(request.sha256);
		}
	}
};
const packageObservation = async observation => {
	flags(observation, ["authorRemoved", "sourceUnchanged"
		, "deterministicReassembly", "independentlyRebuiltExactly"
		, "receiptVerifiedWithoutProducer"]);
	const model = createOwnedPhpWasmModel(observation.inputs), adapters = generateOwnedPhpWasmLeanAdapters(model);
	const generated = generateCompiledPhpWasmOwned(model, observation.inputs.metadata, adapters);
	assert.equal(model.pointerBits, 32); assert.equal(model.schemaVersion, 7);
	assert.equal(model.exports.length, 51);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), observation.reviewed);
	assert.equal(observation.modelSha256, hash(model)); assert.equal(observation.receipt.modelSha256, hash(model));
	assert.equal(observation.receipt.metadataSha256, hash(observation.inputs.metadata));
	assert.equal(observation.receipt.adaptersSha256, sha256(adapters.leanSource));
	assert.equal(observation.receipt.headerSha256, sha256(adapters.header));
	assert.deepEqual(observation.receipt.ownedGraph, generated.receipt);
	assert.equal(observation.packageReceipt.componentIdentity, hash(observation.receipt));
	assert.deepEqual(observation.reproducedArchives, observation.packageReceipt.archives);
	assert.deepEqual(observation.rejected, [...Array(3).fill("php-wasm-component.json"), ...Object.keys(generated.receipt.files).sort()]);
	for(const result of [observation.cliBuild, observation.repeatedCliBuild])
	{ assert.equal(result.status, "ok"); assert.deepEqual(result.result.targets, ["php-wasm"]); }
	verifyHandoff(observation);
	assert.equal(observation.consumerSha256, sha256(await readFile("tests/fixtures/structured-types/owned-php-wasm-installed.php")));
	assert.deepEqual(observation.executions.map(run => [run.arrangement, run.loading, run.strict]),
		["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(loading => [0, 1].map(strict => [arrangement, loading, strict]))));
	for(const run of observation.executions)
	{ apiRun(run); assert.equal(run.invalidStayedCold, true); }
	assert.deepEqual(observation.browser.observations.map(item => item.arrangement), ["embedded", "composer"]);
	for(const browser of observation.browser.observations)
	{
		browserCases(browser);
		for(const run of browser.executions)
		{
			apiRun(run);
			assert.deepEqual(run.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete", "recovered"]);
			assert.deepEqual(run.phases.map(phase => phase.libraries.length), run.loading === "lazy" ? [0, 0, 0, 2, 2] : [2, 2, 2, 2, 2]);
		}
	}
	const shared = observation.coexistence;
	assert.equal(shared.peer.model.ownedGraph, undefined); assert.equal(shared.peer.model.exports.length, 1);
	const choices = ["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(ownedMode =>
		["startup", "lazy"].flatMap(peerMode => ["owned-first", "peer-first"].flatMap(order => [0, 1].map(strict => [arrangement, ownedMode, peerMode, order, strict])))));
	assert.deepEqual(shared.executions.map(run => [run.arrangement, run.ownedMode, run.peerMode, run.order, run.strict]), choices);
	for(const run of shared.executions) coexistence(run);
	assert.equal(shared.browser.programSha256, sha256(ownedPhpWasmCoexistenceProgram));
	assert.deepEqual(shared.browser.observations.map(item => [item.arrangement, item.peerMode, item.order]),
		["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(peerMode => ["owned-first", "peer-first"].map(order => [arrangement, peerMode, order]))));
	for(const browser of shared.browser.observations)
	{
		browserCases(browser);
		for(const run of browser.executions)
		{
			coexistence(run); assert.equal(run.arrangement, browser.arrangement);
			assert.equal(run.peerMode, browser.peerMode); assert.equal(run.order, browser.order);
			assert.equal(run.ownedMode, run.loading); assert.equal(run.strict, run.mode === "strict" ? 1 : 0);
		}
	}
	return model;
};

/**
 * Reject substituted outcomes, missing matrix cases and broadened support claims.
 *
 * @param record - Frozen source-bound integration record.
 */
export const assertOwnedPhpWasmExecution = async record => {
	const repair = record.debuggerRepair;
	assert.deepEqual(repair.ci, { run: 36392672274, job: 108831970965
		, revision: "d0758244f2552b241c18083ac3557516619c55ba" });
	assert.equal(repair.phpVersion, "8.2.33"); assert.equal(repair.xdebugVersion, "3.2.0");
	assert.equal(repair.maxNestingLevel, 256);
	for(const [name, passed, failed] of [["before", 0, 2], ["after", 2, 0]])
	{
		const run = repair[name]; assert.equal(sha256(run.text), run.sha256);
		assert.equal(run.exitCode, failed ? 1 : 0);
		assert.match(run.command, /LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-name-pattern='owned public PHP callbacks' tests\/owned-php-calls\.test\.mjs$/u);
		assert.match(run.command, new RegExp(`^LEAN_BRIDGE_PHP=\\S+/php-${failed ? "develop" : "off"} `, "u"));
		assert.match(run.text, new RegExp(`# tests 2\\n# suites 0\\n# pass ${passed}\\n# fail ${failed}\\n# cancelled 0\\n# skipped 0`, "u"));
	}
	assert.match(repair.before.text, /Xdebug has detected a possible infinite loop/u);
	assert.match(repair.before.text, /256.*frames/u);
	const observations = [...repair.after.text.matchAll(/^# (\{"checks"[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(observations.length, 2);
	for(const observation of observations)
	{
		assert.equal(observation.primitives, 19); assert.equal(observation.scalarCalls, 19);
		assert.equal(observation.reentries, 63); assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
		assert.ok(observation.phpFailures > 0 && observation.nativeFailures > 0);
	}
	assertOwnedPhpCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
	assert.deepEqual(record.scope, ownedPhpWasmScope); assert.equal(record.acceptance, "passed");
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedPhpWasmEvidenceCommands).sort());
	for(const [name, count] of Object.entries({ values: 1, layers: 12, packages: 1, multiDocumentation: 2 }))
	{
		const run = record.runs[name]; assert.equal(run.command, ownedPhpWasmEvidenceCommands[name]);
		assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
		for(const [key, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
		assert.doesNotMatch(run.text, /^not ok|# SKIP/mu);
	}
	const { reports } = record;
	assert.deepEqual(Object.keys(reports).sort(), ["documentation", "fibers", "generated", "generatedReviewed", "lifetime", "multi", "packages", "values"]);
	assert.deepEqual(Object.keys(record.reportFiles).sort(), Object.keys(reports).sort());
	for(const file of Object.values(record.reportFiles))
	{ digest(file.sha256); assert.ok(file.bytes > 0); }
	const packages = reports.packages;
	flags(packages, ["compiledLean", "installedPackage", "cliAdmission"]);
	assert.equal(packages.runtimeSupplied, false); assert.equal(packages.runtimeIdentity, hash(packages.runtimeManifest));
	assert.deepEqual(packages.observations.map(observation => observation.reviewed), [false, true]);
	const models = [];
	for(const observation of packages.observations) models.push(await packageObservation(observation));
	for(const report of [packages, reports.multi, reports.documentation])
	{
		assert.equal(report.runtimeSupplied, false); assert.equal(report.installedCli.packagingSourceRemoved, true);
		assert.equal(report.installedCli.installedFilesVerified, 1593); digest(report.installedCli.archive.sha256);
		assert.equal(report.installedCli.compilerInputsIdentity, packages.installedCli.compilerInputsIdentity);
	}
	assert.deepEqual(reports.multi.observations.map(item => item.reviewed), [false, true]);
	for(const [index, item] of reports.multi.observations.entries())
	{
		flags(item, ["sourceUnchanged", "authorRemoved"]); verifyHandoff(item);
		assert.equal(item.build.status, "ok");
		assert.deepEqual(item.build.result.targets, ["php-native", "php-wasm"]);
		assert.equal(item.build.result.profiles.length, 2);
		for(const [name, bits] of [["nativeModel", 64], ["wasmModel", 32]])
		{
			const model = item[name]; assert.equal(model.pointerBits, bits); assert.equal(model.schemaVersion, 7);
			assert.equal(model.bindingIrSha256, item.nativeModel.bindingIrSha256);
			assert.equal(model.sourceApiSha256, sourceApiIdentity(models[index].bindingIr, { ownedGraphs: true }).sha256);
			assert.equal(model.sourceApiSha256, item.build.result.sourceApiSha256);
			assert.deepEqual(model.exports, models[index].exports.map(fn => fn.bindingId)); digest(model.modelSha256);
		}
		for(const profile of item.build.result.profiles)
			assert.equal(profile.bindingIrSha256, item.nativeModel.bindingIrSha256);
		assert.equal(item.nativeObserved.checks, 241); assert.equal(item.nativeObserved.primitives, 19);
		assert.deepEqual(item.wasmObserved, { checks: 169, phpBits: 32, scalars: 19, structured: 23 });
	}
	const docs = reports.documentation; flags(docs, ["sourceUnchanged", "authorRemoved"]); verifyHandoff(docs);
	assert.deepEqual(docs.observed, { output: "42\n42\n", unmodifiedExample: true });
	for(const [path, heading, language, key] of [
		["publish/php", "Export resource-containing values", "lean", "leanSha256"]
		, ["publish/php", "Export resource-containing values", "json", "configurationSha256"]
		, ["php", "Resource-containing values", "php", "consumerSha256"]
	]) {
		const section = (await readFile("docs/" + path + ".md", "utf8")).split("### " + heading + "\n")[1].split("\n### ")[0];
		const block = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"))[1] + "\n";
		assert.equal(docs[key], sha256(block));
	}
	for(const report of [reports.generated, reports.generatedReviewed])
	{
		assert.equal(report.compiledLean, true); assert.equal(report.installedPackage, false);
		assert.equal(report.inputs.wordBits, 32); assert.equal(report.inputs.hostCallbacks, true);
		const generated = generateOwnedPhpZendExtension(generateOwnedNativeValueAdapters(report.inputs));
		assert.equal(generated.model.functions.length, 51); assert.equal(generated.model.callbacks.length, 27);
		assert.equal(report.sourceSha256, sha256(generated.source));
		assert.equal(report.files["extension.c"], sha256(ownedZendGeneratedProbe(generated.source, generated.model)));
		assert.equal(report.observations.length, 2);
		for(const item of report.observations)
		{
			assert.equal(item.checks, 1349); assert.equal(item.primitives, 19);
			assert.equal(item.nativeFailures, 266); assert.equal(item.phpBits, 32);
			assert.equal(item.live, 0); assert.equal(item.identities, 0);
		}
		assert.equal(report.bailouts.length, 16); assert.equal(report.malformed.length, 9);
		for(const item of [...report.bailouts, ...report.malformed])
		{ assert.equal(item.after.live, 0); assert.equal(item.after.identities, 0); assert.equal(item.after.current, false); }
	}
	for(const [report, fiber, bits, count] of [[reports.lifetime, false, 32, 403], [reports.fibers, true, 64, 417]])
	{
		assert.equal(report.observations.length, 2);
		for(const item of report.observations)
		{
			assert.equal(item.checks, count); assert.equal(item.fiberExecution, fiber);
			assert.equal(item.stats.phpBits, bits); assert.equal(item.stats.live, 0); assert.equal(item.stats.identities, 0);
		}
	}
	assert.deepEqual(reports.fibers.rejectedMutations, ["early-context-release", "late-borrow-expiry", "missing-fiber-guard", "lost-original-exception"]);
	assert.equal(reports.lifetime.bailouts.length, 14);
	assert.deepEqual(reports.values.observations.map(item => item.mode), ["weak", "strict"]);
	for(const { observation } of reports.values.observations)
	{ assert.equal(observation.actualPhpBits, 32); assert.equal(observation.checks, 235); assert.equal(observation.compiledLean, false); }
	assertOwnedPhpWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
