/**
 * Authenticate the owned-Subtype Perl archive source-path repair.
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
	beforeOwnedSubtypePerlSourcePathRepairSource
	, ownedSubtypePerlSourcePathRepairHistoryAddedPaths
	, ownedSubtypePerlSourcePathRepairHistoryPath
	, ownedSubtypePerlSourcePathRepairImplementation
	, ownedSubtypePerlSourcePathRepairIntegrationPaths
	, ownedSubtypePerlSourcePathRepairModifiedPaths
	, ownedSubtypePerlSourcePathRepairPredecessor
	, reverseOwnedSubtypePerlSourcePathRepairUpdate
} from "./owned-subtype-perl-source-path-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	ownedSubtypePerlSourcePathRepairHistoryPath, "utf8"));
const atMilestone = (path, digest) =>
	sourceAtFinHistoryMilestone(path, digest);

test("owned Subtype Perl source-path repair history restores every source"
	, async () => {
		const record = await readRecord();
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "owned-subtype-perl-source-path-repair-v1");
		assert.equal(record.predecessorCommit
			, ownedSubtypePerlSourcePathRepairPredecessor);
		assert.equal(record.implementationCommit
			, ownedSubtypePerlSourcePathRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, ownedSubtypePerlSourcePathRepairModifiedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, ownedSubtypePerlSourcePathRepairIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, ownedSubtypePerlSourcePathRepairHistoryAddedPaths);
		for(const update of record.updates)
		{
			const current = await atMilestone(update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${ownedSubtypePerlSourcePathRepairPredecessor}:${update.path}`]);
			assert.equal(reverseOwnedSubtypePerlSourcePathRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous
				, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path)
				, update.path);
		}
		for(const update of record.integrationUpdates)
		{
			const current = await atMilestone(update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${ownedSubtypePerlSourcePathRepairImplementation}:${update.path}`]);
			assert.equal(reverseOwnedSubtypePerlSourcePathRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous
				, update.path);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await atMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("owned Subtype Perl source-path repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypePerlSourcePathRepairImplementation}^`]).trim()
	, ownedSubtypePerlSourcePathRepairPredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, ownedSubtypePerlSourcePathRepairPredecessor
		, ownedSubtypePerlSourcePathRepairImplementation])
	, [...ownedSubtypePerlSourcePathRepairModifiedPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, ownedSubtypePerlSourcePathRepairPredecessor
		, ownedSubtypePerlSourcePathRepairImplementation])
	, [...ownedSubtypePerlSourcePathRepairModifiedPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
		, ownedSubtypePerlSourcePathRepairPredecessor
		, ownedSubtypePerlSourcePathRepairImplementation]), []);
});

test("owned Subtype Perl source-path repair refreshes only live pins"
	, async () => {
		const record = await readRecord();
		const inventoryUpdate = record.integrationUpdates.find(item =>
			item.path === inventoryPath);
		const inventory = JSON.parse(await atMilestone(
			inventoryPath, inventoryUpdate.currentSha256));
		const before = JSON.parse(git(["show"
			, `${ownedSubtypePerlSourcePathRepairImplementation}:${inventoryPath}`]));
		const expected = new Map([
			...record.updates.map(item => [item.path, item.currentSha256])
			, ...record.integrationUpdates
				.filter(item => item.path !== inventoryPath)
				.map(item => [item.path, item.currentSha256])
		]);
		assert.equal(inventory.evidence.length, before.evidence.length);
		let refreshed = 0;
		for(const [index, evidence] of inventory.evidence.entries())
		{
			const previous = before.evidence[index];
			assert.equal(evidence.files.length, previous.files.length);
			for(const [position, file] of evidence.files.entries())
			{
				const old = previous.files[position];
				assert.equal(file.path, old.path);
				if(expected.has(file.path))
				{
					assert.ok(!file.path.startsWith("docs/evidence/"));
					assert.equal(file.sha256, expected.get(file.path)
						, file.path);
					if(old.sha256 !== file.sha256) refreshed++;
				}
				else assert.equal(file.sha256, old.sha256, file.path);
			}
		}
		assert.ok(refreshed > 0);
	}
);

test("owned Subtype Perl source-path repair re-enters its changed root"
	, async () => {
		const record = await readRecord();
		const path = "tests/owned-subtype-hosted-ci.test.mjs";
		const update = record.integrationUpdates.find(item => item.path === path);
		const current = await atMilestone(path, update.currentSha256);
		const target = git(["show"
			, `${ownedSubtypePerlSourcePathRepairPredecessor}:${path}`]);
		assert.notEqual(sha256(target), update.previousSha256);
		assert.equal(beforeFinRefinementSource(path, current, sha256(target))
			, target);
	}
);

test("owned Subtype Perl source-path repair rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	assert.throws(() => reverseOwnedSubtypePerlSourcePathRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseOwnedSubtypePerlSourcePathRepairUpdate(
		current, shifted));
	const rewritten = structuredClone(update);
	rewritten.edits[0].previous += "x";
	assert.throws(() => reverseOwnedSubtypePerlSourcePathRepairUpdate(
		current, rewritten));
	assert.equal(beforeOwnedSubtypePerlSourcePathRepairSource(
		update.path, `${current}unrelated\n`), `${current}unrelated\n`);
});

test("owned Subtype Perl source-path repair writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-owned-subtype-perl-path-history-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const localGit = arguments_ => execFileSync("git", arguments_, {
			cwd: root, env: environment, stdio: "pipe"
		});
		localGit(["init", "--quiet"]);
		localGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c"
			, "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
			, "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-owned-subtype-perl-source-path-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
