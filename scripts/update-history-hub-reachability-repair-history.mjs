#!/usr/bin/env node
/**
 * Record the exact history-hub reachability and output-proof repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCopiedPerlGraphXs } from "../src/backends/perl/copied-graph-xs.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import {
	historyHubReachabilityRepairAddedPaths
	, historyHubReachabilityRepairChangedPaths
	, historyHubReachabilityRepairDraftParent
	, historyHubReachabilityRepairHistoryPath
	, historyHubReachabilityRepairPredecessor
	, reverseHistoryHubReachabilityRepairUpdate
} from "../tests/helpers/history-hub-reachability-repair-source-history.mjs";
import { nativeRecursiveReviewedIr } from "../tests/helpers/native-recursive-reviewed.mjs";
import {
	perlRecursiveConversionOutputHistoryPath
} from "../tests/helpers/perl-recursive-conversion-output-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, historyHubReachabilityRepairDraftParent
	, "History-hub reachability repair must stay on its exact draft parent");
assert.equal(historyHubReachabilityRepairPredecessor
	, historyHubReachabilityRepairDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, historyHubReachabilityRepairDraftParent, "--"
	, historyHubReachabilityRepairHistoryPath]).trim(), ""
, "Never rewrite committed history-hub reachability evidence");
const draft = await readFile(
	historyHubReachabilityRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "history-hub-reachability-repair-source-v1");
	assert.equal(draft.predecessorCommit
		, historyHubReachabilityRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, historyHubReachabilityRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, historyHubReachabilityRepairPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...historyHubReachabilityRepairChangedPaths].sort());

const sources = new Map();
for(const path of historyHubReachabilityRepairChangedPaths)
{
	const previous = git(["show"
		, `${historyHubReachabilityRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of historyHubReachabilityRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${historyHubReachabilityRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const outputHistoryBytes = await readFile(
	perlRecursiveConversionOutputHistoryPath);
const outputHistory = JSON.parse(outputHistoryBytes);
const receiptPath = outputHistory.outputTransition.receiptPath;
const receiptBytes = await readFile(receiptPath);
const ir = nativeRecursiveReviewedIr();
ir.declarations.sort((left, right) => left.id < right.id
	? -1 : left.id > right.id ? 1 : 0);
const compiled = generateCopiedPerlGraphXs(ir, "LeanBridge::Recursive");
const currentSourceSha256 = sha256(compiled.source);
const previousSourceSha256
	= outputHistory.outputTransition.previousSourceSha256;
assert.equal(currentSourceSha256
	, outputHistory.outputTransition.currentSourceSha256);
const outputEdit = { start: 119125, previous: "", current: "\n" };
assert.equal(compiled.source.slice(outputEdit.start
	, outputEdit.start + outputEdit.current.length), outputEdit.current);
const historicalSource = compiled.source.slice(0, outputEdit.start)
	+ outputEdit.previous
	+ compiled.source.slice(outputEdit.start + outputEdit.current.length);
assert.equal(sha256(historicalSource), previousSourceSha256);
const perlOutputEdit = {
	historyPath: perlRecursiveConversionOutputHistoryPath
	, historySha256: sha256(outputHistoryBytes)
	, receiptPath, receiptSha256: sha256(receiptBytes)
	, previousSourceSha256, currentSourceSha256, edits: [outputEdit]
};

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-history-hub-reachability-"
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
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
	for(const path of historyHubReachabilityRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseHistoryHubReachabilityRepairUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "history-hub-reachability-repair-source-v1"
		, predecessorCommit: historyHubReachabilityRepairPredecessor
		, draftParentCommit: historyHubReachabilityRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			historyHubReachabilityRepairChangedPaths))
		, pinCount: 0, pinUpdates: [], perlOutputEdit, additions, updates
	}, null, 2) + "\n";
	await writeFile(historyHubReachabilityRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} history-hub reachability transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
