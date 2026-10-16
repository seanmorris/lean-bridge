/**
 * Exact source-history controls for recursive checked PHP-Wasm graphs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeRecursiveSubtypePhpWasmSource
	, recursiveSubtypePhpWasmChangedPaths
	, recursiveSubtypePhpWasmDraftParent
	, recursiveSubtypePhpWasmHistoryPath
	, recursiveSubtypePhpWasmPredecessor
	, reverseRecursiveSubtypePhpWasmUpdate
} from "./recursive-subtype-php-wasm-source-history.mjs";

test("recursive checked PHP-Wasm history reconstructs every predecessor source", async () => {
	const record = JSON.parse(await readFile(recursiveSubtypePhpWasmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "recursive-subtype-php-wasm-source-v1");
	assert.equal(record.predecessorCommit, recursiveSubtypePhpWasmPredecessor);
	assert.equal(record.draftParentCommit, recursiveSubtypePhpWasmDraftParent);
	assert.deepEqual(record.updates.map(update => update.path), recursiveSubtypePhpWasmChangedPaths);
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = execFileSync("git", ["show", `${recursiveSubtypePhpWasmPredecessor}:${update.path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
		assert.equal(reverseRecursiveSubtypePhpWasmUpdate(current, update), previous);
		assert.equal(beforeRecursiveSubtypePhpWasmSource(update.path, current), previous);
		assert.equal(beforeRecursiveSubtypePhpWasmSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeRecursiveSubtypePhpWasmSource(update.path, current + "unknown"), current + "unknown");
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveSubtypePhpWasmUpdate(current, changed));
		}
	}
});

test("recursive checked PHP-Wasm history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-subtype-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-recursive-subtype-php-wasm-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
