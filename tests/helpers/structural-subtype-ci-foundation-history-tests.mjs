/**
 * Keep earlier PHP-Wasm evidence readable through exact CI/admission test transitions.
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
import { beforeStructuralSubtypeCiFoundationSource, structuralSubtypeCiFoundationChangedPaths, structuralSubtypeCiFoundationHistoryPath, structuralSubtypeCiFoundationPredecessor, reverseStructuralSubtypeCiFoundationUpdate } from "./structural-subtype-ci-foundation-history.mjs";

test("structural CI foundation history authenticates every source transition and preserves the inventory", async () => {
	const record = JSON.parse(await readFile(structuralSubtypeCiFoundationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "structural-subtype-ci-foundation-source-v1");
	assert.equal(record.predecessorCommit, structuralSubtypeCiFoundationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), structuralSubtypeCiFoundationChangedPaths);
	const gitSource = path => execFileSync("git", ["show", `${structuralSubtypeCiFoundationPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	const inventory = gitSource("docs/type-surface.v1.json");
	assert.equal(beforeFinRefinementSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), sha256(inventory)), inventory);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = gitSource(update.path);
		const current = beforeStructuralSubtypeCiFoundationSource(update.path, source, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256); assert.equal(sha256(previous), update.previousSha256);
		assert.equal(reverseStructuralSubtypeCiFoundationUpdate(current, update), previous);
		assert.equal(beforeStructuralSubtypeCiFoundationSource(update.path, current), previous);
		assert.equal(beforeStructuralSubtypeCiFoundationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeStructuralSubtypeCiFoundationSource(update.path, current + "unknown"), current + "unknown");
		if(update.path.startsWith("tests/") && !update.path.startsWith("tests/helpers/"))
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseStructuralSubtypeCiFoundationUpdate(current, changed));
			}
	}
});

test("structural CI foundation writer refuses unrelated HEAD before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-ci-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-structural-subtype-ci-foundation-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
