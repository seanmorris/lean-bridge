/**
 * Preserve earlier evidence through exact PHP-Wasm corpus partition.
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
import { sha256 } from "./source-history-digest.mjs";
import { beforePhpWasmCorpusPartitionSource, phpWasmCorpusPartitionChangedPaths, phpWasmCorpusPartitionHistoryPath, phpWasmCorpusPartitionPredecessor, reversePhpWasmCorpusPartitionUpdate } from "./php-wasm-corpus-partition-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";

test("PHP-Wasm corpus partition authenticates exact changes without adding support claims", async () => {
	const record = JSON.parse(await readFile(phpWasmCorpusPartitionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "php-wasm-corpus-partition-source-v1");
	assert.equal(record.predecessorCommit, phpWasmCorpusPartitionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), phpWasmCorpusPartitionChangedPaths);
	const original = path => execFileSync("git", ["show", `${phpWasmCorpusPartitionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = sourceAtHistoryMilestone(
			phpWasmCorpusPartitionHistoryPath, update.path
		);
		const previous = reversePhpWasmCorpusPartitionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforePhpWasmCorpusPartitionSource(update.path, current), previous);
		assert.equal(beforePhpWasmCorpusPartitionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforePhpWasmCorpusPartitionSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforePhpWasmCorpusPartitionSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reversePhpWasmCorpusPartitionUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json", inventory = JSON.parse(original(path));
	assert.equal(beforeFinRefinementSource(path, await readFile(path, "utf8"), sha256(original(path))), original(path));
	assert.equal(inventory.evidence.length, 520); assert.equal(inventory.observations.length, 595);
	let pins = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 117);
	const checkpoint = record.updates.find(update => update.path === path).currentSha256;
	const current = sourceAtHistoryMilestone(phpWasmCorpusPartitionHistoryPath, path);
	assert.deepEqual(JSON.parse(beforePhpWasmCorpusPartitionSource(path, current, checkpoint)), inventory);
});

test("PHP-Wasm corpus partition writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-corpus-partition-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-php-wasm-corpus-partition-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
