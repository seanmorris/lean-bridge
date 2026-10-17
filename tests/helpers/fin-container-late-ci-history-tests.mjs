/**
 * Require exact workflow transitions without broadening previous support claims.
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
import { beforeFinLateCiSource, finLateCiChangedPaths, finLateCiHistoryPath, finLateCiPredecessor, reverseFinLateCiUpdate } from "./fin-container-late-ci-history.mjs";
import { disableFinLateWorkflow } from "./fin-container-late-ci-workflow.mjs";

test("late-input CI history preserves exact predecessors and prior inventory claims", async () => {
	const record = JSON.parse(await readFile(finLateCiHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "fin-container-late-ci-v1");
	assert.equal(record.predecessorCommit, finLateCiPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), finLateCiChangedPaths);
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseFinLateCiUpdate(current, update);
		assert.equal(beforeFinLateCiSource(update.path, current), previous);
		assert.equal(beforeFinLateCiSource(update.path, current, update.currentSha256), current);
		if([".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json", "tests/documentation.test.mjs"].includes(update.path))
			assert.equal(sha256(beforeFinRefinementSource(update.path, current, update.previousSha256)), update.previousSha256);
		assert.equal(beforeFinLateCiSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseFinLateCiUpdate(current, changed));
			}
		if(update.path.endsWith("consumer-matrix.yml")) assert.equal(sha256(disableFinLateWorkflow(current)), sha256(previous));
		if(update.path === "docs/type-surface.v1.json")
		{
			const restored = JSON.parse(current), baseline = JSON.parse(previous);
			let pins = 0;
			for(const [index, entry] of restored.evidence.entries()) for(const [i, file] of entry.files.entries())
			{
				const old = baseline.evidence[index].files[i];
				if(file.sha256 === old.sha256) continue;
				assert.ok([".github/workflows/consumer-matrix.yml", "tests/documentation.test.mjs"].includes(file.path));
				const workflow = record.updates.find(item => item.path === file.path);
				assert.equal(file.sha256, workflow.currentSha256); assert.equal(old.sha256, workflow.previousSha256);
				file.sha256 = old.sha256; pins++;
			}
			assert.ok(pins > 0); assert.deepEqual(restored, baseline);
		}
	}
});

test("late-input CI history writer refuses an unrelated checkout without creating files", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-late-ci-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-fin-late-ci-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
