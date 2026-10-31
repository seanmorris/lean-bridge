/**
 * Authenticate the complete callback-result package disk-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeConsumerCallbackDiskBudgetSource
	, consumerCallbackDiskBudgetHistoryAdditions
	, consumerCallbackDiskBudgetHistoryPath
	, consumerCallbackDiskBudgetImplementation
	, consumerCallbackDiskBudgetImplementationAdditions
	, consumerCallbackDiskBudgetImplementationPaths
	, consumerCallbackDiskBudgetIntegrationPaths
	, consumerCallbackDiskBudgetPredecessor
	, reverseConsumerCallbackDiskBudgetUpdate
} from "./consumer-callback-disk-budget-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerCallbackDiskBudgetHistoryPath, "utf8"));

test("callback package disk budget records the exact NuGet ENOSPC failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-callback-disk-budget-source-v1");
		assert.equal(history.predecessorCommit
			, consumerCallbackDiskBudgetPredecessor);
		assert.equal(history.implementationCommit
			, consumerCallbackDiskBudgetImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41170510578, job: 124447261049
		});
		assert.equal(history.failure, "hosted runner ENOSPC");
		assert.equal(history.failedStep
			, "Verify .NET callback-result lifetimes");
		assert.equal(history.callbackJobs, 8);
		assert.deepEqual(history.updates.map(item => item.path)
			, consumerCallbackDiskBudgetImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, consumerCallbackDiskBudgetIntegrationPaths);
	}
);

test("callback package disk budget reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			consumerCallbackDiskBudgetImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, consumerCallbackDiskBudgetImplementation + ":" + update.path]);
		assert.equal(reverseConsumerCallbackDiskBudgetUpdate(
			current, update), previous, update.path);
		assert.equal(beforeConsumerCallbackDiskBudgetSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("callback package disk budget preserves the complete type-surface model"
	, async () => {
		const history = await record();
		assert.equal(history.refreshedCitationCount, 117);
		assert.equal(history.semanticChanges, 0);
		assert.deepEqual(history.typeSurfaceCounts, {
			evidence: 900, observations: 717, paths: 2, positions: 6
			, profiles: 17, stages: 5
		});
		const inventoryPath = "docs/type-surface.v1.json";
		const before = git(["show"
			, consumerCallbackDiskBudgetPredecessor + ":" + inventoryPath]);
		const after = git(["show"
			, consumerCallbackDiskBudgetImplementation + ":" + inventoryPath]);
		let restored = after;
		for(const pin of history.currentSourcePins)
		{
			restored = restored.replaceAll(pin.current, pin.previous);
			assert.equal(after.split(pin.current).length - 1, pin.count);
			assert.equal(after.includes(pin.previous), false);
		}
		assert.equal(restored, before);
	}
);

test("callback package disk budget closes all eight heavy package jobs"
	, async () => {
		const history = await record();
		const workflow = await readFile(
			".github/workflows/consumer-matrix.yml", "utf8");
		const starts = [...workflow.matchAll(
			/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
			.map(match => ({ id: match[1], index: match.index }));
		const jobs = starts.map((start, index) => [start.id
			, workflow.slice(start.index
				, starts[index + 1]?.index ?? workflow.length)]);
		const callbacks = jobs.filter(([, body]) =>
			body.includes("name: Callback-result lifetimes in installed"));
		assert.deepEqual(callbacks.map(([id]) => id), history.callbackJobIds);
		const cleanup = "Free hosted runner disk before callback package builds";
		const command = "sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /usr/local/.ghcup /opt/hostedtoolcache/CodeQL";
		for(const [id, body] of callbacks)
		{
			assert.equal(body.split(cleanup).length - 1, 1, id);
			assert.equal(body.split(command).length - 1, 1, id);
			assert.ok(body.indexOf(cleanup)
				< body.indexOf("Check out the exact revision"), id);
		}
	}
);

test("callback package disk budget authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.implementationAdditions.map(item => item.path)
			, consumerCallbackDiskBudgetImplementationAdditions);
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerCallbackDiskBudgetHistoryAdditions);
		for(const addition of [
			...history.implementationAdditions, ...history.historyAdditions
		]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerCallbackDiskBudgetImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerCallbackDiskBudgetUpdate(current, forged));
	}
);

test("callback package disk-budget writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-callback-disk-budget-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-callback-disk-budget-source-history-20261031\.json/u);
});
