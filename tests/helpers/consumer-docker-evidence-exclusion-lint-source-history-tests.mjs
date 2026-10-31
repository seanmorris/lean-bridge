/**
 * Authenticate the Docker evidence-exclusion lint repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeConsumerDockerEvidenceExclusionLintSource
	, consumerDockerEvidenceExclusionLintHistoryAdditions
	, consumerDockerEvidenceExclusionLintHistoryPath
	, consumerDockerEvidenceExclusionLintImplementation
	, consumerDockerEvidenceExclusionLintImplementationPaths
	, consumerDockerEvidenceExclusionLintIntegrationPaths
	, consumerDockerEvidenceExclusionLintPredecessor
	, reverseConsumerDockerEvidenceExclusionLintUpdate
} from "./consumer-docker-evidence-exclusion-lint-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8"
	, maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerDockerEvidenceExclusionLintHistoryPath, "utf8"));

test("Docker evidence-exclusion lint repair records the exact failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-docker-evidence-exclusion-lint-source-v1");
		assert.equal(history.predecessorCommit
			, consumerDockerEvidenceExclusionLintPredecessor);
		assert.equal(history.implementationCommit
			, consumerDockerEvidenceExclusionLintImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41203403878
			, job: 124543662392
			, aggregateJob: 124544716647
		});
		assert.equal(history.failure.rule
			, "sm-no-saccade-style/leading-comma-lists");
		assert.equal(history.failure.errors, 6);
		assert.equal(history.semanticChanges, 0);
		assert.equal(history.typeSurfaceChanges, 0);
	}
);

test("Docker evidence-exclusion lint repair reverses every source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(item => item.path)
			, consumerDockerEvidenceExclusionLintImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, consumerDockerEvidenceExclusionLintIntegrationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				consumerDockerEvidenceExclusionLintImplementation
				, update.path), update), true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, consumerDockerEvidenceExclusionLintImplementation
					+ ":" + update.path]);
			assert.equal(reverseConsumerDockerEvidenceExclusionLintUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerDockerEvidenceExclusionLintSource(
				update.path, current, update.previousSha256)
				, previous, update.path);
		}
	}
);

test("Docker evidence-exclusion lint repair preserves the type surface"
	, () => {
		assert.equal(git(["show"
			, consumerDockerEvidenceExclusionLintPredecessor
				+ ":docs/type-surface.v1.json"]), git(["show"
			, consumerDockerEvidenceExclusionLintImplementation
				+ ":docs/type-surface.v1.json"]));
	}
);

test("Docker evidence-exclusion lint repair authenticates controls"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerDockerEvidenceExclusionLintHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerDockerEvidenceExclusionLintImplementation
				+ ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerDockerEvidenceExclusionLintUpdate(current, forged));
	}
);

test("Docker evidence-exclusion lint writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-docker-evidence-exclusion-lint-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-docker-evidence-exclusion-lint-source-history-20261031\.json/u);
});
