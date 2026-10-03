/**
 * Authenticate the installed PHP-Wasm callback-result ownership matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../../src/build/php-wasm-owned-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";

export const ownedPhpWasmCallbackResultEvidencePath = "docs/evidence/owned-php-wasm-callback-results-20261003.json";
export const ownedPhpWasmCallbackResultCommand = "LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=$PWD/build/type-corpus/php-wasm-current-runtime npm run test:owned-php-wasm-callback-results";
export const ownedPhpWasmCallbackResultVariants = Object.freeze({
	"no-host": Object.freeze({ checks: 102, rejected: 20, phases: Object.freeze({ native: 65, nativeOrder: 4, noHost: 20, surface: 12 }) })
	, host: Object.freeze({ checks: 127, rejected: 21, phases: Object.freeze({ host: 33, hostOrder: 12, native: 65, nativeOrder: 4, surface: 12 }) })
	, combined: Object.freeze({ checks: 189, rejected: 38, phases: Object.freeze({ combined: 42, host: 33, hostOrder: 12, native: 65, nativeOrder: 4, surface: 12, transferOrder: 20 }) })
});
export const ownedPhpWasmCallbackResultScope = Object.freeze({
	profiles: ["php-wasm"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, variants: ["no-host", "host", "combined"]
	, compiledLean: true
	, installedCli: true
	, installedNpm: true
	, installedComposer: true
	, nodeExecutions: 48
	, chromiumExecutions: 48
	, loadingModes: ["startup", "lazy"]
	, callerModes: ["weak", "strict"]
	, callbackResultAnchors: true
	, wholeHostReplies: true
	, returnedLeanClosures: true
	, callbackLocalBorrows: true
	, explicitCopyArg: true
	, explicitCopyResult: true
	, requestRecovery: true
	, sourceFreeInstallation: true
	, offlineInstall: true
	, deterministicReassembly: true
	, independentRebuild: true
	, receiptForgeryRejection: true
	, pointerBits: 32, browserFibers: false, asynchronousCallbacks: false
});

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const snapshot = value => {
	assert.equal(value.runtimeState, 2); assert.equal(value.runtimeInitRuns, 1);
	assert.equal(value.componentInitRuns, 1); assert.equal(value.liveIdentities, 0);
};

/**
 * Pack exact JSON reports without committing multi-megabyte expanded records.
 *
 * @param reports - Exact report bytes keyed by filename.
 */
export const packOwnedPhpWasmCallbackResultReports = reports => Object.fromEntries(Object.entries(reports).map(([name, value]) => {
	const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
	return [name, { bytes: bytes.length, sha256: sha256(bytes), gzipBase64: gzipSync(bytes, { level: 9 }).toString("base64") }];
}));

/**
 * Recover and authenticate every exact installed report.
 *
 * @param archive - Compressed report entries keyed by filename.
 */
export const unpackOwnedPhpWasmCallbackResultReports = archive => Object.fromEntries(Object.entries(archive).map(([name, item]) => {
	assert.deepEqual(Object.keys(item).sort(), ["bytes", "gzipBase64", "sha256"]);
	digest(item.sha256); const bytes = gunzipSync(Buffer.from(item.gzipBase64, "base64"));
	assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
	return [name, JSON.parse(bytes)];
}));

const checkExecution = (run, expected, browser = false) => {
	assert.equal(run.observed.checks, expected.checks); assert.equal(run.observed.variant, expected.variant);
	assert.equal(run.observed.actualLean, true); assert.equal(run.observed.installedPackage, true);
	assert.equal(run.observed.ordinaryAutoload, true); assert.equal(run.observed.phpBits, 32);
	assert.equal(run.observed.iniDisabled, false); assert.deepEqual(run.observed.phases, expected.phases);
	assert.equal(run.requestRecovery, true); snapshot(run.cleaned); snapshot(run.refreshed);
	if(browser)
	{
		assert.equal(run.realm, "chromium"); assert.ok(run.requests.length > 0);
	}
};

