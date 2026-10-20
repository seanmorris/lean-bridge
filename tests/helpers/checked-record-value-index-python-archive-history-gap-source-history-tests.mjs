/**
 * Authenticate the omitted Python archive-history hub transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexPythonArchiveHistoryGapSource
	, checkedRecordValueIndexPythonArchiveHistoryGapAddedPaths
	, checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit
	, checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths
	, checkedRecordValueIndexPythonArchiveHistoryGapPath
	, checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit
	, reverseCheckedRecordValueIndexPythonArchiveHistoryGapUpdate
} from "./checked-record-value-index-python-archive-history-gap-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("Python archive-history hub gap is exact and reversible", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexPythonArchiveHistoryGapPath, "utf8"
	));
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "currentCommit", "historicalTransitions", "milestone"
		, "pathsSha256", "previousCommit", "schemaVersion"
	]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-python-archive-history-gap-v1");
	assert.equal(record.previousCommit
		, checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit);
	assert.equal(record.currentCommit
		, checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths
	)));
	assert.deepEqual(record.historicalTransitions.map(item => item.path)
		, checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexPythonArchiveHistoryGapAddedPaths);
	for(const update of record.historicalTransitions)
	{
		const previous = git(["show"
			, `${checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit}:${update.path}`]);
		const current = git(["show"
			, `${checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexPythonArchiveHistoryGapUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexPythonArchiveHistoryGapSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexPythonArchiveHistoryGapSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeCheckedRecordValueIndexPythonArchiveHistoryGapSource(
			update.path, current + "unknown"), current + "unknown", update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("Python archive-history gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-python-archive-gap-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-checked-record-value-index-python-archive-history-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on the exact WIT repair parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
