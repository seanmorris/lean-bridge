/**
 * Register the hosted Perl archive without changing support claims or rewriting earlier evidence.
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
import { beforePerlRelocatedConsumerSource } from "./perl-relocated-consumer-source-history.mjs";
import { beforePerlRefinementHostedSource, perlRefinementHostedChangedPaths, perlRefinementHostedHistoryPath, perlRefinementHostedPredecessor, reversePerlRefinementHostedUpdate } from "./perl-refinement-hosted-source-history.mjs";

test("Perl hosted archive history authenticates exact predecessors and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(perlRefinementHostedHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "perl-refinement-hosted-v1");
	assert.equal(record.predecessorCommit, perlRefinementHostedPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), perlRefinementHostedChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePerlRelocatedConsumerSource(update.path, await readFile(update.path, "utf8")), previous = reversePerlRefinementHostedUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforePerlRefinementHostedSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforePerlRefinementHostedSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforePerlRefinementHostedSource(update.path, changed), changed);
		assert.throws(() => reversePerlRefinementHostedUpdate(changed, update));
		assert.throws(() => reversePerlRefinementHostedUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePerlRefinementHostedUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reversePerlRefinementHostedUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Perl archive registration refreshes exactly 95 source pins without promoting any support cell", async () => {
	const path = "docs/type-surface.v1.json", text = beforePerlRelocatedConsumerSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(text), previous = JSON.parse(beforePerlRefinementHostedSource(path, text));
	const record = JSON.parse(await readFile(perlRefinementHostedHistoryPath));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(beforePerlRelocatedConsumerSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 95);
	assert.deepEqual(current, previous);
});

test("the hosted Perl archive updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-hosted-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-perl-refinement-hosted-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Perl hosted archive history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
