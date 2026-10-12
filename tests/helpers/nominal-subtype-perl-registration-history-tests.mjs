/**
 * Verify the Perl test registration preserves all earlier source and support claims.
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
import { beforeNominalSubtypePerlRegistrationSource, nominalSubtypePerlRegistrationChangedPaths, nominalSubtypePerlRegistrationHistoryPath, nominalSubtypePerlRegistrationPredecessor, reverseNominalSubtypePerlRegistrationUpdate } from "./nominal-subtype-perl-registration-history.mjs";

test("nominal Perl registration history authenticates exact changes without changing support claims", async t => {
	const record = JSON.parse(await readFile(nominalSubtypePerlRegistrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-perl-registration-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypePerlRegistrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypePerlRegistrationChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypePerlRegistrationPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalSubtypePerlRegistrationSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalSubtypePerlRegistrationUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypePerlRegistrationSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypePerlRegistrationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypePerlRegistrationSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypePerlRegistrationSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypePerlRegistrationUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json", expected = JSON.parse(original(inventoryPath));
	assert.equal(beforeNominalSubtypePerlRegistrationSource(inventoryPath, await readFile(inventoryPath, "utf8")), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 0); assert.deepEqual(JSON.parse(await readFile(inventoryPath, "utf8")), expected);
	assert.equal(expected.evidence.length, 480); assert.equal(expected.observations.length, 575);
	t.diagnostic(`${pins} current-source pins refreshed; all support claims unchanged`);
});

test("nominal Perl registration writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-perl-registration-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-perl-registration-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
