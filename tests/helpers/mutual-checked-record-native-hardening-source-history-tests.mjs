/**
 * Preserve recursive checked-record native verifier and archive hardening.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeMutualCheckedRecordNativeHardeningSource
	, mutualCheckedRecordNativeHardeningAddedPaths
	, mutualCheckedRecordNativeHardeningChangedPaths
	, mutualCheckedRecordNativeHardeningDeletedPaths
	, mutualCheckedRecordNativeHardeningDraftParent
	, mutualCheckedRecordNativeHardeningHistoryPath
	, mutualCheckedRecordNativeHardeningPredecessor
	, reverseMutualCheckedRecordNativeHardeningUpdate
} from "./mutual-checked-record-native-hardening-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("recursive native hardening has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		mutualCheckedRecordNativeHardeningHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "mutual-checked-record-native-hardening-source-v1");
	assert.equal(record.predecessorCommit
		, mutualCheckedRecordNativeHardeningPredecessor);
	assert.equal(record.draftParentCommit
		, mutualCheckedRecordNativeHardeningDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, mutualCheckedRecordNativeHardeningChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, mutualCheckedRecordNativeHardeningAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		mutualCheckedRecordNativeHardeningChangedPaths)));
	for(const update of record.updates)
	{
		const current = mutualCheckedRecordNativeHardeningDeletedPaths.includes(update.path)
			? "" : await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeMutualCheckedRecordNativeHardeningSource);
		const previous = git(["show"
			, `${mutualCheckedRecordNativeHardeningPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseMutualCheckedRecordNativeHardeningUpdate(
			current, update), previous, update.path);
		assert.equal(beforeMutualCheckedRecordNativeHardeningSource(
			update.path, current), previous, update.path);
		assert.equal(beforeMutualCheckedRecordNativeHardeningSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeMutualCheckedRecordNativeHardeningSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseMutualCheckedRecordNativeHardeningUpdate(
				current, changed));
		}
	}
});

test("recursive native hardening authenticates additions and the wrapper deletion", async () => {
	const record = JSON.parse(await readFile(
		mutualCheckedRecordNativeHardeningHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256);
		assert.equal(sha256(source)
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${mutualCheckedRecordNativeHardeningPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
	for(const path of mutualCheckedRecordNativeHardeningDeletedPaths)
	{
		await assert.rejects(access(path), { code: "ENOENT" });
		assert.equal(spawnSync("git", ["cat-file", "-e"
			, `${mutualCheckedRecordNativeHardeningPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
	}
});

test("recursive native hardening has no stale type-surface pins", async () => {
	const record = JSON.parse(await readFile(
		mutualCheckedRecordNativeHardeningHistoryPath, "utf8"));
	assert.equal(record.pinCount, 0);
	assert.deepEqual(record.pinUpdates, []);
	const inventory = JSON.parse(git(["show"
		, `${mutualCheckedRecordNativeHardeningPredecessor}:docs/type-surface.v1.json`]));
	for(const update of record.updates)
	{
		const matches = inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === update.path
				&& file.sha256 === update.previousSha256);
		assert.deepEqual(matches, [], update.path);
	}
});

test("recursive native hardening closes registration, provenance and archive gaps", async () => {
	const aggregator = await readFile("tests/mutual-checked-records.test.mjs", "utf8");
	assert.match(aggregator
		, /import "\.\/helpers\/mutual-checked-record-native-ci-tests\.mjs";/u);
	assert.match(aggregator
		, /import "\.\/helpers\/mutual-checked-record-native-hardening-source-history-tests\.mjs";/u);
	const report = await readFile(
		"tests/helpers/mutual-checked-record-native-report.mjs", "utf8");
	for(const source of [
		"NativeExports.lean", "sourceTreeSha256", "sourceNoticesSha256"
		, "metadata.toolchain", "mutualCheckedRecordRefinements"
	]) assert.ok(report.includes(source), source);
	const producer = await readFile(
		"tests/helpers/mutual-checked-record-native-installed-tests.mjs", "utf8");
	for(const source of [
		"runtime.json", "declaredGlibcFloor", "controls.json", "GNU_LIBC_VERSION"
	]) assert.ok(producer.includes(source), source);
	const archive = await readFile("scripts/archive-mutual-checked-record-native.mjs", "utf8");
	assert.match(archive, /mkdtemp/u);
	assert.match(archive, /"\/usr\/bin\/unzip", \["-Z1", artifactZip\]/u);
	assert.match(archive
		, /"\/usr\/bin\/unzip", \["-q", artifactZip, "-d", extracted\]/u);
	assert.doesNotMatch(archive, /hostedRoot, "artifact"/u);
	assert.match(archive, /archiver: archiveCommit/u);
});

test("recursive native hardening writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-native-guard-"));
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
		"scripts/update-mutual-checked-record-native-hardening-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
