/**
 * Authenticate the exact language-closure checker repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDirectProofErasureLanguageClosureRepairSource
	, directProofErasureLanguageClosureRepairHistoryAdditions
	, directProofErasureLanguageClosureRepairHistoryPath
	, directProofErasureLanguageClosureRepairImplementation
	, directProofErasureLanguageClosureRepairImplementationPaths
	, directProofErasureLanguageClosureRepairIntegrationPaths
	, directProofErasureLanguageClosureRepairPredecessor
	, reverseDirectProofErasureLanguageClosureRepairUpdate
} from "./direct-proof-erasure-language-closure-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureLanguageClosureRepairHistoryPath, "utf8"));

test("language closure repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-language-closure-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureLanguageClosureRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureLanguageClosureRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureLanguageClosureRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureLanguageClosureRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40978622372);
	assert.equal(history.failedJobId, 123827757645);
	assert.equal(history.profile, "python");
	assert.equal(history.failureCode, "ERR_ASSERTION");
});

test("language closure repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureLanguageClosureRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureLanguageClosureRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureLanguageClosureRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureLanguageClosureRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("language closure repair accepts exact Python identity metadata", () => {
	const report = git(["show"
		, `${directProofErasureLanguageClosureRepairImplementation}:tests/helpers/direct-proof-erasure-language-report.mjs`]);
	const tests = git(["show"
		, `${directProofErasureLanguageClosureRepairImplementation}:tests/helpers/direct-proof-erasure-language-tests.mjs`]);
	assert.match(report, /baselineSha256[\s\S]*?python/u);
	assert.match(report, /key\.endsWith\("Sha256"\)/u);
	assert.match(tests, /python: "3\.12\.15"/u);
});

test("language closure repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureLanguageClosureRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("language closure repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureLanguageClosureRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureLanguageClosureRepairUpdate(current, forged));
});

test("language closure repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-language-closure-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-language-closure-repair-source-history-20261030\.json/u);
});
