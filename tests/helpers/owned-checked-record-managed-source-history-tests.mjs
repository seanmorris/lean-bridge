/**
 * Authenticate .NET, JVM, native PHP and WIT owned checked-record qualification.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedRecordManagedSource
	, ownedCheckedRecordManagedAddedPaths
	, ownedCheckedRecordManagedChangedPaths
	, ownedCheckedRecordManagedEvidencePath
	, ownedCheckedRecordManagedHistoryPath
	, ownedCheckedRecordManagedImplementation
	, ownedCheckedRecordManagedImplementationPaths
	, ownedCheckedRecordManagedPredecessor
	, reverseOwnedCheckedRecordManagedUpdate
} from "./owned-checked-record-managed-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedCheckedRecordManagedPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("managed owned checked-record history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordManagedHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-managed-source-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordManagedPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordManagedImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordManagedChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordManagedAddedPaths);
	assert.ok(record.refreshedTypeSurfacePointers > 0);
	assert.equal(record.acceptanceEvidence.path
		, ownedCheckedRecordManagedEvidencePath);
	assert.equal(record.acceptanceEvidence.sha256
		, sha256(await readFile(ownedCheckedRecordManagedEvidencePath)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordManagedSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseOwnedCheckedRecordManagedUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeOwnedCheckedRecordManagedSource(
			update.path, current), previous);
		assert.equal(beforeOwnedCheckedRecordManagedSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeOwnedCheckedRecordManagedSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("managed owned checked-record history keeps its implementation range", () => {
	assert.equal(execFileSync("git", ["merge-base"
		, ownedCheckedRecordManagedPredecessor
		, ownedCheckedRecordManagedImplementation]
	, { encoding: "utf8" }).trim(), ownedCheckedRecordManagedPredecessor);
	assert.deepEqual(execFileSync("git", ["diff", "--name-only"
		, ownedCheckedRecordManagedPredecessor
		, ownedCheckedRecordManagedImplementation]
	, { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort()
	, [...ownedCheckedRecordManagedImplementationPaths].sort());
});

test("managed owned checked-record evidence authenticates local qualification"
	, async () => {
		const evidence = JSON.parse(await readFile(
			ownedCheckedRecordManagedEvidencePath, "utf8"
		));
		assert.equal(evidence.schemaVersion, 1);
		assert.equal(evidence.profile
			, "installed-owned-checked-record-managed-local-qualification");
		assert.equal(evidence.implementationCommit
			, ownedCheckedRecordManagedImplementation);
		assert.match(evidence.scope, /local qualification/u);
		assert.deepEqual(evidence.reports.map(item => item.profile)
			, ["dotnet", "java", "kotlin", "php-native", "wit-wasi"]);
		assert.deepEqual(evidence.reports.map(item => item.checks)
			, [4, 121, 119, 120, 261]);
		for(const report of evidence.reports)
		{
			assert.equal(report.sourceUnchanged, true);
			assert.equal(report.sourceFreeInstallation, true);
			assert.equal(report.relocatedInstallation, true);
			assert.equal(report.deterministicReassembly, true);
			assert.equal(report.relocatedChecks, report.checks);
		}
	}
);

test("managed owned checked-record history rejects altered transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedCheckedRecordManagedHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordManagedSource
		);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseOwnedCheckedRecordManagedUpdate(
			current, update));
		update.currentSha256 = sha256(current);
		update.path = "src/not-recorded.mjs";
		assert.throws(() => reverseOwnedCheckedRecordManagedUpdate(
			current, update));
	}
);

test("managed owned checked-record writer refuses unrelated checkouts"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-owned-checked-managed-history-guard-"
		));
		t.after(() => rm(root, { recursive: true, force: true }));
		const env = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const git = arguments_ => execFileSync("git", arguments_
			, { cwd: root, env, stdio: "pipe" });
		git(["init", "--quiet"]);
		git(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-owned-checked-record-managed-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
