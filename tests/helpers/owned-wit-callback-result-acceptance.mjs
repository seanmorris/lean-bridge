/**
 * Freeze the six direct WIT callback-result executions and their raw TAP.
 * This receipt proves runtime execution only; installed-package support is a
 * separate acceptance milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import ts from "typescript";
import { sha256 } from "../../src/capsule/node.mjs";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedWitCallbackRuntimeMatrix, assertOwnedWitCallbackRuntimeLogs
	, ownedWitCallbackRuntimeLogs, ownedWitCallbackRuntimeReports
	, ownedWitCallbackRuntimeSourcePaths } from "./wit-owned-callback-result-runtime-evidence.mjs";
import { beforeWitCallbackRuntimeStaging, readWitCallbackRuntimeHistory
	, witCallbackRuntimeBaseline, witCallbackRuntimeHistoryPath
	, witCallbackRuntimeHistorySha256 } from "./wit-callback-runtime-staging-history.mjs";

const keys = (value, names) => assert.deepEqual(Object.keys(value).sort()
	, (Array.isArray(names) ? [...names] : names.split(" ")).sort());
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};

export const ownedWitCallbackEvidencePath = "docs/evidence/owned-wit-callback-results-20261003.json";
export const ownedWitCallbackEvidenceDocument = "docs/evidence/owned-wit-callback-results-20261003.md";
export const ownedWitCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-php-callback-results-20261003.json"
	, sha256: "9812d99ae9b6d7d7b594fc33c9cbe32344600688fdc8d3d12eacc0e6c8449205"
});
export const ownedWitCallbackSourceHistory = Object.freeze({
	path: witCallbackRuntimeHistoryPath, sha256: witCallbackRuntimeHistorySha256
});
export const ownedWitCallbackCounts = freeze({
	reports: 6, selectedLogs: 3, directExecutions: 6
	, assertions: 45634, allocationFailures: 750, injectedSources: 5
});
export const ownedWitCallbackScope = freeze({
	profiles: ["wit-wasi"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, configurations: ["no-host", "host", "combined"]
	, counts: ownedWitCallbackCounts
	, actualLean: true, actualWasmtime: true, componentModelExecution: true
	, callbackResultOwners: true, callbackResultAnchors: true
	, callbackInputTransfers: true, receiverExports: true
	, allocationFailureInjection: true, zeroLiveOwnersAfterExecution: true
	, exactRawProcessOutput: true, installedPackage: false
	, sourceFreeConsumption: false, relocatedPublicReruns: false
	, retainedHostCallbacks: false, asynchronousDelivery: false
	, processLifetimeAdded: false, sanitizerExecutionAdded: false
	, registryPublication: false, sharedCrossLanguageRelease: false
	, installedSupportPromotions: 0
});
export const ownedWitCallbackVerificationCommand
	= "LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_RUNTIME_TEST=1 LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_LOG_ROOT=build node --test --test-concurrency=1 tests/wit-owned-callback-result-runtime-evidence.test.mjs";

export const ownedWitCallbackClosureRoots = freeze([
	"tests/wit-owned-callback-result-acceptance.test.mjs"
	, "tests/wit-owned-callback-result-runtime-evidence.test.mjs"
	, "tests/wit-owned-callback-result-runtime.test.mjs"
	, "tests/helpers/owned-wit-callback-result-acceptance.mjs"
	, "tests/helpers/owned-wit-callback-result-acceptance-tests.mjs"
	, "scripts/record-owned-wit-callback-results.mjs"
]);

/** Include the completed predecessor and the complete local verifier closure. */
export const ownedWitCallbackSourcePaths = async () => {
	const predecessor = await readFile(ownedWitCallbackPrevious.path);
	assert.equal(sha256(predecessor), ownedWitCallbackPrevious.sha256);
	const paths = new Set([
		...Object.keys(JSON.parse(predecessor).sources)
		, ...ownedWitCallbackRuntimeSourcePaths
		, ownedWitCallbackPrevious.path, ownedWitCallbackSourceHistory.path
		, ownedWitCallbackEvidenceDocument, ".github/workflows/consumer-matrix.yml"
		, "package.json", "package-lock.json", "docs/consume/wit-wasi.md"
	]);
	const pending = [...ownedWitCallbackClosureRoots], visited = new Set();
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
				pending.push(join(dirname(path), specifier.text));
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	assert.equal(paths.has(ownedWitCallbackEvidencePath), false);
	return [...paths].sort();
};

