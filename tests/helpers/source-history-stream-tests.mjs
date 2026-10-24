/**
 * Authenticate streamed history spans, including Unicode and EOF edits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { authenticateSourceHistoryReverse, gitSourceHistoryTransition }
	from "./source-history-stream.mjs";

const fixture = async t => {
	const cwd = await mkdtemp(join(tmpdir(), "lean-source-history-stream-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd, env, encoding: "utf8" });
	git(["init", "--quiet"]);
	const commit = async source => {
		await writeFile(join(cwd, "source.txt"), source);
		git(["add", "source.txt"]);
		git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
			, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"]);
		return git(["rev-parse", "HEAD"]).trim();
	};
	return { cwd, commit };
};

const reverse = (source, update) => {
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	return parts.join("");
};

test("streamed history captures insertions, deletions, Unicode and non-newline EOF", async t => {
	const { cwd, commit } = await fixture(t);
	const original = "λ\r\nremoved\nkeep\n🭼 middle\nkeep again\ntail";
	const current = "intro ◆\nλ\r\nkeep\n🭿 middle\nkeep again\ntail\nadded\n";
	const previous = await commit(original), next = await commit(current);
	const update = await gitSourceHistoryTransition("source.txt", previous, next, { cwd });
	assert.equal(update.previousSha256, sha256(original));
	assert.equal(update.currentSha256, sha256(current));
	assert.equal(reverse(current, update), original);
	const encoded = Buffer.from(current);
	const chunks = Array.from({ length: encoded.length }, (_, index) => encoded.subarray(index, index + 1));
	assert.equal(await authenticateSourceHistoryReverse(Readable.from(chunks), update), true);
	assert.equal(await readFile(join(cwd, "source.txt"), "utf8"), current);
});

test("streamed history handles whole-file insertion and deletion at EOF", async t => {
	const { cwd, commit } = await fixture(t);
	const empty = await commit("");
	const full = await commit("🭼 whole file without newline");
	const added = await gitSourceHistoryTransition("source.txt", empty, full, { cwd });
	assert.equal(reverse("🭼 whole file without newline", added), "");
	const removed = await gitSourceHistoryTransition("source.txt", full, empty, { cwd });
	assert.equal(reverse("", removed), "🭼 whole file without newline");
	assert.equal(await authenticateSourceHistoryReverse(Readable.from([]), removed), true);
});

test("streamed history retains only sparse changes in a large unchanged source", async t => {
	const { cwd, commit } = await fixture(t);
	const repeated = "unchanged αβγ\n".repeat(100_000);
	const original = `first\n${repeated}old\n${repeated}last\n`;
	const current = `first\n${repeated}new 🭼\n${repeated}last\n`;
	const previous = await commit(original), next = await commit(current);
	const update = await gitSourceHistoryTransition("source.txt", previous, next
		, { cwd, maximumEditBytes: 1024 });
	assert.equal(update.edits.length, 1);
	assert.equal(update.edits[0].current, "new 🭼\n");
	assert.equal(update.edits[0].previous, "old\n");
	assert.equal(reverse(current, update), original);
	assert.ok(JSON.stringify(update).length < 1024);
});

test("streamed history refuses forged endpoints, spans and edit ordering", async t => {
	const { cwd, commit } = await fixture(t);
	const original = "head\nold\ntail\n", current = "head\nnew\ntail\n";
	const previous = await commit(original), next = await commit(current);
	const update = await gitSourceHistoryTransition("source.txt", previous, next, { cwd });
	for(const mutate of [
		value => { value.currentSha256 = "0".repeat(64); }
		, value => { value.previousSha256 = "0".repeat(64); }
		, value => { value.edits[0].current = "wrong\n"; }
		, value => { value.edits[0].previous = "wrong\n"; }
		, value => { value.edits[0].start++; }
		, value => { value.edits.push(value.edits[0]); }
		, value => { value.edits = []; }
		, value => { value.edits[0].unexpected = true; }
	]) {
		const forged = structuredClone(update); mutate(forged);
		await assert.rejects(authenticateSourceHistoryReverse(Readable.from([Buffer.from(current)]), forged));
	}
	await assert.rejects(authenticateSourceHistoryReverse(Readable.from([Buffer.from(current + "outside")]), update));
	await assert.rejects(gitSourceHistoryTransition("source.txt", previous, previous, { cwd }));
	await assert.rejects(gitSourceHistoryTransition("../source.txt", previous, next, { cwd }));
	await assert.rejects(gitSourceHistoryTransition("source.txt", previous, next, { cwd, maximumEditBytes: 1 }));
});
