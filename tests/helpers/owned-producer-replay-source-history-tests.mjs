/**
 * Authenticate the producer-bound C transfer and JVM runtime verifier replays.
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
	beforeOwnedProducerReplaySource
	, ownedProducerReplayAddedPaths
	, ownedProducerReplayChangedPaths
	, ownedProducerReplayCommits
	, ownedProducerReplayHistoryPath
	, ownedProducerReplayImplementation
	, ownedProducerReplayPredecessor
	, reverseOwnedProducerReplayUpdate
} from "./owned-producer-replay-source-history.mjs";
import {
	ownedJvmRuntimeProducer, ownedJvmRuntimeReceipt, ownedJvmRuntimeSources
} from "./owned-jvm-runtime-evidence.mjs";
import {
	ownedTransferCProducerClosure, ownedTransferCProducerEntries
} from "./owned-transfer-c-evidence.mjs";
import { ownedTransferCPath } from "./owned-transfer-c-history.mjs";
import { bytesAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	ownedProducerReplayHistoryPath, "utf8"
));
const json = async path => JSON.parse(await readFile(path, "utf8"));

test("owned producer replay records exactly its two implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-producer-replay-source-v1");
	assert.equal(record.predecessorCommit, ownedProducerReplayPredecessor);
	assert.equal(record.implementationCommit
		, ownedProducerReplayImplementation);
	assert.deepEqual(record.implementationCommits, ownedProducerReplayCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${ownedProducerReplayPredecessor}..${ownedProducerReplayImplementation}`])
		.trim().split("\n"), ownedProducerReplayCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedProducerReplayPredecessor
		, ownedProducerReplayImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...ownedProducerReplayChangedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedProducerReplayChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${ownedProducerReplayPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${ownedProducerReplayImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseOwnedProducerReplayUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeOwnedProducerReplaySource(update.path, current)
			, previous, update.path);
		assert.equal(beforeOwnedProducerReplaySource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("owned producer replay additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedProducerReplayAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("owned producer replay rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${ownedProducerReplayImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedProducerReplayUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseOwnedProducerReplayUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeOwnedProducerReplaySource(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedProducerReplayUpdate(unknown, update));
		assert.equal(beforeOwnedProducerReplaySource("docs/unrelated.md", current)
			, current);
	}
});

test("staged C transfer replay binds its whole producer closure to the receipt", async () => {
	const { sources } = await json(ownedTransferCPath);
	const closure = ownedTransferCProducerClosure(sources);
	assert.equal(closure.length, 46);
	for(const path of [...ownedTransferCProducerEntries, "src/analyze/spdx-data.json"])
		assert.ok(closure.includes(path), path);
	for(const path of [ownedTransferCProducerEntries[0], "src/analyze/spdx-data.json"])
	{
		assert.throws(() => ownedTransferCProducerClosure({ ...sources, [path]: "0".repeat(64) })
			, assert.AssertionError, path);
		const missing = { ...sources };
		delete missing[path];
		assert.throws(() => ownedTransferCProducerClosure(missing), assert.AssertionError, path);
	}
});

test("owned JVM runtime replay names the receipt's exact producer", async () => {
	const { sources } = await json(ownedJvmRuntimeReceipt);
	assert.deepEqual(Object.keys(sources).sort(), ownedJvmRuntimeSources);
	for(const path of ownedJvmRuntimeSources)
		assert.equal(sha256(bytesAtProducer(ownedJvmRuntimeProducer, path)), sources[path], path);
});

test("owned producer replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-producer-replay-"));
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
		"scripts/update-owned-producer-replay-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
