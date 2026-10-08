/**
 * Callback coverage repair integration and the support table preserve earlier source evidence.
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
import { beforeCallbackCoverageRepairSource, callbackCoverageRepairChangedPaths, callbackCoverageRepairHistoryPath, reverseCallbackCoverageRepairUpdate } from "./callback-coverage-repair-source-history.mjs";

test("Callback coverage repair integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(callbackCoverageRepairHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "d59313d0ed9ec3501757af762d6761b12384ba0e");
	assert.deepEqual(record.updates.map(update => update.path), callbackCoverageRepairChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseCallbackCoverageRepairUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCallbackCoverageRepairSource(update.path, source)), update.previousSha256);
		assert.equal(beforeCallbackCoverageRepairSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeCallbackCoverageRepairSource(update.path, changed), changed);
		assert.throws(() => reverseCallbackCoverageRepairUpdate(changed, update));
		assert.throws(() => reverseCallbackCoverageRepairUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Callback coverage repair source pins do not change observations or other inventory claims", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const document = JSON.parse(text), previous = JSON.parse(beforeCallbackCoverageRepairSource(path, text));
	const record = JSON.parse(await readFile(callbackCoverageRepairHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(await readFile(file.path, "utf8")), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	assert.deepEqual(document, previous);
});

test("the callback coverage repair updater refuses another HEAD before any evidence write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reply-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-callback-coverage-repair-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Callback coverage repair history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
