/**
 * Authenticate the Perl callback Fin milestone-read repair history: exact
 * transitions, additions and refusal controls.
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
	beforeCallbackFinPerlMilestoneReadSource
	, callbackFinPerlMilestoneReadAddedPaths
	, callbackFinPerlMilestoneReadChangedPaths
	, callbackFinPerlMilestoneReadCommits
	, callbackFinPerlMilestoneReadHistoryPath
	, callbackFinPerlMilestoneReadImplementation
	, callbackFinPerlMilestoneReadImplementationAddedPaths
	, callbackFinPerlMilestoneReadPredecessor
	, reverseCallbackFinPerlMilestoneReadUpdate
} from "./callback-fin-perl-milestone-read-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	callbackFinPerlMilestoneReadHistoryPath, "utf8"
));

test("Perl callback Fin milestone-read repair records exactly its implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-perl-milestone-read-source-v1");
	assert.equal(record.predecessorCommit, callbackFinPerlMilestoneReadPredecessor);
	assert.equal(record.implementationCommit
		, callbackFinPerlMilestoneReadImplementation);
	assert.deepEqual(record.implementationCommits, callbackFinPerlMilestoneReadCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${callbackFinPerlMilestoneReadPredecessor}..${callbackFinPerlMilestoneReadImplementation}`])
		.trim().split("\n"), callbackFinPerlMilestoneReadCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackFinPerlMilestoneReadPredecessor
		, callbackFinPerlMilestoneReadImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...callbackFinPerlMilestoneReadChangedPaths
		, ...callbackFinPerlMilestoneReadImplementationAddedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackFinPerlMilestoneReadChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${callbackFinPerlMilestoneReadPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${callbackFinPerlMilestoneReadImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCallbackFinPerlMilestoneReadUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCallbackFinPerlMilestoneReadSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeCallbackFinPerlMilestoneReadSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("Perl callback Fin milestone-read repair additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackFinPerlMilestoneReadAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("Perl callback Fin milestone-read repair rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${callbackFinPerlMilestoneReadImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseCallbackFinPerlMilestoneReadUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseCallbackFinPerlMilestoneReadUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeCallbackFinPerlMilestoneReadSource(update.path, unknown), unknown);
		assert.throws(() => reverseCallbackFinPerlMilestoneReadUpdate(unknown, update));
		assert.equal(beforeCallbackFinPerlMilestoneReadSource("docs/unrelated.md", current)
			, current);
	}
});

test("Perl callback Fin milestone-read repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-fin-perl-milestone-read-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-perl-milestone-read-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
