/**
 * Preserve earlier evidence while repairing the obsolete Perl container Subtype assertion.
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
import { beforePerlContainerSubtypeCiSource, perlContainerSubtypeCiChangedPaths, perlContainerSubtypeCiHistoryPath, perlContainerSubtypeCiPredecessor, reversePerlContainerSubtypeCiUpdate } from "./perl-container-subtype-ci-history.mjs";

test("Perl container Subtype CI repair authenticates exact test changes without changing support or observations", async () => {
	const record = JSON.parse(await readFile(perlContainerSubtypeCiHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "perl-container-subtype-ci-v1");
	assert.equal(record.predecessorCommit, perlContainerSubtypeCiPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), perlContainerSubtypeCiChangedPaths);
	const original = path => execFileSync("git", ["show", `${perlContainerSubtypeCiPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforePerlContainerSubtypeCiSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reversePerlContainerSubtypeCiUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforePerlContainerSubtypeCiSource(update.path, current), previous);
		assert.equal(beforePerlContainerSubtypeCiSource(update.path, current, update.currentSha256), current);
		assert.equal(beforePerlContainerSubtypeCiSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforePerlContainerSubtypeCiSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reversePerlContainerSubtypeCiUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforePerlContainerSubtypeCiSource(inventoryPath, await readFile(inventoryPath, "utf8")), original(inventoryPath));
});

test("Perl container Subtype CI history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-container-subtype-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-perl-container-subtype-ci-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
