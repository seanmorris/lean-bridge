/**
 * Preserve earlier evidence through exact PHP-Wasm report path and CI comparison repair.
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
import { beforeNominalSubtypePhpWasmPathSource, beforeNominalSubtypePhpWasmPathPins, nominalSubtypePhpWasmPathChangedPaths, nominalSubtypePhpWasmPathHistoryPath, nominalSubtypePhpWasmPathPredecessor, reverseNominalSubtypePhpWasmPathUpdate } from "./nominal-subtype-php-wasm-path-history.mjs";

test("PHP-Wasm report path and CI comparison repair authenticates exact changes without adding support claims", async () => {
	const record = JSON.parse(await readFile(nominalSubtypePhpWasmPathHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-php-wasm-path-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypePhpWasmPathPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypePhpWasmPathChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypePhpWasmPathPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalSubtypePhpWasmPathSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalSubtypePhpWasmPathUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypePhpWasmPathSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypePhpWasmPathSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypePhpWasmPathSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypePhpWasmPathSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypePhpWasmPathUpdate(current, changed));
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
	assert.equal(pins, 4);
	assert.deepEqual(beforeNominalSubtypePhpWasmPathPins(inventory), JSON.parse(original(path)));
	const checkpoint = record.updates.find(update => update.path === path).currentSha256;
	assert.deepEqual(JSON.parse(beforeNominalSubtypePhpWasmPathSource(path, await readFile(path, "utf8"), checkpoint)), inventory);
});

test("PHP-Wasm report path and CI comparison repair writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-php-wasm-path-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-php-wasm-path-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
