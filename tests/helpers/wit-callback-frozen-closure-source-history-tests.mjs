/**
 * Authenticate the WIT callback frozen-source closure repair.
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
	beforeWitCallbackFrozenClosureSource
	, reverseWitCallbackFrozenClosureUpdate
	, witCallbackFrozenClosureAddedPaths
	, witCallbackFrozenClosureChangedPaths
	, witCallbackFrozenClosureCommits
	, witCallbackFrozenClosureHistoryPath
	, witCallbackFrozenClosureImplementation
	, witCallbackFrozenClosurePredecessor
} from "./wit-callback-frozen-closure-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	witCallbackFrozenClosureHistoryPath, "utf8"
));

test("WIT callback frozen closure records exactly its two source transitions", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "wit-callback-frozen-closure-source-v1");
	assert.equal(record.predecessorCommit, witCallbackFrozenClosurePredecessor);
	assert.equal(record.implementationCommit, witCallbackFrozenClosureImplementation);
	assert.deepEqual(record.implementationCommits
		, witCallbackFrozenClosureCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, witCallbackFrozenClosurePredecessor
		, witCallbackFrozenClosureImplementation]).trim().split("\n").sort()
	, [...witCallbackFrozenClosureChangedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, witCallbackFrozenClosureChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${witCallbackFrozenClosurePredecessor}:${update.path}`]);
		const current = git(["show"
			, `${witCallbackFrozenClosureImplementation}:${update.path}`]);
		assert.equal(reverseWitCallbackFrozenClosureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeWitCallbackFrozenClosureSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeWitCallbackFrozenClosureSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("WIT callback frozen closure additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, witCallbackFrozenClosureAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("WIT callback frozen closure rejects altered transitions", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${witCallbackFrozenClosureImplementation}:${update.path}`]);
		assert.throws(() => reverseWitCallbackFrozenClosureUpdate(current
			, { ...update, currentSha256: "0".repeat(64) }));
		assert.throws(() => reverseWitCallbackFrozenClosureUpdate(current
			, { ...update, edits: [] }));
		const unknown = `${current}unknown\n`;
		assert.equal(beforeWitCallbackFrozenClosureSource(update.path, unknown)
			, unknown);
	}
});

test("WIT callback frozen closure writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-wit-frozen-closure-"));
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
		"scripts/update-wit-callback-frozen-closure-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
