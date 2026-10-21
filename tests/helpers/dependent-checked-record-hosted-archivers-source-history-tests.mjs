/**
 * Authenticate the combined dependent checked-record hosted-archiver source
 * milestone and its exact seven-commit boundary.
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
	beforeDependentCheckedRecordHostedArchiversSource
	, dependentCheckedRecordHostedArchiversAddedPaths
	, dependentCheckedRecordHostedArchiversChangedPaths
	, dependentCheckedRecordHostedArchiversHistoryPath
	, dependentCheckedRecordHostedArchiversImplementation
	, dependentCheckedRecordHostedArchiversIntegrationPaths
	, dependentCheckedRecordHostedArchiversPredecessor
	, reverseDependentCheckedRecordHostedArchiversUpdate
} from "./dependent-checked-record-hosted-archivers-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync(
	"git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
);
const names = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
}).trim().split("\n").filter(Boolean).sort();
const lines = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
}).trim().split("\n").filter(Boolean);

test("dependent checked-record hosted archiver history closes seven commits"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordHostedArchiversHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-hosted-archivers-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordHostedArchiversPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordHostedArchiversImplementation);
	assert.equal(record.commits.length, 7);
	assert.deepEqual(record.commits, lines([
		"rev-list", "--reverse"
		, `${dependentCheckedRecordHostedArchiversPredecessor}..${dependentCheckedRecordHostedArchiversImplementation}`
	]));
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordHostedArchiversChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordHostedArchiversIntegrationPaths);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
		, dependentCheckedRecordHostedArchiversPredecessor
		, dependentCheckedRecordHostedArchiversImplementation])
	, [...dependentCheckedRecordHostedArchiversAddedPaths]);
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordHostedArchiversSource
		);
		const previous = sourceAt(
			dependentCheckedRecordHostedArchiversImplementation, update.path
		);
		assert.equal(reverseDependentCheckedRecordHostedArchiversUpdate(
			current, update), previous);
	}
	for(const update of record.updates)
	{
		const current = sourceAt(
			dependentCheckedRecordHostedArchiversImplementation, update.path
		);
		const previous = sourceAt(
			dependentCheckedRecordHostedArchiversPredecessor, update.path
		);
		assert.equal(reverseDependentCheckedRecordHostedArchiversUpdate(
			current, update), previous);
	}
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
	}
);

test("dependent hosted archiver history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordHostedArchiversHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordHostedArchiversSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseDependentCheckedRecordHostedArchiversUpdate(current, update));
});

test("dependent hosted archiver history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-hosted-archivers-history-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-hosted-archivers-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
