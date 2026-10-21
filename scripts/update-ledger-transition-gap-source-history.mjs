#!/usr/bin/env node
/**
 * Record every omitted history-hub transition for the ledgered paths whose
 * newest states no record names, reconstructed from exact Git blobs back to
 * the newest state another ledger already records, then refresh only the live
 * pointers this repair itself changes.
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
	ledgerTransitionGapAddedPaths
	, ledgerTransitionGapChangedPaths
	, ledgerTransitionGapHistoricalPaths
	, ledgerTransitionGapHistoryPath
	, ledgerTransitionGapAnchors
	, ledgerTransitionGapPredecessor
	, reverseLedgerTransitionGapHistoricalUpdate
	, reverseLedgerTransitionGapUpdate
} from "../tests/helpers/ledger-transition-gap-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

assert.equal(git(["rev-parse", "HEAD"]).trim(), ledgerTransitionGapPredecessor
	, "ledger transition-gap history must stay on its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, ledgerTransitionGapHistoryPath]).trim()
, "Never rewrite a committed ledger transition-gap record");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ledgerTransitionGapAddedPaths]), [...ledgerTransitionGapAddedPaths].sort());

/**
 * Walk one path's commits newest-first down to its pinned anchor, the newest
 * state the other ledgers still reach; every newer blob pair is an omitted
 * transition this repair records.
 *
 * @param path - Repository-relative ledgered source path.
 */
const omittedMilestones = path => {
	const anchor = ledgerTransitionGapAnchors[path];
	assert.match(anchor ?? "", /^[a-f0-9]{40}$/u, path);
	const commits = git(["log", "--format=%H", "HEAD", "--", path]).trim()
		.split("\n").filter(Boolean);
	const states = [];
	for(const commit of commits)
	{
		states.push({ commit, digest: sha256(git(["show", `${commit}:${path}`])) });
		if(commit === anchor) break;
	}
	assert.equal(states.at(-1)?.commit, anchor, `${path} reaches its anchor commit`);
	assert.ok(states.length >= 2, `${path} has an omitted transition`);
	const milestones = [];
	for(let index = 0; index < states.length - 1; index++)
	{
		if(states[index].digest === states[index + 1].digest) continue;
		milestones.push({ path, previousCommit: states[index + 1].commit
			, currentCommit: states[index].commit });
	}
	assert.ok(milestones.length > 0, path);
	return milestones;
};

const historicalMilestones = ledgerTransitionGapHistoricalPaths
	.flatMap(omittedMilestones);

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const pinUpdates = [];
let pinCount = 0;
const refreshPins = async path => {
	const previous = git(["show", `${ledgerTransitionGapPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	let count = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(file.path === path && file.sha256 === sha256(previous))
		{
			file.sha256 = sha256(current);
			count++;
		}
	if(count === 0) return;
	pinUpdates.push({ path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), count });
	pinCount += count;
};
for(const path of ledgerTransitionGapChangedPaths)
	if(path !== inventoryPath) await refreshPins(path);
assert.ok(pinCount > 0, "transition-gap repair refreshes its own stale pins");
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"])
	, [...ledgerTransitionGapChangedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-ledger-transition-gap-history-"
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
			, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		return [...diff.matchAll(
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
	};
	const updates = [];
	for(const path of ledgerTransitionGapChangedPaths)
	{
		const previous = git(["show", `${ledgerTransitionGapPredecessor}:${path}`]);
		const current = await readFile(path, "utf8");
		assert.notEqual(current, previous, path);
		const update = { path, previousSha256: sha256(previous)
			, currentSha256: sha256(current), edits: await edits(previous, current) };
		assert.ok(update.edits.length > 0, path);
		assert.equal(reverseLedgerTransitionGapUpdate(current, update), previous, path);
		updates.push(update);
	}
	const historicalTransitions = [];
	for(const item of historicalMilestones)
	{
		const previous = git(["show", `${item.previousCommit}:${item.path}`]);
		const current = git(["show", `${item.currentCommit}:${item.path}`]);
		const transition = { ...item, previousSha256: sha256(previous)
			, currentSha256: sha256(current), edits: await edits(previous, current) };
		assert.ok(transition.edits.length > 0, item.currentCommit);
		assert.equal(reverseLedgerTransitionGapHistoricalUpdate(current, transition)
			, previous, item.currentCommit);
		historicalTransitions.push(transition);
	}
	const grouped = Map.groupBy(historicalTransitions, item => item.path);
	for(const [path, transitions] of grouped)
	{
		assert.equal(transitions[0].currentSha256
			, sha256(git(["show", `${ledgerTransitionGapPredecessor}:${path}`])), path);
		for(let index = 0; index < transitions.length - 1; index++)
			assert.equal(transitions[index].previousSha256
				, transitions[index + 1].currentSha256, path);
	}
	const additions = [];
	for(const path of ledgerTransitionGapAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${ledgerTransitionGapPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ledgerTransitionGapHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "ledger-transition-gap-source-v1"
		, predecessorCommit: ledgerTransitionGapPredecessor
		, pathsSha256: sha256(JSON.stringify(ledgerTransitionGapChangedPaths))
		, historicalPathsSha256: sha256(JSON.stringify(ledgerTransitionGapHistoricalPaths))
		, pinCount, pinUpdates, additions, historicalTransitions, updates
	}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${historicalTransitions.length} omitted transitions, ${updates.length} source transitions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
