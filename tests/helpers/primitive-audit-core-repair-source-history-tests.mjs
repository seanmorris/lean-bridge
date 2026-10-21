/**
 * Authenticate the primitive-audit Core repair and its closed pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	primitiveAuditIntegrationChangedPaths
	, primitiveAuditIntegrationHistoryPath
} from "./primitive-audit-integration-source-history.mjs";
import {
	beforePrimitiveAuditCoreRepairSource
	, primitiveAuditCoreRepairAddedPaths
	, primitiveAuditCoreRepairChangedPaths
	, primitiveAuditCoreRepairDraftParent
	, primitiveAuditCoreRepairExpectedPinCount
	, primitiveAuditCoreRepairHistoryPath
	, primitiveAuditCoreRepairPredecessor
	, primitiveAuditCoreRepairProfilePredecessor
	, reversePrimitiveAuditCoreRepairUpdate
} from "./primitive-audit-core-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";

const show = (commit, path) => execFileSync("git", ["show"
	, `${commit}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("primitive audit Core repair authenticates every transition and pin", async t => {
	const record = JSON.parse(await readFile(
		primitiveAuditCoreRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "primitive-audit-core-repair-source-v1");
	assert.equal(record.predecessorCommit
		, primitiveAuditCoreRepairPredecessor);
	assert.equal(record.draftParentCommit
		, primitiveAuditCoreRepairDraftParent);
	assert.equal(record.profilePredecessorCommit
		, primitiveAuditCoreRepairProfilePredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, primitiveAuditCoreRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, primitiveAuditCoreRepairAddedPaths);
	assert.equal(await readFile(
		"docs/evidence/nominal-primitive-subtype-supplement-20261018/.gitattributes"
		, "utf8"), "# Preserve the exact supplemental primitive-base GitHub job log.\napi/job.log whitespace=-blank-at-eol\n");
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	for(const update of record.updates)
	{
		const current = sourceAtHistoryMilestone(
			primitiveAuditCoreRepairHistoryPath, update.path
		);
		const predecessor = update.predecessorCommit
			?? primitiveAuditCoreRepairPredecessor;
		const previous = show(predecessor, update.path);
		assert.equal(reversePrimitiveAuditCoreRepairUpdate(current, update)
			, previous);
		assert.equal(beforePrimitiveAuditCoreRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforePrimitiveAuditCoreRepairSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforePrimitiveAuditCoreRepairSource(
			update.path, current + "unknown"), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() =>
				reversePrimitiveAuditCoreRepairUpdate(current, changed));
		}
		if(update.replacements)
		{
			const changed = structuredClone(update);
			changed.replacements[0].count++;
			assert.throws(() =>
				reversePrimitiveAuditCoreRepairUpdate(current, changed));
		}
		else
		{
			const changed = structuredClone(update);
			changed.edits[0].start = -1;
			assert.throws(() =>
				reversePrimitiveAuditCoreRepairUpdate(current, changed));
		}
	}
	assert.equal(record.pinCount, primitiveAuditCoreRepairExpectedPinCount);
	assert.equal(record.pinUpdates.length, 7);
	assert.equal(record.pinUpdates.reduce((sum, item) => sum + item.count, 0)
		, primitiveAuditCoreRepairExpectedPinCount);
	assert.deepEqual(record.pinUpdates.map(item => [item.path, item.count]), [
		["src/adoption/test-profiles.mjs", 94]
		, ["tests/helpers/nested-checked-record-browser-promotion-tests.mjs", 4]
		, ["tests/helpers/nominal-subtype-dotnet-promotion-tests.mjs", 4]
		, ["tests/helpers/nominal-subtype-jvm-promotion-tests.mjs", 4]
		, ["tests/helpers/nominal-subtype-native-promotion-tests.mjs", 4]
		, ["tests/helpers/nominal-subtype-python-promotion-tests.mjs", 4]
		, ["tests/helpers/nominal-subtype-rust-promotion-tests.mjs", 4]
	]);
	const inventoryPath = "docs/type-surface.v1.json";
	const current = JSON.parse(sourceAtHistoryMilestone(
		primitiveAuditCoreRepairHistoryPath, inventoryPath
	));
	const previous = JSON.parse(show(
		primitiveAuditCoreRepairPredecessor, inventoryPath
	));
	assert.deepEqual(current.observations, previous.observations);
	assert.deepEqual(current.evidence.map(item => [item.id, item.kind, item.scope])
		, previous.evidence.map(item => [item.id, item.kind, item.scope]));
	const profileUpdate = record.updates.find(item =>
		item.path === "src/adoption/test-profiles.mjs");
	assert.equal(profileUpdate.predecessorCommit
		, primitiveAuditCoreRepairProfilePredecessor);
	assert.equal(sourceAtHistoryMilestone(
		primitiveAuditCoreRepairHistoryPath, profileUpdate.path
	), show(primitiveAuditCoreRepairPredecessor, profileUpdate.path));
	const overlapPaths = primitiveAuditCoreRepairChangedPaths.filter(item =>
		primitiveAuditIntegrationChangedPaths.includes(item));
	for(const path of overlapPaths)
	{
		const update = record.updates.find(item => item.path === path);
		assert.equal(update.previousSha256, sha256(sourceAtHistoryMilestone(
			primitiveAuditIntegrationHistoryPath, path
		)), path);
	}
	t.diagnostic(`${record.pinCount} source pins repaired; support claims unchanged`);
});

test("history reconstruction refuses an unbound specialized predecessor", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-history-specialized-predecessor-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const historyPath = join(root, "history.json");
	await writeFile(historyPath, JSON.stringify({
		predecessorCommit: primitiveAuditCoreRepairPredecessor
		, updates: [{
			path: "package.json", previousSha256: "0".repeat(64)
			, currentSha256: "1".repeat(64)
			, edits: [{ start: 0, previous: "x", current: "y" }]
		}]
	}));
	assert.throws(() => sourceAtHistoryMilestone(historyPath, "package.json")
		, /missing specialized predecessor/u);
});

test("primitive audit Core repair writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-primitive-audit-core-repair-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const script = resolve(
		"scripts/update-primitive-audit-core-repair-source-history.mjs"
	);
	const result = spawnSync(process.execPath, [script]
		, { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
