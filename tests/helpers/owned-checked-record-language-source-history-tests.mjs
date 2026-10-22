/**
 * Authenticate Python, Ruby and Rust owned checked-record qualification.
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
	beforeOwnedCheckedRecordLanguageSource
	, ownedCheckedRecordLanguageAddedPaths
	, ownedCheckedRecordLanguageChangedPaths
	, ownedCheckedRecordLanguageEvidencePath
	, ownedCheckedRecordLanguageHistoryPath
	, ownedCheckedRecordLanguageImplementation
	, ownedCheckedRecordLanguageImplementationPaths
	, ownedCheckedRecordLanguagePredecessor
	, reverseOwnedCheckedRecordLanguageUpdate
} from "./owned-checked-record-language-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedCheckedRecordLanguagePredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("language owned checked-record history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordLanguageHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-language-source-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordLanguagePredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordLanguageImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordLanguageChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordLanguageAddedPaths);
	assert.ok(record.refreshedTypeSurfacePointers > 0);
	assert.equal(record.acceptanceEvidence.path
		, ownedCheckedRecordLanguageEvidencePath);
	assert.equal(record.acceptanceEvidence.sha256
		, sha256(await readFile(ownedCheckedRecordLanguageEvidencePath)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordLanguageSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseOwnedCheckedRecordLanguageUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeOwnedCheckedRecordLanguageSource(
			update.path, current), previous);
		assert.equal(beforeOwnedCheckedRecordLanguageSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeOwnedCheckedRecordLanguageSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("language owned checked-record history keeps its implementation range", () => {
	assert.equal(execFileSync("git", ["merge-base"
		, ownedCheckedRecordLanguagePredecessor
		, ownedCheckedRecordLanguageImplementation]
	, { encoding: "utf8" }).trim(), ownedCheckedRecordLanguagePredecessor);
	assert.deepEqual(execFileSync("git", ["diff", "--name-only"
		, ownedCheckedRecordLanguagePredecessor
		, ownedCheckedRecordLanguageImplementation]
	, { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort()
	, [...ownedCheckedRecordLanguageImplementationPaths].sort());
});

test("language owned checked-record evidence authenticates local qualification"
	, async () => {
		const evidence = JSON.parse(await readFile(
			ownedCheckedRecordLanguageEvidencePath, "utf8"
		));
		assert.equal(evidence.schemaVersion, 1);
		assert.equal(evidence.profile
			, "installed-owned-checked-record-language-local-qualification");
		assert.equal(evidence.implementationCommit
			, ownedCheckedRecordLanguageImplementation);
		assert.match(evidence.scope, /local qualification/u);
		assert.deepEqual(evidence.reports.map(item => item.language)
			, ["python", "ruby", "rust"]);
		assert.deepEqual(evidence.reports.map(item => item.checks)
			, [138, 138, 3]);
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

test("language owned checked-record history rejects altered transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedCheckedRecordLanguageHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordLanguageSource
		);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseOwnedCheckedRecordLanguageUpdate(
			current, update));
		update.currentSha256 = sha256(current);
		update.path = "src/not-recorded.mjs";
		assert.throws(() => reverseOwnedCheckedRecordLanguageUpdate(
			current, update));
	}
);

test("language owned checked-record writer refuses unrelated checkouts"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-owned-checked-language-history-guard-"
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
			"scripts/update-owned-checked-record-language-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