/**
 * Require the complete four-test physical evidence TAP and observed exit.
 *
 * @param run - Original verifier TAP and independently observed exit.
 */
export const assertOwnedWitCallbackVerification = run => {
	keys(run, "command exitCode sha256 text");
	assert.equal(run.command, ownedWitCallbackVerificationCommand);
	assert.equal(run.exitCode, 0); assert.equal(run.sha256, sha256(run.text));
	const titles = [
		"WIT callback runtime evidence reconstructs six reports and three exact selected TAP logs"
		, "WIT callback runtime evidence rejects altered contracts, sources, masks and raw observations"
		, "WIT callback runtime evidence rejects omitted cases and forged selected TAP streams"
		, "WIT callback runtime evidence reads only injected repository fixtures and rejects changed source bytes"
	];
	const diagnostics = [
		'# {"reports":6,"selectedLogs":3,"cases":6,"installedPackageClaims":0}'
		, '# {"reports":6,"rejected":756}', '# {"rejected":88}'
		, '# {"injectedSources":5,"rejected":5}'
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
	for(const value of ["1..4", "# tests 4", "# suites 0", "# pass 4", "# fail 0"
		, "# cancelled 0", "# skipped 0", "# todo 0"]) line(value);
	duration("# duration_ms "); line(""); assert.equal(index, lines.length, "no unparsed verification bytes");
};

/**
 * Validate the frozen receipt without retained build directories.
 *
 * @param record - Candidate immutable direct-WIT callback acceptance.
 */
export const assertOwnedWitCallbackAcceptance = async record => {
	keys(record, "schemaVersion kind planNode acceptance baselineRevision previous sourceHistory scope sources logs verification archive");
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-wit-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, witCallbackRuntimeBaseline);
	assert.deepEqual(record.previous, ownedWitCallbackPrevious);
	assert.deepEqual(record.sourceHistory, ownedWitCallbackSourceHistory);
	assert.deepEqual(record.scope, ownedWitCallbackScope);
	readWitCallbackRuntimeHistory();
	for(const reference of [record.previous, record.sourceHistory])
		assert.equal(sha256(await readFile(reference.path)), reference.sha256, reference.path);
	assert.deepEqual(Object.keys(record.sources), await ownedWitCallbackSourcePaths());
	const sourceBytes = new Map();
	for(const [path, digest] of Object.entries(record.sources))
	{
		const source = beforeWitCallbackRuntimeStaging(path, await readFile(path), digest);
		assert.equal(sha256(source), digest, path); sourceBytes.set(path, Buffer.from(source));
	}
	keys(record.archive, "format nodes reports");
	for(const value of Object.values(record.archive.reports)) keys(value, "bytes sha256 data");
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(Object.keys(reports), [...ownedWitCallbackRuntimeReports]);
	const readSource = async (path, encoding) => {
		assert.ok(ownedWitCallbackRuntimeSourcePaths.includes(path), path);
		const value = sourceBytes.get(path); assert.ok(value, path);
		return encoding ? value.toString(encoding) : value;
	};
	await assertOwnedWitCallbackRuntimeMatrix(reports, readSource);
	keys(record.logs, ownedWitCallbackRuntimeLogs);
	assertOwnedWitCallbackRuntimeLogs(record.logs, reports);
	const assertions = Object.values(reports).reduce((sum, item) => sum + item.result.checks, 0);
	const allocationFailures = Object.values(reports).reduce((sum, item) => sum + item.result.allocationFailures, 0);
	assert.deepEqual({ assertions, allocationFailures }, { assertions: 45634, allocationFailures: 750 });
	assert.deepEqual(record.archive, packOwnedCallbackReports(reports));
	assertOwnedWitCallbackVerification(record.verification);
};
