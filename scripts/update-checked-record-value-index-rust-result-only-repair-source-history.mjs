#!/usr/bin/env node
/**
 * Record the exact Rust result-only caller warning repair together with its
 * current source-history registration.
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
	checkedRecordValueIndexRustResultOnlyRepairAddedPaths
	, checkedRecordValueIndexRustResultOnlyRepairChangedPaths
	, checkedRecordValueIndexRustResultOnlyRepairCurrentCommit
	, checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths
	, checkedRecordValueIndexRustResultOnlyRepairHistoryPath
	, checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
	, checkedRecordValueIndexRustResultOnlyRepairRegistrationParent
	, reverseCheckedRecordValueIndexRustResultOnlyRepairUpdate
} from "../tests/helpers/checked-record-value-index-rust-result-only-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexRustResultOnlyRepairRegistrationParent
	, "Rust result-only repair history must stay on its exact registration parent");
assert.equal(
	git(["rev-parse"
		, `${checkedRecordValueIndexRustResultOnlyRepairCurrentCommit}^`]).trim()
	, checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
	, "Rust result-only repair must keep its exact predecessor"
);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexRustResultOnlyRepairRegistrationParent}:${checkedRecordValueIndexRustResultOnlyRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed Rust result-only repair history");
assert.deepEqual(
	git(["diff", "--name-only"
		, checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
		, checkedRecordValueIndexRustResultOnlyRepairCurrentCommit])
		.trim().split("\n").filter(Boolean).sort()
	, [...checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths].sort()
);
assert.deepEqual(
	git(["ls-files", "--others", "--exclude-standard", "--"
		, ...checkedRecordValueIndexRustResultOnlyRepairAddedPaths])
		.trim().split("\n").filter(Boolean).sort()
	, [...checkedRecordValueIndexRustResultOnlyRepairAddedPaths].sort()
);
const draft = await readFile(
	checkedRecordValueIndexRustResultOnlyRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-rust-result-only-repair-v1");
	assert.equal(draft.currentCommit
		, checkedRecordValueIndexRustResultOnlyRepairCurrentCommit);
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-rust-result-only-history-"
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
	for(const path of checkedRecordValueIndexRustResultOnlyRepairChangedPaths)
	{
		const historical
			= checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths
				.includes(path);
		const previousCommit = historical
			? checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
			: checkedRecordValueIndexRustResultOnlyRepairRegistrationParent;
		const previous = git(["show", `${previousCommit}:${path}`]);
		const current = historical
			? git(["show"
				, `${checkedRecordValueIndexRustResultOnlyRepairCurrentCommit}:${path}`])
			: await readFile(path, "utf8");
		const update = {
			path, kind: historical ? "historical" : "registration"
			, previousSha256: sha256(previous), currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		assert.equal(reverseCheckedRecordValueIndexRustResultOnlyRepairUpdate(
			current, update), previous, path);
		updates.push(update);
	}
	const additions = [];
	for(const path of checkedRecordValueIndexRustResultOnlyRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRustResultOnlyRepairRegistrationParent}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(checkedRecordValueIndexRustResultOnlyRepairHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-rust-result-only-repair-v1"
			, previousCommit: checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
			, currentCommit: checkedRecordValueIndexRustResultOnlyRepairCurrentCommit
			, registrationParent: checkedRecordValueIndexRustResultOnlyRepairRegistrationParent
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexRustResultOnlyRepairChangedPaths))
			, additions, updates
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} Rust result-only repair transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
