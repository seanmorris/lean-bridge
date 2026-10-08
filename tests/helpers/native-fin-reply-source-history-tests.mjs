/**
 * Native Fin reply integration and the support table preserve earlier source evidence.
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
import { beforeCallbackCoverageRepairSource } from "./callback-coverage-repair-source-history.mjs";
import { beforeNativeFinReplySource, nativeFinReplyChangedPaths, nativeFinReplyHistoryPath, reverseNativeFinReplyUpdate } from "./native-fin-reply-source-history.mjs";

test("Native Fin reply integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeFinReplyHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "db772273b471ae846bd78953b5526530a03392ae");
	assert.deepEqual(record.updates.map(update => update.path), nativeFinReplyChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCallbackCoverageRepairSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeFinReplyUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinReplySource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinReplySource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeFinReplySource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinReplyUpdate(changed, update));
		assert.throws(() => reverseNativeFinReplyUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Native Fin reply source pins do not change observations or other inventory claims", async () => {
	const path = "docs/type-surface.v1.json", text = beforeCallbackCoverageRepairSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforeNativeFinReplySource(path, text));
	const record = JSON.parse(await readFile(nativeFinReplyHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforeCallbackCoverageRepairSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	assert.deepEqual(document, previous);
});

test("the native Fin reply history updater refuses another HEAD before any evidence write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reply-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-fin-reply-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Native Fin reply history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
