/**
 * Preserve every predecessor and every committed archive byte through the
 * hosted value-index checked-record .NET archive milestone.
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
	beforeCheckedRecordValueIndexDotnetArchiveSource
	, checkedRecordValueIndexDotnetArchiveAddedFileCount
	, checkedRecordValueIndexDotnetArchiveAttributesSha256
	, checkedRecordValueIndexDotnetArchiveChangedPaths
	, checkedRecordValueIndexDotnetArchiveDraftParent
	, checkedRecordValueIndexDotnetArchiveFoundationModifiedPaths
	, checkedRecordValueIndexDotnetArchiveHistoryAddedPaths
	, checkedRecordValueIndexDotnetArchiveHistoryPath
	, checkedRecordValueIndexDotnetArchiveIndexSha256
	, checkedRecordValueIndexDotnetArchiveIndexedFileCount
	, checkedRecordValueIndexDotnetArchivePredecessor
	, checkedRecordValueIndexDotnetArchiveRoot
	, reverseCheckedRecordValueIndexDotnetArchiveUpdate
} from "./checked-record-value-index-dotnet-archive-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

test("hosted value-index .NET archive has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexDotnetArchiveHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-dotnet-archive-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexDotnetArchivePredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexDotnetArchiveDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexDotnetArchiveChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexDotnetArchiveHistoryAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexDotnetArchiveChangedPaths
	)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
				, beforeCheckedRecordValueIndexDotnetArchiveSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexDotnetArchivePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexDotnetArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexDotnetArchiveSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexDotnetArchiveSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeCheckedRecordValueIndexDotnetArchiveSource(
			update.path, unknown), unknown, update.path);
	}
	const sample = record.updates.find(update => update.path.endsWith(
		"checked-record-value-index-dotnet-evidence.mjs"
	));
	const current = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
			, beforeCheckedRecordValueIndexDotnetArchiveSource
	);
	for(const mutate of [
		item => { item.path = "unknown"; }
		, item => { item.previousSha256 = "0".repeat(64); }
		, item => { item.currentSha256 = "0".repeat(64); }
		, item => { item.edits = []; }
		, item => { item.edits[0].start = -1; }
		, item => { item.edits[0].current += "unknown"; }
	]) {
		const changed = structuredClone(sample); mutate(changed);
		assert.throws(() => reverseCheckedRecordValueIndexDotnetArchiveUpdate(
			current, changed));
	}
});

test("hosted value-index .NET archive closes its exact committed tree", () => {
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexDotnetArchivePredecessor
		, checkedRecordValueIndexDotnetArchiveDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...checkedRecordValueIndexDotnetArchiveFoundationModifiedPaths].sort());
	const added = git(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexDotnetArchivePredecessor
		, checkedRecordValueIndexDotnetArchiveDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.equal(added.length, checkedRecordValueIndexDotnetArchiveAddedFileCount);
	assert.ok(added.every(path => path.startsWith(
		checkedRecordValueIndexDotnetArchiveRoot + "/")));
	const indexBytes = Buffer.from(git(["show"
		, `${checkedRecordValueIndexDotnetArchiveDraftParent}:${checkedRecordValueIndexDotnetArchiveRoot}/index.json`]));
	assert.equal(sha256(indexBytes)
		, checkedRecordValueIndexDotnetArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, checkedRecordValueIndexDotnetArchiveIndexedFileCount);
	const expected = [
		`${checkedRecordValueIndexDotnetArchiveRoot}/.gitattributes`
		, `${checkedRecordValueIndexDotnetArchiveRoot}/index.json`
		, ...index.files.map(file =>
			`${checkedRecordValueIndexDotnetArchiveRoot}/${file.path}`)
	].sort();
	assert.deepEqual(added, expected);
	assert.equal(sha256(git(["show"
		, `${checkedRecordValueIndexDotnetArchiveDraftParent}:${checkedRecordValueIndexDotnetArchiveRoot}/.gitattributes`]))
		, checkedRecordValueIndexDotnetArchiveAttributesSha256);
});

test("hosted value-index .NET archive closes additions and live pins"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexDotnetArchiveHistoryPath, "utf8"
		));
		for(const addition of record.additions)
		{
			const current = await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256
					, beforeCheckedRecordValueIndexDotnetArchiveSource
			);
			assert.equal(sha256(current)
				, addition.currentSha256, addition.path);
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${checkedRecordValueIndexDotnetArchivePredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		}
		assert.equal(record.pinCount, 3);
		const inventoryPath = "docs/type-surface.v1.json";
		const inventoryUpdate = record.updates.find(update =>
			update.path === inventoryPath);
		assert.ok(inventoryUpdate);
		const previousSource = git(["show"
			, `${checkedRecordValueIndexDotnetArchivePredecessor}:${inventoryPath}`]);
		const expected = JSON.parse(previousSource);
		let count = 0;
		for(const pin of record.pinUpdates)
		{
			const previous = git(["show"
				, `${checkedRecordValueIndexDotnetArchivePredecessor}:${pin.path}`]);
			const update = record.updates.find(item => item.path === pin.path);
			assert.ok(update, pin.path);
			assert.equal(sha256(previous), pin.previousSha256, pin.path);
			assert.equal(update.previousSha256, pin.previousSha256, pin.path);
			assert.equal(update.currentSha256, pin.currentSha256, pin.path);
			let found = 0;
			for(const evidence of expected.evidence)
				for(const file of evidence.files)
					if(file.path === pin.path
						&& file.sha256 === pin.previousSha256){
						file.sha256 = pin.currentSha256;
						found++;
						}
			assert.equal(found, pin.count, pin.path);
			count += found;
		}
		assert.equal(count, record.pinCount);
		const current = await sourceAtFinHistoryMilestone(
			inventoryPath, inventoryUpdate.currentSha256
				, beforeCheckedRecordValueIndexDotnetArchiveSource
		);
		assert.equal(current, JSON.stringify(expected, null, 2) + "\n");
	}
);

test("hosted value-index .NET archive writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-dotnet-archive-guard-"
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
			"scripts/update-checked-record-value-index-dotnet-archive-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact archive commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
