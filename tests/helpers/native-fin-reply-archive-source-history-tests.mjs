/**
 * Native Fin reply archive integration and the support table preserve earlier source evidence.
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
import { beforeNativeFinReplyPromotionSource } from "./native-fin-reply-promotion-source-history.mjs";
import { beforeNativeFinReplyArchiveSource, nativeFinReplyArchiveChangedPaths, nativeFinReplyArchiveHistoryPath, reverseNativeFinReplyArchiveUpdate } from "./native-fin-reply-archive-source-history.mjs";

test("Native Fin reply archive integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeFinReplyArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "a9b6940ac04df73218a57f4af0702eef744ae1b5");
	assert.deepEqual(record.updates.map(update => update.path), nativeFinReplyArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeFinReplyPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeFinReplyArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinReplyArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinReplyArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeFinReplyArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinReplyArchiveUpdate(changed, update));
		assert.throws(() => reverseNativeFinReplyArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Native Fin reply archive source pins do not change observations or other inventory claims", async () => {
	const path = "docs/type-surface.v1.json", text = beforeNativeFinReplyPromotionSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforeNativeFinReplyArchiveSource(path, text));
	const record = JSON.parse(await readFile(nativeFinReplyArchiveHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforeNativeFinReplyPromotionSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.equal(refreshed, 0);
	assert.deepEqual(document, previous);
});

test("the native Fin reply archive updater refuses another HEAD before any evidence write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reply-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-fin-reply-archive-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Native Fin reply archive history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
