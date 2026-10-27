/**
 * Keep the reviewed Perl diagnostic repair separate from prior installed observations.
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
import { beforeReviewedPerlDiagnosticSource, reviewedPerlDiagnosticChangedPaths, reviewedPerlDiagnosticHistoryPath, reviewedPerlDiagnosticPredecessor, reverseReviewedPerlDiagnosticUpdate } from "./reviewed-perl-diagnostic-history.mjs";
import { assertHistoricalTypeSurfaceEvidence } from "./type-surface-historical-evidence.mjs";

test("reviewed Perl diagnostic history authenticates exact transitions and preserves requested epochs", async () => {
	const history = JSON.parse(await readFile(reviewedPerlDiagnosticHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "reviewed-perl-diagnostic-v1");
	assert.equal(history.predecessorCommit, reviewedPerlDiagnosticPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), reviewedPerlDiagnosticChangedPaths);
	for(const update of history.updates)
	{
		const current = await sourceAtHistoryMilestone(
			reviewedPerlDiagnosticHistoryPath, update.path
		);
		const previous = reverseReviewedPerlDiagnosticUpdate(current, update);
		assert.equal(beforeReviewedPerlDiagnosticSource(update.path, current), previous);
		assert.equal(beforeReviewedPerlDiagnosticSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		const unknown = current + "\n// unknown edit\n";
		assert.equal(beforeReviewedPerlDiagnosticSource(update.path, unknown), unknown);
		assert.throws(() => reverseReviewedPerlDiagnosticUpdate(unknown, update));
		const mutations = [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseReviewedPerlDiagnosticUpdate(current, changed));
		}
	}
	const bytes = Buffer.from([0, 255, 254]);
	assert.equal(beforeReviewedPerlDiagnosticSource("src/backends/perl/generate.mjs", bytes), bytes);
});

test("reviewed Perl diagnostics preserve every support claim and authenticate all current source pins", async () => {
	const history = JSON.parse(await readFile(reviewedPerlDiagnosticHistoryPath));
	const path = "docs/type-surface.v1.json", latest = await readFile(path, "utf8");
	const text = await sourceAtHistoryMilestone(
		reviewedPerlDiagnosticHistoryPath, path
	);
	const current = JSON.parse(text), previous = JSON.parse(beforeReviewedPerlDiagnosticSource(path, text));
	const expected = structuredClone(previous); let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.ok(refreshed > 0); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 407); assert.equal(current.observations.length, 509);
	await assertHistoricalTypeSurfaceEvidence(JSON.parse(latest));
	assert.equal(sha256(await readFile("docs/evidence/reviewed-subtype-host-source-history-20261010.json")), "f246d63f87ee8e131aa48eee9732a31adddbe58673e997d0f9cb95cdc6f169c6");
});

test("reviewed Perl diagnostic writer refuses an unrelated checkout before changing files", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-perl-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-perl-diagnostic-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /history is draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("reviewed Perl failure records preserve the platform refusal and original positional-name error", async () => {
	const root = "docs/evidence/reviewed-perl-diagnostics-20261010";
	const bytes = await readFile(`${root}/index.json`), index = JSON.parse(bytes);
	assert.equal(sha256(bytes), "ab70bd07ace9a71755354167e0bf54673c5c8fc146f1703001c7e7d62b2567d4");
	assert.equal(index.producer, reviewedPerlDiagnosticPredecessor);
	assert.equal(index.records.length, 19);
	const originals = new Map();
	for(const item of index.records)
	{
		const original = await readFile(`${root}/${item.path}`);
		assert.equal(original.length, item.bytes); assert.equal(sha256(original), item.sha256);
		originals.set(item.path, original);
	}
	for(const [attempt, runner] of [[1, 1], [2, 3]])
	{
		const start = JSON.parse(originals.get(`r${attempt}/run.start.json`));
		const end = JSON.parse(originals.get(`r${attempt}/run.end.json`));
		assert.equal(start.revision, index.producer);
		assert.equal(start.runnerSha256, sha256(originals.get(`runner-v${runner}.mjs.txt`)));
		assert.equal(end.code, 1); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
		const tap = originals.get(`r${attempt}/run.tap`);
		assert.equal(end.tapSha256, sha256(tap));
		for(const [name, count] of [["tests", 1], ["pass", 0], ["fail", 1], ["skipped", 0]])
			assert.match(tap.toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
	}
	assert.match(originals.get("r1/run.tap").toString(), /Package requires glibc 2\.38 or later/u);
	assert.match(originals.get("r2/run.tap").toString(), /failed: empty word/u);
	assert.match(originals.get("r2/archived-perl-xs.txt").toString(), /"arg0 was rejected by Subtypes\.checkedWord"/u);
	for(const name of ["model.json", "package-set-receipt.json", "review.json", "Subtypes.lean", "lean-bridge.exports.json"])
		assert.equal(sha256(originals.get(`r2/build-0/${name}`)), sha256(originals.get(`r2/build-1/${name}`)));
});
