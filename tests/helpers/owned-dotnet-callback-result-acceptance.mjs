/**
 * Verify complete .NET callback acceptance without rewriting earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedDotnetCallbackRuntime } from "./owned-dotnet-callback-result-evidence.mjs";
import { assertOwnedDotnetCallbackPackageExecution } from "./owned-dotnet-callback-result-package-execution.mjs";
import { assertOwnedDotnetCallbackCombinedRelease } from "./owned-dotnet-callback-result-combined-evidence.mjs";
import { assertOwnedDotnetCallbackResultCi, ownedDotnetCallbackResultReports } from "./owned-dotnet-callback-result-ci.mjs";
import { ownedDotnetCallbackBaseline, ownedDotnetCallbackChangedPaths
	, ownedDotnetCallbackHistoryPath, ownedDotnetCallbackHistorySha256 } from "./owned-dotnet-callback-result-history.mjs";

export const ownedDotnetCallbackEvidencePath = "docs/evidence/owned-dotnet-callback-results-20261002.json";
export const ownedDotnetCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-ruby-callback-results-20261002.json"
	, sha256: "98dc9ff11d551834ab251cb0b033af73a358e8a5fdc96e9ffc2bf93ee2f36f18"
});
export const ownedDotnetCallbackScope = Object.freeze({
	profiles: ["dotnet"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, originalArgumentOwners: true, transitiveExpiration: true
	, emptyRecursiveValues: true, independentRetains: true
	, hostRawAndWholeReplies: true, hostReplyBeforeFrameExpiration: true
	, nativeClosureIdentity: true, higherOrderCallbacks: true
	, mixedCallbackOverloads: true, combinedReceiverAndTransferPackages: true
	, explicitNoHostPackage: true, compiledLean: true, installedNuget: true
	, offlineInstall: true, sourceFreeConsumption: true, sdkFreeRelocation: true
	, independentProducerBuilds: true, deterministicReassembly: true
	, typedConsumerRejections: { noHost: 8, combined: 12 }
	, installedChecks: { noHost: 21, combined: 57 }
	, installedForkGuards: true, installedRetirementGuards: true
	, installedHostAndTransferRetirement: true, threadExitCleanup: true
	, optimizedGcSchedules: true, concurrentWholeClose: true
	, allocationFaultsBeforeAndAfterTransfer: true, compiledSemanticMutants: true
	, nativeSanitizers: ["address", "undefined"], positiveDetectorControls: true
	, leakSanitizer: false, leanRuntimeInstrumented: false
	, nativeLeakChecks: "allocation-and-identity-ledgers"
	, combinedProfiles: ["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "npm"]
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, modelVersion: 11, ownedGraphVersion: 6, dotnetContractVersion: 5
	, nugetReceiptVersion: 5, callbackInputTransfers: false
	, retainedHostCallbacks: false, asynchronousDelivery: false
	, docker: false, installedSupportPromotions: 0
});
const addedPaths = [
	ownedDotnetCallbackHistoryPath
	, "src/backends/dotnet/owned-callback-arguments.mjs"
	, "tests/helpers/owned-callback-combined-release.mjs"
	, ...["acceptance", "authenticity", "ci", "combined-evidence", "combined-install", "evidence", "fixture", "guards", "history", "installed", "installed-process", "package-evidence", "package-execution", "probes", "sanitizers"].map(name => `tests/helpers/owned-dotnet-callback-result-${name}.mjs`)
	, ...["results", "lifetime", "process", "sanitizers", "runtime-evidence", "package-evidence", "combined-evidence", "result-ci", "result-history", "result-packaging", "result-combined-packaging"].map(name => `tests/owned-dotnet-callback-${name}.test.mjs`)
	, ...["results", "combined-results", "host-results", "lifetimes", "host-lifetimes", "transfer-lifetimes", "process"].map(name => `tests/fixtures/structured-types/owned-dotnet-callback-${name}.cs`)
	, ...["results", "replies"].map(name => `tests/fixtures/documentation/consumers/dotnet/owned-callback-${name}.cs`)
];

/** Preserve every predecessor source and add the .NET compiler and probes. */
export const ownedDotnetCallbackSourcePaths = async () => {
	const bytes = await readFile(ownedDotnetCallbackPrevious.path);
	assert.equal(sha256(bytes), ownedDotnetCallbackPrevious.sha256);
	return [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedDotnetCallbackChangedPaths, ...addedPaths])].sort();
};

export const ownedDotnetCallbackRuns = Object.freeze([
	{ name: "composition", tests: 7 }
	, { name: "lifetime", tests: 6 }, { name: "process", tests: 4 }
	, { name: "sanitizers", tests: 4 }
	, { name: "installed-ordinary-combined", tests: 1 }
	, { name: "installed-remaining", tests: 3 }
	, { name: "combined-release", tests: 1 }
]);
const passed = (run, tests) => {
	assert.equal(run.exitCode, 0); assert.equal(run.sha256, sha256(run.text));
	for(const [key, count] of Object.entries({ tests, pass: tests, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
};

/**
 * Authenticate one original report using its source path and real observations.
 *
 * @param path - Required report path.
 * @param item - Reconstructed original JSON report.
 */
export const assertOwnedDotnetCallbackReport = async (path, item) => {
	assert.ok(ownedDotnetCallbackResultReports.includes(path), path);
	const name = path.split("/").at(-1);
	assert.equal(item.mode, name.startsWith("ordinary-") ? "ordinary" : "reviewed");
	if(name.endsWith("-combined-release.json")) return assertOwnedDotnetCallbackCombinedRelease(item);
	if(name.endsWith("-package.json"))
	{
		assert.equal(item.combined, name.includes("-combined-"));
		return assertOwnedDotnetCallbackPackageExecution(item);
	}
	return assertOwnedDotnetCallbackRuntime(name, item);
};

/**
 * Require 26 executed tests, eight verifier tests and all unchanged originals.
 *
 * @param record - Frozen acceptance after all execution finishes successfully.
 */
export const assertOwnedDotnetCallbackAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-dotnet-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedDotnetCallbackBaseline);
	assert.deepEqual(record.previous, ownedDotnetCallbackPrevious);
	assert.deepEqual(record.scope, ownedDotnetCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: ownedDotnetCallbackHistoryPath, sha256: ownedDotnetCallbackHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedDotnetCallbackSourcePaths());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.runs.map(({ name, tests }) => ({ name, tests })), ownedDotnetCallbackRuns);
	for(const run of record.runs) passed(run, run.tests);
	assert.equal(record.verification.command, "npm run test:owned-dotnet-callback-evidence");
	passed(record.verification, 8);
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(Object.keys(reports).sort(), [...ownedDotnetCallbackResultReports].sort());
	for(const [path, item] of Object.entries(reports)) await assertOwnedDotnetCallbackReport(path, item);
	assertOwnedDotnetCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
