/**
 * Verify the bounded nested-promotion repair and source-history seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220NestedPromotionMemoryBound
	, beforeVo1220NestedPromotionMemoryBoundSource
	, reverseVo1220NestedPromotionMemoryBoundUpdate
	, vo1220NestedPromotionMemoryBoundBehavior
	, vo1220NestedPromotionMemoryBoundHistoryAdditions
	, vo1220NestedPromotionMemoryBoundHistoryPath
	, vo1220NestedPromotionMemoryBoundImplementation
	, vo1220NestedPromotionMemoryBoundImplementationPaths
	, vo1220NestedPromotionMemoryBoundIntegrationPaths
	, vo1220NestedPromotionMemoryBoundNormalizationPaths
	, vo1220NestedPromotionMemoryBoundPredecessor
} from "./vo1220-nested-promotion-memory-bound-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220NestedPromotionMemoryBoundHistoryPath, "utf8"
));

test("bounded promotion expansion authenticates every transition", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "vo1220-nested-promotion-memory-bound-source-v1");
	assert.equal(record.predecessorCommit
		, vo1220NestedPromotionMemoryBoundPredecessor);
	assert.equal(record.implementationCommit
		, vo1220NestedPromotionMemoryBoundImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, vo1220NestedPromotionMemoryBoundImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, vo1220NestedPromotionMemoryBoundIntegrationPaths);
	assert.deepEqual(record.historyAdditions.map(addition => addition.path)
		, vo1220NestedPromotionMemoryBoundHistoryAdditions);
	for(const addition of record.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of record.updates)
	{
		const current = blob(vo1220NestedPromotionMemoryBoundImplementation
			, update.path);
		const previous = blob(vo1220NestedPromotionMemoryBoundPredecessor
			, update.path);
		assert.equal(reverseVo1220NestedPromotionMemoryBoundUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(vo1220NestedPromotionMemoryBoundImplementation
			, update.path);
		assert.equal(reverseVo1220NestedPromotionMemoryBoundUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("bounded promotion expansion changes no support or runtime semantics"
	, async () => {
		const record = await read();
		assert.deepEqual(record.behavior
			, vo1220NestedPromotionMemoryBoundBehavior);
		assert.equal(record.changedSupportCells, 0);
		assert.equal(record.runtimeSemanticChanges, 0);
		const sources = Object.fromEntries(
			vo1220NestedPromotionMemoryBoundImplementationPaths.map(path => [
				path, blob(vo1220NestedPromotionMemoryBoundImplementation, path)
			])
		);
		assert.deepEqual(assertVo1220NestedPromotionMemoryBound(sources)
			, vo1220NestedPromotionMemoryBoundBehavior);
		for(const path of [
			"docs/evidence/vo1220-exact-type-surface-v1.json"
			, "docs/type-surface.v1.json"
		]) {
			const previous = blob(vo1220NestedPromotionMemoryBoundPredecessor, path);
			const current = blob(vo1220NestedPromotionMemoryBoundImplementation, path);
			assert.equal(current, previous, path);
			if(path === "docs/type-surface.v1.json")
				assert.equal(record.inventorySha256, sha256(current));
		}
	}
);

test("bounded promotion expansion rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).updates[0];
		const current = blob(vo1220NestedPromotionMemoryBoundImplementation
			, update.path);
		assert.equal(beforeVo1220NestedPromotionMemoryBoundSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220NestedPromotionMemoryBoundSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() =>
				reverseVo1220NestedPromotionMemoryBoundUpdate(current, forged));
		assert.ok(vo1220NestedPromotionMemoryBoundNormalizationPaths
			.includes(update.path));
	}
);

test("bounded promotion history writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-nested-memory-bound-guard-`);
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-nested-promotion-memory-bound-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
