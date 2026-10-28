/**
 * Authenticate the native Fin callback-role history: exactly the 22
 * transitions of 54426dd, exact additions, refusal controls and the hub's
 * reconstruction of every predecessor source.
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
	beforeNativeFinCallbackRoleSource
	, nativeFinCallbackRoleAddedPaths
	, nativeFinCallbackRoleChangedPaths
	, nativeFinCallbackRoleHistoryPath
	, nativeFinCallbackRoleImplementation
	, nativeFinCallbackRolePredecessor
	, reverseNativeFinCallbackRoleUpdate
} from "./native-fin-callback-role-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	nativeFinCallbackRoleHistoryPath, "utf8"
));

test("native Fin callback roles record exactly the 22 transitions of 54426dd", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "milestone", "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "native-fin-callback-role-source-v1");
	assert.equal(record.predecessorCommit, nativeFinCallbackRolePredecessor);
	assert.equal(record.implementationCommit, nativeFinCallbackRoleImplementation);
	assert.equal(git(["rev-parse", `${nativeFinCallbackRoleImplementation}^`]).trim()
		, nativeFinCallbackRolePredecessor);
	assert.equal(nativeFinCallbackRoleChangedPaths.length, 22);
	assert.deepEqual(git(["diff", "--name-only", nativeFinCallbackRolePredecessor
		, nativeFinCallbackRoleImplementation]).trim().split("\n").sort()
	, [...nativeFinCallbackRoleChangedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, nativeFinCallbackRoleChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${nativeFinCallbackRolePredecessor}:${update.path}`]);
		const current = git(["show"
			, `${nativeFinCallbackRoleImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseNativeFinCallbackRoleUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeNativeFinCallbackRoleSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeNativeFinCallbackRoleSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("native Fin callback roles let the hub reach every predecessor source", async () => {
	for(const update of (await readRecord()).updates)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			update.path, update.previousSha256)), update.previousSha256, update.path);
});

test("native Fin callback role additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, nativeFinCallbackRoleAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("native Fin callback roles reject altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${nativeFinCallbackRoleImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseNativeFinCallbackRoleUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseNativeFinCallbackRoleUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeNativeFinCallbackRoleSource(update.path, unknown), unknown);
		assert.throws(() => reverseNativeFinCallbackRoleUpdate(unknown, update));
		assert.equal(beforeNativeFinCallbackRoleSource("docs/unrelated.md", current)
			, current);
	}
});

test("native Fin callback role writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-native-fin-callback-role-"));
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
		"scripts/update-native-fin-callback-role-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
