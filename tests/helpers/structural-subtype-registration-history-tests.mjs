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
import { beforeStructuralSubtypeRegistrationSource, structuralSubtypeRegistrationChangedPaths, structuralSubtypeRegistrationHistoryPath, structuralSubtypeRegistrationPredecessor, reverseStructuralSubtypeRegistrationUpdate } from "./structural-subtype-registration-history.mjs";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";

test("structural Subtype registration adds all eight roots without changing any previous profile", async () => {
	let source = await readFile("src/adoption/test-profiles.mjs", "utf8");
	for(const name of ["entry-evidence", "entry-installed", "entry", "installed", "native-evidence", "npm-evidence", "npm-installed", "npm"])
	{
		assert.equal(classifyRepositoryTest(`tests/structural-subtype-${name}.test.mjs`), "contract");
		const addition = `\t\t, "structural-subtype-${name}"\n`;
		assert.equal(source.split(addition).length, 2); source = source.replace(addition, "");
	}
	assert.equal(source, execFileSync("git", ["show", `${structuralSubtypeRegistrationPredecessor}:src/adoption/test-profiles.mjs`], { encoding: "utf8" }));
});

test("structural Subtype test registration source history authenticates exact changes and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(structuralSubtypeRegistrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "structural-subtype-registration-source-v1");
	assert.equal(record.predecessorCommit, structuralSubtypeRegistrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), structuralSubtypeRegistrationChangedPaths);
	for(const update of record.updates)
	{
		const current = beforeStructuralSubtypeRegistrationSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseStructuralSubtypeRegistrationUpdate(current, update);
		assert.equal(beforeStructuralSubtypeRegistrationSource(update.path, current), previous);
		assert.equal(beforeStructuralSubtypeRegistrationSource(update.path, current, update.currentSha256), current);
		if(["src/adoption/test-profiles.mjs", "docs/type-surface.v1.json"].includes(update.path))
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeStructuralSubtypeRegistrationSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseStructuralSubtypeRegistrationUpdate(current, changed));
			}
	}
});

test("structural Subtype test registration history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-registration-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-structural-subtype-registration-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
