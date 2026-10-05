/**
 * Reconstruct original Ruby callback-owner packages and their shared releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertOwnedRubyCallbackRuntime } from "./owned-ruby-callback-result-evidence.mjs";
import { assertOwnedRubyCallbackPackage, assertOwnedRubyCallbackPackageInputs } from "./owned-ruby-callback-result-package-evidence.mjs";
import { assertOwnedPythonCallbackCombinedRelease } from "./owned-python-callback-result-acceptance.mjs";
import { ownedRubyCallbackInstalledProbe } from "./owned-ruby-callback-result-installed.mjs";
import { assertOwnedRubyCallbackResultCi, ownedRubyCallbackResultReports } from "./owned-ruby-callback-result-ci.mjs";
import { ownedRubyCallbackBaseline, ownedRubyCallbackChangedPaths
	, ownedRubyCallbackHistoryPath, ownedRubyCallbackHistorySha256 } from "./owned-ruby-callback-result-history.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { beforeOwnedDotnetCallbackResults } from "./owned-dotnet-callback-result-history.mjs";

export const ownedRubyCallbackEvidencePath = "docs/evidence/owned-ruby-callback-results-20261002.json";
export const ownedRubyCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-python-callback-results-20261002.json"
	, sha256: "bacc96203e87a436bca197d4cf8a34b51780a8fee0a4f2e74500429a6aa5e471"
});
export const ownedRubyCallbackScope = Object.freeze({
	profiles: ["ruby"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, callbackLocalAnchors: true, originalArgumentOwners: true
	, transitiveExpiration: true, emptyRecursiveValues: true
	, independentRetains: true, hostReplyBeforeFrameExpiration: true
	, hostRawAndWholeReplies: true, nativeClosureInputs: true
	, combinedReceiverAndTransferPackages: true, explicitNoHostPackage: true
	, compiledLean: true, installedCli: true, sourceFreeConsumption: true
	, offlineGems: true, automaticSharedLoader: true, privateGmp: true
	, relocatedExecution: true, deterministicArchives: true
	, ruby: "3.3", garbageCollection: true, boundedAncestry: true
	, threadAndForkAffinity: true, exitedThreadCollected: true
	, concurrentCloseSchedules: ["get", "retain", "dup", "clone"]
	, nonlocalExits: true, asynchronousInterruptionCleanup: true
	, allocationFaultsBeforeAndAfterTransfer: true
	, semanticMutants: { noHost: 6, host: 10, combined: 10 }
	, nativeSanitizers: ["address", "undefined"]
	, sanitizerDetectors: ["address", "undefined", "leak"]
	, dynamicTlsRoots: true, clearedTlsLeakDetection: true
	, coldLeakBaseline: true, leakCheckpoint: "after-interpreter-shutdown"
	, completeColdAndExercisedLeakReports: true
	, combinedProfiles: ["c", "cpp", "cargo", "pypi", "rubygems", "npm"]
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, installedNoHostChecks: 173, installedCombinedChecks: 206
	, modelVersion: 11, ownedGraphVersion: 6, rubyContractVersion: 5
	, gemReceiptVersion: 5
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, docker: false, installedSupportPromotions: 0
});
const addedPaths = [
	ownedRubyCallbackHistoryPath
	, ...["ci", "evidence", "acceptance", "history", "fixture", "mutations", "report-mutations", "installed", "native", "sanitizers", "package-evidence", "combined-install"].map(name => `tests/helpers/owned-ruby-callback-result-${name}.mjs`)
	, ...["ci", "evidence", "history", "runtime", "packaging", "combined-packaging"].map(name => `tests/owned-ruby-callback-result-${name}.test.mjs`)
	, "tests/owned-ruby-callback-results.test.mjs"
	, "tests/fixtures/structured-types/owned-ruby-callback-results.rb"
	, "tests/fixtures/structured-types/owned-installed-ruby-callback-results.rb"
	, "tests/fixtures/structured-types/owned-ruby-probe.rb"
	, "tests/fixtures/structured-types/owned-ruby-installed-loader.rb"
	, "tests/fixtures/documentation/consumers/ruby/owned-callback-results.rb"
	, "tests/helpers/owned-ruby-callback-generated-history.mjs"
	, "docs/evidence/ruby-callback-sanitizer-runtime-20261002.md"
];
/** Preserve predecessor coverage and include all Ruby acceptance inputs. */
export const ownedRubyCallbackSourcePaths = async () => {
	const bytes = await readFile(ownedRubyCallbackPrevious.path);
	assert.equal(sha256(bytes), ownedRubyCallbackPrevious.sha256);
	return [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedRubyCallbackChangedPaths, ...addedPaths])].sort();
};
const flags = (item, names) => { for(const name of names) assert.equal(item[name], true, name); };
/**
 * Reconstruct all installed peers, including Ruby's original native libraries.
 *
 * @param item - Executed multi-ecosystem release.
 * @param mode - Ordinary or reviewed source admission.
 * @param additionalTargets - Extra peers checked by the caller.
 * @param fixture - Explicit source and counts for an extended shared fixture.
 */
