/**
 * Bind inherited checked-record PHP support to exact source bytes and closed
 * test registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import {
	beforeInheritedCheckedRecordPhpSource
	, inheritedCheckedRecordPhpAddedPaths
	, inheritedCheckedRecordPhpChangedPaths
	, inheritedCheckedRecordPhpDraftParent
	, inheritedCheckedRecordPhpHistoryPath
	, inheritedCheckedRecordPhpPredecessor
	, reverseInheritedCheckedRecordPhpUpdate
} from "./helpers/inherited-checked-record-php-source-history.mjs";
import {
	beforeInheritedCheckedRecordPhpPinRepairSource
	, inheritedCheckedRecordPhpPinRepairAddedPaths
	, inheritedCheckedRecordPhpPinRepairChangedPaths
	, inheritedCheckedRecordPhpPinRepairDraftParent
	, inheritedCheckedRecordPhpPinRepairHistoryPath
	, inheritedCheckedRecordPhpPinRepairPins
	, inheritedCheckedRecordPhpPinRepairPredecessor
	, reverseInheritedCheckedRecordPhpPinRepairUpdate
} from "./helpers/inherited-checked-record-php-pin-repair-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./helpers/source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("inherited checked-record PHP support has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPhpHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "inherited-checked-record-php-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPhpPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPhpDraftParent);
	assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
		, inheritedCheckedRecordPhpPredecessor
		, inheritedCheckedRecordPhpDraftParent]).status, 0);
	assert.equal(Number(git(["rev-list", "--count"
		, `${inheritedCheckedRecordPhpPredecessor}..${inheritedCheckedRecordPhpDraftParent}`
	]).trim()), 3);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPhpChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPhpAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPhpChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPhpSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPhpPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPhpUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPhpSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPhpSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPhpSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseInheritedCheckedRecordPhpUpdate(
				current, changed));
		}
	}
});

test("inherited native PHP additions and test registration are closed", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPhpHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeInheritedCheckedRecordPhpSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPhpPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-php.test.mjs"), "contract");
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-php-evidence.test.mjs"), "contract");
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-php-source-history.test.mjs"
	), "contract");
});

test("inherited native PHP pin repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPhpPinRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-php-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPhpPinRepairPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPhpPinRepairDraftParent);
	assert.equal(inheritedCheckedRecordPhpPinRepairPredecessor
		, inheritedCheckedRecordPhpPinRepairDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPhpPinRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPhpPinRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPhpPinRepairChangedPaths)));
	const pinCount = inheritedCheckedRecordPhpPinRepairPins.reduce(
		(total, pin) => total + pin.count, 0
	);
	assert.equal(record.pinCount, pinCount);
	assert.deepEqual(record.pinUpdates
		, inheritedCheckedRecordPhpPinRepairPins);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPhpPinRepairSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPhpPinRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPhpPinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPhpPinRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPhpPinRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPhpPinRepairSource(
			update.path, unknown), unknown, update.path);
		const mutations = [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
		];
		if(update.replacements)
			mutations.push(
				item => { item.replacements = []; }
				, item => { item.replacements[0].count = 0; }
				, item => { item.replacements[0].current += "unknown"; }
			);
		else mutations.push(
			item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		);
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseInheritedCheckedRecordPhpPinRepairUpdate(
				current, changed));
		}
	}
});

test("inherited native PHP pin repair closes additions and all repaired pins", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPhpPinRepairHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeInheritedCheckedRecordPhpPinRepairSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPhpPinRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	const inventory = JSON.parse(await readFile(
		"docs/type-surface.v1.json", "utf8"));
	const paths = new Set(inheritedCheckedRecordPhpPinRepairPins.map(
		pin => pin.path
	));
	const pins = inventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => paths.has(file.path));
	assert.equal(pins.length, record.pinCount);
	for(const expected of inheritedCheckedRecordPhpPinRepairPins)
	{
		const matches = pins.filter(file => file.path === expected.path);
		assert.equal(matches.length, expected.count, expected.path);
		assert.ok(matches.every(file => file.sha256
			=== expected.currentSha256), expected.path);
	}
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-php-source-history.test.mjs"
	), "contract");
});

test("inherited native PHP pin-repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-php-pin-repair-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-php-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("inherited native PHP history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-php-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-php-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
