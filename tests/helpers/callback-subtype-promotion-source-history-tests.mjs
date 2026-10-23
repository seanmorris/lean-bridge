/**
 * Authenticate the final synchronous callback Subtype promotion history.
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
	beforeCallbackSubtypePromotionSource
	, callbackSubtypePromotionHistoryPath
	, callbackSubtypePromotionIntegrationPaths
	, callbackSubtypePromotionPredecessor
	, reverseCallbackSubtypePromotionUpdate
} from "./callback-subtype-promotion-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype promotion records every exact integration transition", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypePromotionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-promotion-source-v1");
	assert.equal(record.predecessorCommit, callbackSubtypePromotionPredecessor);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypePromotionIntegrationPaths);
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${callbackSubtypePromotionPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypePromotionUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCallbackSubtypePromotionSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);

	const previousInventory = JSON.parse(git(["show"
		, `${callbackSubtypePromotionPredecessor}:docs/type-surface.v1.json`]));
	// Read this promotion's own inventory milestone; later pin layers keep
	// advancing the live inventory.
	const inventoryUpdate = record.integrationUpdates.find(update =>
		update.path === "docs/type-surface.v1.json");
	const currentInventory = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256));
	const milestoneDigests = new Map(record.integrationUpdates.map(update =>
		[update.path, update.currentSha256]));
	const previousPins = new Map(previousInventory.evidence.flatMap(evidence =>
		evidence.files.map(file => [
			`${evidence.id}\0${file.path}`, file.sha256
		])
	));
	const advances = currentInventory.evidence.flatMap(evidence =>
		evidence.files.map(file => ({ evidence: evidence.id, ...file })))
		.filter(file => previousPins.has(`${file.evidence}\0${file.path}`)
			&& previousPins.get(`${file.evidence}\0${file.path}`)
				!== file.sha256);
	const previousEvidence = new Set(previousInventory.evidence.map(item =>
		item.id));
	const newAdvances = currentInventory.evidence.filter(evidence =>
		!previousEvidence.has(evidence.id)).flatMap(evidence =>
		evidence.files.filter(file =>
			callbackSubtypePromotionIntegrationPaths.includes(file.path)));
	assert.equal(advances.length + newAdvances.length
		, record.reconciledTypeSurfacePointers);
	for(const file of [...advances, ...newAdvances])
	{
		assert.ok(callbackSubtypePromotionIntegrationPaths.includes(file.path)
			, file.path);
		assert.equal(file.sha256, milestoneDigests.get(file.path), file.path);
	}
});

test("callback Subtype promotion rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypePromotionHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackSubtypePromotionUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseCallbackSubtypePromotionUpdate(current, update));
});

test("callback Subtype promotion traverses older milestones", async () => {
	const expected
		= "1825f34e6589cf0629b026bfb1bae0c415932ba5fcf99cbbda81fa8620820d0f";
	const source = await sourceAtFinHistoryMilestone(
		"tests/helpers/fin-refinement-source-history.mjs", expected);
	assert.equal(sha256(source), expected);
});

test("callback Subtype promotion history writer refuses unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-bridge-callback-subtype-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const unrelatedGit = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	unrelatedGit(["init", "--quiet"]);
	unrelatedGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-subtype-promotion-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
