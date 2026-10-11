/**
 * Preserve installed observations while checking checked-record Ruby/JVM archive.
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
import { beforeCheckedRecordRemainingHostsArchiveSource } from "./checked-record-remaining-hosts-history.mjs";
import { beforeCheckedRecordRubyJvmArchiveSource, checkedRecordRubyJvmArchiveChangedPaths, checkedRecordRubyJvmArchiveHistoryPath, checkedRecordRubyJvmArchivePredecessor, reverseCheckedRecordRubyJvmArchiveUpdate } from "./checked-record-ruby-jvm-history.mjs";

test("Checked-record Ruby/JVM archive history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(checkedRecordRubyJvmArchiveHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "checked-record-ruby-jvm-v1");
	assert.equal(history.predecessorCommit, checkedRecordRubyJvmArchivePredecessor);
	assert.deepEqual(history.updates.map(update => update.path), checkedRecordRubyJvmArchiveChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeCheckedRecordRemainingHostsArchiveSource(update.path, await readFile(update.path, "utf8"));
		const previous = reverseCheckedRecordRubyJvmArchiveUpdate(current, update);
		assert.equal(beforeCheckedRecordRubyJvmArchiveSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeCheckedRecordRubyJvmArchiveSource(update.path, unknown), unknown);
		assert.throws(() => reverseCheckedRecordRubyJvmArchiveUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordRubyJvmArchiveUpdate(current, changed));
			}
	}
});

test("Checked-record Ruby/JVM archive changes only source pins and preserves all installed observations", async () => {
	const history = JSON.parse(await readFile(checkedRecordRubyJvmArchiveHistoryPath));
	const path = "docs/type-surface.v1.json";
	const source = beforeCheckedRecordRemainingHostsArchiveSource(path, await readFile(path, "utf8"));
	const restored = beforeCheckedRecordRubyJvmArchiveSource(path, source);
	assert.equal(sha256(restored), "82d1a1dc6cf3dca0a0fb7e730fbcc6b843f516d99bdc6b97d923b5e951d2b081");
	const current = JSON.parse(source), previous = JSON.parse(restored);
	const expected = structuredClone(previous); let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 18); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 420); assert.equal(current.observations.length, 519);
	assert.deepEqual(current.observations, previous.observations);
	const hashes = new Map();
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		const key = file.path + ":" + file.sha256;
		if(!hashes.has(key)) hashes.set(key, sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)));
		assert.equal(hashes.get(key), file.sha256, file.path);
	}
	assert.equal(sha256(await readFile("docs/evidence/checked-record-python-source-history-20261010.json")), "09f90b179bc965f4e262843ab680c86764eb44307ebfaad0ab0bee2ed814b31c");
});

test("Checked-record Ruby/JVM archive history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-ruby-jvm-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-ruby-jvm-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
