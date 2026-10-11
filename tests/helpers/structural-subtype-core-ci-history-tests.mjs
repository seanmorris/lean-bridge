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
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeStructuralSubtypeCoreCiSource, structuralSubtypeCoreCiChangedPaths, structuralSubtypeCoreCiHistoryPath, structuralSubtypeCoreCiPredecessor, reverseStructuralSubtypeCoreCiUpdate } from "./structural-subtype-core-ci-history.mjs";

test("structural Subtype Core CI repair source history authenticates exact changes and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(structuralSubtypeCoreCiHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "structural-subtype-core-ci-source-v1");
	assert.equal(record.predecessorCommit, structuralSubtypeCoreCiPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), structuralSubtypeCoreCiChangedPaths);
	const gitSource = path => execFileSync("git", ["show", `${structuralSubtypeCoreCiPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeStructuralSubtypeCoreCiSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseStructuralSubtypeCoreCiUpdate(current, update);
		assert.equal(previous, gitSource(update.path));
		assert.equal(beforeStructuralSubtypeCoreCiSource(update.path, current), previous);
		assert.equal(beforeStructuralSubtypeCoreCiSource(update.path, current, update.currentSha256), current);
		if(["src/analyze/export-configuration.mjs", "docs/type-surface.v1.json"].includes(update.path))
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeStructuralSubtypeCoreCiSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseStructuralSubtypeCoreCiUpdate(current, changed));
			}
	}
	const original = JSON.parse(gitSource("docs/type-surface.v1.json")), expected = structuredClone(original);
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(update => update.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 4);
	const inventoryUpdate = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	const inventory = beforeStructuralSubtypeCoreCiSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), inventoryUpdate.currentSha256);
	assert.deepEqual(JSON.parse(inventory), expected);
	assert.equal(beforeFinRefinementSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), sha256(JSON.stringify(original, null, 2) + "\n")), JSON.stringify(original, null, 2) + "\n");
});

test("structural Subtype Core CI repair history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-core-ci-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-structural-subtype-core-ci-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
