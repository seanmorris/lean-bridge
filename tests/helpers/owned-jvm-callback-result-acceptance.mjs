/**
 * Authenticate complete JVM callback acceptance without rewriting predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedJvmCallbackRuntime } from "./owned-jvm-callback-result-runtime-evidence.mjs";
import { assertOwnedJvmCallbackPackageExecution } from "./owned-jvm-callback-result-package-evidence.mjs";
import { assertOwnedJvmCallbackLifetimeEvidence } from "./owned-jvm-callback-result-lifetime-evidence.mjs";
import { assertOwnedJvmCallbackCombinedRelease } from "./owned-jvm-callback-result-combined-evidence.mjs";
import { assertOwnedJvmCallbackResultCi, ownedJvmCallbackResultReports } from "./owned-jvm-callback-result-ci.mjs";
import { ownedJvmCallbackBaseline, ownedJvmCallbackChangedPaths
	, ownedJvmCallbackHistoryPath, ownedJvmCallbackHistorySha256 } from "./owned-jvm-callback-result-history.mjs";

const frozen = value => {
	for(const child of Object.values(value)) if(child && typeof child === "object") frozen(child);
	return Object.freeze(value);
};
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());

export const ownedJvmCallbackEvidencePath = "docs/evidence/owned-jvm-callback-results-20261003.json";
export const ownedJvmCallbackPrevious = frozen({
	path: "docs/evidence/owned-dotnet-callback-results-20261002.json"
	, sha256: "7e1f8db50586d487923415a199c6680f00d4c80346e8c6f27900f8616b68e764"
});
export const ownedJvmCallbackScope = frozen({
	profiles: ["java", "kotlin"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, callbackLocalAnchors: true, originalArgumentOwners: true
	, transitiveExpiration: true, emptyRecursiveValues: true
	, independentRetains: true
	, hostRawAndWholeReplies: true, hostReplyBeforeFrameExpiration: true
	, wholeRecoveryPreflightBeforeTransfer: true, nativeClosureIdentity: true
	, higherOrderCallbacks: true, mixedCallbackOverloads: true
	, explicitNoHostPackage: true, combinedReceiverAndTransferPackages: true
	, compiledLean: true, installedMaven: true
	, producerInterfaces: { noHost: "native-build-api", combined: "installed-cli" }
	, offlineInstall: true, sourceFreeConsumption: true
	, compilerFreeRelocation: true
	, independentProducerBuilds: true, deterministicReassembly: true
	, installedChecksPerLanguage: { noHost: 22, combined: 47 }
	, typedConsumerRejectionsPerLanguage: { noHost: 2, combined: 3 }
	, installedRuntimeOnlyRunsPerLanguage: 2, installedAssetTamperCases: 40
	, installedDocumentationExamplesPerLanguage: { noHost: 2, combined: 3 }
	, installedThreadExamples: true, installedInstrumentedThreadExit: false
	, directRuntimeConfigurations: 6
	, directSemanticMutants: { profiles: ["java"], cases: 16, restoredRuns: 6 }
	, optimizedGc: { profiles: ["java", "kotlin"], configurations: 2
		, compiler: "c2", methodsPerConfiguration: 12, semanticMutants: 4
		, originalOwnerCollection: true, temporaryWholeReplyRooting: true
		, restoredRuns: 2, installedPackage: false }
	, allocationFaults: { configurations: 2, casesPerConfiguration: 8
		, injectionsPerConfiguration: 1590, checksPerConfiguration: 11263
		, domains: ["managed-checkpoints", "native-allocations"]
		, beforeAndAfterTransfer: true, explicitCleanupWithoutGc: true }
	, directProcess: { configurations: 4, nativeThreadExit: true
		, stronglyReachableOwners: true, runtimeRetirementDuringCallback: true
		, rawAndWholeReplies: true, installedMaven: false, fork: false }
	, nativeSanitizers: ["address", "undefined"], positiveDetectorControls: true
	, sanitizerConfigurations: 4, leakSanitizer: false
	, leanRuntimeInstrumented: false, jvmInstrumented: false
	, nativeLeakChecks: "allocation-and-identity-ledgers"
	, combinedProfiles: ["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "maven", "npm"]
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, modelVersion: 11, ownedGraphVersion: 6, jvmContractVersion: 5
	, mavenReceiptVersion: 5, callbackInputTransfers: false
	, retainedHostCallbacks: false, asynchronousDelivery: false
	, installedForkGuards: false, installedRetirementGuards: false
	, docker: false, installedSupportPromotions: 0
});

// Complete added-file inventory from 72d123d..e8186d2, plus this verifier and
// its acceptance test. Do not include the receipt whose sources these bind.
const addedPaths = [
	ownedJvmCallbackHistoryPath
	, "docs/evidence/owned-jvm-callback-results-20261002.md"
	, "scripts/update-owned-jvm-callback-history.mjs"
	, "scripts/record-owned-jvm-callback-results.mjs"
	, "src/backends/jvm/owned-callback-arguments.mjs"
	, "tests/fixtures/documentation/consumers/java/OwnedCallbackReplyExample.java"
	, "tests/fixtures/documentation/consumers/java/OwnedCallbackResultExample.java"
	, "tests/fixtures/documentation/consumers/java/OwnedCallbackThreadExample.java"
	, "tests/fixtures/documentation/consumers/kotlin/OwnedCallbackReplyExample.kt"
	, "tests/fixtures/documentation/consumers/kotlin/OwnedCallbackResultExample.kt"
	, "tests/fixtures/documentation/consumers/kotlin/OwnedCallbackThreadExample.kt"
	, "tests/fixtures/structured-types/owned-jvm-callback-result-faults.java"
	, "tests/fixtures/structured-types/owned-jvm-callback-result-gc.java"
	, "tests/fixtures/structured-types/owned-kotlin-callback-result-faults.kt"
	, "tests/fixtures/structured-types/owned-kotlin-callback-result-gc.kt"
	, "tests/helpers/owned-jvm-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-jvm-callback-result-acceptance.mjs"
	, "tests/helpers/owned-jvm-callback-result-ci.mjs"
	, "tests/helpers/owned-jvm-callback-result-combined-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-combined-install.mjs"
	, "tests/helpers/owned-jvm-callback-result-examples.mjs"
	, "tests/helpers/owned-jvm-callback-result-history.mjs"
	, "tests/helpers/owned-jvm-callback-result-installed.mjs"
	, "tests/helpers/owned-jvm-callback-result-lifetime-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-process.mjs"
	, "tests/helpers/owned-jvm-callback-result-runtime-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-runtime.mjs"
	, "tests/helpers/owned-jvm-callback-result-sanitizers.mjs"
	, "tests/owned-jvm-callback-mixed-signatures.test.mjs"
	, "tests/owned-jvm-callback-result-ci.test.mjs"
	, "tests/owned-jvm-callback-result-combined-evidence.test.mjs"
	, "tests/owned-jvm-callback-result-combined-packaging.test.mjs"
	, "tests/owned-jvm-callback-result-faults.test.mjs"
	, "tests/owned-jvm-callback-result-gc.test.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
	, "tests/owned-jvm-callback-result-lifetime-evidence.test.mjs"
	, "tests/owned-jvm-callback-result-package-evidence.test.mjs"
	, "tests/owned-jvm-callback-result-packaging.test.mjs"
	, "tests/owned-jvm-callback-result-process.test.mjs"
	, "tests/owned-jvm-callback-result-runtime-evidence.test.mjs"
	, "tests/owned-jvm-callback-result-sanitizers.test.mjs"
	, "tests/owned-jvm-callback-results.test.mjs"
];

/** Preserve all predecessor source coverage and require every new JVM input. */
export const ownedJvmCallbackSourcePaths = async () => {
	const bytes = await readFile(ownedJvmCallbackPrevious.path);
	assert.equal(sha256(bytes), ownedJvmCallbackPrevious.sha256);
	const paths = [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedJvmCallbackChangedPaths, ...addedPaths])].sort();
	assert.ok(!paths.includes(ownedJvmCallbackEvidencePath));
	return paths;
};

