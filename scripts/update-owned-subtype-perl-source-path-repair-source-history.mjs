#!/usr/bin/env node
/**
 * Record the exact owned-Subtype Perl archive source-path repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reconcileDependentCheckedRecordSourcePins } from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	ownedSubtypePerlSourcePathRepairHistoryAddedPaths
	, ownedSubtypePerlSourcePathRepairHistoryPath
	, ownedSubtypePerlSourcePathRepairImplementation
	, ownedSubtypePerlSourcePathRepairIntegrationPaths
	, ownedSubtypePerlSourcePathRepairModifiedPaths
	, ownedSubtypePerlSourcePathRepairPredecessor
	, reverseOwnedSubtypePerlSourcePathRepairUpdate
} from "../tests/helpers/owned-subtype-perl-source-path-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation = ownedSubtypePerlSourcePathRepairImplementation;
const predecessor = ownedSubtypePerlSourcePathRepairPredecessor;
const inventoryPath = "docs/type-surface.v1.json";
const hubPaths = ownedSubtypePerlSourcePathRepairIntegrationPaths
	.filter(path => path !== inventoryPath);

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Owned Subtype Perl path history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "Owned Subtype Perl path history requires its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${ownedSubtypePerlSourcePathRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed repair history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedSubtypePerlSourcePathRepairModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...ownedSubtypePerlSourcePathRepairModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hubPaths].sort());

const inventory = JSON.parse(source(implementation, inventoryPath));
const liveDigests = new Map();
for(const path of ownedSubtypePerlSourcePathRepairModifiedPaths)
	liveDigests.set(path, sha256(source(implementation, path)));
for(const path of hubPaths)
	liveDigests.set(path, sha256(await readFile(path)));
const pinned = reconcileDependentCheckedRecordSourcePins(inventory, liveDigests);
assert.ok(pinned.refreshed > 0, "Repair must refresh existing live pins");
await writeFile(inventoryPath
	, JSON.stringify(pinned.inventory, null, 2) + "\n");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedSubtypePerlSourcePathRepairIntegrationPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-subtype-perl-path-history-"));
const transition = async (path, previous, current) => {
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
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseOwnedSubtypePerlSourcePathRepairUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypePerlSourcePathRepairModifiedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const integrationUpdates = [];
	for(const path of ownedSubtypePerlSourcePathRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(implementation, path), await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypePerlSourcePathRepairHistoryAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypePerlSourcePathRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-subtype-perl-source-path-repair-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Correct the frozen owned-Subtype Perl consumer path to the actual committed installed fixture and require every declared archive source role to exist in Git."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions; refreshed `
		+ `${pinned.refreshed} live source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
