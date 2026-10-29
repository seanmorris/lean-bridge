/**
 * Authenticate bounded proof-erasure and HostNull completion workflows.
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
	beforeCompleteAcceptanceBudgetSource
	, completeAcceptanceBudgetHistoryAdditions
	, completeAcceptanceBudgetHistoryPath
	, completeAcceptanceBudgetImplementation
	, completeAcceptanceBudgetImplementationPaths
	, completeAcceptanceBudgetIntegrationPaths
	, completeAcceptanceBudgetPredecessor
	, reverseCompleteAcceptanceBudgetUpdate
} from "./complete-acceptance-budget-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	completeAcceptanceBudgetHistoryPath, "utf8"));

test("complete acceptance budgets record their exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "complete-acceptance-budget-source-v1");
	assert.equal(history.predecessorCommit, completeAcceptanceBudgetPredecessor);
	assert.equal(history.implementationCommit, completeAcceptanceBudgetImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, completeAcceptanceBudgetImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, completeAcceptanceBudgetIntegrationPaths);
	assert.equal(history.proofErasureProducerGroups, 5);
	assert.equal(history.hostNullProducerGroups, 4);
	assert.equal(history.maximumInternalProducerConcurrency, 3);
	assert.equal(history.auditFetchDepth, 0);
	assert.equal(history.receiptFetchDepth, 1);
	assert.equal(history.sparseCheckoutConeMode, false);
	assert.deepEqual(history.currentSourcePaths, []);
});

test("complete acceptance budgets reverse every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			completeAcceptanceBudgetImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${completeAcceptanceBudgetImplementation}:${update.path}`]);
		assert.equal(reverseCompleteAcceptanceBudgetUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCompleteAcceptanceBudgetSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("completion workflows bound producers and sparse checkout evidence"
	, async () => {
		for(const [path, edges, archive] of [
			[".github/workflows/direct-proof-erasure-complete.yml"
				, [
					["native-perl", "npm-browser"], ["languages", "native-perl"]
					, ["managed-wit", "languages"], ["php", "managed-wit"]
				]
				, "direct-proof-erasure-hosted-*"]
			, [".github/workflows/host-null-complete.yml"
				, [
					["native-perl", "npm-browser"], ["managed-wit", "native-perl"]
					, ["php", "managed-wit"]
				]
				, "host-null-complete-*"]
		]) {
			const source = git(["show"
				, `${completeAcceptanceBudgetImplementation}:${path}`]);
			for(const [job, dependency] of edges)
				assert.match(source, new RegExp(
					`^  ${job}:\\n[\\s\\S]*?^    needs: ${dependency}\\n`
					+ "    if: always\\(\\) && inputs\\.suite == 'produce'$", "mu"));
			assert.equal(source.match(/sparse-checkout-cone-mode: false/gmu)?.length, 2);
			assert.equal(source.match(/!\/docs\/evidence\/\*/gmu)?.length, 2);
			assert.ok(source.includes(`/docs/evidence/${archive}/`), path);
		}
	}
);

test("complete acceptance budgets authenticate history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, completeAcceptanceBudgetHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("complete acceptance budgets reject forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${completeAcceptanceBudgetImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCompleteAcceptanceBudgetUpdate(current, forged));
});

test("complete acceptance budget writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-complete-acceptance-budget-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /complete-acceptance-budget-source-history-20261029\.json/u);
});