export const ownedJvmCallbackRuns = frozen([
	{ name: "direct", tests: 7 }, { name: "mixed", tests: 4 }
	, { name: "lifetime", tests: 8 }, { name: "sanitizers", tests: 4 }
	, { name: "installed", tests: 4 }, { name: "combined-release", tests: 1 }
]);
const modes = ["ordinary", "reviewed"], variants = ["no-host", "combined"];
const runTitles = frozen({
	direct: ["JVM callback-result owners require capability and retain native closure identity"
		, ...modes.flatMap(mode => ["host", ...variants].map(variant =>
			`Java/Kotlin callback-result ownership (${mode}, ${variant})`))]
	, mixed: ["native", "host"].flatMap((kind, index) => [
		`JVM mixed callback signatures select ${kind} inner arguments`
		, `public JVM mixed callback signatures compile (${index ? "host" : "no-host"})`
	])
	, lifetime: [
		...modes.map(mode => `JVM callback-result allocation faults preserve owners (${mode})`)
		, ...modes.map(mode => `optimized JVM callback-result GC (${mode})`)
		, ...modes.flatMap(mode => [
			`JVM callback-result creator threads (${mode}, no-host)`
			, `JVM callback-result creator threads and runtime retirement (${mode}, combined)`
		])
	]
	, sanitizers: modes.flatMap(mode => variants.map(variant =>
		`JVM callback native sanitizers (${mode}, ${variant})`))
	, installed: modes.flatMap(mode => variants.map(variant =>
		`installed Maven callback-result owners (${mode}, ${variant})`))
	, "combined-release": ["installed Maven and C/C++/Cargo/PyPI/RubyGems/NuGet/npm archives share callback-result contracts"]
	, verification: [
		...modes.map(mode => `eight-target callback release reconstructs ${mode} inputs and execution`)
		, "JVM callback lifetime reports reconstruct inputs and reject forged execution evidence"
		, "JVM callback package reports reconstruct all native and managed contracts"
		, ...modes.flatMap(mode => variants.map(variant =>
			`installed JVM callback execution reconstructs ${mode} ${variant}`))
		, "JVM callback runtime evidence reconstructs all six original source-bound executions"
		, "JVM callback runtime evidence rejects forged sources, diagnostics and restoration"
	]
});
const passed = (run, tests, titles) => {
	assert.equal(titles.length, tests);
	assert.equal(run.exitCode, 0); assert.equal(typeof run.text, "string");
	assert.equal(run.sha256, sha256(run.text));
	for(const [key, count] of Object.entries({ tests, pass: tests, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual(run.text.match(new RegExp("^# " + key + " [0-9]+$", "gmu")), ["# " + key + " " + count]);
	assert.deepEqual(run.text.match(/^1\.\.[0-9]+$/gmu), ["1.." + tests]);
	assert.deepEqual(run.text.match(/^# Subtest: .*$/gmu), titles.map(title => "# Subtest: " + title));
	assert.deepEqual(run.text.match(/^ok [0-9]+ - .*$/gmu), titles.map((title, index) => `ok ${index + 1} - ${title}`));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
};

/**
 * Dispatch only inventoried original reports to their exact source-bound reader.
 *
 * @param path - Required complete report path from the CI inventory.
 * @param item - Original unpacked producer JSON, not a synthesized summary.
 */
export const assertOwnedJvmCallbackReport = async (path, item) => {
	assert.ok(ownedJvmCallbackResultReports.includes(path), path);
	const name = path.split("/").at(-1);
	assert.equal(item.mode, name.startsWith("ordinary") ? "ordinary" : "reviewed");
	if(name.endsWith("-combined-release.json")) return assertOwnedJvmCallbackCombinedRelease(item);
	if(name.endsWith("-package.json"))
	{
		assert.equal(item.combined, name.includes("-combined-"));
		return assertOwnedJvmCallbackPackageExecution(item);
	}
	if(name.endsWith("-runtime.json")) return assertOwnedJvmCallbackRuntime(name, item);
	const kind = path.startsWith("build/owned-jvm-callback-result-gc/") ? "gc"
		: path.startsWith("build/owned-jvm-callback-result-faults/") ? "faults"
			: name.endsWith("-process.json") ? "process" : "sanitizers";
	return assertOwnedJvmCallbackLifetimeEvidence(kind, name, item);
};

/**
 * Require all 28 executions, ten verifier tests and 24 original packed reports.
 *
 * @param record - Completed frozen acceptance with exact current source hashes.
 */
export const assertOwnedJvmCallbackAcceptance = async record => {
	keys(record, "schemaVersion kind planNode acceptance baselineRevision previous scope sourceHistory sources runs verification archive");
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-jvm-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedJvmCallbackBaseline);
	assert.deepEqual(record.previous, ownedJvmCallbackPrevious);
	assert.deepEqual(record.scope, ownedJvmCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: ownedJvmCallbackHistoryPath, sha256: ownedJvmCallbackHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedJvmCallbackSourcePaths());
	for(const [path, digest] of Object.entries(record.sources))
		assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.runs.map(({ name, tests }) => ({ name, tests })), ownedJvmCallbackRuns);
	for(const run of record.runs)
	{
		keys(run, "name tests exitCode sha256 text"); passed(run, run.tests, runTitles[run.name]);
	}
	keys(record.verification, "command exitCode sha256 text");
	assert.equal(record.verification.command, "npm run test:owned-jvm-callback-evidence");
	passed(record.verification, 10, runTitles.verification);
	keys(record.archive, "format nodes reports");
	for(const entry of Object.values(record.archive.reports)) keys(entry, "bytes sha256 data");
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.equal(Object.keys(reports).length, 24);
	assert.deepEqual(Object.keys(reports).sort(), [...ownedJvmCallbackResultReports].sort());
	for(const [path, item] of Object.entries(reports)) await assertOwnedJvmCallbackReport(path, item);
	assertOwnedJvmCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
