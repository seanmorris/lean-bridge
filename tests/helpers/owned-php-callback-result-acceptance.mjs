/**
 * Freeze direct and installed native-PHP callback-result ownership evidence.
 * The checker consumes immutable observations and never needs retained handoffs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import ts from "typescript";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { beforePhpCallbackInstalledStaging, phpCallbackInstalledBaseline
	, phpCallbackInstalledChangedPaths, phpCallbackInstalledCompletedPredecessor
	, phpCallbackInstalledHistoryPath, phpCallbackInstalledHistorySha256
	, phpCallbackInstalledIntroducedPaths, readPhpCallbackInstalledHistory } from "./php-callback-installed-staging-history.mjs";
import { assertOwnedPhpCallbackStaged, ownedPhpCallbackStagedPath
	, ownedPhpCallbackStagedSha256, readOwnedPhpCallbackStaged } from "./owned-php-callback-result-runtime-evidence.mjs";
import { assertOwnedPhpInstalledLog, assertOwnedPhpInstalledReport
	, ownedPhpInstalledCases, readOwnedPhpInstalledSource } from "./owned-php-callback-result-package-evidence.mjs";

const keys = (value, names) => assert.deepEqual(Object.keys(value).sort()
	, (Array.isArray(names) ? [...names] : names.split(" ")).sort());
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

export const ownedPhpCallbackEvidencePath = "docs/evidence/owned-php-callback-results-20261003.json";
export const ownedPhpCallbackEvidenceDocument = "docs/evidence/owned-php-callback-results-20261003.md";
export const ownedPhpCallbackPrevious = phpCallbackInstalledCompletedPredecessor;
export const ownedPhpCallbackRuntime = Object.freeze({
	path: ownedPhpCallbackStagedPath, sha256: ownedPhpCallbackStagedSha256
});
export const ownedPhpCallbackCounts = freeze({
	directReports: 6, directExecutions: 6, directAssertions: 640
	, installedReports: 6, producerBuilds: 12, handoffs: 12
	, rawExecutionSlots: 300, documentedAliases: 12
	, publicRuns: 24, publicAssertions: 3344, assetCases: 180
});
export const ownedPhpCallbackScope = freeze({
	profiles: ["php-native"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, configurations: ["no-host", "host", "combined"]
	, explicitNoHostInstalledPackage: true, explicitHostOnlyInstalledPackage: true
	, explicitCombinedInstalledPackage: true
	, producerInterfaces: {
		"no-host": "installed native build API"
		, host: "installed CLI build command"
		, combined: "installed CLI build command"
	}
	, php: { version: "8.2.33", sapi: "cli", zts: false, wordBits: 64 }
	, counts: ownedPhpCallbackCounts
	, actualLean: true, installedComposer: true, offlineInstall: true
	, independentProducerBuilds: true, deterministicReassembly: true
	, sourceFreeConsumption: true, relocatedPublicReruns: true
	, weakAndStrictCallers: true, coldAndWarmAssetChecks: true
	, callbackResultOwners: true, hostReplyBeforeFrameExpiration: true
	, resultSlotAndBrokerCounters: true, nativeAllocationOrLeakCounters: false
	, forkOrThreadLifetimeAdded: false, sanitizerExecutionAdded: false
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, registryPublication: false
	, sharedCrossLanguageRelease: false, installedSupportPromotions: 0
});
export const ownedPhpCallbackVerificationCommand
	= "LEAN_BRIDGE_OWNED_PHP_CALLBACK_RESULT_PACKAGE_EVIDENCE_TEST=1 node --test --test-concurrency=1 tests/owned-php-callback-result-package-evidence.test.mjs";

const helper = name => `tests/helpers/owned-php-callback-result-${name}.mjs`;
export const ownedPhpCallbackClosureRoots = freeze([
	"tests/owned-php-callback-result-package-evidence.test.mjs"
	, "tests/owned-php-callback-result-acceptance.test.mjs"
	, "tests/owned-php-callback-results.test.mjs"
	, helper("acceptance"), helper("acceptance-tests")
	, helper("package-evidence"), helper("runtime-evidence")
	, "scripts/record-owned-php-callback-results.mjs"
	, "scripts/update-owned-php-callback-acceptance.mjs"
]);
const ownedPhpCallbackSuccessorPaths = new Set([
	"tests/helpers/php-callback-acceptance-history.mjs"
]);

/** Include the completed predecessor and the complete local acceptance closure. */
export const ownedPhpCallbackSourcePaths = async () => {
	const predecessor = await readFile(ownedPhpCallbackPrevious.path);
	assert.equal(sha256(predecessor), ownedPhpCallbackPrevious.sha256);
	const paths = new Set([
		...Object.keys(JSON.parse(predecessor).sources)
		, ...phpCallbackInstalledChangedPaths, ...phpCallbackInstalledIntroducedPaths
		, phpCallbackInstalledHistoryPath, ownedPhpCallbackPrevious.path
		, ownedPhpCallbackRuntime.path, ownedPhpCallbackEvidenceDocument
		, ".github/workflows/consumer-matrix.yml", "package.json", "package-lock.json"
		, "docs/php.md", "docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
		, "tests/copied-fixture-source-history.test.mjs"
	]);
	const pending = [...ownedPhpCallbackClosureRoots], visited = new Set();
	while(pending.length)
	{
		const path = pending.pop();
		if(visited.has(path)) continue;
		visited.add(path); paths.add(path);
		if(!path.endsWith(".mjs")) continue;
		const tree = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const visit = node => {
			const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
				: ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
			if(specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith("."))
			{
				const dependency = join(dirname(path), specifier.text);
				if(!ownedPhpCallbackSuccessorPaths.has(dependency)) pending.push(dependency);
			}
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	assert.equal(paths.has(ownedPhpCallbackEvidencePath), false);
	return [...paths].sort();
};

/**
 * Describe the two physical handoffs after their bytes have been checked.
 *
 * @param item - Complete hash-bound installed-package observation.
 */
export const ownedPhpCallbackHandoffIdentity = item => {
	const receipt = canonicalJson(item.packageSetReceipt);
	const sidecar = `${sha256(receipt)}  package-set-receipt.json\n`;
	const archive = item.built.packages[0].archive;
	const files = Object.keys(item.packageReceipt.files).length + 1;
	const payload = { receipt: identity(receipt), sidecar: identity(sidecar)
		, archive: { path: `archives/${archive}`, ...item.originalArchive, files } };
	return {
		original: { root: basename(item.savedHandoff), ...payload }
		, independent: { root: basename(item.independentHandoff), ...payload }
	};
};

/**
 * Require the complete three-test verifier output and its observed exit.
 *
 * @param run - Original verifier TAP and independently observed exit.
 */
export const assertOwnedPhpCallbackVerification = async run => {
	keys(run, "command exitCode sha256 text");
	assert.equal(run.command, ownedPhpCallbackVerificationCommand);
	assert.equal(run.exitCode, 0); assert.equal(run.sha256, sha256(run.text));
	const source = await readFile("tests/owned-php-callback-result-package-evidence.test.mjs", "utf8");
	const titles = [...source.matchAll(/^test\("([^"\n]+)"/gmu)].map(match => match[1]);
	assert.equal(titles.length, 3);
	const diagnostics = [
		"# 3344 public checks, 180 asset cases, 300 raw executions, 707 source paths, 36 handoff files"
		, "# 692 changed report/schema/raw forgeries rejected"
		, "# 173 terminal/source/physical-handoff/ZIP/matrix forgeries rejected; all mutations synthetic, no executions added"
	];
	const lines = run.text.split("\n"); let index = 0;
	const line = expected => assert.equal(lines[index++], expected, `verification line ${index}`);
	const duration = prefix => {
		const value = lines[index++]; assert.ok(value.startsWith(prefix));
		assert.match(value.slice(prefix.length), /^(?:0|[1-9]\d*)(?:\.\d+)?$/u);
		assert.ok(Number(value.slice(prefix.length)) > 0 && Number(value.slice(prefix.length)) < 2400000);
	};
	line("TAP version 13");
	for(const [testIndex, title] of titles.entries())
	{
		line(`# Subtest: ${title}`); line(`ok ${testIndex + 1} - ${title}`);
		line("  ---"); duration("  duration_ms: "); line("  type: 'test'"); line("  ...");
		line(diagnostics[testIndex]);
	}
	for(const value of ["1..3", "# tests 3", "# suites 0", "# pass 3", "# fail 0"
		, "# cancelled 0", "# skipped 0", "# todo 0"]) line(value);
	duration("# duration_ms "); line(""); assert.equal(index, lines.length, "no unparsed verification bytes");
};

/**
 * Validate the frozen receipt without reading retained build handoffs.
 *
 * @param record - Candidate immutable native-PHP callback acceptance.
 */
export const assertOwnedPhpCallbackAcceptance = async record => {
	keys(record, "schemaVersion kind planNode acceptance baselineRevision previous scope sourceHistory runtimeEvidence sources logs verification handoffs archive");
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, phpCallbackInstalledBaseline);
	assert.deepEqual(record.previous, ownedPhpCallbackPrevious);
	assert.deepEqual(record.scope, ownedPhpCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: phpCallbackInstalledHistoryPath, sha256: phpCallbackInstalledHistorySha256 });
	assert.deepEqual(record.runtimeEvidence, ownedPhpCallbackRuntime);
	readPhpCallbackInstalledHistory();
	for(const reference of [record.previous, record.sourceHistory, record.runtimeEvidence])
		assert.equal(sha256(await readFile(reference.path)), reference.sha256, reference.path);
	const { archive: runtimeArchive } = await readOwnedPhpCallbackStaged();
	await assertOwnedPhpCallbackStaged(runtimeArchive);
	assert.deepEqual(Object.keys(record.sources), await ownedPhpCallbackSourcePaths());
	for(const [path, digest] of Object.entries(record.sources))
	{
		const source = beforePhpCallbackInstalledStaging(path, await readFile(path), digest);
		assert.equal(sha256(source), digest, path);
	}
	keys(record.archive, "format nodes reports");
	for(const value of Object.values(record.archive.reports)) keys(value, "bytes sha256 data");
	const reports = unpackOwnedCallbackReports(record.archive);
	const names = ownedPhpInstalledCases.map(value => value.name);
	assert.deepEqual(Object.keys(reports), names); keys(record.logs, names); keys(record.handoffs, names);
	const baseline = async name => reports[name];
	let rawExecutionSlots = 0, publicRuns = 0, publicAssertions = 0, assetCases = 0;
	for(const pin of ownedPhpInstalledCases)
	{
		const item = reports[pin.name];
		await assertOwnedPhpInstalledReport(pin.name, item, readOwnedPhpInstalledSource, baseline);
		assertOwnedPhpInstalledLog(pin.name, record.logs[pin.name], item);
		assert.deepEqual(record.handoffs[pin.name], ownedPhpCallbackHandoffIdentity(item));
		rawExecutionSlots += item.producerExecutions.length + item.installationExecutions.length
			+ item.observations.length + item.assets.length + item.disk.samples.length;
		publicRuns += item.observations.length;
		publicAssertions += item.observations.reduce((sum, value) => sum + value.observed.consumer.checks, 0);
		assetCases += item.assets.length;
	}
	assert.deepEqual({ rawExecutionSlots, publicRuns, publicAssertions, assetCases }
		, { rawExecutionSlots: 300, publicRuns: 24, publicAssertions: 3344, assetCases: 180 });
	assert.equal(new Set(Object.values(reports).map(item => item.directory)).size, 6);
	assert.equal(new Set(Object.values(reports).flatMap(item => [item.savedHandoff, item.independentHandoff])).size, 12);
	assert.deepEqual(record.archive, packOwnedCallbackReports(reports));
	await assertOwnedPhpCallbackVerification(record.verification);
};
