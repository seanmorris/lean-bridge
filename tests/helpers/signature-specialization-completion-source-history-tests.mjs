/**
 * Authenticate the installed specialization-signature completion and pin refresh.
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
	beforeSignatureSpecializationCompletionSource
	, reverseSignatureSpecializationCompletionUpdate
	, signatureSpecializationCompletionAddedPaths
	, signatureSpecializationCompletionChangedPaths
	, signatureSpecializationCompletionCommits
	, signatureSpecializationCompletionHistoryPath
	, signatureSpecializationCompletionImplementation
	, signatureSpecializationCompletionImplementationAdditions
	, signatureSpecializationCompletionPredecessor
} from "./signature-specialization-completion-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationCompletionHistoryPath, "utf8"
));

test("signature specialization completion restores its exact implementation", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationAdditions", "implementationCommit"
		, "implementationCommits", "milestone", "predecessorCommit"
		, "schemaVersion", "scope", "updates"].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-completion-source-v1");
	assert.equal(record.predecessorCommit
		, signatureSpecializationCompletionPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationCompletionImplementation);
	assert.deepEqual(record.implementationCommits
		, signatureSpecializationCompletionCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${signatureSpecializationCompletionPredecessor}..${signatureSpecializationCompletionImplementation}`])
		.trim().split("\n"), signatureSpecializationCompletionCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationCompletionChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${signatureSpecializationCompletionPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${signatureSpecializationCompletionImplementation}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationCompletionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeSignatureSpecializationCompletionSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("signature specialization completion additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.implementationAdditions.map(item => item.path)
		, signatureSpecializationCompletionImplementationAdditions);
	for(const addition of record.implementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, signatureSpecializationCompletionPredecessor
			, "--", addition.path]).trim(), "");
		const source = git(["show"
			, `${signatureSpecializationCompletionImplementation}:${addition.path}`]);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationCompletionAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("signature specialization completion refreshes exactly two live pins", async () => {
	const record = await readRecord();
	const update = record.updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const current = git(["show"
		, `${signatureSpecializationCompletionImplementation}:${update.path}`]);
	const sourcePath = "tests/reviewed-specializations.test.mjs";
	const currentSha256 = sha256(git(["show"
		, `${signatureSpecializationCompletionImplementation}:${sourcePath}`]));
	assert.equal(update.edits.length, 2);
	for(const edit of update.edits)
	{
		const line = /^ *"sha256": "([0-9a-f]{64})"\n$/u;
		const currentMatch = edit.current.match(line);
		const previousMatch = edit.previous.match(line);
		assert.ok(currentMatch && previousMatch);
		assert.notEqual(currentMatch[1], previousMatch[1]);
		assert.equal(currentMatch[1], currentSha256);
		const before = current.lastIndexOf("\n", edit.start - 2) + 1;
		assert.match(current.slice(before, edit.start)
			, /^ *"path": "tests\/reviewed-specializations\.test\.mjs",\n$/u);
	}
});

test("signature specialization completion rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationCompletionImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }])
		assert.throws(() => reverseSignatureSpecializationCompletionUpdate(
			current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseSignatureSpecializationCompletionUpdate(
		current, shifted));
});

test("signature specialization completion writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-specialization-completion-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-signature-specialization-completion-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
