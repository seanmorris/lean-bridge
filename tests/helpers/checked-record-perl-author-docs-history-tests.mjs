/**
 * Preserve existing Fin evidence and reject unrecorded source changes.
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
import { beforePerlAuthorDocsSource, perlAuthorDocsChangedPaths, perlAuthorDocsHistoryPath, perlAuthorDocsPredecessor, reversePerlAuthorDocsUpdate } from "./checked-record-perl-author-docs-history.mjs";

test("Perl checked-record author documentation source history authenticates exact changes and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(perlAuthorDocsHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "checked-record-perl-author-docs-source-v1");
	assert.equal(record.predecessorCommit, perlAuthorDocsPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), perlAuthorDocsChangedPaths);
	for(const update of record.updates)
	{
		const current = beforePerlAuthorDocsSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reversePerlAuthorDocsUpdate(current, update);
		assert.equal(beforePerlAuthorDocsSource(update.path, current), previous);
		assert.equal(beforePerlAuthorDocsSource(update.path, current, update.currentSha256), current);
		if(["docs/lean/existing-package.md", "docs/type-surface.v1.json"].includes(update.path))
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforePerlAuthorDocsSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reversePerlAuthorDocsUpdate(current, changed));
			}
	}
});

test("Perl checked-record author documentation history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-author-docs-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-perl-author-docs-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
