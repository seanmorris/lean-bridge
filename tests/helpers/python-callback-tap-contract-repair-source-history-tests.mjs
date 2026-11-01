/**
 * Authenticate the Python callback TAP contract repair and shared replay edge.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPythonCallbackTapContractRepair
	, beforePythonCallbackTapContractRepairSource
	, pythonCallbackTapContractRepairHistoryAdditions
	, pythonCallbackTapContractRepairHistoryPath
	, pythonCallbackTapContractRepairImplementation
	, pythonCallbackTapContractRepairImplementationPaths
	, pythonCallbackTapContractRepairIntegrationPaths
	, pythonCallbackTapContractRepairPredecessor
	, pythonCallbackTapContractRepairSanitizerCommit
	, pythonCallbackTapContractRepairSanitizerPaths
	, pythonCallbackTapContractRepairTapPaths
	, reversePythonCallbackTapContractRepairUpdate
} from "./python-callback-tap-contract-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePhpCallbackAcceptance }
	from "./php-callback-acceptance-history.mjs";
import { beforePhpCallbackInstalledStaging }
	from "./php-callback-installed-staging-history.mjs";
import { beforePhpWasmCallbackResultAcceptance }
	from "./php-wasm-callback-result-acceptance-history.mjs";
import { beforePerlCallbackVariants }
	from "./owned-perl-callback-result-variant-history.mjs";
import { beforeWitCallbackAcceptance }
	from "./wit-callback-acceptance-history.mjs";
import { beforeWitCallbackInstalledAcceptance }
	from "./wit-callback-installed-acceptance-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	pythonCallbackTapContractRepairHistoryPath, "utf8"));

test("Python callback repairs record the exact CI discoveries", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "python-callback-ci-contract-repair-source-v1");
	assert.equal(history.predecessorCommit
		, pythonCallbackTapContractRepairPredecessor);
	assert.equal(history.sanitizerCommit
		, pythonCallbackTapContractRepairSanitizerCommit);
	assert.equal(history.implementationCommit
		, pythonCallbackTapContractRepairImplementation);
	assert.deepEqual(history.discovery.tap, {
		run: 41336197205, job: 124937486225
		, lane: "Callback-result lifetimes in installed Python wheels"
		, observed: "14 passing TAP tests followed by an exact 13-test gate failure"
	});
	assert.equal(history.discovery.sanitizer.observed
		, "CPython startup Unicode cache varied between equivalent executions");
	assert.deepEqual(history.replayDiscovery.map(item => item.lane), [
		"Native PHP callback-result acceptance"
		, "PHP-Wasm callback-result packages"
		, "WIT and WASI Component Model"
	]);
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.runtimeSemanticChanges, 0);
	assert.equal(history.livePinRefreshes, 92);
});

test("Python callback repairs bind sanitizer and all-passed contracts", async () => {
	const sources = Object.fromEntries(
		pythonCallbackTapContractRepairImplementationPaths.map(path => [path
			, git(["show"
				, `${pythonCallbackTapContractRepairImplementation}:${path}`])])
	);
	assert.deepEqual(assertPythonCallbackTapContractRepair(sources), {
		summary: "nonzero-all-passed", liveWorkflowPins: 92
	});
	const history = await record();
	assert.deepEqual(history.exactModel, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	});
});

test("Python TAP repair reverses every authenticated source", async () => {
	const history = await record();
	assert.deepEqual(history.sanitizerUpdates.map(update => update.path)
		, pythonCallbackTapContractRepairSanitizerPaths);
	for(const update of history.sanitizerUpdates)
	{
		const current = git(["show"
			, `${pythonCallbackTapContractRepairSanitizerCommit}:${update.path}`]);
		const previous = git(["show"
			, `${pythonCallbackTapContractRepairPredecessor}:${update.path}`]);
		assert.equal(reversePythonCallbackTapContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforePythonCallbackTapContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	assert.deepEqual(history.updates.map(update => update.path)
		, pythonCallbackTapContractRepairTapPaths);
	for(const update of history.updates)
	{
		const current = git(["show"
			, `${pythonCallbackTapContractRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${pythonCallbackTapContractRepairSanitizerCommit}:${update.path}`]);
		assert.equal(reversePythonCallbackTapContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforePythonCallbackTapContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, pythonCallbackTapContractRepairIntegrationPaths);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			pythonCallbackTapContractRepairHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${pythonCallbackTapContractRepairImplementation}:${update.path}`]);
		assert.equal(reversePythonCallbackTapContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...pythonCallbackTapContractRepairImplementationPaths
		, ...pythonCallbackTapContractRepairIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("every affected reader reaches each endpoint exposed by CI", async () => {
	const workflow = ".github/workflows/consumer-matrix.yml";
	const endpoints = [
		["native PHP acceptance", workflow
			, "8dcfef9d44b0ba84d5928d20d4ae5db39f307323246ff20274507f44a1591b3e"
			, beforePhpCallbackAcceptance]
		, ["PHP-Wasm callback results", workflow
			, "6e822dfe7252638afdf19fd02713dd27d563196b83734758b9d321017782fcbb"
			, beforePhpWasmCallbackResultAcceptance]
		, ["WIT callback acceptance", workflow
			, "b133ced89b5f519ce9cd1a70fe271718c839a70aa0d4bd39627c67b7c6dbe132"
			, beforeWitCallbackAcceptance]
		, ["WIT runtime staging", workflow
			, "df6292d021eb510baf2696771d2143b522ef9ebe9f71b265852beccb4ac8bccb"
			, (itemPath, source, expected) => beforePerlCallbackVariants(
				itemPath, beforePhpCallbackInstalledStaging(
					itemPath, source, expected), expected)]
		, ["installed WIT callback acceptance", workflow
			, "4d42dddf9fbe66262cbb45953112b01b9835e091b2eff43dfd1100af09cf6bae"
			, beforeWitCallbackInstalledAcceptance]
		, ["WIT Python evidence reader"
			, "tests/helpers/owned-python-callback-result-evidence.mjs"
			, "619d35af6a50b7a60236e9176d686fd52d31d53e74e6553b583973c40b581d63"
			, beforeWitCallbackAcceptance]
		, ["WIT Python sanitizer reader"
			, "tests/helpers/owned-python-callback-result-sanitizers.mjs"
			, "04ccded4ef538e6d734dc28f985166fd01d32ffa19ab370b76ae6d62267c16a3"
			, beforeWitCallbackAcceptance]
		, ["WIT Python runtime reader"
			, "tests/owned-python-callback-results.test.mjs"
			, "ac1627b34445a767fc3a6734f9e7e48e426b22866f95f0178d10400592d4bc7c"
			, beforeWitCallbackAcceptance]
	];
	for(const [reader, path, expected, normalize] of endpoints)
	{
		const current = await readFile(path, "utf8");
		const historical = normalize(path, current, expected);
		assert.equal(sha256(historical), expected, reader);
	}
});

test("Python TAP history additions are immutable and reject forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, pythonCallbackTapContractRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${pythonCallbackTapContractRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reversePythonCallbackTapContractRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-python-callback-tap-contract-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
