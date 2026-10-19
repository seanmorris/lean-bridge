#!/usr/bin/env node
/**
 * Record the value-index Perl Core registration's historical profile update
 * and repair only live pins whose source bytes changed with that registration.
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
	reverseCheckedRecordValueIndexPerlHistoricalUpdate
	, reverseCheckedRecordValueIndexPerlUpdate
	, checkedRecordValueIndexPerlAddedPaths
	, checkedRecordValueIndexPerlChangedPaths
	, checkedRecordValueIndexPerlDraftParent
	, checkedRecordValueIndexPerlHistoryPath
	, checkedRecordValueIndexPerlPredecessor
} from "../tests/helpers/checked-record-value-index-perl-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const profilePath = "src/adoption/test-profiles.mjs";
const profileTransition = Object.freeze({
	path: profilePath
	, previousCommit: "4acb5bec4645eef3dc8161a304a140ff72b13a53"
	, currentCommit: "b6871a34c652ec846fbd05d04db2fbe99031a676"
});
const implementationPaths = checkedRecordValueIndexPerlChangedPaths.filter(
	path => path !== inventoryPath
);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexPerlDraftParent
	, "Value-index Perl source history must stay on its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, checkedRecordValueIndexPerlHistoryPath]).trim()
, "Never rewrite a committed value-index Perl source-history ledger");
assert.ok([
	JSON.stringify([...implementationPaths].sort())
	, JSON.stringify([inventoryPath, ...implementationPaths].sort())
].includes(JSON.stringify(git(["diff", "--name-only", "--diff-filter=M"])
	.trim().split("\n").filter(Boolean).sort()))
, "Only the source-history integration and its generated inventory may be modified");
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexPerlAddedPaths]).trim().split("\n")
	.filter(Boolean).sort(), [...checkedRecordValueIndexPerlAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexPerlPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexPerlAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexPerlPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${checkedRecordValueIndexPerlPredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const path of [...implementationPaths, profilePath])
{
	const previous = path === profilePath ? git(["show"
		, `${profileTransition.previousCommit}:${path}`]) : sources.get(path).previous;
	const current = path === profilePath ? git(["show"
		, `${profileTransition.currentCommit}:${path}`]) : sources.get(path).current;
	const previousSha256 = sha256(previous);
	const currentSha256 = sha256(current);
	let count = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	if(count)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.equal(pinCount, 94
	, "Value-index Perl registration must refresh exactly 94 live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
const inventoryWorktree = await readFile(inventoryPath, "utf8");
assert.ok(inventoryWorktree === inventoryPrevious
	|| inventoryWorktree === inventoryCurrent
, "Never overwrite an unrecorded type-surface change");
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-perl-history-"
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
				, previousPath, currentPath], { encoding: "utf8"
				, maxBuffer: 256 * 1024 * 1024 });
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
	for(const path of checkedRecordValueIndexPerlChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.ok(update.edits.length > 0, path);
		assert.equal(reverseCheckedRecordValueIndexPerlUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const previous = git(["show"
		, `${profileTransition.previousCommit}:${profilePath}`]);
	const current = git(["show"
		, `${profileTransition.currentCommit}:${profilePath}`]);
	const historicalTransition = {
		...profileTransition, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits: await edits(previous, current)
	};
	assert.ok(historicalTransition.edits.length > 0);
	assert.equal(reverseCheckedRecordValueIndexPerlHistoricalUpdate(
		current, historicalTransition), previous);
	assert.equal(sha256(await readFile(profilePath)), historicalTransition.currentSha256);
	const record = JSON.stringify({
		schemaVersion: 1, milestone: "checked-record-value-index-perl-source-v1"
		, predecessorCommit: checkedRecordValueIndexPerlPredecessor
		, draftParentCommit: checkedRecordValueIndexPerlDraftParent
		, pathsSha256: sha256(JSON.stringify(checkedRecordValueIndexPerlChangedPaths))
		, pinCount, pinUpdates, additions
		, historicalTransitions: [historicalTransition], updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(checkedRecordValueIndexPerlHistoryPath, record, { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} current transitions, one historical transition, ${additions.length} additions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
