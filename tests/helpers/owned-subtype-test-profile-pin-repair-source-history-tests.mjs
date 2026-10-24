/**
 * Authenticate the owned-Subtype test-profile live-pin repair.
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
	beforeOwnedSubtypeTestProfilePinRepairSource
	, ownedSubtypeTestProfilePinRepairAddedPaths
	, ownedSubtypeTestProfilePinRepairCurrentSha256
	, ownedSubtypeTestProfilePinRepairHistoryPath
	, ownedSubtypeTestProfilePinRepairImplementation
	, ownedSubtypeTestProfilePinRepairImplementationPaths
	, ownedSubtypeTestProfilePinRepairIntegrationPaths
	, ownedSubtypeTestProfilePinRepairPin
	, ownedSubtypeTestProfilePinRepairPredecessor
	, ownedSubtypeTestProfilePinRepairPreviousSha256
	, reverseOwnedSubtypeTestProfilePinRepairUpdate
} from "./owned-subtype-test-profile-pin-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	ownedSubtypeTestProfilePinRepairHistoryPath, "utf8"));

test("owned Subtype test-profile pin repair restores every source", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-subtype-test-profile-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, git(["rev-parse", ownedSubtypeTestProfilePinRepairPredecessor]).trim());
	assert.equal(record.implementationCommit
		, ownedSubtypeTestProfilePinRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeTestProfilePinRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeTestProfilePinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeTestProfilePinRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedSubtypeTestProfilePinRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeTestProfilePinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedSubtypeTestProfilePinRepairImplementation}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeTestProfilePinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned Subtype test-profile pin repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeTestProfilePinRepairImplementation}^`]).trim()
	, git(["rev-parse", ownedSubtypeTestProfilePinRepairPredecessor]).trim());
	assert.deepEqual(names(["diff", "--name-only"
		, ownedSubtypeTestProfilePinRepairPredecessor
		, ownedSubtypeTestProfilePinRepairImplementation])
	, [...ownedSubtypeTestProfilePinRepairImplementationPaths].sort());
});

test("owned Subtype test-profile repair refreshes exactly 98 live pins"
	, async () => {
	const record = await readRecord();
	assert.equal(record.pinCount, 98);
	assert.deepEqual(record.pin, ownedSubtypeTestProfilePinRepairPin);
	assert.equal(sha256(await sourceAtFinHistoryMilestone(
		ownedSubtypeTestProfilePinRepairPin.path
		, ownedSubtypeTestProfilePinRepairCurrentSha256))
		, ownedSubtypeTestProfilePinRepairCurrentSha256);
	const update = record.updates[0];
	const current = JSON.parse(await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256));
	const previous = JSON.parse(git(["show"
		, `${ownedSubtypeTestProfilePinRepairPredecessor}:${update.path}`]));
	let count = 0;
	for(const [index, evidence] of current.evidence.entries())
	{
		const oldEvidence = previous.evidence[index];
		assert.equal(evidence.files.length, oldEvidence.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = oldEvidence.files[position];
			assert.equal(file.path, old.path);
			if(file.path === ownedSubtypeTestProfilePinRepairPin.path)
			{
				assert.equal(old.sha256
					, ownedSubtypeTestProfilePinRepairPreviousSha256);
				assert.equal(file.sha256
					, ownedSubtypeTestProfilePinRepairCurrentSha256);
				old.sha256 = file.sha256;
				count++;
			}
			else assert.equal(file.sha256, old.sha256, file.path);
		}
	}
	assert.equal(count, 98);
	assert.deepEqual(current, previous
		, "No support claim may change with a live source-pin repair");
	}
);

test("owned Subtype test-profile pin repair rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeTestProfilePinRepairUpdate(
		current, forged));
	const wrongCount = structuredClone(update);
	wrongCount.replacements[0].count--;
	assert.throws(() => reverseOwnedSubtypeTestProfilePinRepairUpdate(
		current, wrongCount));
	assert.equal(beforeOwnedSubtypeTestProfilePinRepairSource(
		"docs/unrelated.md", current), current);
});

test("owned Subtype test-profile pin writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-owned-subtype-test-profile-pin-history-"));
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
		"scripts/update-owned-subtype-test-profile-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
