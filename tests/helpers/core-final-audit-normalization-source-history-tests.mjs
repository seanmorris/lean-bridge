/**
 * Authenticate reversible normalization for every final-audit source.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { coreFinalTypeSurfaceAuditHistoryPath
	, coreFinalTypeSurfaceAuditMilestones }
	from "./core-final-type-surface-audit-source-history.mjs";
import {
	beforeCoreFinalAuditNormalizationSource
	, coreFinalAuditNormalizationBaseline
	, coreFinalAuditNormalizationHistoryAdditions
	, coreFinalAuditNormalizationHistoryPath
	, coreFinalAuditNormalizationIntegrationPaths
	, reverseCoreFinalAuditNormalizationUpdate
} from "./core-final-audit-normalization-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreFinalAuditNormalizationHistoryPath, "utf8"));

test("final-audit normalization covers every modified path in all milestones"
	, async () => {
		const [history, original] = await Promise.all([
			record()
			, readFile(coreFinalTypeSurfaceAuditHistoryPath, "utf8")
				.then(JSON.parse)
		]);
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "core-final-audit-normalization-source-v1");
		assert.equal(history.baselineCommit, coreFinalAuditNormalizationBaseline);
		assert.deepEqual(history.milestones.map(item => ({
			role: item.role, commit: item.commit, parent: item.parent
			, updatePaths: item.updates.map(update => update.path)
			, additions: item.additions.map(addition => addition.path)
		})), original.milestones.map(item => ({
			role: item.role, commit: item.commit, parent: item.parent
			, updatePaths: item.changes.filter(change => change.status === "M")
				.map(change => change.path)
			, additions: item.changes.filter(change => change.status === "A")
				.map(change => change.path)
		})));
		assert.deepEqual(history.milestones.map(item => item.updates.length)
			, [167, 1, 2]);
		assert.deepEqual(history.milestones.map(item => item.additions.length)
			, [1, 1, 0]);
		assert.deepEqual(history.milestones.map(item => item.commit)
			, coreFinalTypeSurfaceAuditMilestones.map(item => item.commit));
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, coreFinalAuditNormalizationIntegrationPaths);
	}
);

test("final-audit normalization authenticates every historical transition"
	, async () => {
		for(const milestone of (await record()).milestones)
			for(const update of milestone.updates)
				assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
					milestone.commit, update.path), update), true, update.path);
	}
);

test("final-audit normalization reverses integration and historical endpoints"
	, async () => {
		const history = await record();
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, coreFinalAuditNormalizationBaseline + ":" + update.path]);
			assert.equal(reverseCoreFinalAuditNormalizationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCoreFinalAuditNormalizationSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const milestone of history.milestones)
			for(const update of milestone.updates)
			{
				const current = git(["show", milestone.commit + ":" + update.path]);
				const previous = git(["show", milestone.parent + ":" + update.path]);
				assert.equal(beforeCoreFinalAuditNormalizationSource(
					update.path, current, update.previousSha256), previous
				, update.path);
			}
	}
);

test("final-audit normalization authenticates every historical and current addition"
	, async () => {
		const history = await record();
		for(const milestone of history.milestones)
			for(const addition of milestone.additions)
			{
				const source = git(["show"
					, milestone.commit + ":" + addition.path]);
				assert.equal(sha256(source), addition.sha256, addition.path);
			}
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, coreFinalAuditNormalizationHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
	}
);

test("final-audit normalization rejects forged transitions", async () => {
	const update = (await record()).milestones[0].updates[0];
	const current = git(["show"
		, coreFinalTypeSurfaceAuditMilestones[0].commit + ":" + update.path]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreFinalAuditNormalizationUpdate(current, forged));
});

test("final-audit normalization writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-final-audit-normalization-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /core-final-audit-normalization-source-history-20261031\.json/u);
});