export const assertOwnedRubyCallbackCombinedRelease = async (item, mode, additionalTargets = [], fixture = null) => {
	await assertOwnedPythonCallbackCombinedRelease(item, mode, ["rubygems", ...additionalTargets], fixture);
	validatePackageSetReceipt(item.receipt);
	const ruby = item.installedRuby;
	await assertOwnedRubyCallbackPackageInputs({ mode, combined: true
		, metadata: item.nativeInput.metadata, model: item.native.model
		, componentReceipt: item.native.receipt, adapter: item.rubyAdapter
		, runtime: item.nativeRuntime, manifest: ruby.manifest }, fixture);
	assert.equal(ruby.checks, 206); assert.equal(ruby.relocatedChecks, 206);
	flags(ruby, ["sourceFreeInstallation", "cliRemovedBeforeConsumerInstall"
		, "offlineInstall", "sourceFreeRelocatedExecution"
		, "handoffRemovedBeforeRelocatedExecution", "gemCacheRemoved"]);
	assert.equal(ruby.consumerSha256, sha256(await ownedRubyCallbackInstalledProbe(true)));
	assert.equal(ruby.loaderProbeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb")));
	assert.deepEqual(ruby.observation, { checks: 206, ordinaryRequire: true
		, scenarios: ["original_owners", "independent_closures", "native_passback"
			, "recursive_owners", "affinity", "host_replies", "combined_transfers"] });
	assert.deepEqual(ruby.loader.consumer, ruby.observation);
	assert.equal(ruby.loader.liveIdentities, 0); assert.equal(ruby.loader.runtimeInitializations, 1);
	assert.equal(ruby.loader.componentInitializations, 1); assert.equal(ruby.loader.concurrentRequires, 4);
	flags(ruby.loader, ["privateGmp", "forkBeforeLock"]);
	const example = await readFile("tests/fixtures/documentation/consumers/ruby/owned-callback-results.rb", "utf8");
	assert.equal((await readFile("docs/consume/ruby.md", "utf8")).match(/```ruby file=ruby\/owned-callback-results\.rb\n([\s\S]*?)```/u)?.[1], example);
	assert.deepEqual(ruby.documentation, { sourceSha256: sha256(example), stdout: "42\n42\n" });
	const packages = item.receipt.packages.filter(value => value.target === "rubygems");
	assert.equal(packages.length, 1);
	assert.equal(packages[0].name, ruby.manifest.name); assert.equal(packages[0].version, ruby.manifest.version);
};

/**
 * Rebuild one exact runtime, original gem or multi-ecosystem report.
 *
 * @param path - Required repository-relative report path.
 * @param item - Complete observed report.
 */
export const assertOwnedRubyCallbackReport = async (path, item) => {
	assert.ok(ownedRubyCallbackResultReports.includes(path), path);
	const name = path.split("/").at(-1).slice(0, -5);
	if(name.startsWith("runtime-"))
	{
		assert.equal(name, `runtime-${item.mode}-${item.name}`);
		return assertOwnedRubyCallbackRuntime(item);
	}
	const mode = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	assert.equal(item.mode, mode);
	if(name === `${mode}-combined-release`) return assertOwnedRubyCallbackCombinedRelease(item, mode);
	assert.equal(item.combined, name === `${mode}-combined-package`);
	return assertOwnedRubyCallbackPackage(item);
};

/**
 * Require the complete enabled gate, authenticated sources and all twelve reports.
 *
 * @param record - Frozen Ruby callback-result acceptance.
 */
export const assertOwnedRubyCallbackAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ruby-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedRubyCallbackBaseline);
	assert.deepEqual(record.previous, ownedRubyCallbackPrevious); assert.deepEqual(record.scope, ownedRubyCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: ownedRubyCallbackHistoryPath, sha256: ownedRubyCallbackHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedRubyCallbackSourcePaths());
	for(const [path, digest] of Object.entries(record.sources))
		assert.equal(sha256(beforeOwnedDotnetCallbackResults(path, await readFile(path), digest)), digest, path);
	assert.equal(record.run.command, "npm run test:owned-ruby-callback-results"); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 12, pass: 12, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(Object.keys(reports).sort(), [...ownedRubyCallbackResultReports].sort());
	for(const [path, item] of Object.entries(reports)) await assertOwnedRubyCallbackReport(path, item);
	assertOwnedRubyCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
