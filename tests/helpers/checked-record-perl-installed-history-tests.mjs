/**
 * Preserve installed observations while checking Perl checked-record installed harness support.
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
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { beforeCheckedRecordPerlInstalledSource, checkedRecordPerlInstalledChangedPaths, checkedRecordPerlInstalledHistoryPath, checkedRecordPerlInstalledPredecessor, reverseCheckedRecordPerlInstalledUpdate } from "./checked-record-perl-installed-history.mjs";
import { assertHistoricalTypeSurfaceEvidence } from "./type-surface-historical-evidence.mjs";

test("Perl checked-record installed harness history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(checkedRecordPerlInstalledHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "checked-record-perl-installed-v1");
	assert.equal(history.predecessorCommit, checkedRecordPerlInstalledPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), checkedRecordPerlInstalledChangedPaths);
	for(const update of history.updates)
	{
		const current = await sourceAtHistoryMilestone(
			checkedRecordPerlInstalledHistoryPath, update.path
		);
		const previous = reverseCheckedRecordPerlInstalledUpdate(current, update);
		assert.equal(beforeCheckedRecordPerlInstalledSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeCheckedRecordPerlInstalledSource(update.path, unknown), unknown);
		assert.throws(() => reverseCheckedRecordPerlInstalledUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordPerlInstalledUpdate(current, changed));
			}
	}
});

test("Perl checked-record installed harness changes only source pins and preserves all installed observations", async () => {
	const history = JSON.parse(await readFile(checkedRecordPerlInstalledHistoryPath));
	const path = "docs/type-surface.v1.json";
	const source = beforeFinRefinementSource(
		path, await readFile(path, "utf8")
		, "272c84a3d4fb5db30f96c3d120eb11bedea9c8392ad0cc5b7e1f220cf0919811"
	);
	const restored = beforeCheckedRecordPerlInstalledSource(path, source);
	assert.equal(sha256(restored), "272c84a3d4fb5db30f96c3d120eb11bedea9c8392ad0cc5b7e1f220cf0919811");
	const current = JSON.parse(source), previous = JSON.parse(restored);
	const expected = structuredClone(previous); let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 0); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 436); assert.equal(current.observations.length, 551);
	assert.deepEqual(current.observations, previous.observations);
	await assertHistoricalTypeSurfaceEvidence(current);
	assert.equal(sha256(await readFile("docs/evidence/checked-record-perl-source-history-20261011.json")), "1b5fdfca3cbf9e35d65c622e0eb7e932878274d16418549d981f4d8a5818b19e");
});

test("Perl checked-record installed harness history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-perl-installed-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-perl-installed-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
