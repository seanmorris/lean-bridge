/**
 * Bind inherited checked-record Perl support to exact source bytes and closed
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
	beforeInheritedCheckedRecordPerlArgumentsSource
	, inheritedCheckedRecordPerlArgumentsAddedPaths
	, inheritedCheckedRecordPerlArgumentsChangedPaths
	, inheritedCheckedRecordPerlArgumentsDraftParent
	, inheritedCheckedRecordPerlArgumentsHistoryPath
	, inheritedCheckedRecordPerlArgumentsPredecessor
	, reverseInheritedCheckedRecordPerlArgumentsUpdate
} from "./helpers/inherited-checked-record-perl-arguments-source-history.mjs";
import {
	beforeInheritedCheckedRecordPerlArchiveSource
	, inheritedCheckedRecordPerlArchiveAddedPaths
	, inheritedCheckedRecordPerlArchiveChangedPaths
	, inheritedCheckedRecordPerlArchiveDraftParent
	, inheritedCheckedRecordPerlArchiveHistoryPath
	, inheritedCheckedRecordPerlArchivePredecessor
	, reverseInheritedCheckedRecordPerlArchiveUpdate
} from "./helpers/inherited-checked-record-perl-archive-source-history.mjs";
import {
	beforeInheritedCheckedRecordPerlSource
	, inheritedCheckedRecordPerlAddedPaths
	, inheritedCheckedRecordPerlChangedPaths
	, inheritedCheckedRecordPerlDraftParent
	, inheritedCheckedRecordPerlHistoryPath
	, inheritedCheckedRecordPerlPredecessor
	, reverseInheritedCheckedRecordPerlUpdate
} from "./helpers/inherited-checked-record-perl-source-history.mjs";
import {
	beforeInheritedCheckedRecordPerlPinRepairSource
	, inheritedCheckedRecordPerlPinRepairAddedPaths
	, inheritedCheckedRecordPerlPinRepairChangedPaths
	, inheritedCheckedRecordPerlPinRepairDraftParent
	, inheritedCheckedRecordPerlPinRepairHistoryPath
	, inheritedCheckedRecordPerlPinRepairPins
	, inheritedCheckedRecordPerlPinRepairPredecessor
	, reverseInheritedCheckedRecordPerlPinRepairUpdate
} from "./helpers/inherited-checked-record-perl-pin-repair-source-history.mjs";
import {
	beforeInheritedCheckedRecordPerlStdoutSource
	, inheritedCheckedRecordPerlStdoutAddedPaths
	, inheritedCheckedRecordPerlStdoutChangedPaths
	, inheritedCheckedRecordPerlStdoutDraftParent
	, inheritedCheckedRecordPerlStdoutHistoryPath
	, inheritedCheckedRecordPerlStdoutPredecessor
	, reverseInheritedCheckedRecordPerlStdoutUpdate
} from "./helpers/inherited-checked-record-perl-stdout-source-history.mjs";
import {
	beforeInheritedCheckedRecordPerlVerifierSource
	, inheritedCheckedRecordPerlVerifierAddedPaths
	, inheritedCheckedRecordPerlVerifierChangedPaths
	, inheritedCheckedRecordPerlVerifierDraftParent
	, inheritedCheckedRecordPerlVerifierHistoryPath
	, inheritedCheckedRecordPerlVerifierPredecessor
	, reverseInheritedCheckedRecordPerlVerifierUpdate
} from "./helpers/inherited-checked-record-perl-verifier-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./helpers/source-at-fin-history-milestone.mjs";
import {
	sourceAtHistoryMilestone
} from "./helpers/source-history-test-source.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("inherited Perl archive pins have one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-perl-archive-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPerlArchivePredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPerlArchiveDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPerlArchiveChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPerlArchiveAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPerlArchiveChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPerlArchiveSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPerlArchivePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPerlArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlArchiveSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlArchiveSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPerlArchiveSource(
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
			assert.throws(() =>
				reverseInheritedCheckedRecordPerlArchiveUpdate(current, changed));
		}
	}
});

test("inherited Perl archive history closes additions", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlArchiveHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPerlArchivePredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("inherited Perl archive-history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-perl-archive-guard-"
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
		"scripts/update-inherited-checked-record-perl-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("inherited Perl verifier hardening has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlVerifierHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-perl-verifier-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPerlVerifierPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPerlVerifierDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPerlVerifierChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPerlVerifierAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPerlVerifierChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPerlVerifierSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPerlVerifierPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPerlVerifierUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlVerifierSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlVerifierSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPerlVerifierSource(
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
			assert.throws(() =>
				reverseInheritedCheckedRecordPerlVerifierUpdate(current, changed));
		}
	}
});

test("inherited Perl verifier hardening closes additions", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlVerifierHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPerlVerifierPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("inherited Perl verifier writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-perl-verifier-guard-"
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
		"scripts/update-inherited-checked-record-perl-verifier-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("inherited Perl argument correction has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlArgumentsHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-perl-arguments-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPerlArgumentsPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPerlArgumentsDraftParent);
	assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
		, inheritedCheckedRecordPerlArgumentsPredecessor
		, inheritedCheckedRecordPerlArgumentsDraftParent]).status, 0);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPerlArgumentsChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPerlArgumentsAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPerlArgumentsChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPerlArgumentsSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPerlArgumentsPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPerlArgumentsUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlArgumentsSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlArgumentsSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPerlArgumentsSource(
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
			assert.throws(() => reverseInheritedCheckedRecordPerlArgumentsUpdate(
				current, changed));
		}
	}
});

test("inherited Perl argument correction closes additions", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlArgumentsHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await readFile(addition.path);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPerlArgumentsPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("inherited Perl argument writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-perl-arguments-guard-"
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
		"scripts/update-inherited-checked-record-perl-arguments-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("inherited Perl stdout correction has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlStdoutHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-perl-stdout-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPerlStdoutPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPerlStdoutDraftParent);
	assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
		, inheritedCheckedRecordPerlStdoutPredecessor
		, inheritedCheckedRecordPerlStdoutDraftParent]).status, 0);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPerlStdoutChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPerlStdoutAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPerlStdoutChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPerlStdoutSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPerlStdoutPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPerlStdoutUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlStdoutSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlStdoutSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPerlStdoutSource(
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
			assert.throws(() => reverseInheritedCheckedRecordPerlStdoutUpdate(
				current, changed));
		}
	}
});

test("inherited Perl stdout correction closes additions", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlStdoutHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await readFile(addition.path);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPerlStdoutPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("inherited Perl stdout writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-perl-stdout-guard-"
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
		"scripts/update-inherited-checked-record-perl-stdout-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("inherited checked-record Perl support has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-perl-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPerlPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPerlDraftParent);
	assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
		, inheritedCheckedRecordPerlPredecessor
		, inheritedCheckedRecordPerlDraftParent]).status, 0);
	assert.equal(Number(git(["rev-list", "--count"
		, `${inheritedCheckedRecordPerlPredecessor}..${inheritedCheckedRecordPerlDraftParent}`
	]).trim()), 4);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPerlChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPerlAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPerlChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPerlSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPerlPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPerlUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPerlSource(
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
			assert.throws(() => reverseInheritedCheckedRecordPerlUpdate(
				current, changed));
		}
	}
});

test("inherited Perl additions and test registration are closed", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeInheritedCheckedRecordPerlSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPerlPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-perl.test.mjs"), "contract");
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-perl-evidence.test.mjs"), "contract");
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-perl-source-history.test.mjs"
	), "contract");
});

test("inherited Perl pin repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlPinRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-perl-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordPerlPinRepairPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordPerlPinRepairDraftParent);
	assert.equal(inheritedCheckedRecordPerlPinRepairPredecessor
		, inheritedCheckedRecordPerlPinRepairDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordPerlPinRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordPerlPinRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordPerlPinRepairChangedPaths)));
	const pinCount = inheritedCheckedRecordPerlPinRepairPins.reduce(
		(total, pin) => total + pin.count, 0
	);
	assert.equal(record.pinCount, pinCount);
	assert.deepEqual(record.pinUpdates
		, inheritedCheckedRecordPerlPinRepairPins);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordPerlPinRepairSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordPerlPinRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordPerlPinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlPinRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordPerlPinRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordPerlPinRepairSource(
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
			assert.throws(() => reverseInheritedCheckedRecordPerlPinRepairUpdate(
				current, changed));
		}
	}
});

test("inherited Perl pin repair closes additions and repaired pins", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordPerlPinRepairHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeInheritedCheckedRecordPerlPinRepairSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordPerlPinRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	const inventory = JSON.parse(sourceAtHistoryMilestone(
		inheritedCheckedRecordPerlPinRepairHistoryPath
		, "docs/type-surface.v1.json"
	));
	const paths = new Set(inheritedCheckedRecordPerlPinRepairPins.map(
		pin => pin.path
	));
	const pins = inventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => paths.has(file.path));
	assert.equal(pins.length, record.pinCount);
	for(const expected of inheritedCheckedRecordPerlPinRepairPins)
	{
		const matches = pins.filter(file => file.path === expected.path);
		assert.equal(matches.length, expected.count, expected.path);
		assert.ok(matches.every(file => file.sha256
			=== expected.currentSha256), expected.path);
	}
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-perl-source-history.test.mjs"
	), "contract");
});

test("inherited Perl pin-repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-perl-pin-repair-guard-"
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
		"scripts/update-inherited-checked-record-perl-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("inherited Perl history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-perl-history-guard-"
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
		"scripts/update-inherited-checked-record-perl-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
