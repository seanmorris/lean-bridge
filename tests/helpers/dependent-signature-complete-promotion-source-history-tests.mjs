/**
 * Authenticate the complete dependent-signature publication lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDependentSignatureCompletePromotionSource
	, dependentSignatureCompletePromotionChangedPaths
	, dependentSignatureCompletePromotionCommits
	, dependentSignatureCompletePromotionGuidePaths
	, dependentSignatureCompletePromotionHistoryAdditions
	, dependentSignatureCompletePromotionHistoryPath
	, dependentSignatureCompletePromotionImplementation
	, dependentSignatureCompletePromotionIntegrationPaths
	, dependentSignatureCompletePromotionPredecessor
	, reverseDependentSignatureCompletePromotionUpdate
} from "./dependent-signature-complete-promotion-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	dependentSignatureCompletePromotionHistoryPath, "utf8"));

test("complete dependent-signature publication records its exact transaction"
	, async () => {
		const record = await readRecord();
		assert.deepEqual(Object.keys(record).sort(), [
			"cells", "guidePaths", "historyAdditions", "implementationCommit"
			, "implementationCommits", "integrationUpdates", "milestone"
			, "observations", "predecessorCommit", "referenceFiles"
			, "schemaVersion", "scope", "updates"
		].sort());
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "dependent-signature-complete-promotion-source-v1");
		assert.equal(record.predecessorCommit
			, dependentSignatureCompletePromotionPredecessor);
		assert.equal(record.implementationCommit
			, dependentSignatureCompletePromotionImplementation);
		assert.deepEqual(record.implementationCommits
			, dependentSignatureCompletePromotionCommits);
		assert.deepEqual(record.updates.map(item => item.path)
			, dependentSignatureCompletePromotionChangedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, dependentSignatureCompletePromotionIntegrationPaths);
		assert.deepEqual(record.guidePaths
			, dependentSignatureCompletePromotionGuidePaths);
		assert.deepEqual({
			cells: record.cells, observations: record.observations
			, referenceFiles: record.referenceFiles
		}, { cells: 34, observations: 2, referenceFiles: 20 });
	}
);

test("complete dependent-signature publication reverses every source"
	, async () => {
		const record = await readRecord();
		for(const update of record.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				dependentSignatureCompletePromotionImplementation, update.path
			), update), true, update.path);
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${dependentSignatureCompletePromotionImplementation}:${update.path}`]);
			assert.equal(reverseDependentSignatureCompletePromotionUpdate(
				current, update), previous, update.path);
			assert.equal(beforeDependentSignatureCompletePromotionSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("complete dependent-signature publication authenticates history controls"
	, async () => {
		const record = await readRecord();
		assert.deepEqual(record.historyAdditions.map(item => item.path)
			, dependentSignatureCompletePromotionHistoryAdditions);
		for(const addition of record.historyAdditions)
		{
			const source = await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256);
			assert.equal(sha256(source), addition.sha256, addition.path);
		}
		assert.deepEqual(git(["rev-list", "--reverse"
			, `${dependentSignatureCompletePromotionPredecessor}..${dependentSignatureCompletePromotionImplementation}`])
			.trim().split("\n"), dependentSignatureCompletePromotionCommits);
	}
);

test("complete dependent-signature publication rejects forged transitions"
	, async () => {
		const update = (await readRecord()).updates.find(item =>
			item.path !== "docs/type-surface.v1.json");
		const current = git(["show"
			, `${dependentSignatureCompletePromotionImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseDependentSignatureCompletePromotionUpdate(current, forged));
	}
);

test("complete dependent-signature publication writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-dependent-complete-promotion-history-test-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const localGit = arguments_ => execFileSync("git", arguments_, {
			cwd: root, env: environment, stdio: "pipe"
		});
		localGit(["init", "--quiet"]);
		localGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-dependent-signature-complete-promotion-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
