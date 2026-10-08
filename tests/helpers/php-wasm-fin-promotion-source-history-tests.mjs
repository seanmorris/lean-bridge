/**
 * Authenticate promotion source transitions and preserve every older evidence claim.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinReplySource } from "./native-fin-reply-source-history.mjs";
import { beforePhpWasmFinPromotionSource, phpWasmFinPromotionChangedPaths, phpWasmFinPromotionHistoryPath, reversePhpWasmFinPromotionUpdate } from "./php-wasm-fin-promotion-source-history.mjs";

test("the PHP-Wasm promotion updater refuses another HEAD before reading or writing evidence", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-php-wasm-fin-promotion-history.mjs")], { cwd: directory, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /PHP-Wasm promotion history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});

test("PHP-Wasm Fin promotion authenticates every exact predecessor and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(phpWasmFinPromotionHistoryPath));
	assert.equal(record.predecessorCommit, "c764790da547a5622fb120bb7f5564eed073b490");
	assert.deepEqual(record.updates.map(update => update.path), phpWasmFinPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeFinReplySource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpWasmFinPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpWasmFinPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforePhpWasmFinPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforePhpWasmFinPromotionSource(update.path, changed), changed);
		assert.throws(() => reversePhpWasmFinPromotionUpdate(changed, update));
		assert.throws(() => reversePhpWasmFinPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("PHP-Wasm Fin promotion preserves earlier evidence except exact authenticated source pins", async () => {
	const path = "docs/type-surface.v1.json", source = beforeNativeFinReplySource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforePhpWasmFinPromotionSource(path, source));
	const record = JSON.parse(await readFile(phpWasmFinPromotionHistoryPath));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(!update || file.sha256 !== update.previousSha256) continue;
		assert.equal(sha256(beforeNativeFinReplySource(file.path, await readFile(file.path, "utf8"))), update.currentSha256, file.path);
		file.sha256 = update.currentSha256; pins++;
	}
	assert.ok(pins > 0);
	assert.deepEqual(current.evidence.slice(0, previous.evidence.length), previous.evidence);
	assert.deepEqual(current.observations.slice(0, previous.observations.length), previous.observations);
});
