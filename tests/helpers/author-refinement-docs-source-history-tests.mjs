/**
 * Register the Author refinement docs without changing support claims or rewriting earlier evidence.
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
import { beforeAuthorRefinementDocsSource, authorRefinementDocsChangedPaths, authorRefinementDocsHistoryPath, authorRefinementDocsPredecessor, reverseAuthorRefinementDocsUpdate } from "./author-refinement-docs-source-history.mjs";

test("Author refinement docs history authenticates exact predecessors and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(authorRefinementDocsHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "author-refinement-docs-v1");
	assert.equal(record.predecessorCommit, authorRefinementDocsPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), authorRefinementDocsChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseAuthorRefinementDocsUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeAuthorRefinementDocsSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeAuthorRefinementDocsSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeAuthorRefinementDocsSource(update.path, changed), changed);
		assert.throws(() => reverseAuthorRefinementDocsUpdate(changed, update));
		assert.throws(() => reverseAuthorRefinementDocsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseAuthorRefinementDocsUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseAuthorRefinementDocsUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Author refinement docs refreshes exactly 18 source pins without promoting any support cell", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeAuthorRefinementDocsSource(path, text));
	const record = JSON.parse(await readFile(authorRefinementDocsHistoryPath));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(await readFile(file.path)), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 18);
	assert.deepEqual(current, previous);
});

test("the Author refinement docs updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-author-refinement-docs-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-author-refinement-docs-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Author refinement docs history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
