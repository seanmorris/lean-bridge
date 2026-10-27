/**
 * Keep the refinement follow-up repair separate from prior installed observations.
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
import { beforeRefinementFollowupSource, refinementFollowupChangedPaths, refinementFollowupHistoryPath, refinementFollowupPredecessor, reverseRefinementFollowupUpdate } from "./refinement-followup-history.mjs";
import { assertHistoricalTypeSurfaceEvidence } from "./type-surface-historical-evidence.mjs";

test("refinement follow-up history authenticates exact transitions and preserves requested epochs", async () => {
	const history = JSON.parse(await readFile(refinementFollowupHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "refinement-followup-v1");
	assert.equal(history.predecessorCommit, refinementFollowupPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), refinementFollowupChangedPaths);
	for(const update of history.updates)
	{
		const current = await sourceAtHistoryMilestone(
			refinementFollowupHistoryPath, update.path
		);
		const previous = reverseRefinementFollowupUpdate(current, update);
		assert.equal(beforeRefinementFollowupSource(update.path, current), previous);
		assert.equal(beforeRefinementFollowupSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		const unknown = current + "\n// unknown edit\n";
		assert.equal(beforeRefinementFollowupSource(update.path, unknown), unknown);
		assert.throws(() => reverseRefinementFollowupUpdate(unknown, update));
		const mutations = [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRefinementFollowupUpdate(current, changed));
		}
	}
	const bytes = Buffer.from([0, 255, 254]);
	assert.equal(beforeRefinementFollowupSource("src/backends/perl/generate.mjs", bytes), bytes);
});

test("refinement follow-ups preserve every support claim and authenticate all current source pins", async () => {
	const history = JSON.parse(await readFile(refinementFollowupHistoryPath));
	const path = "docs/type-surface.v1.json", text = await sourceAtHistoryMilestone(refinementFollowupHistoryPath, path);
	const current = JSON.parse(text), previous = JSON.parse(beforeRefinementFollowupSource(path, text));
	const expected = structuredClone(previous); let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.ok(refreshed > 0); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 407); assert.equal(current.observations.length, 509);
	await assertHistoricalTypeSurfaceEvidence(current);
	assert.equal(sha256(await readFile("docs/evidence/reviewed-perl-diagnostic-source-history-20261010.json")), "1c821561a9b0d01814756047618f930292311e58eb03b5043ad492b8d6dfc4eb");
});

test("refinement follow-up writer refuses an unrelated checkout before changing files", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-perl-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-refinement-followup-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /history is draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("follow-up preserves the installed Perl binder-name failure and all three reproduced Core failures", async () => {
	const root = "docs/evidence/refinement-followup-20261010";
	const bytes = await readFile(`${root}/index.json`), index = JSON.parse(bytes);
	assert.equal(sha256(bytes), "5771c8a96130e2bc346ce7062f8731aec3e4bf3eea978d8ddcb18c53b59f801d");
	assert.equal(index.producer, refinementFollowupPredecessor);
	assert.equal(index.records.length, 16);
	const records = new Map();
	for(const item of index.records)
	{
		const original = await readFile(`${root}/${item.path}`);
		assert.equal(original.length, item.bytes); assert.equal(sha256(original), item.sha256);
		records.set(item.path, original);
	}
	const start = JSON.parse(records.get("perl-r3/start.json")), end = JSON.parse(records.get("perl-r3/end.json"));
	assert.equal(start.revision, index.producer);
	assert.equal(start.runnerSha256, sha256(records.get("perl-r3/runner.mjs.txt")));
	assert.equal(end.code, 1); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.equal(end.tapSha256, sha256(records.get("perl-r3/run.tap")));
	assert.match(records.get("perl-r3/run.tap").toString(), /failed: empty word/u);
	assert.match(records.get("perl-r3/Component.xs.txt").toString(), /"word was rejected by Subtypes\.checkedWord"/u);
	for(const name of ["model.json", "review.json", "Subtypes.lean", "lean-bridge.exports.json", "package-set-receipt.json"])
		assert.equal(sha256(records.get(`perl-r3/build-0/${name}`)), sha256(records.get(`perl-r3/build-1/${name}`)));
	const model = JSON.parse(records.get("perl-r3/build-0/model.json"));
	assert.equal(model.bindingIr.declarations.find(item => item.id === "lean:Subtypes.shout").parameters[0].name, "value0");
	const core = records.get("core/reproduced.tap").toString();
	assert.match(core, /^# tests 3$/mu); assert.match(core, /^# fail 3$/mu);
	assert.equal([...core.matchAll(/^not ok /gmu)].length, 3);
});
