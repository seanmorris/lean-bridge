#!/usr/bin/env node
/**
 * Record the owned-Subtype test-profile live-pin repair.
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
	ownedSubtypeTestProfilePinRepairAddedPaths
	, ownedSubtypeTestProfilePinRepairCurrentSha256
	, ownedSubtypeTestProfilePinRepairHistoryPath
	, ownedSubtypeTestProfilePinRepairImplementation
	, ownedSubtypeTestProfilePinRepairImplementationPaths
	, ownedSubtypeTestProfilePinRepairIntegrationPaths
	, ownedSubtypeTestProfilePinRepairPin
	, ownedSubtypeTestProfilePinRepairPredecessor
	, ownedSubtypeTestProfilePinRepairPreviousSha256
	, reverseOwnedSubtypeTestProfilePinRepairUpdate
} from "../tests/helpers/owned-subtype-test-profile-pin-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const implementation = ownedSubtypeTestProfilePinRepairImplementation;
const predecessor = ownedSubtypeTestProfilePinRepairPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "This history requires its exact predecessor");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedSubtypeTestProfilePinRepairImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${ownedSubtypeTestProfilePinRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedSubtypeTestProfilePinRepairIntegrationPaths].sort());
assert.equal(sha256(await readFile(ownedSubtypeTestProfilePinRepairPin.path))
	, ownedSubtypeTestProfilePinRepairCurrentSha256);

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-test-profile-pin-history-"));
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
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const result = [...diff.matchAll(
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
	assert.ok(result.length > 0);
	return result;
};

try
{
	const inventoryPath = ownedSubtypeTestProfilePinRepairImplementationPaths[0];
	const previousInventory = git(["show", `${predecessor}:${inventoryPath}`]);
	const currentInventory = git(["show", `${implementation}:${inventoryPath}`]);
	const update = {
		path: inventoryPath
		, previousSha256: sha256(previousInventory)
		, currentSha256: sha256(currentInventory)
		, replacements: [{
			previous: ownedSubtypeTestProfilePinRepairPreviousSha256
			, current: ownedSubtypeTestProfilePinRepairCurrentSha256
			, count: ownedSubtypeTestProfilePinRepairPin.count
		}]
	};
	assert.equal(reverseOwnedSubtypeTestProfilePinRepairUpdate(
		currentInventory, update), previousInventory);
	const integrationUpdates = [];
	for(const path of ownedSubtypeTestProfilePinRepairIntegrationPaths)
	{
		const previous = git(["show", `${implementation}:${path}`]);
		const current = await readFile(path, "utf8");
		const integration = {
			path, previousSha256: sha256(previous)
			, currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		assert.equal(reverseOwnedSubtypeTestProfilePinRepairUpdate(
			current, integration), previous, path);
		integrationUpdates.push(integration);
	}
	const additions = [];
	for(const path of ownedSubtypeTestProfilePinRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypeTestProfilePinRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-subtype-test-profile-pin-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Refresh all 98 live type-surface references to the registered owned-Subtype test profile without changing support claims."
		, pinCount: ownedSubtypeTestProfilePinRepairPin.count
		, pin: ownedSubtypeTestProfilePinRepairPin
		, additions
		, updates: [update]
		, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write("Recorded one implementation transition, two integration transitions and 98 exact live pins.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