const checkObservation = (item, variant, expected, runtimeIdentity) => {
	flags(item, ["sourceUnchanged"
		, "sourceFreeInstallation"
		, "authorRemoved"
		, "handoffRemoved"
		, "deterministicReassembly"
		, "receiptVerifiedWithoutProducer"
		, "independentlyRebuiltExactly"]);
	assert.equal(Boolean(item.inputs.sourceIdentity.reviewedBindingIr), item.reviewed);
	const combined = variant === "combined";
	const options = { callbackResultAnchors: true
		, hostCallbacks: variant !== "no-host"
		, transferredInputs: combined
		, anchoredResults: combined
		, receiverExports: combined };
	const model = createCompiledPhpWasmModel({ ...item.inputs, ...options });
	assert.deepEqual(item.model, model); assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.pointerBits, 32); assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), variant !== "no-host");
	assert.equal(model.ownedGraph.inputTransfers?.exports.length ?? 0, combined ? 2 : 0);
	assert.equal(model.ownedGraph.resultAnchors?.exports.length ?? 0, combined ? 1 : 0);
	assert.equal(model.ownedGraph.receiverExports?.exports.length ?? 0, combined ? 5 : 0);
	const generated = generateCompiledPhpWasmOwned(model, item.inputs.metadata, generateCompiledPhpWasmLeanAdapters(model));
	assert.deepEqual(item.receipt.ownedGraph, generated.receipt);
	assert.equal(item.receipt.runtimeIdentity, runtimeIdentity); assert.equal(item.packageReceipt.runtimeIdentity, runtimeIdentity);
	assert.equal(item.packageReceipt.componentIdentity, sha256(canonicalJson(item.receipt)));
	assert.deepEqual(item.reproducedArchives, item.packageReceipt.archives);
	assert.equal(item.rejected.length, expected.rejected);
	for(const path of item.rejected) assert.equal(typeof path, "string");
	digest(item.consumerSha256); digest(item.runnerSha256); digest(item.observer.binarySha256);
	assert.equal(item.observer.runtimeIdentity, runtimeIdentity); assert.equal(item.observer.testOnly, true);
	assert.deepEqual(item.executions.map(run => [run.arrangement, run.loading, run.strict]),
		["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(loading => [0, 1].map(strict => [arrangement, loading, strict]))));
	for(const run of item.executions) checkExecution(run, { ...expected, variant });
	assert.deepEqual(item.browser.observations.map(run => run.arrangement), ["embedded", "composer"]);
	for(const group of item.browser.observations)
	{
		assert.deepEqual(group.executions.map(run => [run.loading, run.mode]),
			["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [loading, mode])));
		for(const run of group.executions) checkExecution(run, { ...expected, variant }, true);
	}
};

/**
 * Reconstruct every generated byte and installed execution represented by the record.
 *
 * @param record - Frozen execution evidence and bound source identities.
 */
export const assertOwnedPhpWasmCallbackResultEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-wasm-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, ownedPhpWasmCallbackResultScope);
	assert.equal(record.command, ownedPhpWasmCallbackResultCommand);
	for(const [path, value] of Object.entries(record.sources))
	{ digest(value); assert.equal(sha256(await readFile(path)), value, path); }
	const reports = unpackOwnedPhpWasmCallbackResultReports(record.reports);
	assert.deepEqual(Object.keys(reports), Object.keys(ownedPhpWasmCallbackResultVariants).map(name => `${name}-packages.json`));
	let runtimeIdentity;
	for(const [name, expected] of Object.entries(ownedPhpWasmCallbackResultVariants))
	{
		const report = reports[`${name}-packages.json`];
		assert.equal(report.schemaVersion, 1); assert.equal(report.profile, "installed-owned-php-wasm-callback-results");
		flags(report, ["compiledLean", "installedPackage", "cliAdmission", "runtimeSupplied"]);
		runtimeIdentity ??= report.runtimeIdentity; assert.equal(report.runtimeIdentity, runtimeIdentity); digest(runtimeIdentity);
		assert.equal(report.runtimeIdentity, sha256(canonicalJson(report.runtimeManifest)));
		assert.deepEqual(report.runtimeManifest.pins, phpWasmCopiedPins); assert.equal(report.runtimeManifest.pointerBits, 32);
		assert.equal(report.installedCli.packagingSourceRemoved, true); assert.equal(report.observations.length, 2);
		assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
		for(const item of report.observations) checkObservation(item, name, expected, runtimeIdentity);
	}
	assert.equal(record.runtimeIdentity, runtimeIdentity);
};
