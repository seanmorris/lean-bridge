/**
 * Check exact Rust archive transitions and preservation of prior evidence.
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
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeRustArchiveSource, nominalSubtypeRustArchiveChangedPaths, nominalSubtypeRustArchiveHistoryPath, nominalSubtypeRustArchivePredecessor, reverseNominalSubtypeRustArchiveUpdate } from "./nominal-subtype-rust-archive-history.mjs";

test("nominal Rust harness archive authenticates exact changes without adding support claims", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeRustArchiveHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-rust-archive-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeRustArchivePredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeRustArchiveChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeRustArchivePredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseNominalSubtypeRustArchiveUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeRustArchiveSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeRustArchiveSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeRustArchiveSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypeRustArchiveSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeRustArchiveUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json", source = original(path);
	const inventory = JSON.parse(source);
	assert.equal(beforeFinRefinementSource(
		path, await readFile(path, "utf8"), sha256(source)
	), source);
	assert.equal(inventory.evidence.length, 492); assert.equal(inventory.observations.length, 581);
	for(const entry of inventory.evidence) for(const file of entry.files)
		assert.ok(!nominalSubtypeRustArchiveChangedPaths.includes(file.path));
});

test("nominal Rust archive writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-rust-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-rust-archive-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
