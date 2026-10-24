#!/usr/bin/env node
/**
 * Record both parents of the historical Core evidence repair integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	coreEvidenceRepairIntegrationAddedPaths
	, coreEvidenceRepairIntegrationChangedPaths
	, coreEvidenceRepairIntegrationCommit
	, coreEvidenceRepairIntegrationHistoryPath
	, coreEvidenceRepairIntegrationLeftParent
	, coreEvidenceRepairIntegrationRetainedHistoryPath
	, coreEvidenceRepairIntegrationRetainedPaths
	, coreEvidenceRepairIntegrationRightParent
	, reverseCoreEvidenceRepairIntegrationUpdate
} from "../tests/helpers/core-evidence-repair-integration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreEvidenceRepairIntegrationCommit
	, "Core evidence repair history requires its exact integration commit");
assert.deepEqual(git(["show", "-s", "--format=%P", "HEAD"])
	.trim().split(" "), [
	coreEvidenceRepairIntegrationLeftParent
	, coreEvidenceRepairIntegrationRightParent
	]
);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreEvidenceRepairIntegrationHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
	, [
		"tests/checked-javascript.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreEvidenceRepairIntegrationAddedPaths])
, [...coreEvidenceRepairIntegrationAddedPaths].sort());

assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreEvidenceRepairIntegrationLeftParent
	, coreEvidenceRepairIntegrationRightParent])
, [...coreEvidenceRepairIntegrationChangedPaths
	, ...coreEvidenceRepairIntegrationRetainedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreEvidenceRepairIntegrationLeftParent
	, coreEvidenceRepairIntegrationCommit])
, [...coreEvidenceRepairIntegrationChangedPaths].sort());
for(const path of coreEvidenceRepairIntegrationRetainedPaths)
{
	const leftBlob = git(["rev-parse"
		, `${coreEvidenceRepairIntegrationLeftParent}:${path}`]).trim();
	assert.equal(git(["rev-parse"
		, `${coreEvidenceRepairIntegrationCommit}:${path}`]).trim(), leftBlob, path);
	// Git hashes the unchanged file incrementally without loading it into V8.
	assert.equal(git(["hash-object", "--", path]).trim(), leftBlob, path);
}
const retainedHistory = await readFile(
	coreEvidenceRepairIntegrationRetainedHistoryPath, "utf8"
);
assert.equal(retainedHistory, git(["show"
	, `${coreEvidenceRepairIntegrationLeftParent}:${coreEvidenceRepairIntegrationRetainedHistoryPath}`]));

const fork = git(["merge-base"
	, coreEvidenceRepairIntegrationLeftParent
	, coreEvidenceRepairIntegrationRightParent]).trim();
const rightHistoryRecords = names(["diff", "--name-only", "--diff-filter=A"
	, fork, coreEvidenceRepairIntegrationRightParent, "--", "docs/evidence"])
	.filter(path => /^docs\/evidence\/[^/]*history[^/]*\.json$/u.test(path));
assert.ok(rightHistoryRecords.length > 0);

const rightExpected = path => {
	const result = new Set([sha256(git(["show"
		, `${coreEvidenceRepairIntegrationRightParent}:${path}`]))]);
	const collect = value => {
		if(!value || typeof value !== "object") return;
		if(value.path === path)
			for(const key of ["currentSha256", "previousSha256"])
				if(typeof value[key] === "string"
					&& /^[a-f0-9]{64}$/u.test(value[key])) result.add(value[key]);
		for(const child of Object.values(value)) collect(child);
	};
	for(const historyPath of rightHistoryRecords)
	{
		let value;
		try
		{
			value = JSON.parse(git(["show"
				, `${coreEvidenceRepairIntegrationRightParent}:${historyPath}`]));
		}
		catch(error)
		{
			if(error instanceof SyntaxError) continue;
			throw error;
		}
		collect(value);
	}
	return [...result].sort();
};

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-evidence-repair-integration-"
));
// Retain only requested hunk boundaries, not millions of per-line strings.
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			line++;
		}
		result.set(boundary, offset);
	}
	return result;
};

const edits = async (previous, current) => {
	if(previous === current) return [];
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount
		};
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(hunk =>
		[hunk.previousStart, hunk.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(hunk =>
		[hunk.currentStart, hunk.currentEnd]));
	const result = hunks.map(hunk => ({
		start: currentOffsets.get(hunk.currentStart)
		, previous: previous.slice(previousOffsets.get(hunk.previousStart)
			, previousOffsets.get(hunk.previousEnd))
		, current: current.slice(currentOffsets.get(hunk.currentStart)
			, currentOffsets.get(hunk.currentEnd))
	}));
	assert.ok(result.length > 0);
	return result;
};

try
{
	const updates = [];
	for(const path of coreEvidenceRepairIntegrationChangedPaths)
	{
		const current = await readFile(path, "utf8");
		const left = git(["show"
			, `${coreEvidenceRepairIntegrationLeftParent}:${path}`]);
		const right = git(["show"
			, `${coreEvidenceRepairIntegrationRightParent}:${path}`]);
		const update = {
			path, currentSha256: sha256(current)
			, left: {
				previousSha256: sha256(left), edits: await edits(left, current)
			}
			, right: {
				previousSha256: sha256(right), edits: await edits(right, current)
			}
			, rightExpectedSha256: rightExpected(path)
		};
		assert.equal(reverseCoreEvidenceRepairIntegrationUpdate(
			current, update, "left"), left, path);
		assert.equal(reverseCoreEvidenceRepairIntegrationUpdate(
			current, update, "right"), right, path);
		assert.ok(update.rightExpectedSha256.includes(sha256(right)));
		updates.push(update);
	}
	const additions = [];
	for(const path of coreEvidenceRepairIntegrationAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${coreEvidenceRepairIntegrationCommit}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreEvidenceRepairIntegrationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "core-evidence-repair-integration-source-v1"
			, integrationCommit: coreEvidenceRepairIntegrationCommit
			, parents: [
				coreEvidenceRepairIntegrationLeftParent
				, coreEvidenceRepairIntegrationRightParent
			]
			, forkCommit: fork, rightHistoryRecords
			, retainedPaths: coreEvidenceRepairIntegrationRetainedPaths
			, retainedHistory: {
				path: coreEvidenceRepairIntegrationRetainedHistoryPath
				, sha256: sha256(retainedHistory)
			}
			, scope: "Preserve both exact parents while combining the six missing WIT transfer-copy transitions, explicit digest stops, historical addition checks and producer-bound .NET/process/host generators with the reviewed author documentation. Right-parent-only milestone digests select that branch; shared ancestry follows the documentation parent. Archived evidence and support observations remain unchanged. Runtime acceptance requires hosted validation."
			, additions, updates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} two-parent transitions, `
		+ `${additions.length} additions and ${rightHistoryRecords.length} right-parent histories.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
