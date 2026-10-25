/**
 * Authenticate native/Perl owned checked-record qualification and history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedRecordNativePerlSource
	, ownedCheckedRecordNativePerlAddedPaths
	, ownedCheckedRecordNativePerlChangedPaths
	, ownedCheckedRecordNativePerlEvidencePath
	, ownedCheckedRecordNativePerlHistoryPath
	, ownedCheckedRecordNativePerlImplementation
	, ownedCheckedRecordNativePerlImplementationPaths
	, ownedCheckedRecordNativePerlPredecessor
	, reverseOwnedCheckedRecordNativePerlUpdate
} from "./owned-checked-record-native-perl-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedCheckedRecordNativePerlPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

// Registration refreshed inventory pins after the implementation commit.
// Stream that exact history blob instead of rebuilding all later inventories.
const inventoryRevision = "c45304fba9e85b562a30ad466a4aeea7f1a546fc";

test("native/Perl owned checked-record history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordNativePerlHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-native-perl-source-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordNativePerlPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordNativePerlImplementation);
	assert.equal(execFileSync("git", ["show", "-s", "--format=%P", inventoryRevision]
		, { encoding: "utf8" }).trim(), ownedCheckedRecordNativePerlImplementation);
	assert.deepEqual(JSON.parse(execFileSync("git", ["show"
		, `${inventoryRevision}:${ownedCheckedRecordNativePerlHistoryPath}`]
	, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })), record);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordNativePerlChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordNativePerlAddedPaths);
	assert.ok(record.refreshedTypeSurfacePointers > 0);
	assert.equal(record.acceptanceEvidence.path
		, ownedCheckedRecordNativePerlEvidencePath);
	assert.equal(record.acceptanceEvidence.sha256
		, sha256(await readFile(ownedCheckedRecordNativePerlEvidencePath)));
	for(const update of record.updates)
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				inventoryRevision, update.path
			), update), true);
			const previous = createHash("sha256");
			for await(const chunk of gitSourceBytes(
				ownedCheckedRecordNativePerlPredecessor, update.path
			)) previous.update(chunk);
			assert.equal(previous.digest("hex"), update.previousSha256);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			continue;
		}
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordNativePerlSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseOwnedCheckedRecordNativePerlUpdate(
			current, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeOwnedCheckedRecordNativePerlSource(
			update.path, current), previous);
		assert.equal(beforeOwnedCheckedRecordNativePerlSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeOwnedCheckedRecordNativePerlSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("native/Perl owned checked-record history keeps its implementation range", () => {
	assert.equal(execFileSync("git", ["merge-base"
		, ownedCheckedRecordNativePerlPredecessor
		, ownedCheckedRecordNativePerlImplementation]
	, { encoding: "utf8" }).trim(), ownedCheckedRecordNativePerlPredecessor);
	assert.deepEqual(execFileSync("git", ["diff", "--name-only"
		, ownedCheckedRecordNativePerlPredecessor
		, ownedCheckedRecordNativePerlImplementation]
	, { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort()
	, [...ownedCheckedRecordNativePerlImplementationPaths].sort());
});

test("native/Perl owned checked-record evidence authenticates local qualification"
	, async () => {
		const evidence = JSON.parse(await readFile(
			ownedCheckedRecordNativePerlEvidencePath, "utf8"
		));
		assert.equal(evidence.schemaVersion, 1);
		assert.equal(evidence.profile
			, "installed-owned-checked-record-native-perl-local-qualification");
		assert.equal(evidence.implementationCommit
			, ownedCheckedRecordNativePerlImplementation);
		assert.match(evidence.scope, /local qualification/u);
		for(const reports of [evidence.nativeReports, evidence.perlReports])
			assert.deepEqual(reports.map(item => item.route)
				, ["ordinary-full", "ordinary-result-only"]);
		assert.deepEqual(evidence.nativeReports.map(item => [
			item.consumers.c.checks, item.consumers.cpp.checks
		]), [[261, 125], [14, 3]]);
		assert.deepEqual(evidence.perlReports.map(item =>
			[...new Set(item.observations.map(value => value.observed.checks))]
		), [[63], [9]]);
		for(const report of evidence.perlReports)
		{
			assert.equal(report.observations.length, 8);
			assert.ok(report.observations.every(value =>
				value.assets.length === 6));
		}
	}
);

test("native/Perl owned checked-record history rejects altered transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedCheckedRecordNativePerlHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates.find(item =>
			item.path !== "docs/type-surface.v1.json"));
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordNativePerlSource
		);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseOwnedCheckedRecordNativePerlUpdate(
			current, update));
		update.currentSha256 = sha256(current);
		update.path = "src/not-recorded.mjs";
		assert.throws(() => reverseOwnedCheckedRecordNativePerlUpdate(
			current, update));
	}
);

test("native/Perl owned checked-record inventory rejects changed endpoints and spans", async () => {
	const record = JSON.parse(await readFile(ownedCheckedRecordNativePerlHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === "docs/type-surface.v1.json");
	for(const change of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }
		, { ...update, edits: [
			{ ...update.edits[0], current: "changed" + update.edits[0].current }
			, ...update.edits.slice(1)
		] }
	])
		await assert.rejects(() => authenticateSourceHistoryReverse(gitSourceBytes(
			inventoryRevision, update.path
		), change));
});

test("native/Perl owned checked-record writer refuses unrelated checkouts"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-owned-checked-native-perl-history-guard-"
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
			"scripts/update-owned-checked-record-native-perl-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
