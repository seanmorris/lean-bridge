/**
 * Authenticate both parents of the historical Core evidence repair integration.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeCoreEvidenceRepairIntegrationSource
	, coreEvidenceRepairIntegrationAddedPaths
	, coreEvidenceRepairIntegrationChangedPaths
	, coreEvidenceRepairIntegrationCommit
	, coreEvidenceRepairIntegrationHistoryPath
	, coreEvidenceRepairIntegrationLeftParent
	, coreEvidenceRepairIntegrationRetainedHistoryPath
	, coreEvidenceRepairIntegrationRetainedPaths
	, coreEvidenceRepairIntegrationRightParent
	, reverseCoreEvidenceRepairIntegrationUpdate
} from "./core-evidence-repair-integration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (revision, path) => git(["show", `${revision}:${path}`]);
const readRecord = async () => JSON.parse(await readFile(
	coreEvidenceRepairIntegrationHistoryPath, "utf8"
));

const assertRetainedParents = async path => {
	const left = sourceAt(coreEvidenceRepairIntegrationLeftParent, path);
	assert.equal(sourceAt(coreEvidenceRepairIntegrationCommit, path), left, path);
	assert.equal(await sourceAtFinHistoryMilestone(path, sha256(left)), left, path);
	const right = sourceAt(coreEvidenceRepairIntegrationRightParent, path);
	assert.equal(await sourceAtFinHistoryMilestone(path, sha256(right)), right, path);
};

const assertParents = async update => {
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreEvidenceRepairIntegrationSource
	);
	assert.equal(sha256(current), update.currentSha256, update.path);
	for(const [side, revision] of [
		["left", coreEvidenceRepairIntegrationLeftParent]
		, ["right", coreEvidenceRepairIntegrationRightParent]
	]) {
		const parent = sourceAt(revision, update.path);
		assert.equal(update[side].previousSha256, sha256(parent), update.path);
		assert.equal(reverseCoreEvidenceRepairIntegrationUpdate(
			current, update, side), parent, update.path);
		assert.equal(beforeCoreEvidenceRepairIntegrationSource(
			update.path, current, sha256(parent)), parent, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, sha256(parent)), parent, update.path);
	}
	assert.ok(update.rightExpectedSha256.includes(update.right.previousSha256)
		, update.path);
	assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
};

test("Core evidence repair integration restores both small-source parents", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-evidence-repair-integration-source-v1");
	assert.equal(record.integrationCommit, coreEvidenceRepairIntegrationCommit);
	assert.deepEqual(record.parents, [
		coreEvidenceRepairIntegrationLeftParent
		, coreEvidenceRepairIntegrationRightParent
	]);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreEvidenceRepairIntegrationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreEvidenceRepairIntegrationAddedPaths);
	assert.deepEqual(record.retainedPaths, coreEvidenceRepairIntegrationRetainedPaths);
	assert.equal(record.retainedHistory.path, coreEvidenceRepairIntegrationRetainedHistoryPath);
	assert.equal(record.retainedHistory.sha256, sha256(await readFile(
		coreEvidenceRepairIntegrationRetainedHistoryPath)));
	for(const update of record.updates)
		await assertParents(update);
	for(const path of coreEvidenceRepairIntegrationRetainedPaths.filter(
		item => item !== inventoryPath)) await assertRetainedParents(path);
});

// Kept separate so small local checks need not replay the large inventory.
// The ordinary unfiltered Core suite includes this test.
test("Core evidence repair integration restores both inventory parents", async () => {
	const record = await readRecord();
	assert.ok(record.retainedPaths.includes(inventoryPath));
	assert.ok(!record.updates.some(item => item.path === inventoryPath));
	await assertRetainedParents(inventoryPath);
});

test("Core evidence repair integration retains exact merge lineage", async () => {
	const record = await readRecord();
	assert.deepEqual(git([
		"show", "-s", "--format=%P", coreEvidenceRepairIntegrationCommit
	]).trim().split(" "), [
		coreEvidenceRepairIntegrationLeftParent
		, coreEvidenceRepairIntegrationRightParent
	]);
	const fork = git(["merge-base", ...record.parents]).trim();
	assert.equal(record.forkCommit, fork);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, ...record.parents]).trim().split("\n").filter(Boolean).sort()
	, [...coreEvidenceRepairIntegrationChangedPaths
		, ...coreEvidenceRepairIntegrationRetainedPaths].sort());
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, coreEvidenceRepairIntegrationLeftParent
		, coreEvidenceRepairIntegrationCommit])
		.trim().split("\n").filter(Boolean).sort()
	, [...coreEvidenceRepairIntegrationChangedPaths].sort());
	assert.deepEqual(record.rightHistoryRecords, git([
		"diff", "--name-only", "--diff-filter=A", fork
		, coreEvidenceRepairIntegrationRightParent, "--", "docs/evidence"
	]).trim().split("\n").filter(path =>
		/^docs\/evidence\/[^/]*history[^/]*\.json$/u.test(path)).sort());
});

test("Core evidence repair integration authenticates added helpers", async () => {
	const record = await readRecord();
	for(const addition of record.additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, coreEvidenceRepairIntegrationCommit, "--", addition.path]).trim(), "");
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
	}
});

test("Core evidence repair integration rejects malformed parent transitions", async () => {
	const record = await readRecord();
	const update = record.updates.find(item => item.path !== inventoryPath
		&& item.left.edits.length > 0 && item.right.edits.length > 0);
	assert.ok(update);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeCoreEvidenceRepairIntegrationSource
	);
	for(const side of ["left", "right"])
	{
		for(const change of [
			item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown.mjs"; }
			, item => { item[side].previousSha256 = "0".repeat(64); }
			, item => { item[side].edits = []; }
			, item => { item[side].edits[0].start += 1; }
			, item => { item[side].edits[0].current += "altered"; }
			, item => { item[side].edits[0].previous += "altered"; }
			, item => { item[side].edits.push(item[side].edits[0]); }
		]) {
			const changed = structuredClone(update);
			change(changed);
			assert.throws(() => reverseCoreEvidenceRepairIntegrationUpdate(
				current, changed, side));
		}
	}
	assert.throws(() => reverseCoreEvidenceRepairIntegrationUpdate(
		current, update, "unknown"));
});

test("Core evidence repair integration preserves unrelated and binary content", async () => {
	const record = await readRecord();
	const update = record.updates.find(item => item.path !== inventoryPath);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeCoreEvidenceRepairIntegrationSource
	);
	const unknown = `${current}unrelated\n`;
	assert.equal(beforeCoreEvidenceRepairIntegrationSource(update.path, unknown), unknown);
	assert.equal(beforeCoreEvidenceRepairIntegrationSource("unknown.mjs", current), current);
	const bytes = Buffer.from(current);
	assert.equal(beforeCoreEvidenceRepairIntegrationSource(update.path, bytes), bytes);
	assert.equal(beforeCoreEvidenceRepairIntegrationSource(
		update.path, current, update.currentSha256), current);
});

test("Core evidence repair integration writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-evidence-repair-integration-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env, stdio: "pipe" });
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-evidence-repair-integration-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
