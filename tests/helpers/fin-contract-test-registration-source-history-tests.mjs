/**
 * Authenticate the final Fin contract-test registration and exact pin refresh.
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
	beforeFinContractTestRegistrationSource
	, finContractTestRegistrationAddedPaths
	, finContractTestRegistrationChangedPaths
	, finContractTestRegistrationCommits
	, finContractTestRegistrationHistoryPath
	, finContractTestRegistrationImplementation
	, finContractTestRegistrationPredecessor
	, reverseFinContractTestRegistrationUpdate
} from "./fin-contract-test-registration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	finContractTestRegistrationHistoryPath, "utf8"
));

test("final Fin test registration restores its exact implementation", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits"
		, "milestone", "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "fin-contract-test-registration-source-v1");
	assert.equal(record.predecessorCommit
		, finContractTestRegistrationPredecessor);
	assert.equal(record.implementationCommit
		, finContractTestRegistrationImplementation);
	assert.deepEqual(record.implementationCommits
		, finContractTestRegistrationCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${finContractTestRegistrationPredecessor}..${finContractTestRegistrationImplementation}`])
		.trim().split("\n"), finContractTestRegistrationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, finContractTestRegistrationChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${finContractTestRegistrationPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${finContractTestRegistrationImplementation}:${update.path}`]);
		assert.equal(reverseFinContractTestRegistrationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinContractTestRegistrationSource(update.path, current
			, update.previousSha256), previous, update.path);
	}
});

test("final Fin test registration additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, finContractTestRegistrationAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("final Fin test registration refreshes only its 102 exact live pins", async () => {
	const record = await readRecord();
	const update = record.updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const current = git(["show"
		, `${finContractTestRegistrationImplementation}:${update.path}`]);
	const pins = new Map([
		["src/adoption/test-profiles.mjs", 98]
		, ["tests/test-profiles.test.mjs", 4]
	].map(([path, count]) => [path, {
		count
		, sha256: sha256(git(["show"
			, `${finContractTestRegistrationImplementation}:${path}`]))
	}]));
	const counts = new Map();
	assert.equal(update.edits.length, 102);
	for(const edit of update.edits)
	{
		const line = /^ *"sha256": "([0-9a-f]{64})"\n$/u;
		const currentMatch = edit.current.match(line);
		const previousMatch = edit.previous.match(line);
		assert.ok(currentMatch && previousMatch);
		assert.notEqual(currentMatch[1], previousMatch[1]);
		assert.equal(edit.previous.replace(previousMatch[1], currentMatch[1])
			, edit.current);
		assert.equal(current.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		const before = current.lastIndexOf("\n", edit.start - 2) + 1;
		const pathMatch = current.slice(before, edit.start)
			.match(/^ *"path": "([^"\n]+)",\n$/u);
		assert.ok(pathMatch);
		const pin = pins.get(pathMatch[1]);
		assert.ok(pin, pathMatch[1]);
		assert.equal(currentMatch[1], pin.sha256, pathMatch[1]);
		counts.set(pathMatch[1], (counts.get(pathMatch[1]) ?? 0) + 1);
	}
	assert.deepEqual([...counts.entries()].sort()
		, [...pins.entries()].map(([path, value]) => [path, value.count]).sort());
});

test("final Fin test registration rejects altered transitions", async () => {
	const record = await readRecord();
	const update = record.updates.find(item =>
		item.path === "src/adoption/test-profiles.mjs");
	const current = git(["show"
		, `${finContractTestRegistrationImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }])
		assert.throws(() => reverseFinContractTestRegistrationUpdate(
			current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseFinContractTestRegistrationUpdate(
		current, shifted));
	assert.equal(beforeFinContractTestRegistrationSource(
		"docs/unrelated.md", current), current);
});

test("final Fin test-registration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-fin-contract-test-registration-"));
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
		"scripts/update-fin-contract-test-registration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
