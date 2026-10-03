/**
 * Freeze only complete, source-bound Perl callback ownership acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePostPerlCallbackStaging } from "./post-perl-callback-staging-history.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { ownedPerlCallbackBaseline, ownedPerlCallbackChangedPaths
	, ownedPerlCallbackHistoryPath, ownedPerlCallbackHistorySha256
	, ownedPerlCallbackCompletedPredecessor } from "./owned-perl-callback-result-history.mjs";
import { assertOwnedPerlCallbackResultCi, ownedPerlCallbackResultReports
	, ownedPerlCallbackEvidencePaths } from "./owned-perl-callback-result-ci.mjs";
import { assertOwnedPerlCallbackRuntime } from "./owned-perl-callback-result-runtime-evidence.mjs";
import { assertOwnedPerlCallbackFaults } from "./owned-perl-callback-result-fault-evidence.mjs";
import { assertOwnedPerlCallbackLifetime } from "./owned-perl-callback-result-lifetime-evidence.mjs";
import { assertOwnedPerlCallbackMutants } from "./owned-perl-callback-result-mutant-evidence.mjs";
import { assertOwnedPerlCallbackSanitizers } from "./owned-perl-callback-result-sanitizer-evidence.mjs";
import { assertOwnedPerlCallbackPackage } from "./owned-perl-callback-result-package-evidence.mjs";
import { assertOwnedPerlCallbackCombinedRelease } from "./owned-perl-callback-result-combined-evidence.mjs";

const frozen = value => {
	for(const child of Object.values(value)) if(child && typeof child === "object") frozen(child);
	return Object.freeze(value);
};
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
export const ownedPerlCallbackEvidencePath = "docs/evidence/owned-perl-callback-results-20261003.json";
export const ownedPerlCallbackPrevious = ownedPerlCallbackCompletedPredecessor;
export const ownedPerlCallbackScope = frozen({
	profiles: ["perl"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, perlAbis: ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]
	, callbackLocalAnchors: true, originalArgumentOwners: true
	, transitiveExpiration: true, emptyRecursiveValues: true
	, independentRetains: true
	, callbackArgumentAndResultFactories: true, authenticFactoryReceiver: true
	, nativeClosureIdentity: true, higherOrderCallbacks: true
	, hostRawAndWholeReplies: true, hostReplyBeforeFrameExpiration: true
	, wholeRecoveryPreflightBeforeTransfer: true, tiedScalarFetchOnce: true
	, directRuntimeConfigurations: 6, directRuntimeExecutions: 24
	, directRuntimeAssertions: 1528
	, allocationFaults: { configurations: 2, executions: 8, assertions: 96120
		, attemptsPerExecution: 1294, keptAliveErrorsPerExecution: 1273
		, domains: ["managed-allocation", "managed-exception", "native-allocation"]
		, beforeAndAfterTransfer: true, restoredControls: true }
	, directProcess: { configurations: 2, executions: 16, assertions: 520
		, fork: true, ithreads: true, callbackReentry: true, activeOwnerPins: true
		, runtimeRetirement: true, reentrantShutdown: true, installedPackage: false }
	, compiledSemanticMutants: { cases: 32, originalControls: 48
		, assertionsPerControl: 92, compilationFailuresAccepted: false
		, crashesAccepted: false }
	, installedConfigurations: ["combined"], installedCpan: true
	, explicitNoHostInstalledPackage: false
	, explicitHostOnlyInstalledPackage: false, sourceFreeConsumption: true
	, installModes: ["prebuilt-only", "build-xs"]
	, independentProducerBuilds: 4
	, deterministicReassembly: true, installedConfigurationsAndModes: 16
	, relocatedRuntimeExecutions: 32, installedAssertions: 2528
	, installedAssetTamperCases: 96, installedPrivateCleanupCounters: false
	, sanitizerKinds: ["address", "undefined"], sanitizerPositiveExecutions: 40
	, sanitizerDetectorControls: 32, sanitizerAssertions: 97376
	, leakSanitizer: "separate-diagnostics", leakFreeClaim: false
	, leanEmittedCInstrumented: true, prebuiltLeanRuntimeInstrumented: false
	, perlInterpreterInstrumented: false, gmpInstrumented: false
	, cleanupCounters: ["allocation", "identity", "wrapper", "owner", "active", "cleanup-status"]
	, combinedTargets: ["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "maven", "npm", "cpan"]
	, sharedReleaseIndependentRebuild: false
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"]
	, modelVersion: 11, ownedGraphVersion: 6, perlContractVersion: 5
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, docker: false, installedSupportPromotions: 0
});

const helper = name => `tests/helpers/owned-perl-callback-result-${name}.mjs`;
const originalReports = ownedPerlCallbackResultReports.filter(path => !path.startsWith("build/owned-perl-callback-result-variants/"));
const originalEvidence = ownedPerlCallbackEvidencePaths.filter(path => path !== helper("variant-evidence-tests"));
const addedPaths = [
	ownedPerlCallbackHistoryPath
	, "docs/evidence/owned-perl-callback-results-20261003.md"
	, "scripts/update-owned-perl-callback-history.mjs"
	, "scripts/record-owned-perl-callback-results.mjs"
	, "scripts/build-perl-toolchains.mjs", "package-lock.json"
	, "src/adoption/type-surface.mjs", "schema/type-surface.schema.json"
	, "src/backends/cpp/boost.source.json"
	, ...["perl-graph-probes", "type-corpus-browser", "type-corpus"
		, "type-corpus-reviewed-native", "type-corpus-c-source"
		, "type-corpus-dotnet-source", "type-corpus-dotnet"
		, "type-corpus-jvm-source", "type-corpus-jvm-tools"
		, "type-corpus-php", "type-corpus-php-source"
		, "type-corpus-php-wasm-evidence", "type-corpus-wit-evidence"
		, "type-corpus-wit-source", "jvm-kotlin-metadata-fixture"
		, "jvm-compound-fixture", "jvm-list-fixture", "jvm-alias-fixture"]
		.map(name => `tests/helpers/${name}.mjs`)
	, "src/backends/perl/BuildCallbackResults.pm"
	, "src/backends/perl/owned-callback-arguments.mjs"
	, "src/backends/perl/owned-callback-build.mjs"
	, "tests/owned-perl-callback-result-contract.test.mjs"
	, ...["faults", "lifetime", "sanitizers"].map(name => `tests/fixtures/structured-types/owned-perl-callback-result-${name}.pl`)
	, "tests/fixtures/structured-types/owned-perl-callback-results.pl"
	, "tests/fixtures/structured-types/owned-perl-callback-results-installed.pl"
	, ...["acceptance", "acceptance-tests", "ci", "ci-tests", "combined-install"
		, "combined-packaging-tests", "contract-tests", "factory-tests"
		, "fault-tests", "history", "history-tests", "installed", "installed-smoke"
		, "installer-tests", "lifetime-tests", "mutants", "mutant-tests"
		, "package-fixture", "package-tests"
		, "packaging-tests", "runtime-tests", "sanitizer-tests"
		, "xs-tests"].map(helper)
	, ...["runtime", "fault", "lifetime", "mutant", "sanitizer", "package", "combined"]
		.flatMap(name => [helper(name + "-evidence"), helper(name + "-evidence-tests")])
];

/** Include all predecessor coverage and every added Perl acceptance input. */
export const ownedPerlCallbackSourcePaths = async () => {
	const bytes = await readFile(ownedPerlCallbackPrevious.path);
	assert.equal(sha256(bytes), ownedPerlCallbackPrevious.sha256);
	const paths = [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedPerlCallbackChangedPaths, ...addedPaths])].sort();
	assert.ok(!paths.includes(ownedPerlCallbackEvidencePath));
	return paths;
};
export const ownedPerlCallbackRuns = frozen([
	{ name: "contracts", tests: 20 }, { name: "direct", tests: 6 }
	, { name: "faults", tests: 2 }, { name: "lifetime", tests: 2 }
	, { name: "mutants", tests: 2 }, { name: "sanitizers", tests: 2 }
	, { name: "installed", tests: 2 }, { name: "combined-release", tests: 1 }
]);
const modes = ["ordinary", "reviewed"];
const runtimeTitles = {
	direct: modes.flatMap(mode => ["no-host", "host", "combined"].map(variant =>
		`Perl callback-result owners execute real Lean (${mode}, ${variant})`))
	, faults: modes.map(mode => `Perl callback-result faults preserve handoff ownership (${mode})`)
	, lifetime: modes.map(mode => `Perl callback-result lifetime and process guards execute real Lean (${mode})`)
	, mutants: modes.map(mode => `Perl callback-result compiled semantic mutants reject (${mode}, combined)`)
	, sanitizers: modes.map(mode => `Perl callback-result ASan and UBSan instrument actual C and XS (${mode})`)
	, installed: modes.map(mode => `installed CPAN callback-result matrix preserves combined owners (${mode})`)
	, "combined-release": ["installed CPAN and eight peer targets share callback-result contracts"]
};
const literalTitles = async paths => {
	const titles = [];
	for(const path of paths)
	{
		const source = await readFile(path, "utf8");
		if(path === helper("combined-evidence-tests"))
		{
			assert.ok(source.includes('for(const mode of ["ordinary", "reviewed"])'));
			assert.ok(source.includes('test(`nine-target Perl callback release reconstructs ${mode} inputs and execution`, {'));
			titles.push(...modes.map(mode => `nine-target Perl callback release reconstructs ${mode} inputs and execution`));
			continue;
		}
		const found = [...source.matchAll(/^test\("([^"\n]+)"/gmu)].map(match => match[1]);
		assert.ok(found.length, `Expected literal test titles in ${path}`); titles.push(...found);
	}
	return titles;
};
const passed = (run, count, titles) => {
	assert.equal(titles.length, count); assert.equal(run.exitCode, 0);
	assert.equal(typeof run.text, "string"); assert.equal(run.sha256, sha256(run.text));
	for(const [key, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual(run.text.match(new RegExp("^# " + key + " [0-9]+$", "gmu")), ["# " + key + " " + value]);
	assert.deepEqual(run.text.match(/^1\.\.[0-9]+$/gmu), ["1.." + count]);
	assert.deepEqual(run.text.match(/^# Subtest: .*$/gmu), titles.map(title => "# Subtest: " + title));
	assert.deepEqual(run.text.match(/^ok [0-9]+ - .*$/gmu), titles.map((title, index) => `ok ${index + 1} - ${title}`));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
};

/**
 * Bind each original report to its independently required slot and source path.
 *
 * @param path - Required canonical CI artifact path.
 * @param item - Complete original observation.
 * @param readSource - Current source or independently authenticated historical bytes.
 */
export const assertOwnedPerlCallbackReport = async (path, item, readSource = readFile) => {
	assert.ok(originalReports.includes(path), path);
	const name = path.split("/").at(-1), mode = name.startsWith("ordinary") ? "ordinary" : "reviewed";
	assert.equal(item.mode, mode);
	if(name.endsWith("-combined-release.json")) return assertOwnedPerlCallbackCombinedRelease(name, item, readSource);
	if(name.endsWith("-combined-package.json")) return assertOwnedPerlCallbackPackage(name, item, readSource);
	if(path.startsWith("build/owned-perl-callback-results/")) return assertOwnedPerlCallbackRuntime(name, item);
	if(path.startsWith("build/owned-perl-callback-result-faults/")) return assertOwnedPerlCallbackFaults(mode, item);
	if(path.startsWith("build/owned-perl-callback-result-lifetime/")) return assertOwnedPerlCallbackLifetime(name, item);
	if(path.startsWith("build/owned-perl-callback-result-mutants/")) return assertOwnedPerlCallbackMutants(mode, item);
	return assertOwnedPerlCallbackSanitizers(name, item);
};

/**
 * Require all 37 executions, 14 verifier tests, and 18 source-bound reports.
 *
 * @param record - Candidate frozen receipt. No file is created by this checker.
 */
export const assertOwnedPerlCallbackAcceptance = async record => {
	keys(record, "schemaVersion kind planNode acceptance baselineRevision previous scope sourceHistory sources runs verification archive");
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedPerlCallbackBaseline);
	assert.deepEqual(record.previous, ownedPerlCallbackPrevious);
	assert.deepEqual(record.scope, ownedPerlCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: ownedPerlCallbackHistoryPath, sha256: ownedPerlCallbackHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedPerlCallbackSourcePaths());
	const readSource = async path => {
		if(!Object.hasOwn(record.sources, path)) return readFile(path);
		const digest = record.sources[path];
		const source = beforePostPerlCallbackStaging(path, await readFile(path), digest);
		assert.equal(sha256(source), digest, path); return source;
	};
	for(const path of Object.keys(record.sources)) await readSource(path);
	assert.deepEqual(record.runs.map(({ name, tests }) => ({ name, tests })), ownedPerlCallbackRuns);
	for(const run of record.runs)
	{
		keys(run, "name tests exitCode sha256 text");
		const titles = run.name === "contracts"
			? await literalTitles(["factory", "xs", "contract", "package", "installer"].map(name => helper(name + "-tests")))
			: runtimeTitles[run.name];
		passed(run, run.tests, titles);
	}
	keys(record.verification, "command exitCode sha256 text");
	assert.equal(record.verification.command, "npm run test:owned-perl-callback-evidence");
	passed(record.verification, 14, await literalTitles([...originalEvidence].sort()));
	keys(record.archive, "format nodes reports");
	for(const entry of Object.values(record.archive.reports)) keys(entry, "bytes sha256 data");
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(Object.keys(reports).sort(), [...originalReports].sort());
	for(const [path, item] of Object.entries(reports)) await assertOwnedPerlCallbackReport(path, item, readSource);
	assertOwnedPerlCallbackResultCi((await readSource(".github/workflows/consumer-matrix.yml")).toString(), JSON.parse(await readSource("package.json")), true);
};
