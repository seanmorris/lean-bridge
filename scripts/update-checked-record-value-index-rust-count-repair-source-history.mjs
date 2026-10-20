#!/usr/bin/env node
/**
 * Record the delayed Rust value-index receipt-count repair from exact Git
 * blobs together with its current history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexRustCountRepairAddedPaths
	, checkedRecordValueIndexRustCountRepairChangedPaths
	, checkedRecordValueIndexRustCountRepairCurrentCommit
	, checkedRecordValueIndexRustCountRepairHistoricalPaths
	, checkedRecordValueIndexRustCountRepairHistoryPath
	, checkedRecordValueIndexRustCountRepairPreviousCommit
	, checkedRecordValueIndexRustCountRepairRegistrationParent
	, reverseCheckedRecordValueIndexRustCountRepairUpdate
} from "../tests/helpers/checked-record-value-index-rust-count-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexRustCountRepairRegistrationParent
	, "Rust count-repair history must stay on its exact registration parent");
assert.equal(git(["rev-parse"
	, `${checkedRecordValueIndexRustCountRepairCurrentCommit}^`]).trim()
, checkedRecordValueIndexRustCountRepairPreviousCommit
, "Rust count repair must keep its exact predecessor");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, checkedRecordValueIndexRustCountRepairCurrentCommit
	, checkedRecordValueIndexRustCountRepairRegistrationParent]
, { stdio: "ignore" }).status, 0, "Rust count repair must remain in history");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexRustCountRepairRegistrationParent}:${checkedRecordValueIndexRustCountRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed Rust count history");
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexRustCountRepairPreviousCommit
	, checkedRecordValueIndexRustCountRepairCurrentCommit])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexRustCountRepairHistoricalPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexRustCountRepairPreviousCommit
	, checkedRecordValueIndexRustCountRepairCurrentCommit])
	.trim().split("\n").filter(Boolean), []);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexRustCountRepairAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexRustCountRepairAddedPaths].sort());

const draft = await readFile(
	checkedRecordValueIndexRustCountRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-rust-count-repair-v1");
	assert.equal(draft.previousCommit
		, checkedRecordValueIndexRustCountRepairPreviousCommit);
	assert.equal(draft.currentCommit
		, checkedRecordValueIndexRustCountRepairCurrentCommit);
	assert.equal(draft.registrationParent
		, checkedRecordValueIndexRustCountRepairRegistrationParent);
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-rust-count-history-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
		assert.ok(result.length > 0);
		return result;
	};
	const updates = [];
	for(const path of checkedRecordValueIndexRustCountRepairChangedPaths)
	{
		const historical = checkedRecordValueIndexRustCountRepairHistoricalPaths
			.includes(path);
		const previous = historical
			? git(["show"
				, `${checkedRecordValueIndexRustCountRepairPreviousCommit}:${path}`])
			: git(["show"
				, `${checkedRecordValueIndexRustCountRepairRegistrationParent}:${path}`]);
		const current = historical
			? git(["show"
				, `${checkedRecordValueIndexRustCountRepairCurrentCommit}:${path}`])
			: await readFile(path, "utf8");
		assert.notEqual(current, previous, path);
		const update = {
			path, kind: historical ? "historical" : "registration"
			, previousSha256: sha256(previous)
			, currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		assert.equal(reverseCheckedRecordValueIndexRustCountRepairUpdate(
			current, update), previous, path);
		updates.push(update);
	}
	const additions = [];
	for(const path of checkedRecordValueIndexRustCountRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRustCountRepairRegistrationParent}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(checkedRecordValueIndexRustCountRepairHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-rust-count-repair-v1"
			, previousCommit: checkedRecordValueIndexRustCountRepairPreviousCommit
			, currentCommit: checkedRecordValueIndexRustCountRepairCurrentCommit
			, registrationParent: checkedRecordValueIndexRustCountRepairRegistrationParent
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexRustCountRepairChangedPaths))
			, additions, updates
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} Rust count-repair transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
