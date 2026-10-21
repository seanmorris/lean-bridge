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
import { beforeCheckedRecordBrowserSource, checkedRecordBrowserChangedPaths, checkedRecordBrowserHistoryPath, checkedRecordBrowserPredecessor, reverseCheckedRecordBrowserUpdate } from "./checked-record-browser-history.mjs";

test("checked-record browser foundation source history authenticates exact changes and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(checkedRecordBrowserHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "checked-record-browser-source-v1");
	assert.equal(record.predecessorCommit, checkedRecordBrowserPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), checkedRecordBrowserChangedPaths);
	const gitSource = path => execFileSync("git", ["show", `${checkedRecordBrowserPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseCheckedRecordBrowserUpdate(current, update);
		assert.equal(previous, gitSource(update.path));
		assert.equal(beforeCheckedRecordBrowserSource(update.path, current), previous);
		assert.equal(beforeCheckedRecordBrowserSource(update.path, current, update.currentSha256), current);
		if(["src/analyze/export-configuration.mjs", "docs/type-surface.v1.json"].includes(update.path))
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeCheckedRecordBrowserSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordBrowserUpdate(current, changed));
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
	assert.equal(pins, 10);
	const inventoryUpdate = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	const inventoryCurrent = beforeFinRefinementSource(
		"docs/type-surface.v1.json"
		, await readFile("docs/type-surface.v1.json", "utf8")
		, inventoryUpdate.currentSha256
	);
	const inventory = beforeCheckedRecordBrowserSource(
		"docs/type-surface.v1.json", inventoryCurrent
		, inventoryUpdate.currentSha256
	);
	assert.deepEqual(JSON.parse(inventory), expected);
	assert.equal(beforeFinRefinementSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), sha256(JSON.stringify(original, null, 2) + "\n")), JSON.stringify(original, null, 2) + "\n");
});

test("checked-record browser foundation history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-browser-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-browser-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
