#!/usr/bin/env node
/**
 * Record the current-source type-surface pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	reverseTypeSurfaceCurrentPinRepairUpdate
	, typeSurfaceCurrentPinRepairAddedPaths
	, typeSurfaceCurrentPinRepairChangedPaths
	, typeSurfaceCurrentPinRepairFinalizationPredecessor
	, typeSurfaceCurrentPinRepairHistoryPath
	, typeSurfaceCurrentPinRepairImplementation
	, typeSurfaceCurrentPinRepairIntegrationBase
	, typeSurfaceCurrentPinRepairIntegrationPaths
	, typeSurfaceCurrentPinRepairLivePins
	, typeSurfaceCurrentPinRepairPinTransitions
	, typeSurfaceCurrentPinRepairPredecessor
} from "../tests/helpers/type-surface-current-pin-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = typeSurfaceCurrentPinRepairPredecessor;
const implementation = typeSurfaceCurrentPinRepairImplementation;
const integrationBase = typeSurfaceCurrentPinRepairIntegrationBase;
const finalizationPredecessor
	= typeSurfaceCurrentPinRepairFinalizationPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Current type-surface pin history requires its exact integration base");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...typeSurfaceCurrentPinRepairChangedPaths].sort());
assert.equal(git(["rev-parse", "HEAD^"]).trim(), finalizationPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, finalizationPredecessor, integrationBase])
, [...typeSurfaceCurrentPinRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, typeSurfaceCurrentPinRepairHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...typeSurfaceCurrentPinRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...typeSurfaceCurrentPinRepairAddedPaths])
, [...typeSurfaceCurrentPinRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
for(const pin of typeSurfaceCurrentPinRepairLivePins)
{
	const matches = inventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === pin.path);
	assert.equal(matches.length, pin.count, pin.path);
	assert.ok(matches.every(file => file.sha256 === pin.currentSha256)
		, pin.path);
	assert.equal(sha256(await readFile(pin.path)), pin.currentSha256, pin.path);
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-type-surface-current-pin-repair-history-"
));
const transition = async (path, previous, current) => {
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
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseTypeSurfaceCurrentPinRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const path = typeSurfaceCurrentPinRepairChangedPaths[0];
	const updates = [
		await transition(path
			, git(["show", `${finalizationPredecessor}:${path}`])
			, git(["show", `${integrationBase}:${path}`]))
		, await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`]))
	];
	const integrationUpdates = [];
	for(const path of typeSurfaceCurrentPinRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of typeSurfaceCurrentPinRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", integrationBase, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(typeSurfaceCurrentPinRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "type-surface-current-pin-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, integrationBaseCommit: integrationBase
			, finalizationPredecessorCommit: finalizationPredecessor
			, scope: "Refresh all 125 stale current-source evidence pins across eight paths, including the component-root registration in two stages; bind the earlier owned-Subtype test-profile assertion to its authenticated milestone without changing support claims or archived evidence identities."
			, livePins: typeSurfaceCurrentPinRepairLivePins
			, pinTransitions: typeSurfaceCurrentPinRepairPinTransitions
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration and `
		+ `${typeSurfaceCurrentPinRepairPinTransitions.reduce((sum, pin) => sum + pin.count, 0)} staged pin updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
