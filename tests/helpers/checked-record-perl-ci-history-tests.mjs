/**
 * Authenticate the new Perl installed CI gate while preserving earlier evidence.
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
import { beforeCheckedRecordPerlPromotionSource } from "./checked-record-perl-promotion-history.mjs";
import { beforeCheckedRecordPerlCiSource, checkedRecordPerlCiChangedPaths, checkedRecordPerlCiHistoryPath, checkedRecordPerlCiPredecessor, reverseCheckedRecordPerlCiUpdate } from "./checked-record-perl-ci-history.mjs";

test("Perl installed CI history restores exact workflow predecessors and rejects unrecorded edits", async () => {
	const history = JSON.parse(await readFile(checkedRecordPerlCiHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "checked-record-perl-ci-v1");
	assert.equal(history.predecessorCommit, checkedRecordPerlCiPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), checkedRecordPerlCiChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeCheckedRecordPerlPromotionSource(update.path, await readFile(update.path, "utf8"));
		const previous = reverseCheckedRecordPerlCiUpdate(current, update);
		assert.equal(beforeCheckedRecordPerlCiSource(update.path, current), previous);
		assert.equal(beforeCheckedRecordPerlCiSource(update.path, current, update.currentSha256), current);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeCheckedRecordPerlCiSource(update.path, unknown), unknown);
		assert.throws(() => reverseCheckedRecordPerlCiUpdate(unknown, update));
		if(update.path === ".github/workflows/perl-consumer.yml")
		{
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
			const bytes = Buffer.from(current);
			assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		}
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordPerlCiUpdate(current, changed));
			}
	}
});

test("Perl installed CI refreshes only workflow pins and preserves every support claim", async () => {
	const path = "docs/type-surface.v1.json";
	const source = beforeCheckedRecordPerlPromotionSource(path, await readFile(path, "utf8"));
	const previous = beforeCheckedRecordPerlCiSource(path, source);
	assert.equal(sha256(previous), "272c84a3d4fb5db30f96c3d120eb11bedea9c8392ad0cc5b7e1f220cf0919811");
	const inventory = JSON.parse(source), expected = JSON.parse(previous);
	const history = JSON.parse(await readFile(checkedRecordPerlCiHistoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ assert.equal(file.path, ".github/workflows/perl-consumer.yml"); file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 13); assert.deepEqual(inventory, expected);
	assert.equal(inventory.evidence.length, 436); assert.equal(inventory.observations.length, 551);
	const checked = new Map();
	for(const file of inventory.evidence.flatMap(entry => entry.files))
	{
		const key = file.path + ":" + file.sha256;
		if(!checked.has(key)) checked.set(key, sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)));
		assert.equal(checked.get(key), file.sha256, file.path);
	}
	assert.equal(checked.size, 3893);
});

test("Perl installed CI history writer refuses another checkout before creating files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-installed-ci-history-guard-"));
	t.after(() => rm(directory, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-perl-ci-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
