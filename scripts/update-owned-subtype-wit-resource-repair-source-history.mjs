#!/usr/bin/env node
/**
 * Record the exact owned-Subtype WIT resource-name assertion repair.
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
	ownedSubtypeWitResourceRepairAddedPaths
	, ownedSubtypeWitResourceRepairHistoryPath
	, ownedSubtypeWitResourceRepairImplementation
	, ownedSubtypeWitResourceRepairImplementationPaths
	, ownedSubtypeWitResourceRepairIntegrationPaths
	, ownedSubtypeWitResourceRepairPredecessor
	, reverseOwnedSubtypeWitResourceRepairUpdate
} from "../tests/helpers/owned-subtype-wit-resource-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypeWitResourceRepairImplementation
	, "Owned Subtype WIT resource history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, ownedSubtypeWitResourceRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypeWitResourceRepairPredecessor
	, ownedSubtypeWitResourceRepairImplementation]).trim().split("\n").sort()
, [...ownedSubtypeWitResourceRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypeWitResourceRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-wit-resource-history-"));
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
	const edits = [...diff.matchAll(
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
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseOwnedSubtypeWitResourceRepairUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypeWitResourceRepairImplementationPaths)
		updates.push(await transition(path
			, git(["show", `${ownedSubtypeWitResourceRepairPredecessor}:${path}`])
			, git(["show", `${ownedSubtypeWitResourceRepairImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedSubtypeWitResourceRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show"
				, `${ownedSubtypeWitResourceRepairImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypeWitResourceRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeWitResourceRepairPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypeWitResourceRepairHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "owned-subtype-wit-resource-repair-v1"
		, predecessorCommit: ownedSubtypeWitResourceRepairPredecessor
		, implementationCommit: ownedSubtypeWitResourceRepairImplementation
		, scope: "Require the exact identity-ticket resource emitted by the installed owned-Subtype WIT component on both author routes without weakening component validation or the public C consumer contract."
		, updates, additions, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
