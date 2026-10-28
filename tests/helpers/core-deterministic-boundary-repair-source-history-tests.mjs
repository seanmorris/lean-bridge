/**
 * Authenticate the deterministic Core evidence-boundary repair history.
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
	beforeCoreDeterministicBoundaryRepairSource
	, coreDeterministicBoundaryRepairAddedPaths
	, coreDeterministicBoundaryRepairChangedPaths
	, coreDeterministicBoundaryRepairCommits
	, coreDeterministicBoundaryRepairHistoryPath
	, coreDeterministicBoundaryRepairImplementation
	, coreDeterministicBoundaryRepairImplementationAddedPaths
	, coreDeterministicBoundaryRepairPredecessor
	, reverseCoreDeterministicBoundaryRepairUpdate
} from "./core-deterministic-boundary-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreDeterministicBoundaryRepairHistoryPath, "utf8"
));

test("deterministic Core boundary repair records exactly its implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit", "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-deterministic-boundary-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreDeterministicBoundaryRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreDeterministicBoundaryRepairImplementation);
	assert.deepEqual(record.implementationCommits
		, coreDeterministicBoundaryRepairCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreDeterministicBoundaryRepairPredecessor}..${coreDeterministicBoundaryRepairImplementation}`])
		.trim().split("\n"), coreDeterministicBoundaryRepairCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, coreDeterministicBoundaryRepairPredecessor
		, coreDeterministicBoundaryRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...coreDeterministicBoundaryRepairChangedPaths
		, ...coreDeterministicBoundaryRepairImplementationAddedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, coreDeterministicBoundaryRepairChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${coreDeterministicBoundaryRepairPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${coreDeterministicBoundaryRepairImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCoreDeterministicBoundaryRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreDeterministicBoundaryRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCoreDeterministicBoundaryRepairSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("deterministic Core boundary repair additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, coreDeterministicBoundaryRepairAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("deterministic Core boundary repair rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${coreDeterministicBoundaryRepairImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseCoreDeterministicBoundaryRepairUpdate(
				current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseCoreDeterministicBoundaryRepairUpdate(
			current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeCoreDeterministicBoundaryRepairSource(
			update.path, unknown), unknown);
		assert.throws(() => reverseCoreDeterministicBoundaryRepairUpdate(
			unknown, update));
		assert.equal(beforeCoreDeterministicBoundaryRepairSource(
			"docs/unrelated.md", current), current);
	}
});

const structuralPath = "tests/helpers/structural-subtype-promotion.mjs";

test("deterministic Core boundary repair refreshes exactly 24 structural promotion pins", async () => {
	const record = await readRecord();
	const update = record.updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const current = git(["show"
		, `${coreDeterministicBoundaryRepairImplementation}:docs/type-surface.v1.json`]);
	const structuralDigest = sha256(git(["show"
		, `${coreDeterministicBoundaryRepairImplementation}:${structuralPath}`]));
	assert.equal(update.edits.length, 24);
	for(const edit of update.edits)
	{
		const pin = /^ *"sha256": "([0-9a-f]{64})"\n$/u;
		const [, newer] = edit.current.match(pin);
		const [, older] = edit.previous.match(pin);
		assert.notEqual(older, newer);
		assert.equal(newer, structuralDigest);
		assert.equal(edit.previous.replace(older, newer), edit.current);
		const before = current.lastIndexOf("\n", edit.start - 2) + 1;
		const [, path] = current.slice(before, edit.start)
			.match(/^ *"path": "([^"\n]+)",\n$/u);
		assert.equal(path, structuralPath);
	}
});

test("deterministic Core boundary repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-deterministic-boundary-repair-"));
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
		"scripts/update-core-deterministic-boundary-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
