/**
 * Authenticate the owned-Subtype analysis transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeOwnedSubtypeJavaScriptTransferSource } from "./owned-subtype-javascript-transfer-source-history.mjs";
import { beforeOwnedSubtypeJavaScriptSource } from "./owned-subtype-javascript-source-history.mjs";
import { beforeOwnedRefinementCarriersSource } from "./owned-refinement-carriers-source-history.mjs";
import { beforeOwnedRefinementModelSource } from "./owned-refinement-model-source-history.mjs";
import {
	beforeOwnedSubtypeAnalysisSource
	, ownedSubtypeAnalysisChangedPaths
	, ownedSubtypeAnalysisHistoryPath
	, ownedSubtypeAnalysisImplementation
	, ownedSubtypeAnalysisPredecessor
	, reverseOwnedSubtypeAnalysisUpdate
} from "./owned-subtype-analysis-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedSubtypeAnalysisPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("owned Subtype analysis history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeAnalysisHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-analysis-source-v1");
	assert.equal(record.predecessorCommit, ownedSubtypeAnalysisPredecessor);
	assert.equal(record.implementationCommit, ownedSubtypeAnalysisImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeAnalysisChangedPaths);
	for(const update of record.updates)
	{
		const live = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeOwnedSubtypeJavaScriptTransferSource
		);
		const installed = beforeOwnedSubtypeJavaScriptSource(
			update.path, live
		);
		const carriers = beforeOwnedRefinementCarriersSource(
			update.path, installed
		);
		const current = beforeOwnedRefinementModelSource(
			update.path, carriers, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseOwnedSubtypeAnalysisUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeOwnedSubtypeAnalysisSource(
			update.path, current), previous);
		assert.equal(beforeOwnedSubtypeAnalysisSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeOwnedSubtypeAnalysisSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const addition of record.additions)
	{
		const live = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256, beforeOwnedSubtypeJavaScriptTransferSource
		);
		const installed = beforeOwnedSubtypeJavaScriptSource(
			addition.path, live
		);
		const carriers = beforeOwnedRefinementCarriersSource(
			addition.path, installed
		);
		const current = beforeOwnedRefinementModelSource(
			addition.path, carriers, addition.currentSha256
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
});

test("owned Subtype history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeAnalysisHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeAnalysisUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseOwnedSubtypeAnalysisUpdate(current, update));
});

test("owned Subtype history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-owned-subtype-analysis-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-analysis-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
