/**
 * Authenticate the complete Consumer Matrix Nix disk-budget repair.
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
	beforeConsumerNixDiskBudgetSource
	, consumerNixDiskBudgetHistoryAdditions
	, consumerNixDiskBudgetHistoryPath
	, consumerNixDiskBudgetImplementation
	, consumerNixDiskBudgetImplementationPaths
	, consumerNixDiskBudgetIntegrationPaths
	, consumerNixDiskBudgetPins
	, consumerNixDiskBudgetPredecessor
	, reverseConsumerNixDiskBudgetUpdate
} from "./consumer-nix-disk-budget-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerNixDiskBudgetHistoryPath, "utf8"));

test("Consumer Matrix disk budget records the exact Docker ENOSPC failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-nix-disk-budget-source-v1");
		assert.equal(history.predecessorCommit
			, consumerNixDiskBudgetPredecessor);
		assert.equal(history.implementationCommit
			, consumerNixDiskBudgetImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41170510578, job: 124447261275
		});
		assert.equal(history.failure, "hosted runner ENOSPC");
		assert.equal(history.failedStep
			, "Execute the clean consumer through Docker");
		assert.deepEqual(history.updates.map(item => item.path)
			, consumerNixDiskBudgetImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, consumerNixDiskBudgetIntegrationPaths);
	}
);

test("Consumer Matrix disk budget reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			consumerNixDiskBudgetImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, consumerNixDiskBudgetImplementation + ":" + update.path]);
		assert.equal(reverseConsumerNixDiskBudgetUpdate(
			current, update), previous, update.path);
		assert.equal(beforeConsumerNixDiskBudgetSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Consumer Matrix disk budget preserves the complete type-surface model"
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
			, consumerNixDiskBudgetPredecessor + ":" + inventoryPath]);
		const after = git(["show"
			, consumerNixDiskBudgetImplementation + ":" + inventoryPath]);
		let restored = after;
		for(const pin of consumerNixDiskBudgetPins)
		{
			restored = restored.replaceAll(pin.current, pin.previous);
			assert.equal(after.split(pin.current).length - 1, pin.count);
			assert.equal(after.includes(pin.previous), false);
		}
		assert.equal(restored, before);
	}
);

test("Consumer Matrix disk budget closes every Nix-backed build job"
	, async () => {
		const history = await record();
		assert.equal(history.nixJobs, 18);
		assert.equal(history.diskBudgetedNixJobs, 17);
		assert.deepEqual(history.excludedNixJobs, ["nix-cache"]);
		const workflow = await readFile(
			".github/workflows/consumer-matrix.yml", "utf8");
		const starts = [...workflow.matchAll(
			/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
			.map(match => ({ id: match[1], index: match.index }));
		const jobs = starts.map((start, index) => [start.id
			, workflow.slice(start.index
				, starts[index + 1]?.index ?? workflow.length)]);
		const nix = jobs.filter(([, body]) =>
			body.includes("cachix/install-nix-action@v31"));
		assert.equal(nix.length, 18);
		const cleanup = "Free hosted runner disk before Nix-backed builds";
		for(const [id, body] of nix)
		{
			const count = body.split(cleanup).length - 1;
			assert.equal(count, id === "nix-cache" ? 0 : 1, id);
			if(id === "nix-cache") continue;
			assert.ok(body.indexOf(cleanup)
				< body.indexOf("Check out the exact revision"), id);
			assert.ok(body.indexOf(cleanup)
				< body.indexOf("cachix/install-nix-action@v31"), id);
		}
	}
);

test("Consumer Matrix disk budget authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerNixDiskBudgetHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerNixDiskBudgetImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerNixDiskBudgetUpdate(current, forged));
	}
);

test("Consumer Matrix disk-budget writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-nix-disk-budget-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-nix-disk-budget-source-history-20261031\.json/u);
});
