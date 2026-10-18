/**
 * Authenticate the historical nested native archive gap and this repair's own transitions.
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
import {
	beforeNestedCheckedRecordArchiveGapSource
	, nestedCheckedRecordArchiveGapChangedPaths
	, nestedCheckedRecordArchiveGapHistoryPath
	, nestedCheckedRecordArchiveGapPath
	, nestedCheckedRecordArchiveGapPredecessor
	, nestedCheckedRecordArchiveGaps
	, reverseNestedCheckedRecordArchiveGapUpdate
} from "./nested-checked-record-archive-gap-history.mjs";

const show = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const sha256 = text => execFileSync("sha256sum", { input: text, encoding: "utf8" }).slice(0, 64);

test("nested checked-record archive gap reproduces the unrecorded test epoch exactly", async () => {
	const record = JSON.parse(await readFile(nestedCheckedRecordArchiveGapHistoryPath, "utf8"));
	assert.equal(record.milestone, "nested-checked-record-archive-gap-source-v1");
	assert.deepEqual(Object.keys(record.gaps).sort(), Object.keys(nestedCheckedRecordArchiveGaps).sort());
	const path = nestedCheckedRecordArchiveGapPath;
	for(const [name, [from, to]] of Object.entries(nestedCheckedRecordArchiveGaps))
	{
		const update = record.gaps[name], previous = show(from, path), current = show(to, path);
		assert.equal(update.previousSha256, sha256(previous)); assert.equal(update.currentSha256, sha256(current));
		assert.equal(reverseNestedCheckedRecordArchiveGapUpdate(current, update), previous);
		assert.equal(beforeNestedCheckedRecordArchiveGapSource(name, path, current), previous);
		assert.equal(beforeNestedCheckedRecordArchiveGapSource(name, path, current, update.currentSha256), current);
		assert.equal(beforeNestedCheckedRecordArchiveGapSource(name, path, current + "x"), current + "x");
		// The whole hub now reaches the earlier epoch from the current aggregator.
		const reached = beforeFinRefinementSource(path, await readFile(path, "utf8"), update.previousSha256);
		assert.equal(sha256(reached), update.previousSha256, name);
	}
});

test("nested checked-record archive repair records its own exact source transitions", async () => {
	const record = JSON.parse(await readFile(nestedCheckedRecordArchiveGapHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, nestedCheckedRecordArchiveGapPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nestedCheckedRecordArchiveGapChangedPaths);
	for(const update of record.updates)
	{
		// Newer layers may edit the same sources; stop at this repair's recorded output.
		const current = beforeFinRefinementSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = show(nestedCheckedRecordArchiveGapPredecessor, update.path);
		assert.equal(reverseNestedCheckedRecordArchiveGapUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
	}
});

test("nested checked-record archive gap writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-archive-gap-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	const identity = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"];
	git([...identity, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const script = resolve("scripts/update-nested-checked-record-archive-gap-history.mjs");
	const result = spawnSync(process.execPath, [script], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
